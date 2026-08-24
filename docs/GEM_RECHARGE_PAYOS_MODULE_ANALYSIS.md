# Báo Cáo Phân Tích Kiến Trúc & Phân Tích Flow Chi Tiết Module Gem Recharge & Wallet (v3 PayOS Edition)

---

## I. Tổng Quan Kiến Trúc & Thiết Kế Module

Module **Gem Recharge & Wallet (PayOS Edition v3)** được thiết kế tuân thủ hoàn toàn theo kiến trúc phân tầng (Layered Architecture) chuẩn của dự án **KujiLingo Backend** (tương tự các module `favorite-vocabularies`, `grammar`, `folder`):

```
                                    ┌───────────────────────┐
                                    │    Client / Postman   │
                                    └───────────┬───────────┘
                                                │ HTTP / JSON
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Fastify Routing & Middleware (authGuard, Zod validation schema)                         │
│ File: src/modules/gems/gems.routes.ts & src/modules/gems/gems.schema.ts               │
└──────────────────────────────────────────────────┬─────────────────────────────────────┘
                                                   │ Request Context & Validated Input
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Controller Layer (HTTP status mapping, Request/Reply handling)                         │
│ File: src/modules/gems/gems.controller.ts                                             │
└──────────────────────────────────────────────────┬─────────────────────────────────────┘
                                                   │ Business Service Calls
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Business Logic Service Layer                                                           │
│ File: src/modules/gems/gems.service.ts                                                 │
│  ├─ Tính toán khuyến mãi động & tổng gem (gem_amount + bonus_gem)                      │
│  ├─ Sinh mã đơn hàng chuẩn PayOS (transaction_code string & order_code numeric BIGINT) │
│  ├─ Xử lý bất đồng bộ Webhook (Idempotency & HMAC SHA256 Signature Verification)      │
│  └─ Tự động kiểm tra Live Status (Freshness Check Polling)                             │
└───────────────┬────────────────────────────────────────────────────────┬───────────────┘
                │ DB Transactions & Queries                              │ Integration
                ▼                                                        ▼
┌───────────────────────────────────────────────┐     ┌──────────────────────────────────┐
│ Repository Layer (Prisma Client & Postgres)   │     │ PayOS Adapter Integration Layer  │
│ File: src/modules/gems/gems.repository.ts     │     │ File: src/modules/gems/payos.client.ts│
└───────────────────────────────────────────────┘     └──────────────────────────────────┘
```

---

## II. Phân Tích Database & Luồng Xử Lý Dữ Liệu (Data Flow)

### 1. Cập Nhật Cấu Trúc Database Schema (Prisma)
- **`payment_transactions`**:
  - `order_code`: `BIGINT UNIQUE NOT NULL` — Mã đơn hàng dạng số (PayOS yêu cầu `orderCode` nguyên), phân biệt với `transaction_code` (mã tham chiếu nội bộ dạng chuỗi như `KL-1735000000123-ABC`).
  - `qr_code`: `TEXT` — Lưu chuỗi QR VietQR do PayOS trả về để hiển thị thanh toán trực tiếp trên App.
  - `provider_transaction_id`: `VARCHAR` — Lưu `paymentLinkId` của PayOS.
  - `payment_method`: Thêm giá trị `PAYOS` vào Enum `PaymentMethod`.

### 2. Giao Dịch Dữ Liệu Nguyên Tử (Atomic DB Transaction) Khi Nạp Gem Thành Công
Khi PayOS gọi Webhook xác nhận thanh toán thành công (`code: "00"`, `success: true`), hệ thống thực hiện 3 thao tác ghi trong **duy nhất 1 DB Transaction (`prisma.$transaction`)**:
1. Cập nhật `payment_transactions`: `payment_status = 'SUCCESS'`, `paid_at = now()`, `provider_response = reference`.
2. Upsert `user_wallets`: Cộng dồn `gems` thêm `total_gem` của giao dịch.
3. Tạo bản ghi `wallet_histories`: Ghi nhận `transaction_type = 'RECHARGE'`, số gem thay đổi (`gem_change`), và số dư mới (`balance_gem`).

---

## III. Phân Tích Chi Tiết Luồng Chạy Của 6 API

### 1. `GET /api/v1/gems/packages` — Lấy Danh Sách Gói Gem
- **Authentication:** Bearer JWT Token (`authGuard`).
- **Luồng xử lý:**
  1. Lấy tất cả gói gem active (`is_active = true`), sắp xếp theo `sort_order ASC`.
  2. Lấy chương trình khuyến mãi đang chạy (`is_active = true AND start_at <= now() <= end_at`), chọn khuyến mãi có `bonus_percent` cao nhất nếu trùng lặp.
  3. Tính toán động số Gem thưởng thực tế:
     $$\text{effective\_bonus\_gem} = \text{package.bonus\_gem} + \left\lfloor \frac{\text{package.gem\_amount} \times \text{promotion.bonus\_percent}}{100} \right\rfloor$$
  4. Tính tổng Gem: `total_gems = gem_amount + effective_bonus_gem`.
  5. Nếu không có khuyến mãi: `effective_bonus_gem = package.bonus_gem`, `active_promotion: null`.

---

### 2. `GET /api/v1/gems/promotions/active` — Lấy Khuyến Mãi Đang Kích Hoạt
- **Authentication:** Bearer JWT Token (`authGuard`).
- **Luồng xử lý:**
  1. Truy vấn bảng `gem_promotions` tìm chương trình khuyến mãi thỏa mãn thời gian hiện tại.
  2. Trả về thông tin khuyến mãi lớn nhất hoặc `data: null` nếu không có khuyến mãi nào đang hoạt động.

---

### 3. `POST /api/v1/gems/transactions` — Khởi Tạo Giao Dịch Nạp Gem (PayOS)
- **Authentication:** Bearer JWT Token (`authGuard`).
- **Luồng xử lý:**
  1. Kiểm tra `package_id` hợp lệ & đang kích hoạt (trả `422 INVALID_PACKAGE` nếu không tìm thấy).
  2. Khóa khuyến mãi tại thời điểm tạo giao dịch (Promotion Locking): Tính toán `gem_amount`, `bonus_gem`, `total_gem`, và `amount`.
  3. Sinh mã `transaction_code` (chuỗi nội bộ) và `order_code` (số nguyên duy nhất gửi cho PayOS).
  4. Ghi bản ghi `payment_transactions` vào DB với trạng thái `PENDING` và `expired_at = now() + 15 phút` **trước khi** gọi PayOS.
  5. Gọi PayOS SDK `payOSAdapter.createPaymentLink(...)`.
  6. Nếu thành công: Cập nhật `payment_url` (`checkoutUrl`), `qr_code` (`qrCode`), `provider_transaction_id` (`paymentLinkId`) vào DB và trả về `201 Created`.
  7. Nếu PayOS lỗi: Cập nhật trạng thái DB thành `FAILED` và trả lỗi `500 PAYMENT_GATEWAY_ERROR`.

---

### 4. `POST /api/v1/gems/callback/payos` — Webhook Xác Nhận Thanh Toán Từ PayOS
- **Authentication:** Không dùng Bearer Token (Xác thực bằng Chữ ký Số HMAC-SHA256 của PayOS).
- **Luồng xử lý:**
  1. **Xác thực chữ ký PayOS:** Sử dụng `payOSAdapter.verifyWebhook(req.body)`. Nếu chữ ký sai, trả về `400 INVALID_SIGNATURE` ngay lập tức và ghi log.
  2. Tìm giao dịch trong DB qua `data.orderCode`. Nếu không thấy, trả `404 TRANSACTION_NOT_FOUND`.
  3. **Kiểm tra tính Idempotent:** Nếu giao dịch đã ở trạng thái kết thúc (`SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`), bỏ qua và trả về `200 { success: true }`.
  4. Nếu `code == "00"` và `success == true`: Chạy DB Transaction cộng Gem vào ví người dùng, tạo lịch sử ví, cập nhật trạng thái `SUCCESS`.
  5. Trả về HTTP `200 { "success": true }`.

---

### 5. `GET /api/v1/gems/transactions/:transactionId` — Lấy Trạng Thái Giao Dịch (Polling)
- **Authentication:** Bearer JWT Token (`authGuard`).
- **Luồng xử lý:**
  1. Tìm giao dịch thuộc về `user_id` hiện tại. Trả `404 TRANSACTION_NOT_FOUND` nếu không tìm thấy.
  2. Nếu trạng thái là `PENDING` và đã hết hạn (`now() > expired_at`): Cập nhật trạng thái thành `EXPIRED`.
  3. **Freshness Enhancement (Cơ chế chủ động kiểm tra live status):** Nếu giao dịch vẫn đang `PENDING` và còn hạn, gọi PayOS API `getPaymentLinkInfo` để kiểm tra trực tiếp. Nếu PayOS đã đổi sang `PAID`, thực hiện cộng Gem đồng bộ và trả về `SUCCESS`.

---

### 6. `GET /api/v1/gems/wallet-history` — Xem Lịch Sử Ví (Lịch Sử Nạp/Tiêu Gem)
- **Authentication:** Bearer JWT Token (`authGuard`).
- **Query parameters:** `transaction_type`, `page` (default 1), `limit` (default 20).
- **Luồng xử lý:**
  1. Truy vấn bảng `wallet_histories` theo `user_id` và loại giao dịch (nếu có).
  2. Trả về danh sách được phân trang, sắp xếp mới nhất lên đầu (`created_at DESC`).

---

## IV. Hướng Dẫn Test Chi Tiết Bằng Postman

### 1. Cấu Hình Môi Trường Postman (Environment Variables)

Khởi tạo các biến môi trường trong Postman Collection:
- `baseUrl`: `http://localhost:3000`
- `accessToken`: `<JWT_ACCESS_TOKEN_CỦA_USER>`

---

### 2. Danh Sách Các Request Postman

#### API 1: List Gem Packages
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/gems/packages`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`
- **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "gp1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
        "title": "Starter Pack",
        "gem_amount": 100,
        "bonus_gem": 10,
        "effective_bonus_gem": 20,
        "total_gems": 120,
        "price": 29000,
        "image": "https://cdn.kujilingo.com/gems/starter.png",
        "is_popular": false,
        "is_best_value": false
      }
    ],
    "active_promotion": {
      "id": "gpr1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
      "title": "Summer Bonus +10%",
      "bonus_percent": 10,
      "end_at": "2026-08-30T23:59:59.000Z"
    }
  }
}
```

---

#### API 2: Get Active Promotions
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/gems/promotions/active`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`
- **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "gpr1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
    "title": "Summer Bonus +10%",
    "description": "Get 10% more gems this week!",
    "bonus_percent": 10,
    "start_at": "2026-08-01T00:00:00.000Z",
    "end_at": "2026-08-30T23:59:59.000Z"
  }
}
```

---

#### API 3: Create Payment Transaction (Initiate Recharge)
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/gems/transactions`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "package_id": "gp1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
  "payment_method": "PAYOS",
  "buyer_email": "user@example.com"
}
```
- **Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "pt1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
    "transaction_code": "KL-1735000000000-A1B2C3",
    "order_code": 1735000000123,
    "payment_url": "https://pay.payos.vn/web/6c3392a824ba4297b6d1417e28f30f0a",
    "qr_code": "00020101021238570010A00000072701270006970422011300000123456789020208QRIBFTTA53037045802VN...",
    "amount": 29000,
    "gem_amount": 100,
    "bonus_gem": 20,
    "total_gem": 120,
    "expired_at": "2026-08-24T13:05:00.000Z"
  },
  "message": "Payment initiated. Redirect the user to payment_url, or render qr_code for in-app bank-transfer checkout."
}
```

---

#### API 4: PayOS Payment Webhook Callback
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/gems/callback/payos`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "code": "00",
  "desc": "success",
  "success": true,
  "data": {
    "orderCode": 1735000000123,
    "amount": 29000,
    "description": "KujiLingo gems",
    "accountNumber": "0123456789",
    "reference": "FT26082412345",
    "transactionDateTime": "2026-08-24 13:00:00",
    "currency": "VND",
    "paymentLinkId": "124c33293c43417ab7879e14c8d9eb18",
    "code": "00",
    "desc": "Thành công"
  },
  "signature": "8d8640d802576397a1ce45ebda7f835055768ac7ad2e0bfb77f9b8f12cca4c7f"
}
```
- **Expected Response (200 OK):**
```json
{
  "success": true
}
```

---

#### API 5: Get Transaction Status
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/gems/transactions/pt1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`
- **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "pt1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
    "payment_status": "SUCCESS",
    "total_gem": 120,
    "amount": 29000,
    "paid_at": "2026-08-24T13:00:00.000Z"
  }
}
```

---

#### API 6: Get Wallet History
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/gems/wallet-history?transaction_type=RECHARGE&page=1&limit=20`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`
- **Expected Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "wh1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6789",
      "transaction_type": "RECHARGE",
      "coin_change": 0,
      "gem_change": 120,
      "balance_coin": 0,
      "balance_gem": 120,
      "note": "Purchased Starter Pack",
      "created_at": "2026-08-24T13:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```
