# Hướng Dẫn Deploy Chi Tiết KujiLingo Cho Server Cloud (180.93.124.132)

Tài liệu này được cấu hình **riêng biệt và chính xác** cho thông tin Cloud Server của bạn:
- **Server IP**: `180.93.124.132`
- **Tài khoản**: `root`
- **Mật khẩu**: `H9xeD2961b82g4Cq`
- **Mục tiêu**: Deploy **Backend (Docker + PostgreSQL)** trên Cloud Server và **Frontend Web (Next.js 16)** lên **Vercel** (bỏ qua ứng dụng mobile).

---

## 📌 Lưu Ý Quan Trọng Về Domain & HTTPS (Tránh Lỗi Mixed Content)

> [!IMPORTANT]
> **Vercel luôn chạy HTTPS** (`https://xxx.vercel.app`). Trình duyệt sẽ **chặn toàn bộ API** nếu Backend gọi qua `http://` thông thường.
> 
> 👉 **Giải pháp nhanh nhất**: Bạn có thể sử dụng domain miễn phí **`180.93.124.132.sslip.io`** (tự động trỏ thẳng về IP `180.93.124.132` mà không cần mua domain, đồng thời cấp được chứng chỉ SSL Let's Encrypt chuẩn HTTPS 100%).
> 
> *(Nếu bạn đã có tên miền riêng như `kujilingo.com`, bạn chỉ cần tạo bản ghi A trỏ `api.kujilingo.com` về `180.93.124.132`).*

---

## BƯỚC 1: Kết Nối Vào Server Cloud & Cài Đặt Môi Trường

### 1.1. Kết nối SSH vào Cloud Server
Mở Terminal / PowerShell trên máy tính của bạn và chạy:
```bash
ssh root@180.93.124.132
```
- Khi hệ thống hỏi `Are you sure you want to continue connecting (yes/no/[fingerprint])?`: Gõ `yes` và nhấn Enter.
- Nhập mật khẩu: `H9xeD2961b82g4Cq` *(khi gõ mật khẩu trên Linux ký tự sẽ ẩn đi, bạn chỉ cần gõ đúng hoặc chuột phải paste rồi nhấn Enter)*.

---

### 1.2. Cài đặt Docker, Docker Compose, Git & Nginx
Sau khi đã ở trong server (`root@...:~#`), copy và chạy khối lệnh sau:
```bash
# 1. Cập nhật hệ thống
apt update && apt upgrade -y

# 2. Cài đặt các gói cần thiết
apt install -y git curl ufw docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# 3. Kích hoạt Docker
systemctl enable --now docker

# 4. Mở các port tường lửa cần thiết
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw --force enable
```

---

## BƯỚC 2: Tải Mã Nguồn Backend & Cấu Hình

### 2.1. Clone source code Backend
```bash
# Tạo thư mục làm việc
mkdir -p /var/www && cd /var/www

# Clone repository Backend (nhập thông tin GitHub nếu repo ở chế độ Private)
git clone https://github.com/LeDuyCoder/KujiLingo_BE.git kujilingo-be
cd /var/www/kujilingo-be
```

---

### 2.2. Copy file `.env` từ máy Local lên Server (Cách nhanh nhất)
Thay vì phải tạo lại các khóa JWT RSA-2048 phức tạp, bạn hãy mở một **Terminal PowerShell mới tại máy tính của bạn** và chạy lệnh `scp`:

```powershell
# Chạy lệnh này trên PowerShell máy tính cá nhân của bạn:
scp d:\Kujilingo\KujiLingo_BE\.env root@180.93.124.132:/var/www/kujilingo-be/.env
```
*(Nhập mật khẩu `H9xeD2961b82g4Cq` khi được yêu cầu)*.

---

### 2.3. Chỉnh sửa biến môi trường trên Server
Quay lại cửa sổ SSH trên server, mở file `.env` vừa upload:
```bash
nano /var/www/kujilingo-be/.env
```

Kiểm tra và sửa 2 dòng sau cho khớp môi trường Docker Production:
```dotenv
# Đảm bảo DATABASE_URL kết nối tới container postgres nội bộ:
DATABASE_URL="postgresql://postgres:123456@postgres:5432/kujilingo?schema=public"

# Cập nhật tạm thời URL frontend (sau khi deploy Vercel xong sẽ điền link vercel chính thức):
FRONTEND_URL="https://180.93.124.132.sslip.io"
```
*(Bấm `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát).*

---

### 2.4. Khởi chạy Docker Container
Tại thư mục `/var/www/kujilingo-be`, chạy lệnh:
```bash
docker compose up -d --build
```

Kiểm tra trạng thái các container:
```bash
docker compose ps
```
Nếu bạn thấy `kujilingo-backend` và `kujilingo-postgres` đều có trạng thái `Up`, nghĩa là các container đã chạy thành công.

---

### 2.5. Chạy Prisma Migration khởi tạo Database
Chạy migration để tạo bảng trên cơ sở dữ liệu mới:
```bash
docker compose exec backend npx prisma migrate deploy
```

*(Tùy chọn) Nạp dữ liệu ban đầu cho database:*
```bash
docker compose exec backend npm run seed:grammar
docker compose exec backend npm run seed:favorites
```

Kiểm tra backend phản hồi nội bộ:
```bash
curl http://localhost:8000/health
# Kết quả trả về: {"status":"ok"}
```

---

## BƯỚC 3: Cấu Hình Nginx & Cấp SSL (HTTPS) Cho Backend

Chúng ta sẽ sử dụng domain miễn phí **`180.93.124.132.sslip.io`** (hoặc subdomain của bạn nếu có).

### 3.1. Tạo cấu hình Reverse Proxy Nginx
Chạy lệnh tạo file config:
```bash
nano /etc/nginx/sites-available/kujilingo
```

Dán nội dung cấu hình sau:
```nginx
server {
    listen 80;
    server_name 180.93.124.132.sslip.io;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*(Nếu bạn dùng domain riêng, hãy thay `180.93.124.132.sslip.io` bằng domain của bạn, ví dụ `api.kujilingo.com`).*

Kích hoạt cấu hình:
```bash
ln -s /etc/nginx/sites-available/kujilingo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

### 3.2. Cấp chứng chỉ SSL HTTPS miễn phí với Certbot
Chạy lệnh:
```bash
certbot --nginx -d 180.93.124.132.sslip.io
```
- Nhập địa chỉ email của bạn khi được hỏi.
- Chọn `Y` để đồng ý với điều khoản của Let's Encrypt.
- Certbot sẽ tự động cấu hình HTTPS cho Nginx.

Sau khi hoàn tất, mở trình duyệt trên máy tính truy cập:
👉 **`https://180.93.124.132.sslip.io/health`**
Nếu màn hình hiển thị:
```json
{"status":"ok"}
```
Chúc mừng bạn! Backend đã có kết nối HTTPS an toàn sẵn sàng cho Frontend Vercel kết nối!

---

## BƯỚC 4: Deploy Frontend Web Lên Vercel (Bỏ Qua Mobile)

Dự án `KujiLingo_FE` là monorepo (chứa `apps/web` và `apps/mobile`). Chúng ta chỉ deploy `apps/web`.

### 4.1. Đẩy code Frontend mới nhất lên GitHub
Tại máy local:
```powershell
cd d:\Kujilingo\KujiLingo_FE
git add .
git commit -m "chore: ready for vercel deployment"
git push origin dev
```

---

### 4.2. Import Project vào Vercel
1. Truy cập [https://vercel.com](https://vercel.com) và đăng nhập.
2. Bấm nút **Add New...** -> chọn **Project**.
3. Chọn tài khoản GitHub và tìm repository **KujiLingo_FE** -> Bấm **Import**.

---

### 4.3. Cấu hình cài đặt Monorepo trên Vercel
Tại giao diện **Configure Project**:

1. **Framework Preset**: Chọn **Next.js**.
2. **Root Directory**:
   - Bấm nút **Edit** bên cạnh mục Root Directory.
   - Chọn thư mục **`apps/web`**.
   - Bấm **Continue**.
   *(Vercel sẽ tự động hiểu cấu trúc monorepo qua `pnpm-workspace.yaml`)*.
3. **Environment Variables**:
   - Thêm biến môi trường sau:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://180.93.124.132.sslip.io/api/v1`
4. Bấm nút **Deploy**.

---

### 4.4. Nhận kết quả từ Vercel
Đợi khoảng 1 - 2 phút để Vercel build Next.js.
Sau khi hoàn thành, bạn sẽ nhận được đường link website, ví dụ:
`https://kujilingo-web.vercel.app`

---

## BƯỚC 5: Kết Nối Hoàn Chỉnh & Test Hệ Thống

### 5.1. Cập nhật `FRONTEND_URL` trên Server
Quay lại terminal SSH trên server:
```bash
nano /var/www/kujilingo-be/.env
```
Cập nhật dòng `FRONTEND_URL` thành link Vercel thực tế vừa nhận:
```dotenv
FRONTEND_URL="https://kujilingo-web.vercel.app"
```
Khởi động lại backend để nhận biến mới:
```bash
cd /var/www/kujilingo-be
docker compose restart backend
```

---

### 5.2. Kiểm tra hoạt động (End-to-End Test)
1. Mở link Vercel trên trình duyệt: `https://kujilingo-web.vercel.app`.
2. Mở cửa sổ DevTools (Bấm `F12`), chuyển sang tab **Console** và tab **Network**.
3. Thử nghiệm các tính năng:
   - Đăng ký / Đăng nhập tài khoản.
   - Tra từ điển / Học từ vựng / Xem bảng xếp hạng.
4. Xác nhận trong tab Network: Các request tới `https://180.93.124.132.sslip.io/api/v1/...` đều trả về status `200/201 OK`, không gặp bất kỳ lỗi CORS hay Mixed Content nào.

---

## 🛠️ Lệnh Tiện Ích Thường Dùng Trên Server (180.93.124.132)

### 1. Cập nhật code Backend khi có commit mới:
```bash
cd /var/www/kujilingo-be
git pull origin dev
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

### 2. Xem log Backend đang chạy:
```bash
cd /var/www/kujilingo-be
docker compose logs -f backend
```

### 3. Xem log Database Postgres:
```bash
cd /var/www/kujilingo-be
docker compose logs -f postgres
```

### 4. Sao lưu (Backup) dữ liệu Database:
```bash
docker compose exec -t postgres pg_dump -U postgres kujilingo > /root/backup_kujilingo_$(date +%F).sql
```
