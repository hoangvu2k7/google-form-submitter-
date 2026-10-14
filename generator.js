const fs = require('fs');
const path = require('path');

function getConfig() {
  const configPath = path.join(__dirname, 'form-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Tập lưu trữ fingerprint của các phiếu đã sinh trong phiên làm việc để đảm bảo không trùng lặp
const generatedSignatures = new Set();

/**
 * Chọn 1 phần tử theo trọng số xác suất (Weighted Random)
 */
function weightedPick(choices) {
  const totalWeight = choices.reduce((sum, c) => sum + (c.weight || 1), 0);
  let random = Math.random() * totalWeight;
  for (const choice of choices) {
    if (random < choice.weight) {
      return choice.value;
    }
    random -= choice.weight;
  }
  return choices[choices.length - 1].value;
}

/**
 * Chọn 1 phần tử ngẫu nhiên đồng đều (Uniform Random)
 */
function uniformPick(choices) {
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx].value;
}

/**
 * Chọn nhiều phần tử không trùng lặp từ danh sách (dùng cho checkbox)
 */
function pickMultiple(choices, minCount, maxCount, mode) {
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
  const pool = [...choices];
  const selected = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    let pickedValue;
    if (mode === 'realistic') {
      pickedValue = weightedPick(pool);
    } else {
      pickedValue = uniformPick(pool);
    }
    selected.push(pickedValue);
    const removeIdx = pool.findIndex(c => c.value === pickedValue);
    if (removeIdx !== -1) {
      pool.splice(removeIdx, 1);
    }
  }

  // Logic thực tế cho câu 9: Nếu đã chọn "Không có biểu hiện nào / Luôn kiểm soát tốt thời gian", chỉ giữ lại lựa chọn này
  const noSymptoms = 'Không có biểu hiện nào / Luôn kiểm soát tốt thời gian';
  if (mode === 'realistic' && selected.includes(noSymptoms) && selected.length > 1) {
    if (Math.random() < 0.7) {
      return [noSymptoms];
    } else {
      return selected.filter(s => s !== noSymptoms);
    }
  }

  return selected;
}

/**
 * Sinh một bộ câu trả lời ngẫu nhiên hoàn chỉnh
 * @param {string} mode - 'realistic' (mặc định) hoặc 'random'
 * @returns {object} { payload, summary, signature }
 */
function generateResponse(mode = 'realistic') {
  const config = getConfig();
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    const payload = {
      fvv: '1',
      pageHistory: '0'
    };
    const summary = {};

    for (const q of config.questions) {
      if (q.type === 'radio') {
        const choice = (mode === 'realistic') ? weightedPick(q.choices) : uniformPick(q.choices);
        payload[q.entry] = choice;
        summary[q.title] = choice;
      } else if (q.type === 'checkbox') {
        const choices = pickMultiple(q.choices, q.minSelect || 1, q.maxSelect || 3, mode);
        payload[q.entry] = choices;
        summary[q.title] = choices.join(', ');
      } else if (q.type === 'text') {
        if (q.suggestions && q.suggestions.length > 0) {
          const textChoice = q.suggestions[Math.floor(Math.random() * q.suggestions.length)];
          if (textChoice) {
            payload[q.entry] = textChoice;
            summary[q.title] = textChoice;
          } else {
            summary[q.title] = '(Để trống)';
          }
        }
      }
    }

    // Tạo chữ ký (signature) nhận diện bộ câu trả lời
    const signature = JSON.stringify(payload);
    if (!generatedSignatures.has(signature)) {
      generatedSignatures.add(signature);
      return { payload, summary, signature };
    }
  }

  return { payload, summary, signature: Date.now().toString() };
}

/**
 * Reset lịch sử nhận diện trùng lặp
 */
function clearHistory() {
  generatedSignatures.clear();
}

module.exports = {
  generateResponse,
  clearHistory,
  getConfig
};
