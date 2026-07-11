# API và phân quyền

API dùng JSON, nằm dưới `/api` và được truy cập qua cùng origin với React app. Interactive OpenAPI
UI nằm tại `/api/docs`. Source code/schema dùng chung trong `packages/contracts` là chuẩn chính xác
cho request body.

## Quy ước

- Thành công trả `{ "data": ... }`.
- Lỗi trả HTTP status phù hợp cùng mã lỗi ổn định; UI không nên parse message để điều khiển logic.
- Session nằm trong cookie HttpOnly, SameSite Strict.
- Request ghi từ browser có session phải có `Origin` nằm trong `WEB_ORIGIN`.
- Client gửi `Content-Type: application/json` trừ upload avatar multipart.
- ID là UUID, token public/invitation là chuỗi bí mật không được log/chia sẻ ngoài đối tượng.

## Authentication

| Method/path                           | Mục đích                                   | Truy cập                           |
| ------------------------------------- | ------------------------------------------ | ---------------------------------- |
| `GET /api/auth/config`                | Mode verify và cooldown runtime            | Public                             |
| `POST /api/auth/register`             | Đăng ký account                            | Public + rate limit                |
| `POST /api/auth/verify`               | Verify OTP/link                            | Public                             |
| `POST /api/auth/resend`               | Gửi lại verification                       | Public + rate limit                |
| `POST /api/auth/login`                | Login bằng email hoặc username             | Public + rate limit                |
| `POST /api/auth/logout`               | Revoke session hiện tại                    | Authenticated                      |
| `GET /api/auth/me`                    | Profile/session hiện tại                   | Authenticated                      |
| `POST /api/auth/forgot-password`      | Queue reset email                          | Public + response không dò account |
| `POST /api/auth/reset-password`       | Reset bằng OTP/link, revoke session        | Public                             |
| `PATCH /api/auth/profile`             | Đổi name/username, bắt đầu đổi email       | Authenticated                      |
| `POST /api/auth/profile/verify-email` | Xác nhận email mới                         | Authenticated                      |
| `POST /api/auth/password`             | Đổi password, tùy chọn revoke session khác | Authenticated                      |
| `POST /api/auth/avatar`               | Upload avatar                              | Authenticated                      |

`AUTH_EMAIL_VERIFICATION_MODE=off` chỉ bỏ verification lúc đăng ký; các luồng nhạy cảm vẫn phải
tuân theo contract/runtime config hiện hành.

## Workspace và invitation

| Nhóm                       | Quyền tối thiểu        |
| -------------------------- | ---------------------- |
| List/tạo workspace         | Authenticated          |
| Xem workspace/member/team  | `viewer`               |
| Sửa workspace              | `admin`                |
| Đổi/xóa member             | `admin`                |
| Tạo team                   | `admin`                |
| Tạo/list/revoke invitation | `admin`                |
| Xem invitation theo token  | Public có token        |
| Accept invitation          | Authenticated có token |

`GET .../members` chỉ trả member `status=active`. Gỡ member là soft-delete (`status=removed`);
người đó mất quyền workspace ngay và không còn hiện trong list. Owner không thể bị đổi role/gỡ.
Invitation email chỉ dành cho đúng email; share link có `maxUses`, expiry và role. Không dùng link
share vĩnh viễn cho quyền edit. Owner không được cấp qua invitation.

## Scoring

Prefix: `/api/workspaces/:workspaceId`.

| Method/path suffix                  | Mục đích                                      | Quyền    |
| ----------------------------------- | --------------------------------------------- | -------- |
| `GET /activities`                   | Danh sách activity                            | `viewer` |
| `GET /ranking`                      | Ranking nội bộ (+ shop/limits từ snapshot)    | `viewer` |
| `GET /ranking/:teamId`              | Breakdown team                                | `viewer` |
| `GET /ledger`                       | Audit scoring có filter/pagination            | `viewer` |
| `POST /games`                       | Submit đủ kết quả rank của game               | `scorer` |
| `POST /games/:submissionId/reverse` | Reverse toàn submission                       | `admin`  |
| `POST /adjustments`                 | Speech/violation/adjustment                   | `scorer` |
| `POST /purchases`                   | Mua mảnh/vật phẩm                             | `scorer` |
| `PATCH /ledger/:entryId`            | Sửa medal delta + reason (adjustment/penalty) | `scorer` |
| `POST /ledger/:entryId/reverse`     | Reverse một entry hợp lệ                      | `admin`  |
| `GET /export.json`                  | Export ranking + ledger                       | `viewer` |

### Idempotency

Mọi lệnh ghi scoring nhận `idempotencyKey` trong body. Key phải được tạo mới cho một ý định nghiệp
vụ và giữ nguyên khi retry cùng request. Không tái sử dụng key cho nội dung khác. API trả lại kết
quả cũ khi request trùng hợp lệ, và trả `IDEMPOTENCY_CONFLICT` khi cùng key trỏ tới payload hoặc
submission khác.

### Ranking payload và shop UI

`GET /ranking` (và public ranking) trả leaderboard từ ledger + rule snapshot của workspace. Response
còn gồm block `shop` (giá piece/item, `minimumPieces`, `pieceLimit`) lấy từ **rule snapshot**, không
từ registry live, để UI shop/limits khớp hành vi scoring đã khóa. `pieceLimit.active` phụ thuộc
activity gate trong snapshot (ví dụ activity finalize đã mở limit hay chưa). Client không được tự
bịa giá/limit; mọi purchase/adjustment vẫn enforce server-side trên snapshot.

### Submit game

Request phải gửi đúng một kết quả cho mỗi team active và rank là hoán vị `1..N`. API lấy award từ
rule snapshot của workspace, không tin medal/piece do client gửi. Transaction chỉ commit khi toàn
bộ submission, activity result và ledger entry đều hợp lệ.

### Edit adjustment / penalty

`PATCH /ledger/:entryId` cho phép `scorer` (và `admin`/`owner`) sửa **in-place** `medalDelta` và
`reason` của entry `adjustment` hoặc `penalty` chưa bị reverse. Có thể đổi dấu (+ ↔ −). Không áp
dụng cho purchase, activity award hay entry đã reverse. Thay đổi điểm phát ranking update; mọi lần
sửa ghi `audit_logs` (`score.ledger.update`).

### Reversal

Không có endpoint xóa ledger. Reversal tạo delta đối dấu, chỉ được thực hiện một lần và lưu actor,
lý do, thời điểm. Reverse game luôn đảo toàn bộ submission trong một transaction; cùng key retry
submission đó là idempotent, nhưng tái dùng key cho submission khác là conflict. Reverse purchase
đồng thời giảm inventory.

## Public ranking

Mỗi workspace có **tối đa một** public ranking link (create-once). Link random token và custom
slug tồn tại song song; **public/private độc lập** qua `tokenEnabled` và `slugEnabled` (path private
trả 404, path còn lại vẫn hoạt động).

| Method/path                                                | Mục đích                                     | Truy cập       |
| ---------------------------------------------------------- | -------------------------------------------- | -------------- |
| `GET /api/workspaces/:id/public-links`                     | List (gồm token + url + slugUrl)             | `admin`        |
| `POST /api/workspaces/:id/public-links`                    | Tạo một lần; nếu đã có thì trả link hiện tại | `admin`        |
| `PATCH /api/workspaces/:id/public-links/:linkId`           | Cập nhật slug / label / public-private       | `admin`        |
| `DELETE /api/workspaces/:id/public-links/:linkId`          | Revoke (private + revoked)                   | `admin`        |
| `POST /api/workspaces/:id/public-links/:linkId/regenerate` | Đổi random token (slug giữ nguyên)           | `admin`        |
| `GET /api/public/rankings/:key`                            | Ranking snapshot (`token` **hoặc** `slug`)   | Public nếu bật |
| `GET /api/public/rankings/:key/teams/:teamId`              | Team breakdown                               | Public nếu bật |
| `GET /api/public/rankings/:key/events`                     | SSE live update                              | Public nếu bật |

Body tạo: `{ slug?, label?, expiresInHours?, isEnabled?, tokenEnabled?, slugEnabled? }`
(`isEnabled` gán cả hai path). Body PATCH: `{ slug?, label?, isEnabled?, tokenEnabled?,
slugEnabled?, expiresInHours? }` (`null` xóa slug/label/expiry).

SSE gửi event tên `ranking` và heartbeat comment. Frontend nhận event rồi refetch snapshot thay vì
coi payload SSE là state duy nhất. Client phải tự reconnect; proxy phải tắt buffering.

## Platform admin

Tất cả endpoint `/api/admin/*` yêu cầu `super_admin`:

- list/search account; đổi global role/status và mark verified;
- list/suspend/restore workspace;
- xem audit log;
- xem health rule registry;
- xem/retry outbox lỗi;
- xem platform health.

`super_admin` cũng bypass workspace membership như quyền `owner` để can thiệp khẩn cấp. Audit log
phải được giữ và review; không dùng account super admin cho nhập điểm hằng ngày.

## Rule registry

`GET /api/rules` trả các rule load thành công để dropdown tạo workspace sử dụng.
`GET /api/rules/health` trả cả trạng thái load/validation. Không có API sửa rule; thay đổi rule bằng
file versioned trong `rule-config`, test, review và deploy code.
