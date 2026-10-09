# KIẾN TRÚC HỆ THỐNG DỮ LIỆU THỊ TRƯỜNG TOÀN DIỆN (1.500+ MÃ CỔ PHIẾU)
**Dự án: YourFin — Wealth Management & Market Terminal**
**Tác giả: Antigravity AI Engineering**
**Ngày ban hành: Tháng 10/2026**

---

## 1. BÀI TOÁN & THÁCH THỨC VẬN HÀNH (THE PROBLEM)

Thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM) hiện có khoảng **1.500 - 2.000 mã cổ phiếu**.
Nếu thiết kế hệ thống theo cách thông thường (Frontend gọi API lấy toàn bộ giá của 1.500 mã hoặc mở WebSocket stream cho tất cả các mã cùng lúc):

1. **Nghẽn băng thông & Quá tải CPU Client**:
   - 1.500 bản ghi chi tiết (giá, khối lượng, 3 bước giá mua/bán, khối ngoại) nặng khoảng **10 - 20 MB JSON**.
   - Mỗi lần cập nhật tick sẽ khiến bộ nhớ trình duyệt quá tải, gây đứng khung hình (Drop FPS, lag UI) trên máy tính và điện thoại.
2. **Bị chặn IP / Vi phạm Rate Limit API nguồn**:
   - Thư viện `vnstock` hoặc các cổng dữ liệu sở GD đều áp dụng Rate Limit (giới hạn số request/phút).
   - Gọi 1.500 mã liên tục sẽ dính lỗi `RateLimitExceed` ngay lập tức.
3. **Hiệu năng Render DOM của React**:
   - DOM không thể render cùng lúc 1.500 hàng bảng giá với hiệu ứng nhấp nháy giá (Tick flashing) mà không bị đơ.

---

## 2. KIẾN TRÚC 5 TẦNG TỐI ƯU CHO TOÀN BỘ VŨ TRỤ CỔ PHIẾU (5-PILLAR ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. DATA INGESTION TIER                                │
│   • Background Worker (Python / FastAPI / Spring Boot)                          │
│   • Batch Priceboard Snapshot (lấy toàn sàn HOSE/HNX theo mẻ 30s-60s)           │
│   • Scheduled EOD Settle (15:05 hàng ngày chốt phiên)                           │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      2. STORAGE & MULTI-TIER CACHING                            │
│   • L1 In-Memory LRU Cache (TTL 15s trong giờ GD, 24h ngoài giờ GD)             │
│   • L2 Snapshot Store (Redis / SQLite / JSON Snapshot Master)                   │
│   • O(1) Key-Value lookup theo Mã cổ phiếu (`symbol`)                           │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         3. HIGH-PERFORMANCE APIS                                │
│   • `/api/market/search?q=...`      -> Instant Fuzzy Search (< 5ms)             │
│   • `/api/market/board?page=1&limit=50&exchange=HOSE` -> Phân trang Server-side │
│   • `/api/market/quote?symbol=XYZ`  -> On-Demand Lazy Resolution                │
│   • `/api/market/quotes`            -> Top Active / Watchlist Hot Cache         │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       4. STREAMING & DYNAMIC SUBSCRIPTION                       │
│   • WebSocket chỉ lắng nghe các kênh ĐANG HOẠT ĐỘNG:                            │
│       1. Chỉ số thị trường (VNINDEX, VN30, HNX)                                 │
│       2. Mã cổ phiếu người dùng ĐANG XEM (activeSymbol)                         │
│       3. Danh sách Watchlist (10 - 20 mã yêu thích)                             │
│   • Chuyển mã -> Gửi lệnh Dynamic Subscribe mã mới & Unsubscribe mã cũ          │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       5. CLIENT PRESENTATION & VIRTUALIZATION                   │
│   • Virtualized Table (TanStack Virtual / React Window): Chỉ render 20-30 hàng  │
│     nằm trong tầm nhìn màn hình, tái sử dụng DOM nodes                          │
│   • TradingView Pro Global CDN: Bắt sóng trực tiếp `HOSE:${sym}` không tải máy chủ│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT TRIỂN KHAI TỪNG TẦNG

### 3.1. Danh mục biểu tượng gốc (Master Symbol Directory)
- Toàn bộ danh sách 1.522 mã được lưu trong bộ nhớ tĩnh (`stockDatabase.json` hoặc SQLite).
- Chứa các trường: `symbol`, `organ_name`, `exchange`, `sector`.
- Trọng số cực nhẹ (< 200 KB nén), tải 1 lần lúc khởi động, hỗ trợ gõ tìm kiếm tức thì với thuật toán Fuzzy Search không cần gọi mạng.

### 3.2. Cơ chế nạp lười theo nhu cầu (On-Demand Lazy Loading)
- Người dùng có thể tìm và chọn **BẤT KỲ MÃ NÀO** trong số 1.500 mã (ví dụ: `HPG`, `VGI`, `CTR`, `BSR`, `MCH`, `VNZ`, v.v.).
- Khi mã được chọn:
  1. Kiểm tra L1 In-Memory Cache.
  2. Nếu có trong Cache & còn hạn TTL -> Phản hồi ngay < 5ms.
  3. Nếu chưa có -> Gọi `Market().equity(symbol).quote()` từ vnstock, ghi vào Cache và trả về cho người dùng.

### 3.3. Phân trang & Virtualization (Bảng giá toàn thị trường)
- Bảng giá thị trường hiển thị theo từng phân khúc:
  - Tab 1: **VN30** (30 mã vốn hóa lớn)
  - Tab 2: **HOSE** (Phân trang 50 mã / trang hoặc Virtual Scroll)
  - Tab 3: **HNX / UPCOM**
  - Tab 4: **Bộ lọc Ngành** (Ngân hàng, Bất động sản, Thép, Bán lẻ, Công nghệ)
- Giúp dữ liệu truyền tải mỗi lần chỉ dưới **50 KB**, đảm bảo mượt mà 60 FPS trên mọi thiết bị.

### 3.4. Tận dụng TradingView Pro Cloud Engine
- Đối với biểu đồ kỹ thuật và nến lịch sử, việc lưu trữ và vẽ 1.500 mã ở máy chủ của bạn sẽ tốn tài nguyên khổng lồ.
- Nhúng **TradingView Pro Embed** với mã nguồn `HOSE:${symbol}` hoặc `HNX:${symbol}` giúp máy trạm của người dùng kéo trực tiếp dữ liệu nến 1S/1D/1W từ hệ thống toàn cầu của TradingView với độ trễ 0ms và hoàn toàn miễn phí băng thông máy chủ của YourFin.

---

## 4. LỘ TRÌNH TRIỂN KHAI (IMPLEMENTATION ROADMAP)

1. [x] **Giai đoạn 1**: Chuẩn hóa danh mục 1.522 mã cổ phiếu và bộ lọc tìm kiếm tức thì.
2. [x] **Giai đoạn 2**: Chuẩn hóa dữ liệu thật các chỉ số thị trường (`VNINDEX 1735.09`, `VN30 1873.43`, `HNX 261.60`).
3. [x] **Giai đoạn 3**: Tích hợp TradingView Pro hỗ trợ toàn diện tất cả mã cổ phiếu HOSE/HNX.
4. [ ] **Giai đoạn 4**: Xây dựng Endpoint On-Demand Quote Resolver (`/api/market/quote?symbol=...`) có TTL Cache.
5. [ ] **Giai đoạn 5**: Áp dụng Virtual Scrolling cho Bảng giá tổng hợp toàn sàn.
