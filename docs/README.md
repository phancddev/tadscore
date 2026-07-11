# Tài liệu TadScore

TadScore là platform chấm điểm local-first cho nhiều workspace. Toàn bộ stack mặc định chạy bằng
Docker Compose, không phụ thuộc dịch vụ cloud. Mailpit cung cấp SMTP và inbox local; avatar được
lưu trong Docker volume.

## Bản đồ tài liệu

- [Kiến trúc hệ thống](architecture.md): thành phần, luồng dữ liệu, mô hình quyền và nguyên tắc
  scoring ledger.
- [Cấu hình môi trường](configuration.md): ý nghĩa, giá trị mặc định và lưu ý bảo mật của từng biến
  trong `.env`.
- [Triển khai](deployment.md): chạy local, chạy trong LAN và triển khai production sau reverse
  proxy/TLS.
- [Vận hành](operations.md): migration, tạo account, backup/restore, kiểm tra health, email và xử lý
  sự cố.
- [API và phân quyền](api.md): nhóm endpoint, authentication, idempotency, SSE và quyền cần thiết.
- [Rule configuration](rules.md): HOH 2026, discrepancy PDF/XLSX, schema, versioning và cách thêm
  rule an toàn.
- [Testing](testing.md): unit, API integration, Compose cô lập, Playwright và coverage kỳ vọng.

Quick start ngắn gọn vẫn nằm tại [README gốc](../README.md).

## Các nguyên tắc không được phá vỡ

1. Không seed account và không đặt password account trong `.env`.
2. Migration đã deploy là bất biến; thay đổi schema bằng migration mới.
3. Điểm là ledger append-only; sửa sai bằng reversal, không sửa/xóa lịch sử.
4. Backend luôn kiểm tra quyền. Ẩn nút ở frontend không phải là kiểm soát truy cập.
5. Public ranking chỉ read-only và không được trả về dữ liệu cá nhân của member.
6. Workspace giữ snapshot + hash của rule tại thời điểm tạo để kết quả cũ không đổi âm thầm.
