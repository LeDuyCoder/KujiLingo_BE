# KujiLingo Backend API — PVP Module (REST API v2) Test Guide & Postman Documentation

> **Tài liệu hướng dẫn kiểm thử và tập hợp toàn bộ Test Cases trên Postman cho Module PVP (Player vs Player)**

---

## I. Cấu Hình Environment Trên Postman

Tạo một Environment mới trên Postman (ví dụ: `KujiLingo-Local`) với các biến sau:

| Variable Name | Initial Value | Current Value | Description |
|---|---|---|---|
| `baseUrl` | `http://localhost:3000` | `http://localhost:3000` | URL của server backend |
| `accessToken` | `<your_jwt_access_token>` | `<your_jwt_access_token>` | Bearer token nhận được sau khi đăng nhập (`POST /auth/login`) |
| `internalApiKey` | `kujilingo_pvp_internal_secret_key_2026` | `kujilingo_pvp_internal_secret_key_2026` | Pre-shared key cho Service-to-Service internal endpoints |
| `userId` | `<uuid_player1>` | `<uuid_player1>` | UUID của User 1 |
| `opponentId` | `<uuid_player2>` | `<uuid_player2>` | UUID của User 2 (Đối thủ) |

---

## II. Danh Sách Endpoints & Mẫu Request cURL

---

### 1. Get My PVP Statistics

#### 🔹 Request Detail
- **HTTP Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/pvp/statistics`
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`

#### 🔹 Mẫu cURL:
```bash
curl --location 'http://localhost:3000/api/v1/pvp/statistics' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### 🔹 Success Response (`200 OK` - Đã từng thi đấu):
```json
{
  "success": true,
  "data": {
    "total_matches": 42,
    "wins": 28,
    "losses": 12,
    "draws": 2,
    "win_rate": 66.7,
    "rating": 1350,
    "highest_rating": 1410
  }
}
```

#### 🔹 Success Response (`200 OK` - Người chơi mới chưa có trận đấu nào):
```json
{
  "success": true,
  "data": {
    "total_matches": 0,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "win_rate": null,
    "rating": 1200,
    "highest_rating": 1200
  }
}
```

#### 🔹 Error Response (`401 Unauthorized` - Hết hạn/Không có Token):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access token is missing, invalid, or expired."
  }
}
```

---

### 2. Get Match History

#### 🔹 Request Detail
- **HTTP Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/pvp/history?result=WIN&page=1&limit=20`
- **Query Parameters:**
  - `result` *(Optional)*: `WIN` | `LOSS` | `DRAW` (Lọc kết quả trận đấu theo góc nhìn người gọi)
  - `page` *(Optional)*: `1` (Mặc định: 1)
  - `limit` *(Optional)*: `20` (Min: 1, Max: 50, Mặc định: 20)
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`

#### 🔹 Mẫu cURL:
```bash
curl --location 'http://localhost:3000/api/v1/pvp/history?result=WIN&page=1&limit=20' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### 🔹 Success Response (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "b3c9a1d2-7e8f-4a0b-9c3d-1e2f3a4b5c6d",
      "opponent_id": "9843c9aa-ef01-48db-9a8f-2e42ae8f8942",
      "opponent_name": "Minh",
      "opponent_avatar": null,
      "result": "WIN",
      "score": {
        "player": 8,
        "opponent": 5
      },
      "rating_change": 15,
      "played_at": "2026-08-25T10:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

#### 🔹 Error Response (`400 Bad Request` - Truyền filter kết quả sai):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/result must be equal to one of the allowed values"
  }
}
```

#### 🔹 Error Response (`400 Bad Request` - Truyền limit quá 50):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/limit must be <= 50"
  }
}
```

---

### 3. Record Match Result (Internal / Post-Match)

#### 🔹 Request Detail
- **HTTP Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/pvp/matches`
- **Headers:**
  - `Content-Type`: `application/json`
  - `X-Internal-Key`: `{{internalApiKey}}`
- **Body (JSON Raw):**
```json
{
  "user_id": "u1a2b3c4-1111-2222-3333-444455556666",
  "opponent_id": "u2b3c4d5-7777-8888-9999-000011112222",
  "winner_id": "u1a2b3c4-1111-2222-3333-444455556666",
  "user_score": 8,
  "opponent_score": 5,
  "rating_change_user": 15,
  "rating_change_opponent": -15,
  "played_at": "2026-08-25T14:00:00.000Z",
  "external_match_id": "e7b8c9d0-1234-5678-90ab-cdef12345678"
}
```

#### 🔹 Mẫu cURL:
```bash
curl --location 'http://localhost:3000/api/v1/pvp/matches' \
--header 'Content-Type: application/json' \
--header 'X-Internal-Key: kujilingo_pvp_internal_secret_key_2026' \
--data '{
  "user_id": "u1a2b3c4-1111-2222-3333-444455556666",
  "opponent_id": "u2b3c4d5-7777-8888-9999-000011112222",
  "winner_id": "u1a2b3c4-1111-2222-3333-444455556666",
  "user_score": 8,
  "opponent_score": 5,
  "rating_change_user": 15,
  "rating_change_opponent": -15,
  "played_at": "2026-08-25T14:00:00.000Z"
}'
```

#### 🔹 Success Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "match_id": "e7b8c9d0-1234-5678-90ab-cdef12345678"
  },
  "message": "Match recorded."
}
```

#### 🔹 Error Response (`401 Unauthorized` - X-Internal-Key thiếu hoặc sai):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INTERNAL_KEY",
    "message": "X-Internal-Key is missing or invalid."
  }
}
```

#### 🔹 Error Response (`422 Unprocessable Entity` - User ID không tồn tại):
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with ID u1a2b3c4-1111-2222-3333-444455556666 does not exist."
  }
}
```

---

### 4. Get PVP Leaderboard

#### 🔹 Request Detail
- **HTTP Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/pvp/leaderboard?limit=50`
- **Query Parameters:**
  - `limit` *(Optional)*: `50` (Min: 1, Max: 100, Mặc định: 50)
- **Headers:**
  - `Authorization`: `Bearer {{accessToken}}`

#### 🔹 Mẫu cURL:
```bash
curl --location 'http://localhost:3000/api/v1/pvp/leaderboard?limit=50' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### 🔹 Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "rank": 1,
        "user_id": "u1a2b3c4-1111-2222-3333-444455556666",
        "display_name": "Pro Player",
        "avatar": null,
        "rating": 1450,
        "wins": 35,
        "total_matches": 50,
        "win_rate": 70.0
      },
      {
        "rank": 2,
        "user_id": "u2b3c4d5-7777-8888-9999-000011112222",
        "display_name": "Rookie Player",
        "avatar": null,
        "rating": 1150,
        "wins": 10,
        "total_matches": 25,
        "win_rate": 40.0
      }
    ],
    "current_user": {
      "rank": 1,
      "rating": 1450,
      "total_matches": 50
    }
  }
}
```

#### 🔹 Error Response (`400 Bad Request` - Limit vượt quá 100):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/limit must be <= 100"
  }
}
```

---

## III. Bảng Tổng Hợp Test Cases Cho Postman Validation

| # | Test Case Title | Endpoint | Method | Input Parameters / Body | Expected Status | Expected Code |
|---|---|---|---|---|---|---|
| 1 | Thống kê cá nhân - Chưa Auth | `/statistics` | `GET` | Không header `Authorization` | `401` | `UNAUTHORIZED` |
| 2 | Thống kê cá nhân - Auth thành công (Chưa đấu) | `/statistics` | `GET` | Valid Bearer Token | `200` | `success: true`, `total_matches: 0`, `win_rate: null` |
| 3 | Lịch sử trận đấu - Query kết quả sai | `/history` | `GET` | `?result=INVALID` | `400` | `VALIDATION_ERROR` |
| 4 | Lịch sử trận đấu - Limit quá 50 | `/history` | `GET` | `?limit=100` | `400` | `VALIDATION_ERROR` |
| 5 | Lịch sử trận đấu - Lật góc nhìn thắng/thua | `/history` | `GET` | `?page=1&limit=20` | `200` | `result` tự động đổi theo User ID người gọi |
| 6 | Ghi nhận trận đấu - X-Internal-Key sai | `/matches` | `POST` | Header `X-Internal-Key: wrong` | `401` | `INVALID_INTERNAL_KEY` |
| 7 | Ghi nhận trận đấu - User không tồn tại | `/matches` | `POST` | UUID không có trong DB | `422` | `USER_NOT_FOUND` |
| 8 | Ghi nhận trận đấu - Thành công & Update Stats | `/matches` | `POST` | Valid JSON + Header hợp lệ | `201` | `Match recorded.`, tự động cộng/trừ ELO và số trận thắng/thua |
| 9 | Bảng xếp hạng - Limit > 100 | `/leaderboard` | `GET` | `?limit=150` | `400` | `VALIDATION_ERROR` |
| 10 | Bảng xếp hạng - Trả về Top N và Rank người gọi | `/leaderboard` | `GET` | Valid Token | `200` | Đơn vị xếp theo `rating DESC`, trả về `current_user.rank` live |
