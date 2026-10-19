# Kế Hoạch Triển Khai: Đồ Thị Luân Chuyển Dòng Tiền Ngành (RRG — Relative Rotation Graph)

> **Mục tiêu:** Tích hợp đồ thị **RRG (Relative Rotation Graph)** trực quan, tương tác cao vào chuyên trang **Thị Trường (Market)**, mô phỏng chuẩn xác 100% giao diện và tính năng như ảnh mẫu "RRG — Market Watch", phục vụ nhà đầu tư theo dõi chu kỳ luân chuyển dòng tiền giữa 16 nhóm ngành và cổ phiếu so với VN-INDEX.

---

## 1. Phân Tích Yêu Cầu & Tham Chiếu Ảnh Mẫu

Dựa trên hình ảnh mẫu của người dùng:
1. **4 Góc Phần Tư (Quadrants):**
   - **DẪN DẮT (Leading - Xanh lục / Emerald #10b981):** $RS\text{-}Ratio \ge 100$, $RS\text{-}Momentum \ge 100$. Ngành mạnh hơn thị trường chung và xung lực tiếp tục gia tăng.
   - **SUY YẾU (Weakening - Vàng cam / Amber #f59e0b):** $RS\text{-}Ratio \ge 100$, $RS\text{-}Momentum < 100$. Ngành vẫn mạnh hơn thị trường nhưng đà tăng đang giảm tốc.
   - **TỤT HẬU (Lagging - Đỏ / Rose #ef4444):** $RS\text{-}Ratio < 100$, $RS\text{-}Momentum < 100$. Ngành yếu hơn thị trường chung và xung lực suy giảm.
   - **CẢI THIỆN (Improving - Xanh lam / Blue #3b82f6):** $RS\text{-}Ratio < 100$, $RS\text{-}Momentum \ge 100$. Ngành yếu hơn thị trường nhưng đang có đà phục hồi mạnh.
2. **Quy Luật Xoay Vòng (Clockwise Rotation):**
   - Vòng xoay thuận chiều kim đồng hồ: `Tụt Hậu` $\rightarrow$ `Cải Thiện` $\rightarrow$ `Dẫn Dắt` $\rightarrow$ `Suy Yếu` $\rightarrow$ `Tụt Hậu`.
3. **Các Thành Phần Trực Quan:**
   - **Đường đuôi (Trail / Tail):** Nối các mốc thời gian trong quá khứ (cấu hình 3, 4, 8, 12 kỳ) tạo thành quỹ đạo uốn lượn mềm mại.
   - **Chấm tròn đầu (Current Marker):** Vị trí hiện tại của ngành có viền sáng neon, kèm tên ngành sắc nét.
   - **Tâm tọa độ chuẩn:** Điểm $(100, 100)$ có đường phân cách đứt đoạn màu trắng/xám phân định 4 góc.
   - **Thanh tiêu đề trạng thái:** `RRG — Market Watch | Khung ngày · 16 ngành · Đuôi 4 kỳ · Dẫn dắt 11 · Suy yếu 2 · Tụt hậu 1 · Cải thiện 2 | [Khoảng thời gian] | Realtime Data`.
   - **Bộ công cụ (Controls):** Bật/tắt Lưới, Đổi số kỳ đuôi, Chọn Khung thời gian (Ngày/Tuần), Lọc ngành, Chế độ Toàn màn hình (Fullscreen / Modal) kèm nút Đóng X.

---

## 2. Công Thức & Thuật Toán Tính Toán RRG Chuẩn Mực

Để tuân thủ tuyệt đối quy tắc **STRICT ZERO MOCK DATA**, mọi tọa độ sẽ được tính toán trực tiếp từ dữ liệu nến lịch sử thực tế của **VN-INDEX** và **16 Nhóm Ngành** (tính theo rổ cổ phiếu đại diện trọng số vốn hóa):

1. **Sức Mạnh Tương Đối (Relative Strength - RS):**
   $$RS_t = \frac{Price_{Sector, t}}{Price_{VNINDEX, t}} \times 100$$

2. **RS-Ratio (Trục Hoành X - Chuẩn hóa quanh 100):**
   $$RS\_Ratio_t = 100 + \left( \frac{RS_t - SMA(RS, N)}{StdDev(RS, N)} \right) \times 10$$
   *(với $N = 10$ hoặc $14$ phiên giao dịch)*.

3. **RS-Momentum (Trục Tung Y - Tốc độ biến thiên):**
   $$RS\_Momentum_t = 100 + \left( \frac{\Delta RS\_Ratio_t - SMA(\Delta RS\_Ratio, M)}{StdDev(\Delta RS\_Ratio, M)} \right) \times 10$$
   *(hoặc tính theo tỷ lệ phần trăm thay đổi của RS-Ratio so với nến trước)*.

---

## 3. Danh Sách 16 Nhóm Ngành Chứng Khoán Việt Nam

| STT | Tên Nhóm Ngành | Mã Cổ Phiếu Trọng Số Đại Diện |
| :--- | :--- | :--- |
| 1 | **Ngân hàng** | VCB, BID, CTG, TCB, MBB, ACB, VPB, HDB, STB |
| 2 | **Chứng khoán & Bảo hiểm** | SSI, VND, VCI, HCM, SHS, MBS, BVH, MIG |
| 3 | **Bất động sản** | VHM, VIC, VRE, KDH, NLG, PDR, DIG, DXG |
| 4 | **Thép & Kim loại** | HPG, HSG, NKG, VGS |
| 5 | **Dầu khí** | GAS, PVD, PVS, BSR, PLX, PVT |
| 6 | **Bán lẻ & Tiêu dùng** | MWG, PNJ, FRT, DGW, MSN, VNM, SAB |
| 7 | **Công nghệ & Viễn thông** | FPT, CMG, CTR, VGI, ELC |
| 8 | **Khu công nghiệp** | KBC, GVR, BCM, IDC, SZC, VGC |
| 9 | **Xây dựng & Hạ tầng** | VCG, HHV, C4G, CII, FCN, LCG |
| 10 | **Thủy sản & Nông nghiệp** | VHC, ANV, IDI, BAF, DBC, HAG |
| 11 | **Điện & Năng lượng** | POW, REE, PC1, GEG, HDG |
| 12 | **Hóa chất & Phân bón** | DGC, DPM, DCM, BFC |
| 13 | **Vận tải & Cảng biển** | GMD, HAH, VSC, PVT, VOS |
| 14 | **Cao su & Săm lốp** | DRC, CSM, BRC, GVR, PHR |
| 15 | **Dược phẩm & Y tế** | DHG, TRA, IMP, DBD |
| 16 | **Khác & Dịch vụ** | TDM, BWE, PAN, VJC, HVN |

---

## 4. Kiến Trúc Kỹ Thuật & Module Cần Xây Dựng

```
frontend/src/features/market/
├── components/
│   ├── RelativeRotationGraph/
│   │   ├── RelativeRotationGraphModal.tsx    # Cửa sổ Fullscreen RRG chuẩn ảnh mẫu
│   │   ├── RelativeRotationGraphCanvas.tsx   # Canvas 2D render 60fps mượt mà, Pan/Zoom
│   │   ├── RRGControlBar.tsx                 # Thanh điều khiển (kỳ đuôi, khung, lọc)
│   │   ├── RRGQuadrantSummary.tsx            # Thống kê số lượng ngành theo 4 góc
│   │   └── RRGTooltip.tsx                    # Tooltip thông số chi tiết khi hover
│   └── MarketOverviewSection.tsx             # Tích hợp thêm Tab "Luân Chuyển Ngành (RRG)"
├── utils/
│   └── rrgCalculator.ts                      # Thuật toán RS-Ratio, RS-Momentum & Bézier curves
└── store/
    └── rrgStore.ts                           # Quản lý state RRG (zoom, pan, trail length, selected)
```

---

## 5. Các Giai Đoạn Thực Hiện

- [ ] **Giai đoạn 1: Module Tính Toán RRG (`rrgCalculator.ts`)**
  - Xây dựng thuật toán tính toán RS, RS-Ratio, RS-Momentum theo dữ liệu nến chuẩn hóa.
  - Xây dựng thuật toán nội suy đường cong Bézier (smooth spline) cho đuôi quỹ đạo.
  - Phân loại ngành vào 4 nhóm: Dẫn dắt, Suy yếu, Tụt hậu, Cải thiện.

- [ ] **Giai đoạn 2: API Dữ Liệu RRG (`/api/market/rrg`)**
  - Kết nối dữ liệu nến lịch sử thực tế của VN-INDEX và các cổ phiếu trụ cột đại diện ngành.
  - Tính toán chỉ số ngành theo trọng số vốn hóa thực tế (Zero Mock Data).
  - Trả về tọa độ lịch sử $N$ kỳ cho 16 nhóm ngành.

- [ ] **Giai đoạn 3: Phát Triển Component Render Canvas (`RelativeRotationGraphCanvas.tsx`)**
  - Vẽ 4 góc phần tư với màu sắc và độ mờ nền tương ứng ảnh mẫu.
  - Vẽ trục tọa độ crosshair tại $(100, 100)$ với đường gạch đứt.
  - Vẽ đuôi quỹ đạo đổi màu theo từng góc phần tư đi qua.
  - Vẽ marker đầu ngành, vòng sáng neon và nhãn tên ngành.
  - Xử lý tương tác: Hover highlight, Pan (kéo rê chuột), Zoom (con lăn chuột), Reset view khi nhấp đúp.

- [ ] **Giai đoạn 4: Bộ Điều Khiển & Giao Diện Fullscreen (`RelativeRotationGraphModal.tsx`)**
  - Tích hợp thanh tiêu đề đếm số ngành theo từng nhóm: `Dẫn dắt X · Suy yếu Y · Tụt hậu Z · Cải thiện W`.
  - Hỗ trợ đổi số kỳ đuôi (3, 4, 8, 12 kỳ).
  - Hỗ trợ bật/tắt hiển thị từng ngành qua danh sách bộ lọc.
  - Tích hợp nút mở Fullscreen Modal phóng to toàn màn hình giống ảnh mẫu của user.

- [ ] **Giai đoạn 5: Tích Hợp Vào Market Terminal & Kiểm Tra Localhost**
  - Bổ sung nút/tab "Luân Chuyển Ngành (RRG)" trong `MarketOverviewSection.tsx` và `market/page.tsx`.
  - Kiểm tra hiệu năng render 60fps trên Localhost.
  - Kiểm tra độ chính xác của các điểm xoay so với VN-INDEX.
