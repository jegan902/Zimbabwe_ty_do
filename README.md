# Digishop — trung gian bán tài khoản số đa nhà cung cấp

Website mirror catalog từ API nhà cung cấp (Quang Vinh, …), bán qua ví khách hàng, mua giúp bằng API key của bạn.

## Kiến trúc catalog

1. **Sync** gọi API NCC → chuẩn hóa → `SupplierProduct` + `Product` + mapping + tính giá bán.
2. **Khách xem** đọc Postgres (nhanh, có cache ngắn).
3. **Khách mua** revalidate giá live từ NCC; nếu đổi giá phải xác nhận.

Cập nhật lại catalog: admin sync hoặc `npm run db:sync`.

## Setup local

Yêu cầu: Docker Desktop, Node 20+.

```bash
# 1. Biến môi trường
#    cp .env.example .env  (mẫu đầy đủ + giải thích từng biến)
#    DATABASE_URL, REDIS_URL, SESSION_SECRET
#    TRUST_PROXY=true khi chạy sau nginx/CDN (bắt buộc để rate limit theo IP thật)
#    SEPAY_WEBHOOK_SECRET (production từ chối webhook nếu không cấu hình)
#    ADMIN_EMAIL, ADMIN_PASSWORD cho tài khoản seed
#    SUPPLIER_QUANGVINH_BASE_URL, SUPPLIER_QUANGVINH_API_KEY

# 2. Hạ tầng
docker compose up -d

# 3. Schema + seed (seed mirror toàn bộ sản phẩm từ Quang Vinh)
npm install
npm run db:setup

# 4. Dev server
npm run dev
```

Hoặc double-click `scripts/setup-local-db.command`.

### Scripts hữu ích

| Lệnh                          | Việc                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run db:migrate`          | Áp migration Prisma                                                                            |
| `npm run db:seed`             | Upsert supplier từ `.env` + sync catalog lần đầu                                               |
| `npm run db:sync`             | Đồng bộ lại mọi supplier ACTIVE                                                                |
| `npm run db:setup`            | migrate + seed                                                                                 |
| `npm run db:migrate-api-keys` | Chuyển API key partner từ plaintext sang `apiKeyHash` + `apiKeyEnc` (chạy 1 lần sau migration) |
| `npm run worker:sync`         | Worker tự đồng bộ catalog (mặc định mỗi 5 phút / supplier)                                     |

Tài khoản admin được seed từ `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Nếu không đặt `ADMIN_PASSWORD`, seed dùng mặc định `admin@digishop.com` / `Admin@123456` cho môi trường dev và **bỏ qua** việc tạo admin khi `NODE_ENV=production`.

Partner API key: gửi qua header `X-API-Key` (hoặc `Authorization: Bearer`) là đường chính; `?api_key=` vẫn được chấp nhận cho script cũ nhưng bị ghi log deprecation vì URL lọt vào access log/`Referer`.

## Chống lạm dụng (anti-abuse)

| Lớp              | Cấu hình                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limit Redis | login 10/15m (theo IP **và** theo email), register 10/h, forgot 5/15m (IP + mailbox), reset OTP 5/15m (IP + tài khoản), checkout 10/phút/user, partner API 60/phút/key, catalog 120/phút/IP                                        |
| Kết nối realtime | tối đa 3 SSE/user, 10/IP mỗi instance                                                                                                                                                                                              |
| Webhook          | bắt buộc `SEPAY_WEBHOOK_SECRET` hoặc `SEPAY_API_KEY` ở production, so sánh constant-time                                                                                                                                           |
| Header           | CSP + HSTS (prod) + `nosniff`/`X-Frame-Options`/`Referrer-Policy` qua `src/proxy.ts`                                                                                                                                               |
| `/admin`         | proxy chặn khách chưa có cookie phiên; **`admin/layout.tsx` kiểm tra role ở server** (user thường nhận 404, không tải được bundle admin); API vẫn dùng `requireApiAdmin`                                                           |
| Body size        | `apiRoute`/`apiRouteWithParams` chặn theo `Content-Length`: JSON ≤ 256 KB, webhook ≤ 512 KB (`src/lib/utils/body.ts`); webhook đọc theo stream nên body chunked không lách được, trả `413 PAYLOAD_TOO_LARGE`                       |
| Partner API key  | Lưu dạng `apiKeyHash` (SHA-256, dùng để tra cứu) + `apiKeyEnc` (AES-256-GCM, để chủ key xem lại); cột `apiKey` plaintext đã được backfill và xoá trắng. Ưu tiên header `X-API-Key`; `?api_key=` vẫn chạy nhưng ghi log deprecation |
| Docker           | Postgres/Redis chỉ publish ra loopback (`127.0.0.1`), không mở ra LAN/VPS                                                                                                                                                          |

### Auto sync

Worker tự chạy cùng process Next qua `src/instrumentation.ts` — chỉ cần `npm run dev` hoặc `npm start`, **không cần terminal thứ 2**:

```bash
npm run dev   # hoặc npm start
```

Worker đọc `SupplierSyncSettings` (`isAutoSyncEnabled`, `syncInterval` giây: 60/300/900/1800/3600). Mặc định **300s (5 phút)**. Manual sync vẫn dùng `npm run db:sync` hoặc nút admin.

Tắt trên instance phụ bằng `SYNC_WORKER_ENABLED=false` (PM2 cluster / nhiều container); trên serverless (Vercel Functions) nên tắt và dùng Cron ngoài gọi API đồng bộ, vì process bị đóng băng giữa các request.

Vẫn có thể chạy worker tách riêng (không phụ thuộc web process):

```bash
npm run worker:sync
```

Realtime SSE (sau sync): `GET /api/realtime`.

### Cảnh báo số dư nhà cung cấp

1. `test-connection` / mỗi lần sync cập nhật `SupplierBalance.balance` (`balanceType = ACTUAL`, `lastVerifiedAt`).
2. Sau mỗi tick sync, `runSupplierBalanceAlertsThrottled()` quét NCC `ACTIVE` — tối đa 1 lần / 5 phút (Redis lock `supplier-balance-alerts` dùng TTL làm throttle).
3. `balance <= alertThreshold` → ghi `EmailNotification` (dedupeKey unique, chống 2 worker gửi trùng) → gửi SMTP tới `ADMIN_ALERT_EMAIL`.

Quy tắc gửi: **1 mail khi vừa xuống ngưỡng**, nhắc lại theo chu kỳ cấu hình được (mặc định **24h**), và reset `lowBalanceNotifiedAt` khi số dư hồi phục. Bỏ qua NCC có `alertThreshold = 0` hoặc số dư chưa từng được xác nhận (tránh spam NCC mới tạo có số dư 0).

Chu kỳ nhắc lại và **danh sách email nhận cảnh báo**: `/admin/suppliers` → **Cài đặt cảnh báo** (lưu `NotificationSetting`: `balance_alert_repeat_minutes`, `alert_recipients`; chu kỳ 5 phút – 14 ngày, tối đa 5 email). Thứ tự ưu tiên: DB setting → `BALANCE_ALERT_REPEAT_MINUTES` / `ADMIN_ALERT_EMAIL` → mặc định 1440 phút. Để trống ô email = quay lại dùng `ADMIN_ALERT_EMAIL`.

Thiếu `SMTP_*` hoặc `ADMIN_ALERT_EMAIL` → bản ghi ở trạng thái `SKIPPED`, trang `/admin/suppliers` hiện banner vàng cảnh báo.

| API                                           | Việc                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/admin/notifications`                | SMTP đã cấu hình chưa, người nhận, 20 email gần nhất                          |
| `POST /api/admin/notifications/check-balance` | Quét và gửi ngay (bỏ qua throttle 5 phút, rate limit 6/phút/admin)            |
| `PUT /api/admin/notifications/settings`       | Đổi chu kỳ nhắc lại (`repeatMinutes`, 5–20160) và/hoặc danh sách `recipients` |

## Tài liệu nghiệp vụ

Xem [writing-block.md](writing-block.md).
