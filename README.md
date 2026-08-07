# KujiLingo Backend (API)

Đây là mã nguồn backend (RESTful API) cho dự án **KujiLingo**, được xây dựng bằng **Fastify** và **Prisma ORM**. Hệ thống sử dụng PostgreSQL làm cơ sở dữ liệu chính.

## 🚀 Công nghệ sử dụng

- **Framework:** [Fastify](https://fastify.dev/) (v5)
- **Ngôn ngữ:** [TypeScript](https://www.typescriptlang.org/)
- **Cơ sở dữ liệu:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Xác thực & Bảo mật:** `bcrypt`, JWT (dự kiến)
- **Tiện ích:** `dayjs` (xử lý thời gian), `zod` (validate dữ liệu), `pino` (logging)

## 📁 Cấu trúc thư mục (src)

```text
src/
├── config/       # Các file cấu hình (Swagger, Prisma, Redis, v.v.)
├── common/       # Các hằng số (constants) và kiểu dữ liệu (types) dùng chung
├── modules/      # Chứa logic nghiệp vụ theo tính năng (ví dụ: users, auth)
├── routes/       # Khai báo các API endpoint (routes)
├── jobs/         # Chứa các background jobs (cron jobs)
├── websocket/    # Xử lý các kết nối thời gian thực (Socket.io)
├── app.ts        # Thiết lập ứng dụng Fastify và đăng ký plugins
└── server.ts     # Điểm khởi chạy (entry point) của ứng dụng
```

## ⚙️ Yêu cầu hệ thống
- Node.js >= 20.x
- PostgreSQL

## 📦 Cài đặt và Khởi chạy

1. **Cài đặt các gói phụ thuộc (Dependencies):**
   ```bash
   npm install
   ```

2. **Cấu hình biến môi trường (.env):**
   Tạo file `.env` ở thư mục gốc (hoặc copy từ `.env.example` nếu có) và cấu hình chuỗi kết nối Database. Ví dụ:
   ```env
   DATABASE_URL="postgresql://<username>:<password>@localhost:5432/kujilingo?schema=public"
   ```

3. **Thiết lập Database (Prisma):**
   Đồng bộ hóa lược đồ (schema) của bạn với cơ sở dữ liệu:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Khởi chạy Server:**
   - **Môi trường Development (có watch file thay đổi):**
     ```bash
     npm run dev
     ```
   - **Môi trường Production:**
     ```bash
     npm run build
     npm start
     ```

## 📚 API Documentation (Swagger)

Hệ thống đã tích hợp **Swagger** để tự động sinh tài liệu API.
Sau khi khởi chạy ứng dụng (ở cổng mặc định `3000`), bạn có thể truy cập tài liệu tại:

- **URL:** [http://localhost:3000/docs](http://localhost:3000/docs)

## 🛠 Các script thông dụng (npm scripts)

- `npm run dev`: Chạy server dev (sử dụng `tsx watch`).
- `npm run build`: Biên dịch TypeScript sang JavaScript.
- `npm start`: Khởi động ứng dụng từ code đã build (trong thư mục `dist/`).
- `npm run prisma:generate`: Tạo ra Prisma Client từ schema hiện tại.
- `npm run prisma:migrate`: Áp dụng các thay đổi schema vào Database.
- `npm run prisma:studio`: Mở giao diện web của Prisma để xem và quản lý dữ liệu trực quan.

## 📝 Quy chuẩn Code
- Dự án sử dụng `type: module` (ESM) nên các file import cần có đuôi `.js` (ví dụ: `import app from "./app.js";`).
- Bật `verbatimModuleSyntax` trong TypeScript: sử dụng `import type` cho các kiểu dữ liệu interface.
