let currentLogs = [];
let eventSource = null;
let startTime = null;
let currentJobId = null;
let currentFormConfig = null;

function initSSE(jobId = null) {
  if (eventSource) {
    eventSource.close();
  }

  const streamUrl = jobId ? `/api/stream?jobId=${encodeURIComponent(jobId)}` : '/api/stream';
  eventSource = new EventSource(streamUrl);

  eventSource.addEventListener('open', () => {
    document.getElementById('connectionBadge').textContent = '● Đã kết nối';
    document.getElementById('connectionBadge').className = 'badge badge-green';
  });

  eventSource.addEventListener('error', () => {
    document.getElementById('connectionBadge').textContent = '○ Mất kết nối';
    document.getElementById('connectionBadge').className = 'badge badge-red';
  });

  eventSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    updateUIFromStatus(data);
  });

  eventSource.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    updateUIFromStatus(data);
  });

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    handleProgressUpdate(data);
  });
}

function updateUIFromStatus(status) {
  if (!status) return;

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnStop = document.getElementById('btnStop');
  const statusIndicator = document.getElementById('statusIndicator');

  if (status.jobId) {
    currentJobId = status.jobId;
  }

  if (status.isRunning) {
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnStop.disabled = false;
    btnPause.innerHTML = status.isPaused ? '<span>▶</span> Tiếp tục' : '<span>⏸</span> Tạm dừng';
    statusIndicator.innerHTML = status.isPaused ? 
      'Trạng thái: <strong style="color: #f59e0b;">Đang tạm dừng</strong>' : 
      'Trạng thái: <strong style="color: #10b981;">Đang gửi phiếu...</strong>';
  } else {
    btnStart.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled = true;
    btnPause.innerHTML = '<span>⏸</span> Tạm dừng';
    if (status.targetCount > 0 && status.currentCount >= status.targetCount) {
      statusIndicator.innerHTML = 'Trạng thái: <strong style="color: #5746e3;">Đã hoàn tất mục tiêu! 🎉</strong>';
    } else {
      statusIndicator.innerHTML = 'Trạng thái: <strong>Sẵn sàng</strong>';
    }
  }

  // Cập nhật thông tin Form
  if (status.formTitle) {
    document.getElementById('formTitleDisplay').textContent = status.formTitle;
  }
  if (status.formUrl) {
    const linkEl = document.getElementById('targetFormLink');
    if (linkEl) {
      linkEl.href = status.formUrl;
      linkEl.textContent = status.formUrl;
    }
    const inputEl = document.getElementById('formUrlInput');
    if (inputEl && document.activeElement !== inputEl && !inputEl.value) {
      inputEl.value = status.formUrl;
    }
  }

  // Cập nhật số lượng câu hỏi & danh sách xem trước
  if (status.questions && Array.isArray(status.questions)) {
    if (!currentFormConfig) {
      currentFormConfig = {
        formUrl: status.formUrl,
        title: status.formTitle,
        desc: status.formDesc,
        questions: status.questions
      };
    }
    const count = status.questions.length;
    document.getElementById('totalQuestionsBadge').textContent = `${count} Câu hỏi`;
    document.getElementById('detectedCount').textContent = count;
    renderQuestionsPreview(status.questions);
  }

  // Cập nhật số liệu
  updateProgress(status.currentCount || 0, status.targetCount || 0);
  document.getElementById('statSent').textContent = status.currentCount || 0;
  document.getElementById('statSuccess').textContent = status.successCount || 0;
  document.getElementById('statFailed').textContent = status.failCount || 0;

  if (status.startTime) {
    startTime = status.startTime;
  }

  if (status.logs && status.logs.length > 0) {
    currentLogs = status.logs;
    renderLogTable(currentLogs);
  }
}

function handleProgressUpdate(data) {
  updateProgress(data.currentCount, data.targetCount);
  document.getElementById('statSent').textContent = data.currentCount;
  document.getElementById('statSuccess').textContent = data.successCount;
  document.getElementById('statFailed').textContent = data.failCount;

  // Tính tốc độ phiếu/phút
  if (startTime) {
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes > 0) {
      const speed = Math.round(data.currentCount / elapsedMinutes);
      document.getElementById('statSpeed').textContent = speed;
    }
  }

  if (data.latestLog) {
    currentLogs.unshift(data.latestLog);
    if (currentLogs.length > 200) currentLogs.pop();
    renderLogTable(currentLogs);
  }
}

function updateProgress(current, target) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressCount').textContent = `${current} / ${target} phiếu`;
  document.getElementById('progressBarFill').style.width = `${percent}%`;
}

/**
 * Hiển thị xem trước các câu hỏi đã quét được
 */
function renderQuestionsPreview(questions) {
  const container = document.getElementById('questionsPreviewList');
  if (!questions || questions.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Chưa có câu hỏi nào. Hãy dán link và bấm "Quét & Phân tích Form".</p>';
    return;
  }

  const typeLabels = {
    radio: 'Trắc nghiệm (1 đáp án)',
    checkbox: 'Hộp kiểm (Nhiều đáp án)',
    dropdown: 'Menu thả xuống',
    scale: 'Thang đo mức độ',
    text: 'Văn bản ngắn',
    paragraph: 'Đoạn văn'
  };

  container.innerHTML = questions.map((q, idx) => {
    const typeLabel = typeLabels[q.type] || q.type;
    const reqBadge = q.required ? '<span class="q-req-badge">Bắt buộc</span>' : '';
    
    let choicesHtml = '';
    if (q.choices && q.choices.length > 0) {
      choicesHtml = `
        <div class="q-choices-list">
          ${q.choices.map(c => `<span class="q-choice-tag">${escapeHtml(typeof c === 'object' ? c.value : c)}</span>`).join('')}
        </div>
      `;
    }

    return `
      <div class="q-preview-item">
        <div class="q-preview-header">
          <div class="q-preview-title">${idx + 1}. ${escapeHtml(q.title)}</div>
          <div class="q-preview-badges">
            <span class="q-type-badge">${typeLabel}</span>
            ${reqBadge}
          </div>
        </div>
        ${choicesHtml}
      </div>
    `;
  }).join('');
}

function toggleSchemaCollapse() {
  const body = document.getElementById('schemaBody');
  const btn = document.getElementById('btnToggleSchema');
  const isCollapsed = body.classList.toggle('collapsed');
  btn.textContent = isCollapsed ? '▼ Mở rộng xem chi tiết' : '▲ Thu gọn';
}

/**
 * Hiển thị bảng nhật ký phiếu gửi
 */
function renderLogTable(logs) {
  const tbody = document.getElementById('logTableBody');
  document.getElementById('logCountBadge').textContent = `${logs.length} phiếu`;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr id="emptyRow">
        <td colspan="6" class="text-center text-muted">Chưa có dữ liệu gửi. Hãy dán link form, cấu hình số lượng và bấm "Bắt đầu gửi"!</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const s = log.summary || {};
    const entries = Object.entries(s);
    
    // Tóm tắt 2 câu đầu tiên
    const previewSummary = entries.slice(0, 2).map(([k, v]) => `
      <span style="display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; margin: 2px 4px 2px 0; font-size: 11px;">
        <strong>${escapeHtml(k.substring(0, 15))}:</strong> ${escapeHtml(v)}
      </span>
    `).join('') + (entries.length > 2 ? `<span class="text-muted" style="font-size: 11px;">+${entries.length - 2} mục khác</span>` : '');

    const statusBadge = log.success 
      ? '<span class="badge badge-green">✔ Thành công</span>'
      : `<span class="badge badge-red" title="${escapeHtml(log.error || '')}">✘ Thất bại</span>`;

    return `
      <tr>
        <td><strong>#${log.id}</strong></td>
        <td>${log.time}</td>
        <td>${statusBadge}</td>
        <td>${previewSummary || '-'}</td>
        <td>${log.durationMs}ms</td>
        <td>
          <button class="btn-detail" onclick="viewDetail(${log.id})">Chi tiết</button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewDetail(logId) {
  const log = currentLogs.find(l => l.id === logId);
  if (!log) return;

  document.getElementById('modalTitle').textContent = `Chi tiết phiếu #${log.id} (${log.time})`;
  const modalBody = document.getElementById('modalBody');

  const s = log.summary || {};
  const items = Object.entries(s).map(([q, a], idx) => `
    <div class="detail-item">
      <div class="detail-q">Câu ${idx + 1}: ${escapeHtml(q)}</div>
      <div class="detail-a">${escapeHtml(a)}</div>
    </div>
  `).join('');

  modalBody.innerHTML = items || '<p class="text-muted">Không có dữ liệu chi tiết.</p>';
  document.getElementById('detailModal').classList.add('active');
}

function closeModal(event) {
  if (!event || event.target.id === 'detailModal' || event.target.classList.contains('btn-close')) {
    document.getElementById('detailModal').classList.remove('active');
  }
}

function setCount(val) {
  document.getElementById('targetCount').value = val;
}

function updateModeUI() {
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  document.getElementById('modeSmartLabel').classList.toggle('active', selectedMode === 'smart');
  document.getElementById('modeRandomLabel').classList.toggle('active', selectedMode === 'random');
}

/**
 * Xử lý khi bấm nút "Quét & Phân tích Form"
 */
async function handleAnalyzeForm() {
  const input = document.getElementById('formUrlInput');
  const btn = document.getElementById('btnAnalyze');
  const url = input.value.trim();

  if (!url) {
    alert('Vui lòng dán đường link Google Form (forms.gle hoặc docs.google.com)!');
    input.focus();
    return;
  }

  btn.disabled = true;
  document.getElementById('analyzeIcon').textContent = '⏳';
  document.getElementById('analyzeText').textContent = 'Đang quét & phân tích...';

  try {
    const res = await fetch('/api/analyze-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok) {
      alert('Lỗi: ' + (data.error || 'Không thể phân tích form!'));
      return;
    }

    currentFormConfig = data.form;
    document.getElementById('formTitleDisplay').textContent = data.form.title;
    document.getElementById('targetFormLink').href = data.form.formUrl;
    document.getElementById('targetFormLink').textContent = data.form.formUrl;
    document.getElementById('totalQuestionsBadge').textContent = `${data.form.questions.length} Câu hỏi`;
    document.getElementById('detectedCount').textContent = data.form.questions.length;
    renderQuestionsPreview(data.form.questions);

    alert(`🎉 Thành công!\nĐã phân tích: "${data.form.title}"\nPhát hiện: ${data.form.questions.length} câu hỏi.\nBạn có thể bắt đầu gửi phiếu ngay!`);

    // Mở rộng phần xem trước câu hỏi
    const body = document.getElementById('schemaBody');
    const toggleBtn = document.getElementById('btnToggleSchema');
    body.classList.remove('collapsed');
    toggleBtn.textContent = '▲ Thu gọn';

  } catch (err) {
    alert('Lỗi kết nối tới máy chủ: ' + err.message);
  } finally {
    btn.disabled = false;
    document.getElementById('analyzeIcon').textContent = '🔍';
    document.getElementById('analyzeText').textContent = 'Quét & Phân tích Form';
  }
}

async function startSubmission() {
  const count = parseInt(document.getElementById('targetCount').value, 10);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const delayMin = parseInt(document.getElementById('delayMin').value, 10) || 800;
  const delayMax = parseInt(document.getElementById('delayMax').value, 10) || 1500;

  if (!count || count <= 0) {
    alert('Vui lòng nhập số lượng phiếu hợp lệ (> 0)!');
    return;
  }

  startTime = Date.now();
  currentLogs = [];
  renderLogTable([]);

  try {
    const res = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count,
        mode,
        delayMin,
        delayMax,
        formConfig: currentFormConfig
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Lỗi khi bắt đầu');
      return;
    }

    if (data.jobId) {
      currentJobId = data.jobId;
      // Kết nối SSE riêng cho tiến trình của người dùng này
      initSSE(currentJobId);
    }
  } catch (err) {
    alert('Không thể kết nối đến máy chủ: ' + err.message);
  }
}

async function togglePause() {
  if (!currentJobId) return;
  try {
    await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: currentJobId })
    });
  } catch (err) {
    console.error(err);
  }
}

async function stopSubmission() {
  if (!currentJobId) return;
  if (confirm('Bạn có chắc chắn muốn dừng quá trình gửi phiếu?')) {
    try {
      await fetch('/api/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId })
      });
    } catch (err) {
      console.error(err);
    }
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', () => {
  initSSE();
});
