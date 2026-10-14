const fs = require('fs');
const path = require('path');
const { parseGoogleForm } = require('./parser');
const { generateSmartResponse, clearHistory } = require('./smart-generator');
const { submitForm, clearEndpointCache, getConfig } = require('./submitter');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    count: 10,
    delay: 1000,
    mode: 'smart',
    url: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' || args[i] === '-n') {
      options.count = parseInt(args[++i], 10) || 10;
    } else if (args[i] === '--delay' || args[i] === '-d') {
      options.delay = parseInt(args[++i], 10) || 1000;
    } else if (args[i] === '--mode' || args[i] === '-m') {
      options.mode = args[++i] === 'random' ? 'random' : 'smart';
    } else if (args[i] === '--url' || args[i] === '-u') {
      options.url = args[++i];
    }
  }

  return options;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const options = parseArgs();

  let formConfig = getConfig();

  if (options.url) {
    console.log(`[CLI] Đang quét và phân tích biểu mẫu: ${options.url}`);
    try {
      formConfig = await parseGoogleForm(options.url);
      const configPath = path.join(__dirname, 'form-config.json');
      fs.writeFileSync(configPath, JSON.stringify(formConfig, null, 2), 'utf-8');
      clearEndpointCache();
      clearHistory();
      console.log(`[CLI] Phân tích thành công! Đã tìm thấy ${formConfig.questions.length} câu hỏi.`);
    } catch (err) {
      console.error(`[CLI] Lỗi khi phân tích link:`, err.message);
      return;
    }
  }

  console.log('====================================================');
  console.log('   UNIVERSAL GOOGLE FORM AUTO-SUBMITTER');
  console.log(`   Tiêu đề: ${formConfig.title}`);
  console.log(`   Link:    ${formConfig.formUrl}`);
  console.log('====================================================');
  console.log(` Mục tiêu:       ${options.count} phiếu`);
  console.log(` Khoảng nghỉ:    ${options.delay} ms giữa các lần gửi`);
  console.log(` Chế độ sinh:    ${options.mode === 'smart' ? 'Thông minh & Tự nhiên (Smart)' : 'Ngẫu nhiên hoàn toàn (Random)'}`);
  console.log(` Số câu hỏi:     ${(formConfig.questions || []).length} câu`);
  console.log('----------------------------------------------------');

  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 1; i <= options.count; i++) {
    const { payload, summary } = generateSmartResponse(formConfig, options.mode);
    const result = await submitForm(payload, formConfig);

    const now = new Date().toLocaleTimeString();
    if (result.success) {
      successCount++;
      // Lấy 2 câu trả lời đầu tiên để in preview
      const previewKeys = Object.keys(summary).slice(0, 2);
      const previewText = previewKeys.map(k => `${k.substring(0, 20)}: ${summary[k]}`).join(' | ');

      console.log(`[${now}] [${i}/${options.count}] ✔ THÀNH CÔNG (${result.durationMs}ms)`);
      if (previewText) {
        console.log(`       -> ${previewText}`);
      }
    } else {
      failCount++;
      console.log(`[${now}] [${i}/${options.count}] ✘ THẤT BẠI: ${result.error}`);
    }

    if (i < options.count) {
      const actualDelay = Math.floor(options.delay * (0.8 + Math.random() * 0.5));
      await sleep(actualDelay);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('====================================================');
  console.log(` Hoàn tất!`);
  console.log(` Tổng thời gian: ${totalTime}s`);
  console.log(` Thành công:     ${successCount} phiếu`);
  console.log(` Thất bại:       ${failCount} phiếu`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
});
