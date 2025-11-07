# CSV to Excel Merger 📊

Ứng dụng web đơn giản để tổng hợp nhiều file CSV thành một file Excel duy nhất.

## ✨ Tính năng

- 📁 Upload nhiều file CSV cùng lúc
- 🎯 Kéo thả file dễ dàng (Drag & Drop)
- 📊 Tự động tổng hợp dữ liệu vào một sheet
- 📋 Tạo sheet riêng cho từng file CSV
- 🎨 Giao diện đẹp và hiện đại
- ⚡ Xử lý nhanh chóng
- 💯 Hoàn toàn miễn phí và không cần backend

## 🚀 Cài đặt

### Yêu cầu
- Node.js 18+ 
- npm hoặc yarn

### Các bước cài đặt

1. Clone repository hoặc tải mã nguồn

2. Cài đặt dependencies:
```bash
npm install
# hoặc
yarn install
```

3. Chạy development server:
```bash
npm run dev
# hoặc
yarn dev
```

4. Mở trình duyệt và truy cập: `http://localhost:3000`

## 📦 Deploy lên Vercel

### Cách 1: Deploy qua Vercel Dashboard (Dễ nhất)

1. Đăng ký/Đăng nhập tài khoản tại [Vercel](https://vercel.com)
2. Nhấn "Add New Project"
3. Import repository GitHub của bạn (hoặc upload folder)
4. Vercel sẽ tự động nhận diện Next.js và cấu hình
5. Nhấn "Deploy" và chờ vài giây
6. Xong! Website của bạn đã online 🎉

### Cách 2: Deploy qua Vercel CLI

```bash
# Cài đặt Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy production
vercel --prod
```

## 🛠️ Công nghệ sử dụng

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Papa Parse** - Parse CSV files
- **XLSX** - Tạo file Excel
- **CSS3** - Styling với animations đẹp mắt

## 📖 Cách sử dụng

1. **Upload file CSV:**
   - Nhấn vào vùng upload hoặc kéo thả file CSV vào
   - Có thể chọn nhiều file cùng lúc

2. **Kiểm tra danh sách file:**
   - Xem danh sách các file đã chọn
   - Xóa file nếu cần

3. **Tải xuống Excel:**
   - Nhấn nút "Tải xuống Excel"
   - File Excel sẽ được tải về máy tự động

4. **Kết quả:**
   - Sheet "Combined Data": Tổng hợp tất cả dữ liệu
   - Các sheet riêng: Dữ liệu từng file CSV

## 🎯 Tính năng nổi bật

- ✅ Xử lý hoàn toàn trên trình duyệt (client-side)
- ✅ Không cần server, không upload dữ liệu lên cloud
- ✅ Bảo mật dữ liệu tuyệt đối
- ✅ Tự động điều chỉnh độ rộng cột
- ✅ Hỗ trợ file CSV với nhiều encoding
- ✅ Responsive design - hoạt động tốt trên mobile

## 📝 Ghi chú

- Ứng dụng xử lý file hoàn toàn trên trình duyệt của bạn
- Không có dữ liệu nào được gửi lên server
- Phù hợp để deploy lên Vercel với free plan

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo issue hoặc pull request.

## 📄 License

MIT License - Tự do sử dụng cho mọi mục đích

---

Made with ❤️ using Next.js


