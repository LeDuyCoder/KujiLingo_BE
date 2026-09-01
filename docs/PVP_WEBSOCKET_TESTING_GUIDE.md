# Hướng Dẫn Kiểm Thử PVP Realtime WebSocket Module (`WSS /ws/v1/pvp`)

Tài liệu hướng dẫn kiểm thử chi tiết hệ thống thi đấu PVP tiếng Nhật thời gian thực qua WebSocket, hỗ trợ 3 chế độ thi đấu: `SPEED_QUIZ`, `HP_BATTLE`, và `ENERGY_BAR`.

---

## 1. Đã Cài Đặt & Cấu Hình

- Endpoint WebSocket: `WSS /ws/v1/pvp`
- Authentication Handshake: `Authorization: Bearer <access_token>` hoặc `?access_token=<access_token>`
- Plugin: `@fastify/websocket`
- Core Modules:
  - `src/websocket/pvp-session.manager.ts`: Quản lý phiên kết nối, JWT auth, Ping/Pong Heartbeat (25s) và Event Replay Buffer (30s grace period).
  - `src/websocket/pvp-matchmaker.manager.ts`: Quản lý hàng chờ Ghép ngẫu nhiên và Lời mời Bạn bè.
  - `src/websocket/pvp-room.manager.ts`: Game Loop thời gian thực hỗ trợ cả 3 chế độ `SPEED_QUIZ`, `HP_BATTLE`, `ENERGY_BAR`.
  - `src/websocket/pvp.socket.ts`: Gateway Router tiếp nhận lệnh từ Client.

---

## 2. Kiểm Thử Tự Động Thời Gian Thực (Automated Real-time Test Client)

Một script kiểm thử tự động đã được tích hợp tại `scripts/pvp-ws-test-client.ts`. Script này sẽ:
1. Tạo/Xác thực 2 người chơi thử nghiệm (`PVP Player 1` và `PVP Player 2`).
2. Mở 2 kết nối WebSocket độc lập tới server `ws://localhost:3000/ws/v1/pvp`.
3. Giả lập toàn bộ quy trình: `lobby.join` → `matchmaking.start` → `matchmaking.found` → `player.ready` → `match.started` → `question.issued` / `question.answer` → `match.finished` → `settlement.completed`.

### Cách chạy:

Khởi chạy server dev (nếu chưa chạy):
```bash
npm run dev
```

Trong terminal khác, chạy script test theo từng chế độ thi đấu:

#### Chế độ 1: Trắc nghiệm tốc độ (`SPEED_QUIZ`)
```bash
npm run test:pvp-ws -- --mode=SPEED_QUIZ
```

#### Chế độ 2: Đấu trường mất máu (`HP_BATTLE`)
```bash
npm run test:pvp-ws -- --mode=HP_BATTLE
```

#### Chế độ 3: Đua thanh năng lượng (`ENERGY_BAR`)
```bash
npm run test:pvp-ws -- --mode=ENERGY_BAR
```

---

## 3. Nhật Ký Kết Quả Mong Đợi (Expected Test Output)

Khi chạy thành công, terminal sẽ hiển thị luồng dữ liệu 2 chiều đầy đủ:

```text
==================================================
🚀 Starting PVP WebSocket Realtime Test Client
🎮 Selected Battle Mode: HP_BATTLE
==================================================

📡 Connecting Player 1 (PVP Player 1)...
📡 Connecting Player 2 (PVP Player 2)...
✅ [Player 1] Connected to WSS /ws/v1/pvp
✅ [Player 2] Connected to WSS /ws/v1/pvp
📥 [Player 1] Received Event: 'connection.ready'
📤 [Player 1] Sending 'lobby.join' (HP_BATTLE)
📥 [Player 2] Received Event: 'connection.ready'
📤 [Player 2] Sending 'lobby.join' (HP_BATTLE)
📥 [Player 1] Received Event: 'lobby.joined'
📤 [Player 1] Sending 'matchmaking.start'
📥 [Player 2] Received Event: 'lobby.joined'
📤 [Player 2] Sending 'matchmaking.start'
📥 [Player 1] Received Event: 'matchmaking.searching'
🎯 [Player 2] Opponent Found! Match ID: match_1a2b3c...
🎯 [Player 1] Opponent Found! Match ID: match_1a2b3c...
📤 [Player 1] Sending 'player.ready'
📤 [Player 2] Sending 'player.ready'
🔥 [Player 1] Match Started! Mode: HP_BATTLE, Questions: 5
🔥 [Player 2] Match Started! Mode: HP_BATTLE, Questions: 5
❓ [Player 1] Question 1/5: 勉強
❓ [Player 2] Question 1/5: 勉強
📤 [Player 1] Answered Question 1
📤 [Player 2] Answered Question 1
📊 [Player 1] Question Result: correct=true
   HP: { 'user_id_1': 2000, 'user_id_2': 1850 }
...
🏆 [Player 1] Match Finished! Winner: user_id_1, Condition: HP_HIGHER
💳 [Player 1] Settlement Completed! Rating Changes: { 'user_id_1': 15, 'user_id_2': -15 }

🎉 Test Completed Successfully for mode HP_BATTLE!
```

---

## 4. Bảng Tra Cứu Error Codes

| Code | Ý nghĩa |
|---|---|
| `UNAUTHORIZED` | Token không hợp lệ hoặc thiếu Token trong Handshake. |
| `DUPLICATE_SESSION` | Tài khoản đăng nhập trên kết nối WebSocket mới (kết nối cũ bị ngắt). |
| `SESSION_EXPIRED` | Quá thời gian ân hạn 30s để nối lại phiên (`session.resume`). |
| `INVALID_COMMAND` | Cấu trúc payload gửi lên không hợp lệ. |
| `OPPONENT_UNAVAILABLE` | Đối thủ được mời đang offline hoặc không có sẵn. |
| `INVITE_EXPIRED` | Lời mời thi đấu đã hết hạn (sau 30s). |
| `QUESTION_DEADLINE_EXCEEDED` | Trả lời sau khi server deadline câu hỏi đã kết thúc. |
