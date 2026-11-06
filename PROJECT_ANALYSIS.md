# Phân tích yêu cầu và kế hoạch triển khai

**Tài liệu yêu cầu:** `../tailieu2.md` (đã đọc toàn bộ 1.394 dòng)  
**Thư mục làm việc:** `app/`  
**Ngày khảo sát:** 2026-11-05

## Phạm vi an toàn và quyết định triển khai

Tài liệu yêu cầu bán tài khoản số, gọi nhà cung cấp để lấy `username|password`, lưu thông tin đăng nhập đã mã hóa rồi giao/hiển thị lại cho người mua. Không triển khai nghiệp vụ mua bán, lưu trữ hoặc bàn giao mật khẩu hay quyền kiểm soát tài khoản cá nhân. Vì vậy, các luồng order trả về/lưu/hiển thị credentials và bảng `OrderCredential` không được dùng làm tính năng vận hành.

Có thể tiếp tục với nền tảng bán **sản phẩm số hợp pháp không chuyển giao quyền kiểm soát tài khoản cá nhân** (ví dụ mã bản quyền/credit do nhà phát hành cho phép phân phối hoặc dịch vụ số). Chưa tự đổi nghiệp vụ trong code vì loại hàng và hợp đồng API thay thế chưa được xác nhận. Việc gọi API mua hàng thật, thanh toán thật hoặc migration lên database thật cũng chưa thực hiện.

## 1. Mục tiêu tổng thể

Xây dựng marketplace đa nhà cung cấp với danh mục sản phẩm được chuẩn hóa, đồng bộ có kiểm soát, ví khách hàng và vốn nhà cung cấp tách biệt, thanh toán có đối soát, mua trực tiếp, quản trị và báo cáo. Hệ thống phải đảm bảo tính nhất quán tài chính, idempotency, audit và đối soát khi trạng thái từ bên ngoài không rõ.

Mục tiêu kinh doanh cốt lõi gắn với chuyển giao thông tin đăng nhập tài khoản cá nhân nên **không thuộc phạm vi triển khai**. Kiến trúc và các module độc lập (đăng nhập website, danh mục, ví, thanh toán, quản trị, đồng bộ dữ liệu sản phẩm phù hợp) có thể được giữ lại sau khi người dùng xác nhận phạm vi sản phẩm hợp lệ.

## 2. Chức năng bắt buộc trong yêu cầu và trạng thái

| Nhóm yêu cầu | Trạng thái trong source hiện tại | Việc còn lại / giới hạn |
|---|---|---|
| Tài khoản người dùng, session, phân quyền | Đang triển khai ở thư viện; chưa có API hay trang đăng nhập/đăng ký | Thêm routes, UI, xử lý đăng ký/đăng nhập/đăng xuất/reset, rate-limit và test tích hợp sau khi chốt luồng tài khoản website |
| Ví khách hàng, sổ giao dịch, reservation/capture/release | Schema và `wallet.service.ts` đã được phác triển khai; chưa có API/UI và chưa có test nghiệp vụ DB | Kiểm tra tính idempotent dưới cạnh tranh, endpoints có auth, test tích hợp trên DB dùng riêng |
| Nạp tiền, xác minh webhook, đối soát | Có model `PaymentTransaction`/`PaymentWebhook`, env mẫu nêu gateway “TBD”; chưa có endpoint/provider adapter | Chưa thể cộng tiền cho đến khi provider, chữ ký, event ID và contract được xác nhận; chưa gọi giao dịch thật |
| Nhà cung cấp và adapter | Có interface, registry, HTTP helper và adapter Quang Vinh; chưa có quản trị cấu hình hoặc route | Contract Quang Vinh chưa xác minh trực tiếp. Adapter đang dùng `POST /buy_product.php`, trong khi brief ghi `POST /buy_product`; cần xác nhận endpoint trước khi bật. Không bật luồng trả credential |
| Đồng bộ sản phẩm và tự cập nhật giá/trạng thái | Có schema cho nguồn, mapping, lịch sử giá và sync log; chưa có job/service/route/UI | Cần adapter contract xác minh, cơ chế chống job trùng, cập nhật có điều kiện tránh ghi dữ liệu cũ, cache invalidation và test lỗi/mất kết nối |
| Đơn hàng và mua trực tiếp | Có model Order/reservation và phân loại kết quả adapter; chưa có order service/API/UI | Luồng mô tả giao tài khoản/password bị loại khỏi phạm vi. Có thể thiết kế fulfillment cho mặt hàng số hợp lệ không bàn giao quyền tài khoản sau khi chốt contract |
| Số dư nhà cung cấp, top-up, cảnh báo | Có schema; chưa có service/admin UI/email job | Quang Vinh chưa được xác nhận có API balance; chỉ được báo số dư ước tính hoặc số dư nhập tay nếu không có API xác minh |
| Giao diện storefront | Hiện chỉ là trang mặc định Next.js | Chưa có trang sản phẩm, tìm kiếm/lọc, chi tiết, ví, lịch sử, hồ sơ hoặc auth UI |
| Giao diện admin, analytics | Chưa có | Chưa có dashboard, quản lý user/supplier/sync/order/ledger hoặc báo cáo |
| Email cảnh báo/audit | Có schema và một số cấu hình; chưa có gửi email, queue hay UI audit | Cần cấu hình nhà cung cấp email, retry/dedupe, quyền truy cập và test |
| Bảo mật / idempotency | Có helper cho session cookie, CSRF, rate-limit, crypto, logging và secret encryption; chưa được nối vào routes | Rà soát end-to-end trước khi mở routes. Không để log chứa query/response chứa secret hoặc dữ liệu nhạy cảm |

### Phân loại tổng quát

- **Đã có nền tảng nhưng chưa chứng minh nghiệp vụ:** schema, migration, helper session/wallet/supplier, UI components.
- **Đã có một phần và cần sửa/xác minh:** adapter Quang Vinh (endpoint mua không khớp brief; body chưa được xác minh), auth helpers chưa nối route, wallet service chưa có integration tests.
- **Chưa triển khai:** mọi API route, queue/job, webhook handler, UI nghiệp vụ, admin dashboard, integration email/payment.
- **Không triển khai:** lưu/giao thông tin đăng nhập hoặc bàn giao quyền kiểm soát tài khoản cá nhân.
- **Chưa thể triển khai:** tích hợp payment/supplier live khi chưa có API contract xác thực và quyết định sản phẩm hợp lệ.

## 3. Vai trò người dùng

1. **Khách hàng:** tạo tài khoản website, quản lý hồ sơ, xem sản phẩm phù hợp, ví và giao dịch của chính mình, xem đơn của chính mình.
2. **Admin:** quản lý user, catalog, suppliers, sync, số dư ước tính/thực tế, đơn phù hợp, cấu hình lợi nhuận, thông báo và báo cáo.
3. **Superadmin (nếu thật sự cần):** cấu hình hệ thống và phân quyền admin; cần xác nhận vì tài liệu chỉ yêu cầu chung Admin/User nhưng schema đã có vai trò này.
4. **Tác nhân hệ thống/job:** đồng bộ catalog, nhận webhook, đối soát, gửi cảnh báo; quyền tối thiểu và audit đầy đủ.

Không có vai trò nào được phép xem credential của tài khoản cá nhân được mua bán.

## 4. Các trang giao diện dự kiến

### Khách hàng
- Trang chủ; danh mục/tìm kiếm/lọc/sắp xếp; chi tiết mặt hàng.
- Đăng ký, đăng nhập, quên/đổi mật khẩu và hồ sơ.
- Ví, tạo yêu cầu nạp tiền, lịch sử giao dịch; chỉ hiển thị trạng thái thanh toán đã được server xác minh.
- Lịch sử đơn và chi tiết kết quả fulfillment phù hợp; không có trang hiển thị username/password tài khoản.

### Admin
- Dashboard; users; catalog/categories; products và mapping nguồn.
- Suppliers, cấu hình API secret server-side, sức khỏe kết nối và supplier balance loại actual/estimated/unreconciled.
- Sync monitor/log/retry; orders và reconciliation; wallet/payment ledger; pricing/history; email/audit/settings.

Các trang này hiện **chưa tồn tại** ngoài trang starter.

## 5. Quy trình nghiệp vụ

1. **Đăng ký/đăng nhập:** validate input ở server, hash mật khẩu website, tạo session opaque token (DB chỉ lưu hash), cookie an toàn, role guard và rate-limit.
2. **Đồng bộ catalog:** job lấy dữ liệu theo adapter đã xác minh → normalize/validate → transaction DB/upsert → ghi log/history → recalculate giá theo chính sách → invalidate/revalidate cache. Lỗi mạng không đồng nghĩa hết hàng; dữ liệu stale không được coi là stock=0.
3. **Nạp tiền:** tạo pending payment code → nhận webhook đáng tin cậy → verify chữ ký/nguồn/amount/idempotency → transaction ghi webhook, ledger và cộng ví đúng người. Không tin frontend hoặc thông báo chưa xác minh.
4. **Mua trực tiếp mặt hàng hợp lệ:** xác thực user, lấy giá/trạng thái mới nhất từ backend, hỏi lại khi giá đổi, kiểm tra wallet và supplier availability, reserve ví, gọi nhà cung cấp một lần với idempotency; definitive failure thì release; timeout/unknown thì giữ ở reconciliation, không retry mù hoặc chuyển supplier. Chỉ capture theo kết quả đã xác minh.
5. **Fulfillment:** chỉ thiết kế theo loại hàng hợp lệ được xác nhận; không chứa trao đổi password, session hoặc quyền kiểm soát tài khoản cá nhân.
6. **Supplier balance/alerts:** hiển thị rõ actual vs estimated; cập nhật thủ công có audit nếu provider không có API; cảnh báo có dedupe và lịch sử gửi.

## 6. Database hiện có và mục tiêu

- Dự án đã chọn PostgreSQL + Prisma 7. Schema có các nhóm `User/Session/PasswordResetToken`, `Wallet/WalletTransaction/WalletReservation`, `Supplier/SupplierBalance/SupplierTopUp/SupplierTransaction`, catalog/mapping/price history/sync log, order/payment/webhook, notification/audit/idempotency.
- Migration `20261105065748_init_full_platform` đã có, bao gồm các bảng/index/FK chính; chưa xác nhận đã chạy trên database. **Không chạy migrate, reset hoặc thao tác dữ liệu trong khảo sát này.**
- Tiền dùng `Decimal`; timestamp mặc định DB; cần quyết định quy ước UTC, hiển thị múi giờ địa phương và retention.
- Điểm cần rà soát trước migration thật: `Order.supplierId` không có foreign key tới `Supplier`; `SupplierTransaction.orderId` cũng không có FK/relation; cần quyết định integrity và deletion/retention. Có field `Supplier.apiKey` lưu dạng string nhưng chưa chứng minh mọi write path đều mã hóa. `OrderCredential` là mô hình lưu credential bị loại khỏi phạm vi vận hành.

## 7. API cần triển khai sau khi chốt phạm vi

Chưa có `src/app/api/**`; các đường dẫn dưới đây là kế hoạch, không phải endpoint đã tồn tại:

- Auth: register/login/logout/me/forgot-password/reset-password.
- Customer: products/categories list/detail; wallet summary/ledger; payment intent/status; own order list/detail.
- Payment provider: webhook ingress riêng theo gateway, xác minh signature và dedupe.
- Admin: users, catalog, supplier config/connection check, sync start/log/retry, balance adjustment, orders/reconciliation, dashboard/audit/settings.
- Internal jobs: scheduled product sync, provider balance check nếu được hỗ trợ, email notifications.

Không triển khai endpoint trả/hiển thị account credentials. API supplier/payment chỉ được viết theo contract được xác nhận; không tự suy luận field, webhook hay balance endpoint.

## 8. Tích hợp bên ngoài

- **PostgreSQL:** compose local có service `postgres`; chưa kiểm tra trạng thái DB hay chạy migration.
- **Redis/BullMQ:** compose và helper có mặt; cần đảm bảo queue/job idempotency/lock và startup health.
- **Quang Vinh Media:** tài liệu nêu base URL và các endpoint profile/products/product/order, endpoint buy còn bất nhất giữa `/buy_product` và implementation `/buy_product.php`; response chưa được xác minh live. Brief không xác nhận webhook, stock hay balance API. Không gọi supplier API trong lần này.
- **Payment:** `.env.example` chỉ ghi SePay/Casso là ví dụ và TBD; chưa xác định gateway, chữ ký, tài khoản nhận tiền hoặc event contract.
- **SMTP:** biến cấu hình mẫu có nhưng không có sender/job implementation.

## 9. Bảo mật và tính nhất quán

- Có sẵn một số lớp nền: HMAC session token, httpOnly session cookie, readable CSRF cookie, guard helpers, `argon2` dependency, secret encryption helpers, Redis rate limiter, Prisma Decimal và wallet row lock.
- Chưa có route để xác nhận permission/CSRF/rate limit được áp dụng trên mọi write.
- Secret `.env` không được đọc/in ra; `.env.example` đã khảo sát. DB log level hiện bật query/warn/error ở development; phải đảm bảo không log param/value nhạy cảm trước khi xử lý credential hoặc giao dịch tiền.
- Supplier adapter xây URL có API key trong query string cho các GET được mô tả; cần bảo đảm URL không xuất hiện trong log/proxy traces. Không dùng browser/client gọi supplier.
- Cần idempotency với unique constraints, transaction isolation/row locks, ownership checks, audit log, timeout rõ ràng, reconciliation và không tự động hoàn tiền khi supplier result unknown.
- Không có payment secret, supplier key hay tài khoản thật được đọc hoặc hiển thị trong báo cáo.

## 10. Tiêu chí nghiệm thu

Các tiêu chí gốc vẫn áp dụng cho phần hợp lệ, ngoại trừ luồng mua/giao account credentials bị loại bỏ:

- Authentication/authorization và ownership được kiểm tra ở server; client không thể truyền role/giá/tổng tiền.
- Deposit/webhook được xác minh và idempotent; replay không cộng ví hai lần.
- Wallet không thể chi vượt số dư dưới giao dịch đồng thời; reservation/capture/release có ledger nhất quán.
- Catalog sync phát hiện thay đổi giá/nội dung/trạng thái; lỗi API không biến thành hết hàng; job trùng và ghi đè data mới bị ngăn.
- Giá thủ công không bị ghi đè; giá tiền dùng Decimal; khách phải xác nhận khi giá thay đổi trước khi mua.
- Order trạng thái unknown vào reconciliation; không retry mua tự động/đổi supplier; không capture/refund khi chưa có kết quả xác nhận.
- Supplier balance được gắn nhãn actual/estimated; cảnh báo dedupe; API key không ra client/log.
- Responsive UI có loading/error/empty state; build, typecheck, lint và test đều chạy.
- Không có luồng lưu/hiển thị/giao username-password hay quyền kiểm soát tài khoản cá nhân; không thanh toán hoặc gọi supplier thật trong test.

## 11. Kế hoạch theo phase

| Phase | Mục tiêu và đầu ra | Files dự kiến | DB/API/UI | Tests/tiêu chí |
|---|---|---|---|---|
| 0 — Khảo sát (xong) | Phân tích tài liệu/source, mapping, baseline | `PROJECT_ANALYSIS.md` | Không đụng DB/API | baseline checks ghi bên dưới |
| 1 — Chốt phạm vi & identity | Chốt mặt hàng hợp lệ; nối auth website và role checks | `src/app/api/auth/**`, `src/lib/auth/**`, auth forms, test files | Không cần đổi DB trước khi review schema; register/login/logout/me | Unit + integration auth; session cookie, CSRF, rate-limit; role escalation denied |
| 2 — Catalog & supplier read/sync | Public catalog và sync cho product contract được xác minh | supplier service/adapters, product/sync modules, API routes, UI admin sync | Có thể cần migration sau review | normalize, price/status, stale data, duplicate lock, failed sync cases |
| 3 — Wallet & payment | Ledger và provider webhook verified | wallet/payment service, routes, webhook handler | Migration chỉ sau backup/approval/DB status | concurrency, duplicate webhook, wrong owner/amount/signature |
| 4 — Supplier balance & alerts | Actual/estimated ledger, admin edits, alerts | supplier balance, notification jobs/settings/UI | Schema adjustments nếu cần | boundary threshold, dedupe, provider unavailable |
| 5 — Fulfillment hợp lệ & order history | Giao dịch cho hàng hóa/dịch vụ đã được xác nhận hợp pháp, không chuyển giao account control | order service/API, customer/admin pages | Thiết kế transaction saga sau contract | insufficient funds, partial result, unknown reconciliation; no real purchase in tests |
| 6 — UI/analytics/hardening | Hoàn thiện storefront/admin, audit, responsive, operational review | pages/components/styles/security | DB changes only via reviewed migrations | full suite, build, lint, security and accessibility pass |

Mỗi phase phải có test trước khi thêm behavior, chạy kiểm tra thật và báo rõ phần nào chưa thể verify. Không thực hiện deploy production hoặc thao tác thanh toán thật.

## 12. Câu hỏi cần xác nhận (không tự đoán)

1. **Phạm vi sản phẩm:** Có đồng ý thay mặt hàng tài khoản/password bằng hàng hóa số hợp pháp không chuyển giao quyền kiểm soát tài khoản cá nhân (ví dụ mã bản quyền/credit được nhà phát hành cho phép phân phối hoặc dịch vụ số)? Đây là điều kiện để tiếp tục phần catalog/order.
2. **Nhà cung cấp:** Có tài liệu chính thức/live test hoặc sandbox xác nhận endpoint chính xác (`/buy_product` hay `/buy_product.php`), cấu trúc response, lỗi, idempotency/tra cứu order và quyền phân phối sản phẩm hợp lệ không? Không gửi API key qua chat.
3. **Thanh toán:** Chọn gateway nào (SePay/Casso/khác) và cung cấp contract xác minh webhook chính thức (signature, event ID, amount, memo, retry); chưa xác nhận thì không cộng ví.
4. **Tài khoản website:** Username có bắt buộc riêng hay email là định danh đăng nhập? Có cần email verification trước khi dùng ví không?
5. **Admin:** Có cần tách `SUPERADMIN` khỏi `ADMIN` không? Ai được tạo/cấp role admin?

## Khảo sát source và baseline

- Kiến trúc: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Prisma 7/PostgreSQL; Redis/BullMQ và UI component primitives đã thêm.
- `src/app/` hiện chỉ có layout, CSS, trang chủ starter và favicon; chưa có routes/components nghiệp vụ.
- Schema/migration rộng đã có nhưng chưa phải hệ thống hoàn chỉnh; các service/adapter là thư viện chưa được gọi bởi API.
- Git status ban đầu đã có nhiều thay đổi chưa commit (tracked changes ở `package.json`, lockfile, Prisma schema/config; xóa `prisma7.config.ts`; nhiều file mới ở `src/lib`, UI và migration). Các thay đổi đó được giữ nguyên; không reset/xóa/chỉnh đè trong khảo sát này.
- Không đọc `.env`, không kết nối/ghi/xóa database, không gọi API bên ngoài và không tạo giao dịch.

Lệnh đã chạy trong `app/`:

| Lệnh | Kết quả thực tế |
|---|---|
| `npm exec vitest run` | PASS — 3 test files, 66 tests. Có warning cấu hình Vitest/Vite về native loader/CommonJS. |
| `npx tsc --noEmit` | PASS — exit code 0. |
| `npm run lint` | PASS — exit code 0. |
| `npx prisma validate` | PASS — schema hợp lệ; nạp `prisma.config.ts`. |
| `npm run build` | PASS — production build thành công; hiện chỉ build route `/` và `/_not-found` (starter app). |
| `git status --short`, `git diff --stat` | Dirty worktree ban đầu; thay đổi không do phase khảo sát này. |

**Trạng thái phase:** hoàn tất khảo sát, phân tích và baseline. Chưa viết feature code trong phase này vì scope chính yêu cầu bàn giao password/quyền kiểm soát tài khoản cá nhân và các hợp đồng tích hợp còn thiếu. Phase tiếp theo: xác nhận câu hỏi 1, sau đó bắt đầu test-first với module identity/catalog an toàn; không triển khai luồng account credential.