const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

function getConfig() {
  const configPath = path.join(__dirname, 'form-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

let resolvedCache = {
  raw: null,
  submitUrl: null,
  referer: null
};

/**
 * Tự động phân giải link forms.gle hoặc viewform sang endpoint formResponse
 */
function resolveEndpoint(rawUrl) {
  return new Promise((resolve) => {
    if (resolvedCache.raw === rawUrl && resolvedCache.submitUrl) {
      return resolve(resolvedCache);
    }

    if (rawUrl.includes('/formResponse')) {
      resolvedCache = {
        raw: rawUrl,
        submitUrl: rawUrl,
        referer: rawUrl.replace('/formResponse', '/viewform')
      };
      return resolve(resolvedCache);
    }

    function traceRedirect(currentUrl, depth = 0) {
      if (depth > 6) {
        resolvedCache = { raw: rawUrl, submitUrl: currentUrl, referer: currentUrl };
        return resolve(resolvedCache);
      }

      try {
        const u = new URL(currentUrl);
        const req = https.request({
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'GET',
          headers: { 'User-Agent': getRandomUserAgent() }
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const nextUrl = new URL(res.headers.location, currentUrl).href;
            res.resume();
            return traceRedirect(nextUrl, depth + 1);
          }

          res.resume();
          let finalSubmit = currentUrl;
          if (finalSubmit.includes('/viewform')) {
            finalSubmit = finalSubmit.replace(/\/viewform.*/, '/formResponse');
          } else if (!finalSubmit.endsWith('/formResponse')) {
            finalSubmit = finalSubmit.replace(/\/+$/, '') + '/formResponse';
          }

          resolvedCache = {
            raw: rawUrl,
            submitUrl: finalSubmit,
            referer: currentUrl
          };
          resolve(resolvedCache);
        });

        req.on('error', () => {
          let fallback = rawUrl;
          if (fallback.includes('/viewform')) {
            fallback = fallback.replace(/\/viewform.*/, '/formResponse');
          }
          resolve({ raw: rawUrl, submitUrl: fallback, referer: rawUrl });
        });
        req.end();
      } catch (e) {
        resolve({ raw: rawUrl, submitUrl: rawUrl, referer: rawUrl });
      }
    }

    traceRedirect(rawUrl);
  });
}

/**
 * Gửi 1 phiếu phản hồi lên Google Form
 * @param {object} payload - Dữ liệu các trường entry.XXXXX
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định 15000ms)
 * @returns {Promise<{success: boolean, statusCode: number, durationMs: number, error?: string}>}
 */
async function submitForm(payload, customConfig = null, timeoutMs = 15000) {
  const config = customConfig || getConfig();
  const targetUrl = config.submitUrl || config.formUrl;
  const endpoint = await resolveEndpoint(targetUrl);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const postData = querystring.stringify(payload);

    try {
      const parsedUrl = new URL(endpoint.submitUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Origin': 'https://docs.google.com',
          'Referer': endpoint.referer || config.formUrl
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const isSuccessStatus = res.statusCode >= 200 && res.statusCode < 400;
          const containsRecordedMsg = data.includes('Câu trả lời của bạn đã được ghi lại') || 
                                      data.includes('Your response has been recorded') ||
                                      data.includes('freebirdFormviewerViewResponseConfirmationMessage');

          if (isSuccessStatus || containsRecordedMsg) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              durationMs
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              durationMs,
              error: `Máy chủ trả về mã HTTP ${res.statusCode}`
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          durationMs: Date.now() - startTime,
          error: 'Hết thời gian chờ kết nối (Timeout)'
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          statusCode: 0,
          durationMs: Date.now() - startTime,
          error: err.message
        });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      resolve({
        success: false,
        statusCode: 0,
        durationMs: Date.now() - startTime,
        error: err.message
      });
    }
  });
}

function clearEndpointCache() {
  resolvedCache = { raw: null, submitUrl: null, referer: null };
}

module.exports = {
  submitForm,
  getConfig,
  clearEndpointCache
};
