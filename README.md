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
| `npm run db:reencrypt-secrets` | Re-encrypt `Supplier.apiKey` + `User.apiKeyEnc` sau khi đổi `ENCRYPTION_KEY` (truyền `OLD_ENCRYPTION_KEY=<khoá cũ>` hoặc `OLD_KEY_FROM_SESSION_SECRET=true`) |
| `npm run admin:reset-2fa`     | Cứu admin mất điện thoại **và** mã dự phòng: xoá secret 2FA, mở khoá, thu hồi mọi session (`npm run admin:reset-2fa -- admin@example.com`) |
| `npm run worker:sync`         | Worker tự đồng bộ catalog (mặc định mỗi 5 phút / supplier)                                     |
| `npm run typecheck`           | `tsc --noEmit`                                                                                 |
| `npm test`                    | Vitest (unit test, không cần DB/Redis)                                                          |
| `npm run lint`                | ESLint flat config (`eslint.config.mjs`)                                                       |

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
| CSRF             | `apiRoute`/`apiRouteWithParams` gọi `assertTrustedOrigin` (`src/lib/security/csrf.ts`): request ghi dữ liệu có `Origin` khác host của app, hoặc `Sec-Fetch-Site: cross-site` → `403 CSRF_ORIGIN_REJECTED`. Miễn trừ `/api/webhooks/*`, `/api/v1/partner/*` và request có `Authorization`/`X-API-Key`; không cần client gửi thêm token |
| Rate limit store | Redis lỗi → `503 RATE_LIMIT_UNAVAILABLE` (fail-closed); cầu dao sau 5 lần lỗi liên tiếp mở 30s để không request nào phải chờ timeout (`src/lib/security/rate-limit.ts`)                                                       |
| Audit log        | Mọi request ghi `/api/admin/*` thành công được ghi `AuditLog` ở trung tâm (`src/lib/services/audit.service.ts`), không phụ thuộc từng route                                                                                      |
| Cảnh báo bảo mật | Khoá tài khoản sau 5 lần sai mật khẩu (`SECURITY_LOCKOUT`) và spike 401/403/429 ≥ 25 lần/10 phút/IP (`SECURITY_DENIAL_SPIKE`) gửi mail admin, chống trùng bằng `dedupeKey`                                                       |
| Khoá mã hoá      | `crypto.ts` không còn fallback hard-code: thiếu `ENCRYPTION_KEY` thì suy ra từ `SESSION_SECRET` và log lỗi lúc khởi động (`instrumentation.ts`); thiếu cả hai → throw                                                                 |
| 2FA admin        | TOTP RFC 6238 (`src/lib/auth/totp.ts`), secret lưu AES-256-GCM, 8 mã dự phòng dùng 1 lần lưu dạng HMAC. Bật 2FA → `/api/auth/login` chỉ trả challenge ký HMAC (5 phút), session chỉ được tạo sau `/api/auth/2fa/login`. Mặc định bắt buộc ở production (`ADMIN_2FA_REQUIRED`) |

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

### Xác thực hai lớp (2FA) cho admin

Bật tại `/admin/security` (menu **Bảo mật tài khoản**): quét QR bằng Google Authenticator / Authy → nhập mã 6 số → nhận 8 mã dự phòng dùng 1 lần.

- **Luồng đăng nhập**: `POST /api/auth/login` đúng mật khẩu nhưng tài khoản đã bật 2FA → chỉ trả `{ twoFactorRequired: true, challenge }` (ký HMAC bằng `SESSION_SECRET`, hết hạn **5 phút**). Session chỉ được tạo khi `POST /api/auth/2fa/login` nhận mã TOTP (hoặc mã dự phòng) hợp lệ.
- Mã dự phòng lưu dạng HMAC-SHA256, mỗi mã dùng **1 lần** (xoá bằng `updateMany` có guard để 2 request song song không tiêu được cùng một mã).
- Sai mã tính vào **cùng bộ đếm khoá tài khoản** như sai mật khẩu: 5 lần → khoá 15 phút + mail `SECURITY_LOCKOUT`.
- `ADMIN_2FA_REQUIRED`: mặc định **bật ở production**, tắt ở dev. Khi bắt buộc mà admin chưa thiết lập: mọi API `/api/admin/*` trả `403 TWO_FACTOR_REQUIRED` và admin shell hiện banner vàng; `/admin/security` + các API `/api/auth/2fa/*` vẫn dùng được để hoàn tất đăng ký (không thể tự khoá mình ra ngoài).
- Mất điện thoại **và** mã dự phòng: chạy trên server `npm run admin:reset-2fa -- admin@example.com` — xoá secret, mở khoá tài khoản, thu hồi mọi session, ghi `AuditLog` `USER_2FA_RESET`.
- Mọi thao tác bật/tắt/tạo lại mã đều ghi `AuditLog` (`USER_2FA_ENABLED`, `USER_2FA_DISABLED`, `USER_2FA_RECOVERY_CODES_ROTATED`) và bị rate limit riêng.

### Giám sát uptime & cảnh báo đồng bộ nhà cung cấp

**`GET /api/health`** (public, không cần đăng nhập, `Cache-Control: no-store`) là điểm bám cho monitor ngoài (UptimeRobot / Better Stack / cron + `curl`):

| Trạng thái | HTTP | Khi nào                                                                                       |
| ---------- | ---- | --------------------------------------------------------------------------------------------- |
| `ok`       | 200  | DB + Redis ping được, worker còn heartbeat, không NCC nào có `lastSyncError`                   |
| `degraded` | 503  | Hạ tầng OK nhưng worker chết (heartbeat > 120s) hoặc có NCC đang lỗi                           |
| `error`    | 503  | DB hoặc Redis không phản hồi (timeout 2.5s mỗi check)                                          |

Body chỉ gồm số liệu tổng hợp (latency, số NCC, trạng thái sync gần nhất) — không có tên NCC hay số dư, vì endpoint này truy cập được ẩn danh. Worker ghi heartbeat `worker:supplier-sync:heartbeat` (TTL 180s) ở mỗi tick; deploy **không** chạy worker thì đặt `HEALTH_EXPECT_SYNC_WORKER=false`.

**Cảnh báo sync lỗi liên tiếp** (`src/lib/services/supplier-health.service.ts`) chạy sau mỗi tick sync, throttle 5 phút bằng Redis lock `supplier-sync-health`:

- **3 lần** `SupplierSyncLog` `FAILED` liên tiếp, **hoặc** quá **12 giờ** không có lần `SUCCESS`/`PARTIAL` nào trên NCC đang bật auto-sync → gửi mail `SUPPLIER_SYNC_FAILURE` tới danh sách cảnh báo, kèm lỗi gần nhất, trạng thái kết nối và lần thành công cuối.
- Chống trùng bằng `dedupeKey` theo cửa sổ 6 giờ: mỗi NCC tối đa 1 mail/6h và tự nhắc lại cho tới khi sync thành công trở lại.
- Khác với cảnh báo số dư: cảnh báo này bắt được kiểu hỏng „API key hết hạn nên catalog đứng yên nhưng đơn vẫn chạy”.

## Kiểm tra & CI

`.github/workflows/ci.yml` chạy 3 job song song:

| Job           | Nội dung                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `verify`      | `npm ci` → `prisma migrate deploy` (Postgres 16 + Redis 7 service) → `typecheck` → `vitest run` → `lint` → `next build` |
| `audit`       | `npm audit --omit=dev --audit-level=high` (chỉ chặn lỗi trong cây production)                          |
| `secrets`     | `gitleaks detect` trên toàn bộ lịch sử commit                                                         |

Chạy tương đương ở máy local:

```bash
npm run typecheck && npm test && npm run lint && npm run build
```

## Tài liệu nghiệp vụ

Xem [writing-block.md](writing-block.md).
