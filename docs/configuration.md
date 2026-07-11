# Cấu hình môi trường

Sinh / merge `.env` từ `.env.example` bằng script (khuyến nghị). Script **giữ nguyên** giá trị đã có,
chỉ điền key thiếu hoặc còn placeholder `CHANGE_ME`, và gen `POSTGRES_PASSWORD` + đồng bộ
`DATABASE_URL` khi cần:

```bash
make setup
# hoặc
./scripts/generate-env.sh
./scripts/generate-env.sh -n          # dry-run, không ghi file
./scripts/generate-env.sh -f          # force gen lại password + DATABASE_URL
docker compose up --build -d
```

Khi ghi đè, script backup `.env` → `.env.bak`. Không commit `.env` hay `.env.bak`. File example
không chứa secret dùng được và không chứa account mẫu.

### Hành vi `scripts/generate-env.sh`

| Tình huống                                             | Kết quả                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Key đã có value thật (không chứa `CHANGE_ME`)          | Giữ nguyên                                              |
| Key thiếu so với `.env.example`                        | Lấy giá trị example                                     |
| Value còn `CHANGE_ME`                                  | Coi như chưa set; secret được gen, key khác lấy example |
| `POSTGRES_PASSWORD` thiếu/placeholder                  | Gen random 32 ký tự (url-safe)                          |
| `DATABASE_URL` thiếu/placeholder hoặc password vừa gen | Rebuild từ `POSTGRES_USER` / `PASSWORD` / `DB`          |
| Key chỉ có trong `.env` (không có trong example)       | Giữ lại ở cuối file                                     |

## Compose và URL

| Biến                   | Mặc định example        | Ý nghĩa                                                            |
| ---------------------- | ----------------------- | ------------------------------------------------------------------ |
| `COMPOSE_PROJECT_NAME` | `tadscore`              | Prefix container/network/volume; đổi tên sẽ tạo bộ volume khác     |
| `APP_PORT`             | `1107`                  | Host port cho web, API gateway và public ranking                   |
| `MAILPIT_UI_PORT`      | `1109`                  | Host port cho inbox local; không expose trong production công khai |
| `WEB_ORIGIN`           | `http://localhost:1107` | Origin được CORS/CSRF chấp nhận và base URL đưa vào email          |
| `RULE_CONFIG_PATH`     | `/app/rule-config`      | Đường dẫn rule registry bên trong API container                    |

`WEB_ORIGIN` phải khớp chính xác scheme/host/port người dùng mở. Nếu dùng LAN, ví dụ
`http://192.168.1.20:1107`, dùng địa chỉ đó. Khi deploy TLS dùng URL `https://...`.

## PostgreSQL

| Biến                | Giá trị          | Ý nghĩa                                    |
| ------------------- | ---------------- | ------------------------------------------ |
| `POSTGRES_DB`       | `tadscore`       | Database được image PostgreSQL tạo lần đầu |
| `POSTGRES_USER`     | `tadscore`       | Database role của app                      |
| `POSTGRES_PASSWORD` | bắt buộc đổi     | Password database                          |
| `DATABASE_URL`      | bắt buộc đồng bộ | Connection URL mà dbmate và API sử dụng    |

Password trong `DATABASE_URL` phải URL-encode nếu chứa ký tự đặc biệt. Host phải là service name
`postgres`, không phải `localhost`, khi API chạy trong Compose.

## Xác minh email

| Biến                               | Mặc định | Ý nghĩa                            |
| ---------------------------------- | -------: | ---------------------------------- |
| `AUTH_EMAIL_VERIFICATION_MODE`     |    `otp` | `off`, `otp` hoặc `link`           |
| `AUTH_OTP_LENGTH`                  |      `6` | Số chữ số của OTP                  |
| `AUTH_OTP_TTL_SECONDS`             |  `86400` | Thời hạn OTP/link, mặc định 24 giờ |
| `AUTH_OTP_MAX_ATTEMPTS`            |      `5` | Số lần verify tối đa cho một mã    |
| `AUTH_OTP_RESEND_COOLDOWN_SECONDS` |    `300` | Chờ năm phút trước khi gửi lại     |
| `AUTH_OTP_MAX_SENDS`               |      `5` | Số lần gửi tối đa trong cửa sổ     |
| `AUTH_OTP_SEND_WINDOW_SECONDS`     |  `86400` | Độ dài cửa sổ đếm lượt gửi         |
| `AUTH_OTP_LOCK_SECONDS`            |  `18000` | Khóa gửi năm giờ khi vượt giới hạn |

Hành vi mode:

- `off`: account đăng ký active ngay; không cần SMTP cho đăng ký.
- `otp`: gửi code số; gửi code mới vô hiệu code cũ.
- `link`: gửi token single-use trong link.

Đổi mode không tự active account đang pending. Thay đổi cần restart API. OTP/token chỉ lưu dạng
hash và không được log.

## Session và login protection

| Biến                        |           Mặc định | Ý nghĩa                                  |
| --------------------------- | -----------------: | ---------------------------------------- |
| `SESSION_COOKIE_NAME`       | `tadscore_session` | Tên cookie HttpOnly                      |
| `SESSION_TTL_SECONDS`       |           `604800` | Session bảy ngày                         |
| `COOKIE_SECURE`             |            `false` | Phải là `true` khi chạy HTTPS production |
| `AUTH_LOGIN_MAX_ATTEMPTS`   |               `10` | Lần login lỗi tối đa trong cửa sổ        |
| `AUTH_LOGIN_WINDOW_SECONDS` |              `900` | Cửa sổ đếm login lỗi                     |
| `AUTH_LOGIN_LOCK_SECONDS`   |              `900` | Thời gian khóa sau khi vượt giới hạn     |

Không có `AUTH_SECRET`: session dùng token ngẫu nhiên, database lưu SHA-256 hash. Account password
dùng Argon2. Không đặt password account hoặc super admin trong `.env`.

## SMTP

| Biến            | Mặc định local                            | Ý nghĩa                                  |
| --------------- | ----------------------------------------- | ---------------------------------------- |
| `SMTP_HOST`     | `mailpit`                                 | SMTP hostname từ API container           |
| `SMTP_PORT`     | `1025`                                    | SMTP port                                |
| `SMTP_SECURE`   | `false`                                   | `true` cho implicit TLS, thường port 465 |
| `SMTP_USER`     | rỗng                                      | Username tùy SMTP server                 |
| `SMTP_PASSWORD` | rỗng                                      | Password tùy SMTP server                 |
| `SMTP_FROM`     | `TadScore Local <noreply@tadscore.local>` | Sender hiển thị                          |

Mailpit nhận mail hoàn toàn local tại `http://localhost:1109`. Để gửi tới mailbox thật, thay các
biến SMTP bằng server tự host hoặc nhà cung cấp SMTP. App vẫn khởi động local mà không cần dịch vụ
bên ngoài.

## Upload, logging và proxy

| Biến               | Mặc định        | Ý nghĩa                                                      |
| ------------------ | --------------- | ------------------------------------------------------------ |
| `UPLOAD_DIR`       | `/data/uploads` | Mount point của avatar volume                                |
| `MAX_AVATAR_BYTES` | `5242880`       | Giới hạn upload, mặc định 5 MiB                              |
| `LOG_LEVEL`        | `info`          | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `TRUST_PROXY`      | `true`          | Tin header proxy để lấy protocol/IP; phù hợp Nginx Compose   |

Không đổi `UPLOAD_DIR` nếu chưa đổi volume mount tương ứng trong Compose. Khi đặt TadScore sau
reverse proxy khác, proxy phải ghi đè `X-Forwarded-For` và `X-Forwarded-Proto`, không chuyển tiếp
header giả từ Internet mà không kiểm soát.

## Cấu hình production tối thiểu

```dotenv
WEB_ORIGIN=https://score.example.org
COOKIE_SECURE=true
POSTGRES_PASSWORD=<random-strong-password>
DATABASE_URL=postgresql://tadscore:<url-encoded-password>@postgres:5432/tadscore?sslmode=disable
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
SMTP_FROM=TadScore <noreply@example.org>
```

Không copy các placeholder trên thành secret thật trong git.
