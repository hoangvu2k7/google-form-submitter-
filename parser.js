const https = require('https');
const http = require('http');
const { URL } = require('url');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Tự động lần theo redirect để tìm URL đích cuối cùng
 */
function fetchWithRedirects(initialUrl, maxRedirects = 7) {
  return new Promise((resolve, reject) => {
    function get(currentUrl, redirectCount) {
      if (redirectCount > maxRedirects) {
        return reject(new Error('Vượt quá số lần chuyển hướng cho phép (Too many redirects)'));
      }

      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (err) {
        return reject(new Error('Đường link không hợp lệ: ' + currentUrl));
      }

      const client = parsed.protocol === 'http:' ? http : https;
      const req = client.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, currentUrl).href;
          res.resume();
          return get(nextUrl, redirectCount + 1);
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({ finalUrl: currentUrl, body, statusCode: res.statusCode });
        });
      });

      req.on('error', reject);
      req.end();
    }

    get(initialUrl, 0);
  });
}

/**
 * Phân tích dữ liệu Google Form từ URL bất kỳ
 * @param {string} rawUrl - Link form (forms.gle hoặc docs.google.com)
 * @returns {Promise<{formUrl: string, submitUrl: string, title: string, desc: string, questions: Array}>}
 */
async function parseGoogleForm(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('Đường link Google Form không được để trống!');
  }

  const { finalUrl, body } = await fetchWithRedirects(rawUrl.trim());

  // Tìm khối dữ liệu FB_PUBLIC_LOAD_DATA_
  const match = body.match(/var FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/);
  if (!match) {
    throw new Error('Không thể tìm thấy cấu trúc biểu mẫu! Vui lòng kiểm tra lại link hoặc đảm bảo form mở công khai.');
  }

  let parsedData;
  try {
    parsedData = JSON.parse(match[1]);
  } catch (err) {
    throw new Error('Không thể giải mã dữ liệu biểu mẫu: ' + err.message);
  }

  const title = parsedData[1][8] || parsedData[3] || 'Biểu mẫu khảo sát';
  const desc = parsedData[1][0] || '';
  const rawItems = parsedData[1][1] || [];

  const questions = [];

  rawItems.forEach((item) => {
    const qTitle = item[1];
    const qDesc = item[2] || '';
    const qRawType = item[3];
    const entryData = item[4];

    if (!entryData || entryData.length === 0) {
      // Tiêu đề phần hoặc mô tả (không phải câu hỏi)
      return;
    }

    entryData.forEach((entry) => {
      const entryId = entry[0];
      const isRequired = entry[2] === 1;
      const rawChoices = entry[1];
      
      let choices = null;
      if (rawChoices && Array.isArray(rawChoices)) {
        choices = rawChoices
          .map(c => (c && c[0] ? String(c[0]).trim() : ''))
          .filter(c => c.length > 0);
      }

      // Xác định loại câu hỏi
      let type = 'text';
      if (qRawType === 0) type = 'text';
      else if (qRawType === 1) type = 'paragraph';
      else if (qRawType === 2) type = 'radio';
      else if (qRawType === 3) type = 'dropdown';
      else if (qRawType === 4) type = 'checkbox';
      else if (qRawType === 5) type = 'scale';

      questions.push({
        id: questions.length + 1,
        title: qTitle,
        description: qDesc,
        type: type,
        rawType: qRawType,
        entry: 'entry.' + entryId,
        required: isRequired,
        choices: choices,
        minSelect: type === 'checkbox' ? 1 : undefined,
        maxSelect: type === 'checkbox' ? Math.min(choices ? choices.length : 3, 3) : undefined
      });
    });
  });

  // Xây dựng submitUrl từ finalUrl
  let submitUrl = finalUrl;
  if (submitUrl.includes('/viewform')) {
    submitUrl = submitUrl.replace(/\/viewform.*/, '/formResponse');
  } else if (!submitUrl.endsWith('/formResponse')) {
    submitUrl = submitUrl.replace(/\/+$/, '') + '/formResponse';
  }

  return {
    formUrl: rawUrl.trim(),
    realFormUrl: finalUrl,
    submitUrl: submitUrl,
    title: title,
    desc: desc,
    totalQuestions: questions.length,
    questions: questions
  };
}

module.exports = {
  parseGoogleForm,
  fetchWithRedirects
};
