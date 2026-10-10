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
