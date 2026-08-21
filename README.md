# job-radar 📡

Tổng hợp job **.NET / remote** từ các job-board public (RemoteOK, Remotive, Arbeitnow),
lọc từ khoá, khử trùng lặp, rồi **mỗi sáng thứ 2–6 tạo một GitHub Issue** — GitHub tự
gửi email digest vào hộp thư. Không cần SMTP, không lưu secret.

## Cách chạy
- **Tự động:** cron `0 0 * * 1-5` (07:00 GMT+7). Xem `.github/workflows/radar.yml`.
- **Chạy tay:** tab **Actions → job-radar → Run workflow**.

## Cơ chế
```
Actions cron → radar.js (fetch 3 board, lọc .NET/C#, khử trùng qua seen.json)
            → digest.md → tạo Issue → GitHub email cho owner
            → commit seen.json (tránh lặp job cũ)
```

Chỉnh từ khoá lọc trong `radar.js` (biến `KEYWORDS`). Tắt email = tắt notify Issue của repo.

**Tech:** Node 20 (fetch built-in, no deps) · GitHub Actions · github-script.
