# Kiến trúc hệ thống

## Tổng quan

```text
Browser PC/mobile/projector
          |
          | HTTP/SSE :1107
          v
Nginx web gateway
  |-- React static app
  |-- /api/* ---------> Fastify API -----> PostgreSQL
  |-- /uploads/* -----> Fastify API -----> uploads volume
                              |
                              +----------> Mailpit SMTP/inbox

Startup: postgres healthy -> migrate hoàn tất -> api healthy -> web healthy
```

Chỉ web gateway (`1107`) và Mailpit UI (`1109`) được publish ra host. PostgreSQL, SMTP, API và
container migration chỉ nằm trên Docker network nội bộ.

## Thành phần

| Thành phần             | Trách nhiệm                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `apps/web`             | React responsive cho desktop, mobile, tablet và projector             |
| `apps/api`             | Fastify API, auth, RBAC, scoring, public ranking, SSE và outbox email |
| `packages/contracts`   | Zod schema/type dùng chung giữa API và web                            |
| `packages/rule-engine` | Tính award, balance, điều kiện hợp lệ và ranking xác định             |
| `rule-config`          | Rule JSON được quản lý bằng code và version                           |
| `database/migrations`  | SQL migration tuần tự do dbmate quản lý                               |
| Nginx                  | Serve SPA, reverse proxy API/uploads và tắt buffering cho SSE         |
| PostgreSQL             | Nguồn dữ liệu duy nhất cho account, workspace và scoring ledger       |
| Mailpit                | SMTP + inbox local, không gửi mail ra Internet                        |

## Domain chính

### Identity

Account có đúng một global role: `user` hoặc `super_admin`. Session dùng random token trong cookie
HttpOnly; database chỉ lưu hash của token. Account đăng ký có thể cần OTP/link tùy cấu hình.

### Workspace

Workspace đại diện cho một sự kiện, ví dụ trại hè 2026. Mỗi workspace có member role độc lập:

| Role     | Khả năng chính                                       |
| -------- | ---------------------------------------------------- |
| `owner`  | Toàn quyền workspace, là người tạo workspace         |
| `admin`  | Cấu hình, member/invitation, public link và reversal |
| `scorer` | Nhập game, adjustment/violation và purchase          |
| `viewer` | Xem ranking, team detail, ledger và export           |

Thứ tự quyền là `viewer < scorer < admin < owner`. `super_admin` có quyền emergency/platform
override và được API xem như `owner` ở mọi workspace dù không có membership. Mọi thao tác ghi của
override vẫn đi qua audit log với actor ID; chỉ cấp role này cho người vận hành tin cậy và phải rà
soát audit log sau khi can thiệp.

### Rule snapshot

Khi tạo workspace, API đọc rule từ registry rồi lưu `rule_id`, `rule_version`, toàn bộ JSON
snapshot và SHA-256 hash. Việc sửa file trong `rule-config` sau đó không tự thay đổi workspace cũ.

Rule HOH 2026 hiện chốt các giả định sau trong chính file rule:

- Warm-up hạng nhất là 14 theo Excel, không phải ví dụ 140 trong PDF.
- Tổng award hai Big Game là 515.
- Đội đủ tối thiểu bốn mảnh xếp trước; đội chưa đủ xếp theo số mảnh rồi huy hiệu.
- Tie-break ổn định theo tên rồi ID.

### Scoring ledger

`score_ledger` là source of truth. Mỗi dòng chứa delta huy hiệu, mảnh ghép và vật phẩm. Balance và
ranking luôn được tổng hợp từ ledger; không có cột tổng điểm có thể bị lệch.

- Một game hoàn chỉnh, bốn kết quả và award tương ứng được ghi trong một transaction.
- Mỗi lệnh ghi có idempotency key để retry/double-click không cộng hai lần.
- Sửa sai tạo dòng `reversal` đối dấu và tham chiếu dòng gốc.
- Purchase đồng thời ghi ledger và cập nhật inventory trong cùng transaction.
- PostgreSQL advisory lock tuần tự hóa các thao tác có thể tranh chấp balance.

## Email outbox

Request nghiệp vụ chỉ enqueue email vào `email_outbox`. Vòng xử lý nền trong API lấy batch, gửi
SMTP và ghi trạng thái `sent`/`failed`. Lỗi SMTP vì vậy không làm mất invitation hoặc verification
request; super admin có thể xem và retry email lỗi.

## Public ranking và SSE

Public link lưu hash token, có thể expire, revoke hoặc regenerate. Người xem không cần account.
React tải snapshot ranking bằng HTTP rồi mở SSE tại
`/api/public/rankings/:token/events`. Nginx tắt proxy buffering/cache và giữ kết nối dài; khi có
event `ranking`, client refetch snapshot mới.

## Persistence

Ba named volume tồn tại qua restart/container replacement:

- `postgres-data`: toàn bộ database.
- `uploads-data`: avatar.
- `mailpit-data`: inbox Mailpit local.

`docker compose down` giữ volume. Chỉ `docker compose down --volumes` xóa dữ liệu.
