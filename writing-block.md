# MASTER PROMPT – XÂY DỰNG WEBSITE TRUNG GIAN BÁN TÀI KHOẢN SỐ ĐA NHÀ CUNG CẤP (MULTI-SUPPLIER E-COMMERCE)

Bạn là một Senior Fullstack Developer, Software Architect và chuyên gia thiết kế hệ thống thương mại điện tử.

Hãy xây dựng một website thương mại điện tử chuyên phân phối tài khoản số, hoạt động theo mô hình trung gian giữa khách hàng và nhiều website nhà cung cấp.

Tôi cần một hệ thống có thể vận hành kinh doanh thực tế, có đầy đủ frontend, backend, database, tích hợp API, xử lý thanh toán, quản lý số dư, đồng bộ sản phẩm tự động và quản trị hệ thống.

Không được chỉ tạo giao diện demo hoặc sử dụng dữ liệu giả để thay thế các nghiệp vụ quan trọng.

---

# PHẦN 1. MÔ HÌNH KINH DOANH

## 1.1. Cách website hoạt động

Tôi là người trung gian bán sản phẩm từ nhiều website nhà cung cấp như:

- Supplier A.
- Supplier B.
- Supplier C.
- Supplier D.
- Các nhà cung cấp khác có thể tích hợp trong tương lai.

Tôi không mua tài khoản về lưu kho trước.

Thay vào đó:

1. Website lấy danh sách sản phẩm từ nhiều nhà cung cấp thông qua API.
2. Chuẩn hóa dữ liệu sản phẩm.
3. Lưu dữ liệu vào database của website tôi.
4. Hiển thị sản phẩm trên website của tôi.
5. Tự động đồng bộ khi sản phẩm tại nhà cung cấp thay đổi.
6. Khách hàng đăng ký và nạp tiền vào website.
7. Tiền khách nạp được chuyển về tài khoản thanh toán của tôi.
8. Backend xác minh thanh toán và cộng tiền vào ví riêng của khách.
9. Khách hàng mua sản phẩm trực tiếp trên website của tôi.
10. Backend kiểm tra số dư ví khách hàng và số dư tài khoản của tôi tại nhà cung cấp.
11. Nếu đủ điều kiện, backend sử dụng API Key và tài khoản của tôi tại nhà cung cấp để mua hàng.
12. Nhà cung cấp trừ tiền từ số dư của tôi.
13. Nhà cung cấp trả về thông tin tài khoản.
14. Website giao tài khoản ngay cho khách hàng.
15. Đồng thời lưu thông tin tài khoản vào lịch sử đơn hàng.
16. Tôi kiếm lợi nhuận từ phần chênh lệch giữa giá bán và giá nhập, sau khi tính các chi phí liên quan.

**Nguyên tắc quan trọng:** Khách hàng mua thông qua tài khoản/API Key của tôi tại nhà cung cấp. Khách hàng không cần có tài khoản hoặc API Key tại các website nhà cung cấp.

## 1.2. Ví dụ thực tế

Tôi nạp trước 1.000.000 VNĐ vào tài khoản nhà cung cấp A.

Khách hàng B nạp 200.000 VNĐ vào website của tôi.

Sau khi xác minh thanh toán:

- Tài khoản thanh toán của tôi nhận 200.000 VNĐ.
- Ví khách hàng B được cộng 200.000 VNĐ.

Khách hàng B mua sản phẩm:

- Giá nhập: 100.000 VNĐ.
- Giá bán: 110.000 VNĐ.
- Lợi nhuận gộp: 10.000 VNĐ.

Khi khách mua thành công:

- Ví khách hàng B giảm 110.000 VNĐ.
- Tài khoản của tôi tại nhà cung cấp A giảm 100.000 VNĐ.
- Tôi có 10.000 VNĐ lợi nhuận gộp trước các chi phí khác.

Tiền khách nạp vào website và tiền tôi nạp vào nhà cung cấp là hai nguồn tiền độc lập.

---

# PHẦN 2. HỆ THỐNG SỐ DƯ

Website phải có hai hệ thống số dư riêng biệt.

## 2.1. Customer Wallet – Ví khách hàng

Mỗi khách hàng có một ví riêng.

Chức năng:

- Xem số dư.
- Nạp tiền.
- Lịch sử nạp tiền.
- Lịch sử mua hàng.
- Lịch sử hoàn tiền.
- Lịch sử biến động số dư.
- Xem giao dịch đang được giữ tiền.

Quy tắc:

- Tiền chỉ được cộng khi backend xác minh thanh toán thành công.
- Không tin tưởng thông báo thanh toán từ frontend.
- Sử dụng webhook có xác minh chữ ký hoặc API đối soát giao dịch đáng tin cậy.
- Mỗi giao dịch nạp tiền chỉ được cộng một lần.
- Khách chỉ được mua khi ví đủ tiền.
- Không cho phép sử dụng số dư của người dùng khác.

## 2.2. Supplier Balance – Số dư nhà cung cấp

Đây là số tiền tôi đã nạp trước vào tài khoản của mình tại từng nhà cung cấp.

Ví dụ:

| Nhà cung cấp | Số dư |
|---|---:|
| Supplier A | 1.000.000đ |
| Supplier B | 500.000đ |
| Supplier C | 200.000đ |

Admin có thể quản lý:

- Số dư hiện tại.
- Tổng tiền đã nạp.
- Tổng tiền đã chi mua hàng.
- Số dư khả dụng.
- Ngưỡng cảnh báo.
- Mức nạp tối thiểu.
- Lịch sử nạp tiền.
- Lịch sử trừ tiền.
- Thời điểm kiểm tra gần nhất.
- Trạng thái API.

Nếu nhà cung cấp có API kiểm tra số dư, hệ thống sử dụng API đó.

Nếu không có API, cho phép Admin cập nhật thủ công và theo dõi số dư ước tính dựa trên các khoản nạp và giao dịch đã xác nhận.

Phải phân biệt:

- Số dư thực tế được nhà cung cấp xác nhận.
- Số dư ước tính nội bộ.
- Số dư chưa đối soát.

Không được hiển thị số dư ước tính như số dư thực tế.

## 2.3. Điều kiện cho phép mua hàng

Backend phải kiểm tra đồng thời hai điều kiện:

**Điều kiện 1: Ví khách hàng đủ tiền.**

Ví dụ:

- Đơn hàng: 110.000đ.
- Ví khách: 80.000đ.

Kết quả: Không cho mua, dù tài khoản nhà cung cấp của tôi còn nhiều tiền.

**Điều kiện 2: Tài khoản nhà cung cấp đủ tiền.**

Ví dụ:

- Giá nhập: 100.000đ.
- Số dư nhà cung cấp: 50.000đ.

Kết quả: Không cho mua, dù ví khách có 1.000.000đ.

Chỉ cho phép giao dịch khi cả hai điều kiện đều hợp lệ.

---

# PHẦN 3. HỆ THỐNG ĐỒNG BỘ SẢN PHẨM TỰ ĐỘNG

Đây là module quan trọng và bắt buộc.

Website phải tự động cập nhật sản phẩm khi dữ liệu ở nhà cung cấp thay đổi.

Không được chỉ lấy dữ liệu sản phẩm một lần rồi lưu cố định trong database.

## 3.1. Các thông tin phải theo dõi

Đối với từng sản phẩm nguồn, lưu và theo dõi:

- ID sản phẩm tại nhà cung cấp.
- Tên sản phẩm.
- Mô tả.
- Hình ảnh.
- Danh mục.
- Giá nhập.
- Tồn kho nếu API hỗ trợ.
- Trạng thái hoạt động.
- Thời gian cập nhật tại nhà cung cấp nếu có.
- Thời gian đồng bộ gần nhất.
- Trạng thái đồng bộ.

## 3.2. Những thay đổi phải được đồng bộ

Khi nhà cung cấp thay đổi:

- Giá sản phẩm.
- Tên sản phẩm.
- Mô tả.
- Hình ảnh.
- Danh mục.
- Tồn kho.
- Trạng thái hoạt động.
- Trạng thái ngừng kinh doanh.
- Các thuộc tính khác mà API cung cấp.

Backend phải phát hiện thay đổi, chuẩn hóa dữ liệu và cập nhật database nội bộ.

## 3.3. Cơ chế đồng bộ

Ưu tiên sử dụng các phương pháp sau:

**Phương pháp 1: Webhook**

Nếu nhà cung cấp hỗ trợ webhook:

1. Đăng ký webhook.
2. Nhận thông báo khi sản phẩm thay đổi.
3. Xác thực chữ ký hoặc cơ chế xác thực webhook.
4. Xác định sản phẩm thay đổi.
5. Lấy lại dữ liệu mới nhất từ API nếu cần.
6. Chuẩn hóa dữ liệu.
7. Cập nhật database.
8. Tính lại giá bán.
9. Làm mới cache.
10. Phát sự kiện thông báo cho frontend.

**Phương pháp 2: Scheduled Polling**

Nếu nhà cung cấp không hỗ trợ webhook, dùng background job để định kỳ gọi API lấy dữ liệu.

Cho phép cấu hình chu kỳ riêng cho từng nhà cung cấp:

- 1 phút.
- 5 phút.
- 15 phút.
- 30 phút.
- 60 phút.

Các giá trị trên là tùy chọn cấu hình, không phải mặc định áp dụng cho mọi nhà cung cấp.

Phải tuân thủ rate limit của API.

Có thể dùng incremental sync nếu nhà cung cấp hỗ trợ bộ lọc thời gian cập nhật hoặc phân trang.

Nếu API chỉ trả danh sách sản phẩm đầy đủ, phải đồng bộ và đối chiếu dữ liệu cẩn thận.

**Phương pháp 3: Đồng bộ thủ công**

Admin có nút:

- Đồng bộ tất cả sản phẩm.
- Đồng bộ theo nhà cung cấp.
- Đồng bộ một sản phẩm.
- Thử lại những sản phẩm lỗi.

## 3.4. Quy tắc cập nhật giá bán

Admin có thể cấu hình lợi nhuận:

- Theo phần trăm.
- Theo số tiền cố định.
- Theo từng sản phẩm.
- Theo từng nhà cung cấp.
- Giá bán cố định do Admin nhập thủ công.

Ví dụ:

Giá nhập ban đầu: 100.000đ.

Lợi nhuận: 10%.

Giá bán: 110.000đ.

Sau đó nhà cung cấp tăng giá nhập lên 120.000đ.

Nếu sản phẩm dùng công thức lợi nhuận 10%, hệ thống phải tự tính lại:

Giá bán mới = 120.000 × 1,10 = 132.000đ.

Sau đó:

1. Cập nhật giá nhập.
2. Tính lại giá bán.
3. Cập nhật database.
4. Làm mới cache.
5. Cập nhật giao diện khách hàng.
6. Ghi lịch sử thay đổi giá.

Nếu Admin đặt giá bán thủ công thì không được tự ý ghi đè. Phải tôn trọng chính sách giá đã cấu hình.

Sử dụng kiểu dữ liệu Decimal/Numeric để tính toán tiền tệ.

## 3.5. Quy tắc cập nhật trạng thái

Nếu nhà cung cấp:

- Đang hoạt động: cập nhật trạng thái nguồn.
- Ngừng hoạt động: không cho mua từ nguồn đó.
- Hết hàng: cập nhật trạng thái hết hàng nếu có dữ liệu.
- Xóa sản phẩm: đánh dấu không còn khả dụng sau khi xác minh.
- Mất kết nối: đánh dấu dữ liệu đã cũ, không tự kết luận sản phẩm hết hàng.

Nếu một sản phẩm nội bộ có nhiều nhà cung cấp:

- Một nguồn hết hàng nhưng nguồn khác còn hàng thì sản phẩm vẫn có thể bán.
- Hệ thống lựa chọn nguồn khác theo quy tắc Admin đã cấu hình.
- Chỉ ngừng bán sản phẩm nội bộ khi không còn nguồn nào đủ điều kiện cung cấp.

Không tự động chuyển nhà cung cấp trong một giao dịch mua đang có trạng thái không xác định.

## 3.6. Cập nhật giao diện khách hàng

Sau khi backend đồng bộ thành công, giao diện khách hàng phải hiển thị dữ liệu mới.

Luồng xử lý:

```text
Supplier APIs
     |
     v
Webhook / Scheduled Polling
     |
     v
Supplier Adapter
     |
     v
Normalize Product Data
     |
     v
Update Database
     |
     v
Recalculate Selling Price
     |
     v
Invalidate Cache
     |
     v
Publish Product Updated Event
     |
     v
Frontend Refreshes Product Data
```

Yêu cầu kỹ thuật:

- Không để cache khiến khách nhìn thấy giá cũ vô thời hạn.
- Khi dữ liệu sản phẩm thay đổi, phải invalidate hoặc revalidate cache.
- Cập nhật danh sách sản phẩm.
- Cập nhật trang chi tiết sản phẩm.
- Cập nhật trạng thái và giá đang hiển thị.
- Nếu khách đang mở trang sản phẩm, có thể thông báo và tải dữ liệu mới.
- Có thể sử dụng SSE hoặc WebSocket để gửi thông báo cập nhật.
- Không gọi API nhà cung cấp từ trình duyệt.
- Frontend chỉ gọi backend của website tôi.

Phân biệt rõ:

- Đồng bộ dữ liệu: lấy thay đổi từ nhà cung cấp về database.
- Realtime frontend: thông báo cho giao diện biết database đã thay đổi.

Không được quảng cáo hệ thống cập nhật tức thì nếu nhà cung cấp chỉ hỗ trợ polling định kỳ. Độ trễ thực tế phụ thuộc khả năng API và chu kỳ đồng bộ.

## 3.7. Kiểm tra dữ liệu ngay trước khi mua

Khi khách nhấn Mua ngay:

1. Lấy dữ liệu sản phẩm mới nhất có thể từ nguồn.
2. Kiểm tra sản phẩm còn hoạt động.
3. Kiểm tra tồn kho nếu API hỗ trợ.
4. Lấy giá nhập mới.
5. Tính lại giá bán.
6. So sánh với giá khách đang xem.
7. Nếu giá thay đổi, yêu cầu khách xác nhận giá mới.
8. Chỉ thực hiện mua sau khi khách đồng ý.

Không được tự ý trừ thêm tiền của khách nếu giá đã thay đổi.

## 3.8. Quản lý đồng bộ trong Admin

Tạo trang quản lý đồng bộ với các thông tin:

- Nhà cung cấp.
- Thời điểm đồng bộ gần nhất.
- Thời điểm đồng bộ tiếp theo.
- Tổng số sản phẩm.
- Sản phẩm mới.
- Sản phẩm thay đổi.
- Sản phẩm thay đổi giá.
- Sản phẩm ngừng hoạt động.
- Sản phẩm lỗi.
- Trạng thái đồng bộ.
- Nội dung lỗi.

Chức năng:

- Đồng bộ ngay.
- Bật/tắt tự động.
- Cấu hình chu kỳ.
- Xem lịch sử đồng bộ.
- Thử lại khi thất bại.

Phải có cơ chế chống chạy đồng bộ trùng và giới hạn request.

---

# PHẦN 4. QUY TRÌNH MUA HÀNG TRỰC TIẾP

## 4.1. Hình thức mua

Chỉ hỗ trợ mua trực tiếp (Buy Now).

Không có giỏ hàng.

Mỗi lần mua là một giao dịch cho một sản phẩm nội bộ.

Nếu muốn mua sản phẩm khác, khách thực hiện giao dịch mới.

## 4.2. Quy trình mua hàng

1. Khách đăng nhập.
2. Chọn sản phẩm.
3. Chọn số lượng.
4. Nhấn Mua ngay.
5. Backend kiểm tra tài khoản.
6. Kiểm tra sản phẩm còn hoạt động.
7. Kiểm tra giá và trạng thái nguồn hàng mới nhất.
8. Tính giá bán và tổng tiền.
9. Kiểm tra ví khách.
10. Kiểm tra số dư nhà cung cấp.
11. Nếu khách không đủ tiền, từ chối mua.
12. Nếu nhà cung cấp không đủ tiền, từ chối mua.
13. Nếu cả hai đủ, tạo đơn hàng Pending.
14. Giữ tiền khách bằng wallet reservation.
15. Tạo idempotency key.
16. Gọi API nhà cung cấp bằng tài khoản của tôi.
17. Nhận response.
18. Xác minh kết quả.
19. Nếu thành công, chốt giao dịch ví.
20. Ghi nhận giá nhập, giá bán và lợi nhuận.
21. Lưu thông tin tài khoản.
22. Hiển thị tài khoản ngay cho khách.
23. Lưu thông tin vào lịch sử đơn hàng.

## 4.3. Xử lý lỗi

Nếu nhà cung cấp xác nhận thất bại:

- Giải phóng tiền đang giữ.
- Không giao tài khoản.
- Cập nhật trạng thái Failed.
- Lưu nguyên nhân.

Nếu API timeout hoặc kết quả không rõ:

- Không retry mù quáng.
- Không mua lại bằng nhà cung cấp khác.
- Tra cứu trạng thái bằng API nếu được hỗ trợ.
- Nếu chưa xác định được, chuyển Reconciliation Required.
- Thông báo Admin.

Nếu trả thiếu số lượng tài khoản:

- Lưu số lượng thực tế đã giao.
- Không tính thành công toàn bộ khi chưa giao đủ.
- Xử lý phần còn lại theo kết quả xác nhận từ nhà cung cấp.
- Không tự động mua bù khi giao dịch cũ chưa được xác định rõ.

---

# PHẦN 5. QUẢN LÝ NHIỀU NHÀ CUNG CẤP

## 5.1. Kiến trúc Adapter Pattern

Không viết code cố định cho một nhà cung cấp.

Định nghĩa interface chung:

```ts
interface SupplierAdapter {
  getProfile(): Promise<unknown>;
  getProducts(): Promise<unknown>;
  getProduct(productId: string): Promise<unknown>;
  buyProduct(
    productId: string,
    quantity: number,
    coupon?: string
  ): Promise<unknown>;
  getOrder(orderId: string): Promise<unknown>;
}
```

Có thể mở rộng interface để hỗ trợ:

- getBalance.
- checkStock.
- registerWebhook.
- getProductUpdates.

Chỉ triển khai các chức năng khi nhà cung cấp thực sự hỗ trợ.

Cấu trúc:

```text
suppliers/
  supplier.interface.ts
  supplier.service.ts
  supplier.factory.ts
  supplier-registry.ts

  adapters/
    quangvinh.adapter.ts
    supplier-b.adapter.ts
    supplier-c.adapter.ts
```

Mỗi adapter phải:

- Gọi API riêng của nhà cung cấp.
- Chuẩn hóa response.
- Chuẩn hóa lỗi.
- Xử lý timeout.
- Xử lý rate limit.
- Không để nghiệp vụ cốt lõi phụ thuộc response riêng của một nhà cung cấp.

## 5.2. Nhà cung cấp đầu tiên: Quang Vinh Media

Base URL:

```text
https://quangvinhmedia.store/api/
```

Các API đã được cung cấp:

```http
GET /profile.php?api_key=API_KEY
GET /products.php?api_key=API_KEY
GET /product.php?api_key=API_KEY&product=PRODUCT_ID
GET /order.php?api_key=API_KEY&order=SUPPLIER_ORDER_ID
```

Mua sản phẩm:

```http
POST /buy_product
Content-Type: multipart/form-data
```

Các field:

```text
action=buyProduct
id=PRODUCT_ID
amount=QUANTITY
coupon=COUPON_CODE
api_key=API_KEY
```

Ví dụ response:

```json
{
  "status": "success",
  "msg": "Tạo đơn hàng thành công!",
  "trans_id": "JF465f728224ce11",
  "data": [
    "1000040304952|GUTJXYIFPWLHCNDOMBRKVAQESZ"
  ]
}
```

Thông tin tài khoản có định dạng:

```text
username|password
```

Yêu cầu:

- Xác minh response thực tế trước khi triển khai.
- Không tự bịa các field chưa được xác nhận.
- Không tự giả định API có chức năng kiểm tra số dư nếu chưa xác minh.
- Không tự giả định API có webhook.
- Không tự giả định API có thông tin tồn kho.
- Không gọi API trực tiếp từ frontend.
- API Key chỉ được lưu ở backend.

---

# PHẦN 6. QUẢN LÝ SẢN PHẨM

Tách sản phẩm nội bộ và sản phẩm nguồn.

## 6.1. SupplierProducts

Lưu sản phẩm lấy từ từng nhà cung cấp:

- SupplierId.
- SupplierProductId.
- SupplierCategoryId.
- Name.
- Description.
- Image.
- SupplierCost.
- Stock.
- Status.
- RawData.
- LastSyncedAt.

## 6.2. Products

Lưu sản phẩm nội bộ:

- Name.
- Slug.
- Description.
- Image.
- CategoryId.
- SellingPrice.
- ProfitType.
- ProfitValue.
- PricingMode.
- Status.

## 6.3. ProductSupplierMappings

Một sản phẩm nội bộ có thể liên kết với nhiều sản phẩm nguồn.

Ví dụ:

Sản phẩm nội bộ: Tài khoản A.

| Nguồn | Giá nhập |
|---|---:|
| Supplier A | 100.000đ |
| Supplier B | 105.000đ |
| Supplier C | 98.000đ |

Admin được phép:

- Chọn nguồn ưu tiên.
- Chọn nguồn dự phòng.
- Bật/tắt nguồn.
- Cấu hình cách chọn nguồn.
- Xem lịch sử giá.
- Xem trạng thái từng nguồn.

Có thể chọn nguồn theo:

- Giá nhập.
- Tồn kho.
- Trạng thái hoạt động.
- Độ ổn định.
- Mức ưu tiên của Admin.

Không tự động chuyển nguồn khi giao dịch trước chưa được xác định thất bại.

---

# PHẦN 7. GIAO DIỆN KHÁCH HÀNG

Thiết kế hiện đại, chuyên nghiệp, responsive.

## 7.1. Trang chủ

- Header.
- Logo.
- Menu.
- Tìm kiếm.
- Đăng nhập/đăng ký.
- Số dư ví.
- Banner.
- Danh mục sản phẩm.
- Sản phẩm nổi bật.
- Sản phẩm mới.
- Hướng dẫn mua hàng.
- Chính sách.
- Footer.

## 7.2. Danh sách sản phẩm

- Hiển thị theo danh mục.
- Tìm kiếm.
- Lọc giá.
- Sắp xếp.
- Hình ảnh.
- Tên sản phẩm.
- Mô tả.
- Giá bán mới nhất.
- Trạng thái.
- Nút mua ngay.

Không hiển thị:

- API Key.
- Giá nhập.
- Thông tin nội bộ.
- Tên nhà cung cấp nếu không được Admin cho phép công khai.

## 7.3. Chi tiết sản phẩm

- Tên.
- Hình ảnh.
- Mô tả.
- Giá bán.
- Trạng thái.
- Số lượng nếu nguồn cung cấp dữ liệu.
- Tổng tiền dự kiến.
- Số dư ví.
- Nút Mua ngay.

## 7.4. Kết quả mua hàng

Sau khi thành công:

- Hiển thị thông báo thành công.
- Mã đơn hàng.
- Tên sản phẩm.
- Số lượng.
- Tài khoản.
- Mật khẩu.
- Nút sao chép tài khoản.
- Nút sao chép mật khẩu.
- Nút sao chép toàn bộ.
- Liên kết đến lịch sử đơn hàng.

## 7.5. Trang ví

- Số dư.
- Nạp tiền.
- Lịch sử nạp.
- Lịch sử mua.
- Lịch sử hoàn tiền.
- Lịch sử biến động số dư.

## 7.6. Lịch sử đơn hàng

- Mã đơn.
- Sản phẩm.
- Số lượng.
- Tổng tiền.
- Thời gian.
- Trạng thái.
- Xem chi tiết.
- Xem lại thông tin tài khoản.

## 7.7. Tài khoản cá nhân

- Thông tin người dùng.
- Cập nhật hồ sơ.
- Đổi mật khẩu.
- Lịch sử hoạt động.

## 7.8. Authentication

- Đăng ký.
- Đăng nhập.
- Đăng xuất.
- Quên mật khẩu.
- Xác thực.
- Phân quyền.

---

# PHẦN 8. GIAO DIỆN ADMIN

Thiết kế Dashboard có sidebar, header, biểu đồ và bảng dữ liệu.

## 8.1. Dashboard tổng quan

Thống kê:

- Tổng doanh thu.
- Tổng lợi nhuận gộp.
- Lợi nhuận sau chi phí.
- Tổng đơn hàng.
- Đơn thành công.
- Đơn thất bại.
- Đơn đang xử lý.
- Đơn cần đối soát.
- Tổng người dùng.
- Người dùng mới.
- Tổng tiền khách nạp.
- Tổng số dư ví khách.
- Tổng vốn đã nạp vào nhà cung cấp.
- Tổng tiền đã chi mua hàng.
- Số dư còn lại tại nhà cung cấp.

Biểu đồ:

- Doanh thu theo ngày/tháng/năm.
- Lợi nhuận theo thời gian.
- Số đơn hàng.
- Người dùng mới.
- Chi phí theo nhà cung cấp.

Bộ lọc:

- Hôm nay.
- 7 ngày.
- 30 ngày.
- Tháng.
- Năm.
- Khoảng thời gian tùy chỉnh.

Phải phân biệt doanh thu, lợi nhuận, số dư ví khách và vốn nhà cung cấp.

## 8.2. Quản lý người dùng

- Danh sách.
- Tìm kiếm.
- Lọc.
- Chi tiết.
- Số dư.
- Lịch sử nạp.
- Lịch sử mua.
- Khóa/mở khóa.
- Phân quyền.

## 8.3. Quản lý sản phẩm

- Danh sách.
- Danh mục.
- Sản phẩm đang bán.
- Sản phẩm ẩn.
- Sản phẩm hết hàng.
- Sản phẩm chờ duyệt.
- Đồng bộ sản phẩm.
- Chỉnh sửa thông tin.
- Thiết lập lợi nhuận.
- Thiết lập giá bán.
- Chọn nguồn hàng.
- Xem giá nhập.
- Xem lịch sử giá.
- Quản lý sản phẩm trùng.

## 8.4. Quản lý nhà cung cấp

- Thêm/sửa/xóa nhà cung cấp.
- Bật/tắt.
- API Base URL.
- API Key.
- Kiểm tra kết nối.
- Đồng bộ sản phẩm.
- Cấu hình số dư.
- Cấu hình ngưỡng cảnh báo.
- Xem lịch sử API.
- Xem giao dịch.
- Cấu hình mức ưu tiên.

## 8.5. Quản lý đồng bộ

Hiển thị:

- Nhà cung cấp.
- Thời gian đồng bộ gần nhất.
- Thời gian đồng bộ tiếp theo.
- Tổng sản phẩm.
- Sản phẩm mới.
- Sản phẩm thay đổi.
- Sản phẩm thay đổi giá.
- Sản phẩm ngừng bán.
- Sản phẩm lỗi.
- Trạng thái.
- Nội dung lỗi.

Có nút:

- Đồng bộ ngay.
- Bật/tắt tự động.
- Cấu hình chu kỳ.
- Xem lịch sử.
- Thử lại.

## 8.6. Quản lý số dư nhà cung cấp

- Số dư.
- Loại số dư: Thực tế/Ước tính.
- Tổng tiền đã nạp.
- Tổng tiền đã chi.
- Ngưỡng cảnh báo.
- Mức nạp tối thiểu.
- Lịch sử nạp.
- Lịch sử trừ.
- Đối soát.
- Cập nhật thủ công.

## 8.7. Quản lý đơn hàng

- Mã đơn.
- Người mua.
- Sản phẩm.
- Số lượng.
- Giá bán.
- Giá nhập.
- Lợi nhuận.
- Nhà cung cấp.
- Mã giao dịch nguồn.
- Trạng thái.
- Thời gian.
- Thông tin tài khoản đã giao.
- Đối soát.

Các trạng thái:

- Pending.
- Processing.
- Success.
- Failed.
- Reconciliation Required.
- Partially Fulfilled.
- Refunded.

## 8.8. Quản lý ví và thanh toán

- Danh sách ví.
- Nạp tiền.
- Thanh toán.
- Giữ tiền.
- Hoàn tiền.
- Lịch sử giao dịch.
- Đối soát.

## 8.9. Quản lý lợi nhuận

- Lợi nhuận mặc định.
- Lợi nhuận theo phần trăm.
- Lợi nhuận cố định.
- Lợi nhuận từng sản phẩm.
- Lợi nhuận từng nhà cung cấp.
- Lợi nhuận từng đơn.
- Lịch sử giá nhập và giá bán.

## 8.10. Quản lý thông báo

- Email nhận cảnh báo.
- SMTP hoặc email provider.
- Cấu hình ngưỡng cảnh báo.
- Bật/tắt thông báo.
- Lịch sử gửi email.
- Trạng thái gửi.
- Chống gửi email trùng.

---

# PHẦN 9. EMAIL CẢNH BÁO NHÀ CUNG CẤP

Đây là tính năng bắt buộc.

Gửi email cho Admin khi:

1. Số dư nhà cung cấp thấp hơn ngưỡng.
2. Số dư không đủ mua sản phẩm.
3. Nhà cung cấp hết tiền.
4. Không lấy được số dư.
5. API mất kết nối.
6. Giao dịch không xác định được kết quả.

Ví dụ:

```text
Subject: [WARNING] Supplier Balance Low

Nhà cung cấp: Quang Vinh Media

Số dư hiện tại: 30.000 VNĐ
Ngưỡng cảnh báo: 100.000 VNĐ

Trạng thái: Số dư thấp

Vui lòng nạp thêm tiền vào tài khoản nhà cung cấp.

Thời gian: ...
```

Yêu cầu:

- Mỗi nhà cung cấp có ngưỡng cảnh báo riêng.
- Có thể cấu hình mức nạp tối thiểu.
- Có thể cấu hình email nhận thông báo.
- Dùng background job nếu API hỗ trợ kiểm tra số dư.
- Chống gửi email liên tục.
- Gửi lại khi trạng thái thay đổi hoặc theo chu kỳ nhắc lại.
- Ghi lịch sử email.

Nếu nhà cung cấp không có API kiểm tra số dư thì không được giả lập số dư thực tế. Hỗ trợ cập nhật thủ công và số dư ước tính.

Không tự động nạp tiền vào tài khoản nhà cung cấp nếu chưa có tích hợp và xác minh giao dịch an toàn.

---

# PHẦN 10. DATABASE

Sử dụng PostgreSQL.

Các bảng chính:

## Người dùng

```text
Users
Roles
Permissions
```

## Ví khách hàng

```text
Wallets
WalletTransactions
```

Các loại giao dịch:

- Deposit.
- Purchase.
- Reservation.
- Capture.
- Release.
- Refund.
- Adjustment.

## Nhà cung cấp

```text
Suppliers
SupplierBalances
SupplierBalanceLogs
SupplierTopUps
SupplierTransactions
SupplierApiLogs
```

## Sản phẩm

```text
Categories
Products
SupplierProducts
ProductSupplierMappings
ProductPriceHistories
ProductSyncLogs
SupplierSyncSettings
```

## Đơn hàng

```text
Orders
OrderItems
OrderCredentials
OrderStatusHistories
```

## Thanh toán

```text
PaymentTransactions
PaymentWebhooks
```

## Thông báo và quản trị

```text
EmailNotifications
NotificationSettings
AuditLogs
SystemSettings
```

Yêu cầu database:

- Primary key.
- Foreign key.
- Index.
- Unique constraint.
- Decimal/Numeric cho tiền tệ.
- Transaction.
- Migration.
- Lưu thời gian UTC và hiển thị múi giờ Việt Nam.
- Lưu snapshot giá nhập và giá bán tại thời điểm mua.
- Không lưu mật khẩu tài khoản khách mua dưới dạng plaintext.
- Mã hóa thông tin tài khoản được giao.

Có thể điều chỉnh schema theo ORM và kiến trúc dự án thực tế.

---

# PHẦN 11. BACKEND ARCHITECTURE

Tổ chức theo module nghiệp vụ.

Ví dụ:

```text
backend/
  modules/
    auth/
    users/
    wallet/
    payments/
    products/
    categories/
    suppliers/
    orders/
    notifications/
    analytics/
    admin/

  integrations/
    suppliers/
      adapters/
        quangvinh/
        supplier-b/
        supplier-c/

  jobs/
    product-sync.job.ts
    supplier-balance.job.ts
    email-notification.job.ts

  common/
    middleware/
    guards/
    errors/
    validators/
    logger/
    utils/
```

Tách rõ:

- Authentication.
- Wallet.
- Payment.
- Product.
- Supplier.
- Order.
- Notification.
- Analytics.
- Admin.

Không bắt buộc phải triển khai microservice ngay từ đầu. Ưu tiên module hóa rõ ràng, đảm bảo giao dịch tài chính chính xác và dễ bảo trì.

Nếu dự án hiện tại đã có kiến trúc monorepo hoặc các service riêng thì phải khảo sát và tận dụng.

---

# PHẦN 12. BẢO MẬT VÀ TÍNH NHẤT QUÁN

Bắt buộc:

1. Phân quyền Admin/User.
2. Backend kiểm tra quyền trên mọi API.
3. Khách chỉ xem đơn hàng của mình.
4. API Key không gửi xuống frontend.
5. Không sử dụng NEXT_PUBLIC cho secret.
6. Không commit secret lên Git.
7. Không tin tưởng giá và tổng tiền client gửi lên.
8. Mã hóa thông tin tài khoản nhà cung cấp trả về.
9. Không ghi thông tin tài khoản và API Key vào log.
10. Validate dữ liệu.
11. Rate limiting.
12. Idempotency cho mua hàng.
13. Idempotency cho webhook thanh toán.
14. Database transaction cho nghiệp vụ ví.
15. Kiểm soát giao dịch đồng thời để không chi vượt số dư.
16. Audit log.
17. Timeout và retry có kiểm soát.
18. Đối soát khi trạng thái giao dịch chưa rõ.
19. Không tự động hoàn tiền khi chưa xác định giao dịch nhà cung cấp thất bại.
20. Không tự động chuyển nguồn khi giao dịch trước có kết quả không xác định.

Đặc biệt, database của website và hệ thống nhà cung cấp không nằm trong cùng một transaction. Phải thiết kế quy trình giao dịch phân tán có trạng thái, idempotency và reconciliation.

---

# PHẦN 13. CÔNG NGHỆ VÀ UI/UX

Ưu tiên:

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- Recharts.
- React Hook Form.
- Zod.
- PostgreSQL.
- Backend API.
- ORM phù hợp với dự án hiện tại.

Nếu dự án đã có công nghệ hoặc cấu trúc monorepo, phải giữ nguyên những gì đang hoạt động, chỉ đề xuất thay đổi khi có lý do kỹ thuật rõ ràng.

Thiết kế:

- Hiện đại.
- Chuyên nghiệp.
- Responsive.
- Tối giản.
- Dễ thao tác.
- Loading state.
- Empty state.
- Error state.
- Toast notification.
- Confirm dialog.
- Pagination.
- Search và filter.
- Bảng quản trị dễ theo dõi.
- Dashboard biểu đồ rõ ràng.

---

# PHẦN 14. QUY TẮC TÀI CHÍNH

1. Tiền khách nạp về tài khoản tôi không đồng nghĩa với lợi nhuận.
2. Số dư ví khách hàng là nghĩa vụ số dư phải trả cho khách.
3. Số dư nhà cung cấp là vốn riêng tôi nạp trước.
4. Không gộp Customer Wallet và Supplier Balance.
5. Khách không đủ tiền thì không được mua.
6. Nhà cung cấp không đủ tiền thì không thực hiện mua hàng.
7. Không trừ tiền khách hai lần.
8. Không cộng tiền nạp hai lần.
9. Chỉ ghi nhận doanh thu theo giao dịch thành công.
10. Chỉ ghi nhận lợi nhuận khi giao dịch mua hàng được xác nhận thành công.
11. Lưu giá nhập và giá bán tại thời điểm giao dịch.
12. Theo dõi phí thanh toán và chi phí liên quan.
13. Mỗi nhà cung cấp có lịch sử nạp và chi tiền riêng.
14. Mọi thay đổi số dư đều phải có transaction ledger.
15. Không tự động nạp tiền cho nhà cung cấp khi chưa có cơ chế tích hợp và xác minh.

---

# PHẦN 15. TIÊU CHÍ KIỂM THỬ VÀ NGHIỆM THU

Hệ thống phải kiểm thử được các tình huống sau:

**1. Khách nạp tiền thành công**

- Tiền về tài khoản tôi.
- Backend xác minh.
- Ví đúng khách được cộng tiền.
- Không cộng trùng webhook.

**2. Khách không đủ tiền**

- Từ chối mua.
- Không gọi API nhà cung cấp.
- Không trừ tiền khách.

**3. Khách đủ tiền nhưng nhà cung cấp hết tiền**

- Từ chối mua.
- Không trừ tiền khách.
- Gửi email cảnh báo.

**4. Cả hai bên đều đủ tiền**

- Giữ tiền khách.
- Gọi API nhà cung cấp bằng tài khoản của tôi.
- Nhận thông tin tài khoản.
- Chốt giao dịch.
- Lưu đơn hàng.
- Giao tài khoản ngay.
- Lưu lịch sử.
- Ghi nhận lợi nhuận.

**5. Nhà cung cấp thay đổi giá**

- Hệ thống phát hiện.
- Cập nhật giá nhập.
- Tính lại giá bán theo cấu hình.
- Làm mới cache.
- Giao diện hiển thị giá mới.
- Khách phải xác nhận nếu giá thay đổi ngay trước mua.

**6. Nhà cung cấp thay đổi thông tin sản phẩm**

- Đồng bộ tên.
- Mô tả.
- Hình ảnh.
- Danh mục.
- Trạng thái.
- Cập nhật giao diện.

**7. Nhà cung cấp hết hàng**

- Cập nhật nguồn hàng.
- Nếu nguồn khác còn hàng thì sản phẩm vẫn bán được.
- Nếu tất cả nguồn đều hết hàng thì ngừng bán.

**8. Nhà cung cấp mất kết nối**

- Không tự kết luận hết hàng.
- Đánh dấu dữ liệu đã cũ.
- Ghi log.
- Cảnh báo Admin nếu cần.

**9. API mua hàng timeout**

- Không mua trùng.
- Đối soát.
- Chuyển trạng thái cần xử lý nếu chưa xác định được kết quả.

**10. Khách xem lại đơn hàng**

- Xem được đơn của mình.
- Xem lại tài khoản đã mua.
- Không xem được đơn người khác.

**11. Hai khách mua đồng thời**

- Không chi vượt số dư.
- Không trừ ví sai.
- Không tạo giao dịch trùng.

**12. Đồng bộ sản phẩm đồng thời**

- Không chạy trùng job.
- Không ghi đè dữ liệu mới bằng dữ liệu cũ.
- Không đánh dấu hết hàng khi một lần đồng bộ bị lỗi.
- Có log và khả năng thử lại.

---

# PHẦN 16. QUY TRÌNH TRIỂN KHAI

Trước khi code, hãy khảo sát toàn bộ source code hiện tại.

Không tự ý xóa source code, thay đổi framework, đổi database hoặc tạo lại dự án từ đầu.

Thực hiện theo thứ tự:

1. Phân tích cấu trúc dự án.
2. Xác định frontend, backend, database và các service đang có.
3. Đề xuất kiến trúc tổng thể.
4. Thiết kế database.
5. Xây dựng Authentication và Authorization.
6. Xây dựng Customer Wallet.
7. Xây dựng Payment và webhook.
8. Xây dựng Supplier Management.
9. Xây dựng adapter Quang Vinh Media.
10. Xây dựng Supplier Balance.
11. Xây dựng Product Sync.
12. Xây dựng Product Normalization.
13. Xây dựng tự động cập nhật giá và trạng thái.
14. Xây dựng cache invalidation và cập nhật giao diện.
15. Xây dựng quản lý sản phẩm nội bộ.
16. Xây dựng nghiệp vụ mua trực tiếp.
17. Xây dựng giao tài khoản và lịch sử đơn hàng.
18. Xây dựng email cảnh báo.
19. Xây dựng Admin Dashboard.
20. Xây dựng giao diện khách hàng.
21. Kiểm thử toàn bộ nghiệp vụ.
22. Hoàn thiện bảo mật và tối ưu.

Với từng module:

- Giải thích nghiệp vụ.
- Nêu file được tạo và sửa.
- Viết code hoàn chỉnh.
- Giải thích chức năng.
- Cung cấp cấu hình môi trường.
- Hướng dẫn migration.
- Hướng dẫn chạy.
- Hướng dẫn test API.
- Không để các nghiệp vụ quan trọng ở dạng mock hoặc TODO.

Nếu thiếu tài liệu API nhà cung cấp, phải chỉ rõ thông tin chưa xác minh. Không tự bịa endpoint, response, tính năng kiểm tra số dư, webhook hoặc tồn kho.

Không được giả lập giao dịch mua hàng thành công khi chưa thực sự gọi API và xác minh response.

# KẾT QUẢ CUỐI CÙNG

Tôi muốn có một website trung gian bán tài khoản số hoàn chỉnh, với các khả năng:

- Khách hàng đăng ký và đăng nhập.
- Khách hàng nạp tiền vào website của tôi.
- Tiền nạp được xác minh và cộng vào ví riêng.
- Khách mua trực tiếp từng sản phẩm.
- Backend mua sản phẩm bằng tài khoản/API Key của tôi tại nhà cung cấp.
- Sử dụng số dư vốn tôi đã nạp trước vào nhà cung cấp.
- Khách không đủ tiền thì không được mua.
- Nhà cung cấp không đủ tiền thì không được mua.
- Tự động giao tài khoản sau khi mua thành công.
- Lưu lịch sử đơn hàng và thông tin tài khoản.
- Tự động đồng bộ sản phẩm từ nhiều nhà cung cấp.
- Khi nhà cung cấp thay đổi sản phẩm, giá hoặc trạng thái, website cập nhật theo.
- Giao diện khách hàng tải dữ liệu mới sau khi đồng bộ.
- Admin quản lý sản phẩm, nhà cung cấp, số dư, đơn hàng và lợi nhuận.
- Gửi email khi số dư nhà cung cấp thấp hoặc hết tiền.
- Kiến trúc có thể mở rộng thêm nhà cung cấp mới mà không phải viết lại hệ thống.

Hãy ưu tiên tính chính xác của nghiệp vụ tài chính, tính an toàn giao dịch, khả năng đồng bộ dữ liệu và khả năng mở rộng lâu dài.