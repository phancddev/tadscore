# Triển khai

## Chạy local bằng Docker Compose

Yêu cầu: Docker Engine/Desktop có Compose v2. `make` chỉ là tiện ích, không bắt buộc.

```bash
make setup
# Review .env (script đã gen password nếu còn CHANGE_ME; giữ các value sẵn có).
make up
make ps
```

Hoặc không dùng Make:

```bash
./scripts/generate-env.sh
# fallback thủ công: cp .env.example .env  rồi sửa CHANGE_ME
docker compose up --build -d
docker compose ps
```

Mở:

- App: `http://localhost:1107`
- Mail local: `http://localhost:1109`
- API reference: `http://localhost:1107/api/docs` (sau khi stack healthy)

Lần đầu có thể lâu hơn vì Docker phải pull image và pnpm tải dependency trong build stage. Sau khi
image đã build, runtime không cần tải package hay gọi cloud service.

## Trình tự startup

Compose bảo đảm:

1. PostgreSQL trả `pg_isready`.
2. Container `migrate` chạy dbmate và exit code 0.
3. API khởi động, load rule registry và health check database.
4. Nginx web gateway chỉ khởi động sau khi API healthy.

Nếu migration lỗi, API/web không được khởi động. Xem lỗi bằng:

```bash
docker compose logs migrate postgres
```

## Dùng trong mạng LAN

1. Lấy IP LAN cố định của máy host.
2. Đặt `WEB_ORIGIN=http://<host-ip>:1107` trong `.env`.
3. Restart: `docker compose up -d`.
4. Cho phép inbound TCP 1107 trong firewall chỉ từ mạng tin cậy.

Người dùng cùng Wi-Fi mở URL đó trên PC/mobile. Port 1109 chứa OTP và email nhạy cảm; không nên
mở Mailpit cho toàn LAN nếu không cần.

## Production sau reverse proxy TLS

Mô hình khuyến nghị:

```text
Internet -> reverse proxy TLS :443 -> host 127.0.0.1:1107 -> TadScore Nginx -> API
```

Checklist:

1. Dùng domain và chứng chỉ TLS hợp lệ.
2. Đặt `WEB_ORIGIN=https://score.example.org` và `COOKIE_SECURE=true`.
3. Dùng password PostgreSQL ngẫu nhiên mạnh, URL-encode trong `DATABASE_URL`.
4. Không publish PostgreSQL/API/SMTP ra host.
5. Chặn port 1109 hoặc bind Mailpit vào loopback qua override Compose; production thật nên cấu
   hình SMTP phù hợp.
6. Reverse proxy phải hỗ trợ streaming SSE, tắt buffering cho đường dẫn `*/events` và dùng read
   timeout dài hơn một giờ.
7. Backup database và uploads trước mỗi release có migration.
8. Đặt retention/rotation cho Docker logs và giám sát dung lượng volume.

Ví dụ proxy ngoài phải chuyển ít nhất:

```text
Host
X-Real-IP
X-Forwarded-For
X-Forwarded-Proto
```

Không đặt CDN/proxy cache trước API hoặc SSE nếu chưa cấu hình bypass cache cho `/api/*`.

## Update phiên bản

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=200 migrate api web
```

Migration chạy tự động trước API. Không sửa migration cũ để xử lý lỗi release; rollback application
chỉ an toàn nếu schema mới backward-compatible. Với migration phá vỡ tương thích, dùng backup hoặc
migration forward-fix đã review.

## Dừng và xóa

```bash
docker compose down                 # giữ database/uploads/mail
docker compose down --volumes       # XÓA toàn bộ dữ liệu local
```

Lệnh có `--volumes` là destructive và không dùng trong quy trình update thông thường.

## Development ngoài container

Workspace yêu cầu Node.js 22 và pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

Database của Compose không publish ra host theo mặc định. Khi phát triển API trực tiếp trên host,
tạo Compose override tạm để expose PostgreSQL chỉ vào `127.0.0.1`, hoặc chạy API trong container.
Không thêm port database vào file production chỉ để phục vụ development.
