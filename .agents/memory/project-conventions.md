---
type: project
created: 2026-05-25
updated: 2026-07-12
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.

## Strict Data Integrity (Zero Mock Data)
- CẤM MOCK DATA tài chính (Macro, giá cổ phiếu, chỉ số kinh tế, tin tức).
- Chỉ sử dụng dữ liệu thực tế từ API chuẩn xác (DNSE, Vnstock, API chính thống).
- Nếu không có API thực hoặc dữ liệu chưa xác thực, không hiển thị dữ liệu giả định để lấp chỗ trống. Phải ẩn hoặc để trạng thái chờ dữ liệu thật.

## Deployment Workflow
- Luôn kiểm tra, phát triển và chạy thử nghiệm trên **Localhost** trước.
- **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG DEPLOY VERCEL**: Chỉ khi người dùng có yêu cầu rõ ràng ("đẩy lên vercel", "deploy vercel",...) thì mới được phép chạy lệnh deploy lên Vercel. Sau mỗi lần sửa code, chỉ kiểm tra và chạy local.

## US & Global Macro Section Standards
- Toàn bộ chỉ số thị trường Mỹ (S&P 500, Nasdaq, Dow Jones, US 10Y Yield, VIX, DXY), xác suất FedWatch và CPI lấy từ API backend `/api/macro/us-global`.
- Thiết kế Bento 2.0 theo `design-taste-frontend`, giao diện tối giản chuẩn Dark mode zinc-950, typography font-mono sắc nét, tuyệt đối không màu tím (Purple Ban).
- Hỗ trợ nút mũi tên thu gọn / mở rộng (Caret) linh hoạt, hiển thị thanh tóm tắt khi thu gọn.
