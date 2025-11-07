# CustomExcel (csv-to-excel-merger)

Một dự án Next.js + Tailwind CSS nhỏ để kết hợp/biến đổi CSV thành Excel (xlsx). Dự án hiện dùng `papaparse` để parse CSV và `xlsx` để xuất file Excel.

## Tổng quan
- Framework: Next.js
- Styling: Tailwind CSS
- Mục đích: Hỗ trợ xử lý và gộp file CSV, xuất sang Excel (.xlsx)

## Yêu cầu
- Node.js (v18+ khuyến nghị)
- npm (hoặc pnpm/yarn nếu bạn thích)

## Cài đặt
Mở terminal trong thư mục dự án và chạy:

```bash
npm install
```

## Scripts hữu dụng
Dự án có các script sau (theo `package.json`):

- `npm run dev` — chạy ứng dụng ở chế độ phát triển (Next.js dev)
- `npm run build` — build production
- `npm run start` — chạy server production sau khi build
- `npm run lint` — chạy ESLint

Ví dụ chạy ở local:

```bash
npm run dev
```

Ứng dụng sẽ mặc định chạy ở http://localhost:3000 trừ khi có cấu hình khác.

## Cấu trúc chính (tóm tắt)
- `app/` — mã nguồn Next.js (ứng dụng sử dụng App Router)
  - `globals.css` — CSS toàn cục, chứa Tailwind base/utilities
  - `layout.tsx`, `page.tsx` — layout và trang chính
  - `analyze/` — có trang `page.tsx` phục vụ chức năng phân tích/gộp CSV

## Thư viện chính
- next
- react / react-dom
- papaparse (parse CSV)
- xlsx (tạo file Excel)
- tailwindcss, postcss, autoprefixer (styling)

## Triển khai
Dự án sẵn sàng deploy lên Vercel (cấu hình Next.js mặc định). Hoặc build và chạy với `npm run build` rồi `npm run start`.

## Ghi chú và bước tiếp theo
- Nếu cần biến môi trường (API keys,...), thêm `.env.local` và cập nhật README khi có biến mới.
- Có thể thêm hướng dẫn unit test hoặc CI nếu muốn.

## License
Chưa chỉ định. Thêm tệp `LICENSE` nếu bạn muốn công khai bản quyền.

---

Nếu bạn muốn mình thêm thông tin chi tiết (mô tả component chính, hướng dẫn deploy Vercel, hoặc ví dụ file CSV mẫu), cho mình biết chi tiết bạn muốn đưa vào README nhé.