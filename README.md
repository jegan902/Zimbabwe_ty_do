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
# 1. Biến môi trường (đã có mẫu trong .env)
#    DATABASE_URL, REDIS_URL, SESSION_SECRET
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

| Lệnh | Việc |
|------|------|
| `npm run db:migrate` | Áp migration Prisma |
| `npm run db:seed` | Upsert supplier từ `.env` + sync catalog lần đầu |
| `npm run db:sync` | Đồng bộ lại mọi supplier ACTIVE |
| `npm run db:setup` | migrate + seed |
| `npm run worker:sync` | Worker tự đồng bộ catalog (mặc định mỗi 5 phút / supplier) |

Admin mặc định sau seed: `admin@digishop.com` / `Admin@123456`.

### Auto sync

Chạy worker song song với Next (terminal 2):

```bash
npm run worker:sync
```

Worker đọc `SupplierSyncSettings` (`isAutoSyncEnabled`, `syncInterval` giây: 60/300/900/1800/3600). Mặc định **300s (5 phút)**. Manual sync vẫn dùng `npm run db:sync` hoặc nút admin.

Realtime SSE (sau sync): `GET /api/realtime`.

## Tài liệu nghiệp vụ

Xem [writing-block.md](writing-block.md).
