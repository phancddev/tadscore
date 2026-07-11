# Vận hành

## Lệnh thường dùng

```bash
make setup              # merge/gen .env từ .env.example (giữ value sẵn có)
make up                 # build/start nền
make ps                 # trạng thái và health
make logs               # follow log toàn stack
make migrate            # apply migration pending
make account-create     # tạo account qua CLI an toàn
make test               # test workspace
make build              # build toàn workspace
make validate           # line/migration/Compose checks
make down               # stop, giữ volume
```

Sinh env thủ công / dry-run:

```bash
./scripts/generate-env.sh
./scripts/generate-env.sh -n    # in ra stdout, không ghi .env
./scripts/generate-env.sh -f    # force gen lại POSTGRES_PASSWORD + DATABASE_URL
```

Nếu `corepack` trên host lỗi chữ ký khi resolve pnpm, dùng trực tiếp:

```bash
npx -y pnpm@10.13.1 test
npx -y pnpm@10.13.1 build
```

## Tạo account trực tiếp

Không có account mặc định. Sau khi API healthy:

```bash
make account-create
make account-create ARGS="--email admin@example.test --username admin --full-name 'Admin User' --role super_admin"
```

Role hợp lệ chỉ gồm `user` và `super_admin`. Script yêu cầu terminal tương tác, đọc password hai
lần không echo rồi pipe qua stdin vào compiled CLI. Password không đi qua argument, `.env` hay
container environment. Account tạo bằng CLI được active + verified ngay.

Nên tạo `super_admin` ban đầu từ console host tin cậy, đăng nhập kiểm tra, rồi bảo vệ account bằng
password riêng mạnh. Workspace role vẫn được quản lý riêng.

## Migration

Tên file bắt buộc `00001_reason.sql`, tăng tuần tự và có đúng hai section:

```sql
-- migrate:up
-- thay đổi schema

-- migrate:down
-- hoàn tác thay đổi trên
```

Kiểm tra:

```bash
pnpm db:check
docker compose run --rm migrate --migrations-dir /db/migrations status
docker compose run --rm migrate --migrations-dir /db/migrations up
```

Rollback đúng một migration gần nhất (chỉ dùng khi đã đánh giá mất dữ liệu):

```bash
docker compose run --rm migrate --migrations-dir /db/migrations down
```

Kiểm thử migration đảo chiều đầy đủ trên project Compose tách biệt nên chạy `up`, rollback từng
file từ migration mới nhất về `00001`, rồi `up` lại. Không chạy bài này trên dữ liệu production.

Không sửa file đã deploy. Dbmate theo dõi version trong `schema_migrations`; không dùng blanket
`IF NOT EXISTS` để che schema drift.

## Test backend với PostgreSQL thật

Unit test API không cần database và sẽ skip integration nếu thiếu biến:

```bash
npx -y pnpm@10.13.1 --filter @tadscore/api test
```

Integration test dùng Fastify inject nhưng kết nối PostgreSQL thật. Quy trình an toàn là tạo
Compose project riêng, expose Postgres bằng override tạm vào loopback/port riêng, chạy migration
`up/down/up`, rồi bật `TADSCORE_INTEGRATION=1`:

```bash
TADSCORE_INTEGRATION=1 \
DATABASE_URL='postgresql://tadscore:<password>@127.0.0.1:<port>/tadscore?sslmode=disable' \
npx -y pnpm@10.13.1 --filter @tadscore/api test
```

Test tạo account/workspace qua API, không dựa vào seed account hay password trong `.env`. Coverage
bao gồm OTP/link/off auth, login email/username, global/workspace RBAC, invitation email/share link,
team limit, scoring/ranking, idempotency conflict, purchase affordability/phase limit,
locked/archived read-only, game reversal atomicity, public privacy/link revoke, audit/outbox,
Swagger/health và account CLI stdin. Nếu thêm test mới, giữ mỗi file dưới 300 dòng và tách helper
chung thay vì nhồi thêm vào một spec lớn.

## Backup

Tạo thư mục backup có quyền truy cập hạn chế. Database dump dạng custom:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump \
  -U tadscore -d tadscore --format=custom --no-owner --no-acl \
  > backups/tadscore-$(date +%Y%m%d-%H%M%S).dump
```

Backup uploads bằng tên volume thực (xem bằng `docker volume ls`). Có thể dùng container tạm đọc
volume và ghi tar vào thư mục backup:

```bash
docker run --rm \
  -v tadscore_uploads-data:/source:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'tar -czf /backup/uploads.tar.gz -C /source .'
```

Tên volume có prefix từ `COMPOSE_PROJECT_NAME`; sửa lệnh nếu đã đổi prefix. Mailpit thường chỉ là
dữ liệu development và không cần backup production.

## Restore

Restore vào database trống hoặc sau khi đã xác nhận xóa dữ liệu hiện tại:

```bash
docker compose stop api web
docker compose exec -T postgres dropdb -U tadscore --if-exists tadscore
docker compose exec -T postgres createdb -U tadscore tadscore
docker compose exec -T postgres pg_restore \
  -U tadscore -d tadscore --no-owner --no-acl --clean --if-exists \
  < backups/tadscore.dump
docker compose up -d
```

Test restore định kỳ trên project/volume tách biệt. Backup chưa từng restore thử không được xem là
backup đã xác minh.

## Health và logs

```bash
docker compose ps
docker compose logs --tail=200 postgres migrate api web mailpit
curl -f http://localhost:1107/health
curl -f http://localhost:1109/api/v1/info
```

- `/health` qua port 1107 kiểm tra Nginx/web gateway.
- API container health gọi API `/health`, bao gồm truy vấn database.
- `/api/admin/health` trả trạng thái database, rule registry và email lỗi cho `super_admin`.
- Mailpit API trả version/message count.

## Email lỗi

1. Kiểm tra `SMTP_*` và `docker compose logs api mailpit`.
2. Trong admin dashboard, lọc outbox trạng thái `failed`.
3. Sửa SMTP trước, sau đó retry item; không retry liên tục khi nguyên nhân chưa hết.
4. Kiểm tra inbox Mailpit port 1109 ở local.

Email xử lý theo batch. Sau khi enqueue có thể cần chờ tối đa khoảng một chu kỳ worker trước khi
thấy trong inbox.

## Sự cố startup

### Migration failed

- Đọc log migration đầu tiên lỗi.
- So sánh `schema_migrations` với file repo.
- Không thêm `IF NOT EXISTS` chỉ để làm pipeline xanh.
- Khôi phục backup hoặc viết migration forward-fix nếu schema đã drift.

### API unhealthy

- Xác nhận PostgreSQL healthy và migration exit 0.
- Kiểm tra `DATABASE_URL`, rule JSON và quyền ghi uploads volume.
- Xem error đầu tiên trong `docker compose logs api`.

### Ranking không realtime

- Snapshot HTTP vẫn phải tải được.
- Kiểm tra EventSource `/api/public/rankings/:token/events` trong browser network tab.
- Xác nhận reverse proxy ngoài không buffer/cache và không timeout SSE sớm.
- Client sẽ refetch snapshot khi nhận event `ranking`; event không chứa toàn bộ dữ liệu ranking.

### Điện thoại không truy cập được

- Dùng IP LAN thay `localhost`.
- Đặt `WEB_ORIGIN` đúng IP/scheme/port và restart.
- Kiểm tra cùng mạng Wi-Fi, firewall host và không bật client isolation.

## Kết thúc sự kiện

1. Khóa workspace để ngừng nhập điểm.
2. Export JSON ranking + ledger.
3. Tạo database dump và backup uploads.
4. Ghi lại rule ID/version/hash.
5. Revoke public/invitation link nếu không cần giữ public.
6. Chỉ archive workspace sau khi đối soát lịch sử.
