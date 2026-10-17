---
name: global-macro-rules
version: 1.0.0
priority: P0
trigger: always
---

# Global Macro & US Financial Data Rules - AG Kit

> Always-active rule for US Market, Global Economic Data, FedWatch, and Vietnam Impact Analytics.

---

## 1. 🚫 STRICT ZERO MOCK DATA CHO DỮ LIỆU THỊ TRƯỜNG MỸ & VĨ MÔ QUỐC TẾ
- **TUYỆT ĐỐI CẤM DỮ LIỆU GIẢ / HARDCODE ẢO**: Mọi chỉ số chứng khoán Mỹ (S&P 500, Nasdaq, Dow Jones), lợi suất trái phiếu (US 10Y Yield `^TNX`), chỉ số biến động sợ hãi (`^VIX`), chỉ số Dollar Index (`DX-Y.NYB`), số liệu lạm phát Mỹ (CPI/Core CPI từ Cục Thống kê Lao động Mỹ BLS), và xác suất điều hành lãi suất từ công cụ CME FedWatch Tool BẮT BUỘC phải được kết nối từ endpoint backend chuẩn (`/api/macro/us-global`) hoặc API thị trường thực tế (Yahoo Finance, CME Group, BLS, FRED).
- **Cơ chế Fallback An Toàn**: Khi mạng lỗi hoặc endpoint không khả dụng, hiển thị trạng thái đang cập nhật / spinner, tuyệt đối không tự bịa số liệu ảo.

---

## 2. 🇻🇳 MA TRẬN PHÂN TÍCH TÁC ĐỘNG TỚI THỊ TRƯỜNG VIỆT NAM (VIETNAM MACRO IMPACT)
Mọi bảng điều khiển chỉ số quốc tế phải luôn đi kèm góc nhìn phân tích tương quan định lượng tới kinh tế vĩ mô và TTCK Việt Nam theo 3 trụ cột:
1. **Áp lực tỷ giá USD/VND**: Đánh giá dựa trên tương quan biến động của chỉ số DXY và chênh lệch lãi suất Fed - SBV.
2. **Dư địa chính sách tiền tệ NHNN (SBV)**: Khả năng duy trì mặt bằng lãi suất điều hành thấp và chính sách nới lỏng tiền tệ hỗ trợ tăng trưởng khi Fed bước vào chu kỳ cắt giảm lãi suất.
3. **Dòng vốn ngoại ròng (FII & ETF)**: Đánh giá xu hướng dòng vốn quốc tế rút ròng hay đảo chiều mua ròng trên HOSE/HNX tương quan với khẩu vị rủi ro toàn cầu (chỉ số VIX & US 10Y Yield).

---

## 3. 🎨 NGUYÊN TẮC THIẾT KẾ & TASTE GUIDELINES (BENTO 2.0 & THE PURPLE BAN)
Tuân thủ nghiêm ngặt kỹ năng `design-taste-frontend` và `DESIGN.md`:
- **Layout Bento Grid 2.0 Cân Đối**: Bố cục module hóa khoa học (CME FedWatch Tool, US CPI & 10Y Yield, US Equities & VIX). Luôn giữ tỷ lệ fit hoàn hảo, không để lệch cột hay vỡ layout trên desktop/mobile.
- **Collapsible Toggle (Thu gọn / Mở rộng)**: Cung cấp nút mũi tên Caret để người dùng có thể chủ động ẩn/hiện chi tiết bảng chỉ số vĩ mô quốc tế, hiển thị dải tóm tắt rút gọn tinh tế khi thu gọn.
- **Banned Purple & Over-glow**: Tuyệt đối không dùng màu tím AI (Purple Ban), không dùng viền neon lóa mắt. Sử dụng nền sâu `#09090b` (`zinc-950`), viền `zinc-800/80`, điểm nhấn màu tài chính: Xanh ngọc (`emerald-400`), Xanh cyan (`cyan-400`), Vàng hổ phách (`amber-400`), Xanh dương (`blue-400`).
- **Font Chuyên Dụng**: Toàn bộ số liệu giá, tỷ lệ %, lãi suất và thời gian bắt buộc dùng font đơn cách `JetBrains Mono` / `font-mono`.

---

## 4. 🔒 LOCALHOST FIRST - KHÔNG TỰ Ý PUSH / DEPLOY
- Luôn kiểm thử và hoàn thiện toàn bộ tính năng trên **Localhost** (`http://localhost:3000`).
- **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG `git push` HAY DEPLOY LÊN VERCEL** nếu người dùng chưa trực tiếp xác nhận và ra lệnh.
