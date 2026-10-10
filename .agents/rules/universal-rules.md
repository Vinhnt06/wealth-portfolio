---
name: universal-rules
version: 1.0.0
priority: P0
trigger: always_on
---

# Universal Rules (TIER 0) - AG Kit

> Always-active rules that apply to every request, regardless of domain.

---

## 🌐 Language Handling

When user's prompt is NOT in English:

1. **Internally translate** for better comprehension
2. **Respond in user's language** - match their communication
3. **Code comments/variables** remain in English

---

## 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow `@[skills/clean-code]` rules. No exceptions.**

- **Code**: Concise, direct, no over-engineering. Self-documenting.
- **Testing**: Mandatory. Pyramid (Unit > Int > E2E) + AAA Pattern.
- **Performance**: Measure first. Adhere to current Core Web Vitals standards.
- **Infra/Safety**: 5-Phase Deployment. Verify secrets security.

---

## 🚫 STRICT ZERO MOCK DATA RULE (CẤM MOCK DATA)

- **TUYỆT ĐỐI CẤM MOCK DATA**: Mọi số liệu tài chính, giá cổ phiếu, chỉ số kinh tế vĩ mô (GDP, CPI, tỷ giá, lãi suất, giá hàng hóa), tin tức, khối lượng giao dịch BẮT BUỘC phải lấy từ API/nguồn dữ liệu thực tế, chuẩn xác (DNSE, Vnstock, các API chính thống có kiểm chứng).
- **KHÔNG BỊA ĐẶT SỐ LIỆU**: Cấm tự viết tệp JSON tĩnh tự sinh số liệu giả, cấm hardcode số liệu tài chính giả lập để lấp đầy giao diện.
- **XỬ LÝ KHI CHƯA CÓ API**: Nếu một chức năng chưa có nguồn API thực hoặc nguồn dữ liệu chưa được xác thực chuẩn xác 100%, KHÔNG ĐƯỢC dùng mock data thay thế. Phải ẩn component đó hoặc thông báo rõ ràng cho người dùng, tuyệt đối không hiển thị thông tin sai lệch.

---
