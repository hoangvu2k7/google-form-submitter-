const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateSmartResponse } = require('./smart-generator');
const { parseGoogleForm } = require('./parser');
const { submitForm, clearEndpointCache, getConfig } = require('./submitter');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Quản lý các phiên chạy độc lập cho từng người dùng (Multi-User Jobs)
const jobs = new Map();
// Quản lý kết nối SSE theo jobId: Map<jobId, Set<Response>>
const sseClients = new Map();

function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function broadcastToJob(jobId, eventType, data) {
  const clients = sseClients.get(jobId);
  if (!clients) return;
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (e) {
      clients.delete(res);
    }
  }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function runJobWorker(job) {
  while (job.isRunning && job.currentCount < job.targetCount) {
    if (job.workerAbort) {
      break;
    }

    if (job.isPaused) {
      await sleep(300);
      continue;
    }

    job.currentCount++;
    const itemIndex = job.currentCount;
    const { payload, summary } = generateSmartResponse(job.formConfig, job.mode);

    const submitResult = await submitForm(payload, job.formConfig);

    if (submitResult.success) {
      job.successCount++;
    } else {
      job.failCount++;
    }

    const logEntry = {
      id: itemIndex,
      time: new Date().toLocaleTimeString('vi-VN'),
      success: submitResult.success,
      durationMs: submitResult.durationMs,
      error: submitResult.error,
      summary: summary
    };

    job.logs.unshift(logEntry);
    if (job.logs.length > 200) {
      job.logs.pop();
    }

    broadcastToJob(job.jobId, 'progress', {
      jobId: job.jobId,
      currentCount: job.currentCount,
      targetCount: job.targetCount,
      successCount: job.successCount,
      failCount: job.failCount,
      latestLog: logEntry
    });

    if (job.currentCount >= job.targetCount) {
      break;
    }

    // Thời gian nghỉ ngẫu nhiên mô phỏng người thật
    const actualDelay = Math.floor(
      job.delayMin + Math.random() * (job.delayMax - job.delayMin)
    );
    await sleep(actualDelay);
  }

  job.isRunning = false;
  job.isPaused = false;
  broadcastToJob(job.jobId, 'status', getJobStatus(job));
}

function getJobStatus(job) {
  if (!job) return null;
  return {
    jobId: job.jobId,
    isRunning: job.isRunning,
    isPaused: job.isPaused,
    targetCount: job.targetCount,
    currentCount: job.currentCount,
    successCount: job.successCount,
    failCount: job.failCount,
    mode: job.mode,
    delayMin: job.delayMin,
    delayMax: job.delayMax,
    startTime: job.startTime,
    formUrl: job.formConfig ? job.formConfig.formUrl : null,
    formTitle: job.formConfig ? job.formConfig.title : null,
    formDesc: job.formConfig ? job.formConfig.desc : null,
    totalQuestions: job.formConfig && job.formConfig.questions ? job.formConfig.questions.length : 0,
    questions: job.formConfig ? job.formConfig.questions : [],
    logs: job.logs.slice(0, 50)
  };
}

function getDefaultStatus() {
  const currentConfig = getConfig();
  return {
    jobId: null,
    isRunning: false,
    isPaused: false,
    targetCount: 0,
    currentCount: 0,
    successCount: 0,
    failCount: 0,
    mode: 'smart',
    delayMin: 800,
    delayMax: 1500,
    startTime: null,
    formUrl: currentConfig.formUrl,
    formTitle: currentConfig.title,
    formDesc: currentConfig.desc,
    totalQuestions: (currentConfig.questions || []).length,
    questions: currentConfig.questions || [],
    logs: []
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // SSE Stream hỗ trợ phân tách theo jobId
  if (pathname === '/api/stream') {
    const jobId = parsedUrl.searchParams.get('jobId');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    if (jobId && jobs.has(jobId)) {
      if (!sseClients.has(jobId)) {
        sseClients.set(jobId, new Set());
      }
      sseClients.get(jobId).add(res);
      res.write(`event: init\ndata: ${JSON.stringify(getJobStatus(jobs.get(jobId)))}\n\n`);
    } else {
      res.write(`event: init\ndata: ${JSON.stringify(getDefaultStatus())}\n\n`);
    }

    req.on('close', () => {
      if (jobId && sseClients.has(jobId)) {
        sseClients.get(jobId).delete(res);
      }
    });
    return;
  }

  // API Lấy trạng thái mặc định hoặc theo jobId
  if (req.method === 'GET' && pathname === '/api/status') {
    const jobId = parsedUrl.searchParams.get('jobId');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (jobId && jobs.has(jobId)) {
      return res.end(JSON.stringify(getJobStatus(jobs.get(jobId))));
    }
    return res.end(JSON.stringify(getDefaultStatus()));
  }

  // API Quét và phân tích biểu mẫu Google Form bất kỳ
  if (req.method === 'POST' && pathname === '/api/analyze-form') {
    const data = await parseJsonBody(req);
    if (!data.url || !data.url.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Vui lòng nhập đường link Google Form!' }));
    }

    try {
      console.log(`[Server] Đang phân tích biểu mẫu: ${data.url}`);
      const parsed = await parseGoogleForm(data.url);
      
      // Lưu lại làm form mặc định
      try {
        const configPath = path.join(__dirname, 'form-config.json');
        fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
        clearEndpointCache();
      } catch (e) {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        message: `Phân tích thành công! Đã phát hiện ${parsed.questions.length} câu hỏi.`,
        form: parsed
      }));
    } catch (err) {
      console.error(`[Server] Lỗi phân tích form:`, err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // API Bắt đầu gửi phiếu (Hỗ trợ Multi-User với jobId riêng)
  if (req.method === 'POST' && pathname === '/api/start') {
    const data = await parseJsonBody(req);
    const target = parseInt(data.count, 10);
    if (!target || target <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Số lượng phiếu không hợp lệ!' }));
    }

    const formConfig = data.formConfig || getConfig();
    if (!formConfig || !formConfig.questions || formConfig.questions.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Chưa có cấu hình biểu mẫu hợp lệ! Vui lòng quét form trước.' }));
    }

    const jobId = generateJobId();
    const newJob = {
      jobId: jobId,
      formConfig: formConfig,
      targetCount: target,
      currentCount: 0,
      successCount: 0,
      failCount: 0,
      mode: data.mode === 'random' ? 'random' : 'smart',
      delayMin: Math.max(300, parseInt(data.delayMin, 10) || 800),
      delayMax: Math.max(800, parseInt(data.delayMax, 10) || 1500),
      isRunning: true,
      isPaused: false,
      startTime: Date.now(),
      logs: [],
      workerAbort: false
    };

    jobs.set(jobId, newJob);

    // Chạy worker riêng cho job này
    runJobWorker(newJob);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message: 'Bắt đầu gửi phiếu!',
      jobId: jobId,
      status: getJobStatus(newJob)
    }));
  }

  // API Tạm dừng / Tiếp tục theo jobId
  if (req.method === 'POST' && pathname === '/api/pause') {
    const data = await parseJsonBody(req);
    const jobId = data.jobId;
    if (jobId && jobs.has(jobId)) {
      const job = jobs.get(jobId);
      job.isPaused = !job.isPaused;
      broadcastToJob(jobId, 'status', getJobStatus(job));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ isPaused: job.isPaused }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Không tìm thấy tiến trình!' }));
  }

  // API Dừng hẳn theo jobId
  if (req.method === 'POST' && pathname === '/api/stop') {
    const data = await parseJsonBody(req);
    const jobId = data.jobId;
    if (jobId && jobs.has(jobId)) {
      const job = jobs.get(jobId);
      job.workerAbort = true;
      job.isRunning = false;
      job.isPaused = false;
      broadcastToJob(jobId, 'status', getJobStatus(job));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Đã dừng tiến trình!' }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Không tìm thấy tiến trình!' }));
  }

  // Tĩnh (Static Files)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  if (extname === '.js') contentType = 'text/javascript';
  else if (extname === '.css') contentType = 'text/css';
  else if (extname === '.json') contentType = 'application/json';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
      res.end(content);
    }
  });
});

const { exec } = require('child_process');

function startServer(port) {
  const currentConf = getConfig();
  const s = server.listen(port, HOST, () => {
    console.log(`\n========================================================`);
    console.log(`   UNIVERSAL GOOGLE FORM AUTO-SUBMITTER (MULTI-USER)`);
    console.log(`========================================================`);
    console.log(` [OK] May chu dang chay tai: http://localhost:${port}`);
    console.log(` [OK] San sang tren moi giao dien mang (0.0.0.0)`);
    console.log(` [OK] Form mac dinh: ${currentConf ? currentConf.formUrl : 'Chua co'}`);
    console.log(` Nhấn Ctrl + C để dừng công cụ bất cứ lúc nào.`);
    console.log(`========================================================\n`);

    // Chỉ tự động mở trình duyệt nếu đang chạy local trên máy (không phải trên cloud)
    if (!process.env.PORT) {
      const openCmd = process.platform === 'win32' ? `start http://localhost:${port}` : `open http://localhost:${port}`;
      exec(openCmd);
    }
  });

  s.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT) {
      console.log(`Cong ${port} dang ban, tu dong chuyen sang cong ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Loi server:', err);
    }
  });
}

startServer(PORT);
