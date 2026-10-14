// Danh sách mẫu để sinh câu trả lời tự nhiên theo ngữ cảnh tiếng Việt
const SAMPLE_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Mai', 'Lê Hoàng Long', 'Phạm Minh Đức', 'Vũ Thu Trang',
  'Đỗ Quang Huy', 'Hoàng Hải Yến', 'Bùi Anh Tuấn', 'Ngô Bảo Ngọc', 'Đinh Tuấn Kiệt',
  'Dương Khánh Linh', 'Lý Quốc Bảo', 'Phan Thanh Thảo', 'Hồ Đức Trọng', 'Võ Thùy Dương'
];

const SAMPLE_FEEDBACKS = [
  'Biểu mẫu khảo sát rất chi tiết và thiết thực.',
  'Cần nâng cao ý thức tự giác của mỗi cá nhân.',
  'Mong nhà trường và các đơn vị tổ chức thêm nhiều hoạt động hỗ trợ sinh viên.',
  'Nên đẩy mạnh tuyên truyền qua các kênh mạng xã hội chính thức.',
  'Cần có sự phối hợp chặt chẽ giữa các bên liên quan.',
  'Giải pháp đề ra cần phù hợp với điều kiện thực tế.',
  'Rất đồng tình với các nội dung khảo sát nêu trên.',
  'Không có ý kiến gì thêm.',
  ''
];

const SAMPLE_PHONES = [
  '0912345678', '0987654321', '0345678901', '0389123456', '0978123456', '0903456789'
];

// Bộ nhớ lưu chữ ký các phiếu đã sinh để chống trùng lặp
const generatedSignatures = new Set();

/**
 * Chọn 1 phần tử ngẫu nhiên
 */
function randomChoice(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Chọn ngẫu nhiên có trọng số (nếu có trường weight) hoặc ngẫu nhiên tự nhiên
 */
function pickRadio(choices, mode) {
  if (!choices || choices.length === 0) return '';
  
  // Nếu có định nghĩa trọng số
  if (choices[0] && typeof choices[0] === 'object' && choices[0].weight) {
    const total = choices.reduce((sum, c) => sum + (c.weight || 1), 0);
    let r = Math.random() * total;
    for (const c of choices) {
      if (r < c.weight) return c.value;
      r -= c.weight;
    }
    return choices[choices.length - 1].value;
  }

  // Chế độ tự nhiên (hơi lệch nhẹ về các phương án đầu/giữa như người thật)
  const values = choices.map(c => (typeof c === 'object' ? c.value : c));
  if (mode === 'smart' && values.length > 2) {
    // Phân bổ xác suất thực tế
    const weights = values.map((_, i) => (i === 0 ? 1.2 : i === 1 ? 1.3 : 1.0));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < values.length; i++) {
      if (r < weights[i]) return values[i];
      r -= weights[i];
    }
  }

  return randomChoice(values);
}

/**
 * Chọn nhiều đáp án cho hộp kiểm (Checkbox)
 */
function pickCheckboxes(choices, minSelect = 1, maxSelect = 3, mode = 'smart') {
  if (!choices || choices.length === 0) return [];
  const values = choices.map(c => (typeof c === 'object' ? c.value : c));
  
  const targetCount = Math.floor(Math.random() * (maxSelect - minSelect + 1)) + minSelect;
  const pool = [...values];
  const selected = [];

  for (let i = 0; i < targetCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  // Tự động xử lý tính logic: Nếu chọn phương án mang tính phủ định ("Không có", "Chưa từng", "None")
  if (mode === 'smart') {
    const negativeOption = selected.find(s => 
      s.toLowerCase().includes('không có') || 
      s.toLowerCase().includes('chưa từng') || 
      s.toLowerCase().includes('none')
    );
    if (negativeOption && selected.length > 1) {
      if (Math.random() < 0.75) {
        return [negativeOption];
      } else {
        return selected.filter(s => s !== negativeOption);
      }
    }
  }

  return selected;
}

/**
 * Trả lời thang điểm đánh giá (Scale 1-5 hoặc 1-10)
 */
function pickScale(choices) {
  if (choices && choices.length > 0) {
    return randomChoice(choices);
  }
  // Mặc định thang 1-5, phân bổ tự nhiên tập trung vào 3, 4, 5
  const r = Math.random();
  if (r < 0.1) return '2';
  if (r < 0.4) return '3';
  if (r < 0.8) return '4';
  return '5';
}

/**
 * Sinh câu trả lời thông minh theo ngữ cảnh tiêu đề câu hỏi
 */
function generateContextualText(questionTitle, isRequired, suggestions) {
  if (suggestions && suggestions.length > 0) {
    return randomChoice(suggestions);
  }

  const title = (questionTitle || '').toLowerCase();

  // Nhận diện họ tên
  if (title.includes('họ và tên') || title.includes('họ tên') || title.includes('tên của bạn')) {
    return randomChoice(SAMPLE_NAMES);
  }

  // Nhận diện số điện thoại
  if (title.includes('số điện thoại') || title.includes('sđt') || title.includes('phone')) {
    return randomChoice(SAMPLE_PHONES);
  }

  // Nhận diện ý kiến, đề xuất, nhận xét
  if (title.includes('ý kiến') || title.includes('đề xuất') || title.includes('góp ý') || title.includes('nhận xét') || title.includes('chia sẻ')) {
    const feedback = randomChoice(SAMPLE_FEEDBACKS);
    if (!isRequired && Math.random() < 0.5) return '';
    return feedback || (isRequired ? 'Đồng ý với các nội dung trên.' : '');
  }

  // Nhận diện email
  if (title.includes('email') || title.includes('thư điện tử')) {
    const username = 'sv' + Math.floor(100000 + Math.random() * 900000);
    return `${username}@gmail.com`;
  }

  // Nhận diện mã sinh viên / mã số
  if (title.includes('mã sinh viên') || title.includes('msv') || title.includes('mã số')) {
    return '23' + Math.floor(100000 + Math.random() * 900000);
  }

  // Câu hỏi mở chung
  if (isRequired) {
    return 'Phù hợp với tình hình thực tế hiện nay.';
  }

  return Math.random() < 0.4 ? 'Đồng ý.' : '';
}

/**
 * Sinh một bộ câu trả lời hoàn chỉnh cho toàn bộ form
 * @param {object} formConfig - Cấu hình biểu mẫu được parse
 * @param {string} mode - 'smart' (thông minh/tự nhiên) hoặc 'random' (ngẫu nhiên 100%)
 * @returns {object} { payload, summary, signature }
 */
function generateSmartResponse(formConfig, mode = 'smart') {
  const questions = formConfig.questions || [];
  let attempts = 0;

  while (attempts < 100) {
    attempts++;
    const payload = {
      fvv: '1',
      pageHistory: '0'
    };
    const summary = {};

    for (const q of questions) {
      if (!q.entry) continue;

      if (q.type === 'radio' || q.type === 'dropdown') {
        const answer = pickRadio(q.choices, mode);
        payload[q.entry] = answer;
        summary[q.title] = answer;
      } else if (q.type === 'checkbox') {
        const answers = pickCheckboxes(q.choices, q.minSelect || 1, q.maxSelect || 3, mode);
        payload[q.entry] = answers;
        summary[q.title] = answers.join(', ');
      } else if (q.type === 'scale') {
        const answer = pickScale(q.choices);
        payload[q.entry] = answer;
        summary[q.title] = answer;
      } else if (q.type === 'text' || q.type === 'paragraph') {
        const answer = generateContextualText(q.title, q.required, q.suggestions);
        if (answer) {
          payload[q.entry] = answer;
          summary[q.title] = answer;
        } else {
          summary[q.title] = '(Để trống)';
        }
      }
    }

    const signature = JSON.stringify(payload);
    if (!generatedSignatures.has(signature)) {
      generatedSignatures.add(signature);
      return { payload, summary, signature };
    }
  }

  return { payload, summary, signature: Date.now().toString() };
}

function clearHistory() {
  generatedSignatures.clear();
}

module.exports = {
  generateSmartResponse,
  clearHistory
};
