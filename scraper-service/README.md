# HP Scraper Service (Reference Implementation)

This is the **external** scraping service that Next.js calls via
`HP_SCRAPER_ENDPOINT`. It runs **outside** Vercel (AWS Lambda,
Fly.io, Railway, a self-hosted VPS, or Browserbase) because:

1. Playwright + Chromium can't fit in Vercel's serverless function
   size limit (250 MB).
2. Login + scrape typically takes 30–60 s, exceeding Hobby (10 s) and
   Pro (60 s) function timeouts.
3. Salon IPs are shared on Vercel — dedicated egress / residential IPs
   work better for avoiding bot detection.

## Contract

`POST /` with JSON:

```json
{
  "salonId": "uuid",
  "email": "salon@example.com",
  "password": "plaintext-password",
  "daysAhead": 7
}
```

Authentication: `X-Scraper-Api-Key: <HP_SCRAPER_API_KEY>`

### Response

```json
{
  "ok": true,
  "reservations": [
    {
      "externalId": "R12345678",
      "customerName": "山田 花子",
      "customerNameKana": "ヤマダ ハナコ",
      "phone": "09012345678",
      "reservationDate": "2026-04-25",
      "startTime": "14:00",
      "endTime": "15:30",
      "menu": "カット＋カラー",
      "staffName": "田中",
      "price": 12000,
      "status": "confirmed"
    }
  ]
}
```

On login failure, return `{ "ok": false, "loginFailed": true, "error": "invalid credentials" }`.
The Next.js app will auto-disable `hp_sync_enabled` and notify via LINE.

## ⚠️ Legal & Ethical Notes

**This scraper accesses サロンボード (Recruit's salon management
system) without a published API.** Recruit's terms of service prohibit
automated access. Operators of this service accept full responsibility
for:

- Account bans from HotPepper Beauty
- Data accuracy issues
- Any action Recruit may take against integrators

Do **not** expose this service without:

1. Rate limits (5 min min between calls per salon — already enforced by Next.js)
2. Human-like jitter (randomized waits)
3. Rotating User-Agents (already picked by `pickUserAgent()` in Next.js)
4. Egress IPs from Japan (residential proxy recommended)

## Reference Playwright Code

See `hp-scraper.ts`. To run locally:

```bash
cd scraper-service
npm install
npx playwright install chromium
HP_SCRAPER_API_KEY=dev-key npm run dev
```

Expose locally via `ngrok http 4001` and set
`HP_SCRAPER_ENDPOINT=https://xxx.ngrok-free.app` in the main app's env.

## Deployment Options

| Platform     | Pros                                      | Notes                               |
| ------------ | ----------------------------------------- | ----------------------------------- |
| AWS Lambda   | Pay-per-request, auto-scale               | Needs chromium layer (~170MB)       |
| Browserbase  | Managed browsers, residential IPs, IPs JP | Paid, most robust                   |
| Fly.io       | Cheap, Japan region available             | Always-on, simple to operate        |
| Self VPS     | Full control, cheapest at scale           | Ops overhead                        |

The default expectation is **Browserbase + a thin Lambda wrapper**
or **Fly.io with a Japan region**.
