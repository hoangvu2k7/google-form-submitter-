# Universal Google Form Auto-Submitter (Công Cụ Điền Mọi Loại Google Form Thông Minh)

Công cụ tự động hóa thông minh có thể **điền và gửi hàng loạt phiếu cho BẤT KỲ biểu mẫu Google Form nào**, chỉ bằng cách dán đường link (hỗ trợ cả link rút gọn `https://forms.gle/...` lẫn link đầy đủ `https://docs.google.com/forms/d/e/...`).

---

## 🌟 Các Tính Năng Đột Phá

1. **Tự động quét & phân tích mọi Google Form (Universal Parser)**:
   - Dán link bất kỳ vào ô nhập và bấm **"🔍 Quét & Phân tích Form"**.
   - Hệ thống tự động bóc tách: Tiêu đề, mô tả, danh sách toàn bộ câu hỏi, mã `entry.XXXXX` và các lựa chọn.
   - Hỗ trợ đầy đủ các kiểu câu hỏi:
     - **Trắc nghiệm 1 lựa chọn (Radio / Dropdown)**.
     - **Hộp kiểm nhiều lựa chọn (Checkbox)**.
     - **Thang điểm đánh giá (Linear Scale 1-5, 1-10)**.
     - **Câu hỏi văn bản ngắn / đoạn văn (Short text / Paragraph)**.

2. **Bộ sinh câu trả lời thông minh (Smart Heuristic Engine)**:
   - **Tự động thích ứng ngữ cảnh:**
     - Trắc nghiệm: phân bổ xác suất tự nhiên như người thật điền.
     - Hộp kiểm: chọn số lượng phương án hợp lý (1 đến 3 đáp án), tự động tránh các lựa chọn mâu thuẫn (như chọn "Không có vi phạm" cùng lúc với các vi phạm).
     - Thang đo (Scale 1-5): phân phối tự nhiên theo đường cong chuẩn.
     - Câu hỏi mở: nhận diện từ khóa (Họ tên, SĐT, Email, Ý kiến, Đề xuất...) để điền tự nhiên hoặc để trống linh hoạt.
   - **Cam kết 100% không trùng lặp:** Hệ thống kiểm tra chữ ký (signature hash) của từng phiếu, đảm bảo mỗi phiếu gửi đi là một bộ câu trả lời duy nhất.

3. **Giao diện Web Dashboard v2.0 trực quan**:
   - Thanh nhập link và nút phân tích 1 chạm.
   - Bảng xem trước danh sách câu hỏi đã nhận diện kèm nhãn phân loại.
   - Chọn nhanh số lượng phiếu mục tiêu (20, 50, 100, 200...).
   - Điều chỉnh độ trễ ngẫu nhiên (Delay jitter) để chống chặn IP.
   - Bảng nhật ký trực tiếp (Live Feed) cập nhật từng giây, có nút **"Chi tiết"** để xem tất cả câu trả lời của từng phiếu.

---

## 🚀 Hướng Dẫn Sử Dụng

### Cách 1: Sử dụng Giao diện Web (Khuyên dùng)
1. Nhấp đúp chuột vào file **`start.bat`**.
2. Trình duyệt sẽ tự động mở trang: `http://localhost:3000`.
3. **Dán link Google Form bất kỳ** vào ô ở đầu trang rồi bấm **"🔍 Quét & Phân tích Form"**.
4. Sau khi hệ thống thông báo thành công, chọn **Số lượng phiếu cần lấy** (ví dụ: `50`, `100`...).
5. Bấm **"▶ Bắt đầu gửi"** và theo dõi tiến độ hoàn thành ngay trước mắt.

### Cách 2: Sử dụng dòng lệnh (CLI)
Mở PowerShell tại thư mục công cụ:
```powershell
# Chạy với form hiện tại
node cli.js --count 50 --delay 1000

# Hoặc truyền trực tiếp link Google Form bất kỳ để tự động phân tích và chạy
node cli.js --url "https://forms.gle/9RK5BoqtDHAdtucC8" --count 50 --delay 1000
```

---

## 📁 Cấu Trúc Mã Nguồn

- `start.bat`: File nhấp đúp để chạy công cụ trên Windows.
- `parser.js`: Module tự động tải, lần theo redirect và bóc tách cấu trúc Google Form.
- `smart-generator.js`: Bộ tạo câu trả lời thông minh theo ngữ cảnh câu hỏi.
- `submitter.js`: Module gửi HTTP POST, xoay vòng User-Agent và chống nghẽn.
- `server.js`: Web server điều khiển và cung cấp API phân tích form mới.
- `cli.js`: Phiên bản chạy qua terminal đa năng.
- `public/`: Giao diện Web v2.0 (HTML, CSS, JS).
