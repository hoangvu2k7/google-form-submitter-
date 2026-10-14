# Hướng Dẫn Đưa Công Cụ Lên Mạng (Online) Cho Mọi Người Cùng Dùng

Có 2 cách cực kỳ đơn giản để bạn và bạn bè có thể dùng chung công cụ này qua Internet:

---

## ⚡ CÁCH 1: Tạo Link Online Tức Thì Bằng 1 Cú Nhấp Chuột (Dễ nhất)

*Bạn không cần đăng ký tài khoản gì cả, link được mở thẳng từ máy tính của bạn ra Internet.*

1. Trong thư mục dự án, nhấp đúp vào file:
   👉 **`share-online.bat`**
2. Cửa sổ màu đen sẽ chạy và hiển thị một đường link công khai dạng:
   ```text
   your url is: https://funny-tiger-42.loca.lt
   ```
3. Bạn copy link này và gửi cho bạn bè. Bất kỳ ai mở link này trên **điện thoại hoặc máy tính** đều dùng được công cụ để quét và gửi form!
   *(Lưu ý: Lần đầu mở link trên trình duyệt, trang sẽ hiện nút xác nhận "Click to Continue", bạn chỉ cần bấm nút đó là vào trang web).*

> ⚠️ *Cách này yêu cầu máy tính của bạn phải đang mở file `share-online.bat`. Nếu bạn tắt máy tính thì link sẽ dừng hoạt động.*

---

## 🌐 CÁCH 2: Đưa Lên Render.com (Chạy 24/7 Vĩnh Viễn, Máy Tắt Vẫn Dùng Được)

*Website sẽ chạy trên máy chủ đám mây của Render, bạn sẽ có link riêng dạng `https://ten-web-cua-ban.onrender.com` hoàn toàn MIỄN PHÍ.*

### Bước 1: Đưa code lên GitHub
1. Truy cập [github.com](https://github.com) và đăng nhập (hoặc đăng ký miễn phí).
2. Nhấn nút **New** (Tạo repository mới):
   - Đặt tên (ví dụ: `google-form-submitter`).
   - Chọn chế độ **Public**.
   - Bấm **Create repository**.
3. Tại trang repository vừa tạo, bấm nút **uploading an existing file**:
   - Kéo toàn bộ các file trong thư mục `google-form-auto-submitter` thả vào trình duyệt.
   - Bấm **Commit changes** để lưu.

### Bước 2: Kích hoạt website trên Render.com
1. Truy cập [render.com](https://render.com) và bấm **Sign Up** (đăng nhập bằng chính tài khoản GitHub vừa tạo).
2. Tại trang điều khiển Render, nhấn **New +** ở góc trên -> Chọn **Web Service**.
3. Chọn repository `google-form-submitter` mà bạn vừa tạo trên GitHub.
4. Điền các thông tin:
   - **Name**: Tên bạn muốn đặt cho trang web (ví dụ: `form-auto-submitter`).
   - **Region**: Chọn `Singapore` (để tốc độ tải ở Việt Nam nhanh nhất).
   - **Runtime**: Chọn `Node`.
   - **Build Command**: để trống.
   - **Start Command**: điền `node server.js`.
   - **Instance Type**: Chọn **Free**.
5. Kéo xuống dưới và bấm **Create Web Service**.
6. Chờ khoảng 1-2 phút, Render sẽ cấp cho bạn một đường link web chính thức dạng:
   👉 **`https://form-auto-submitter.onrender.com`**

Bây giờ bất kỳ ai trên toàn thế giới đều có thể truy cập vào đường link này để dán form và điền phiếu tự động 24/24!
