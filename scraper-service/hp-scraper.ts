/**
 * HP Scraper Service — REFERENCE IMPLEMENTATION
 *
 * Deploy this separately from the Next.js app (Fly.io, AWS Lambda, VPS, ...).
 * DO NOT bundle this file into the Next.js build — playwright won't fit
 * in Vercel's 250MB serverless limit and login/scrape takes >60s.
 *
 * Env vars:
 *   HP_SCRAPER_API_KEY     (shared secret — must match Next.js)
 *   PORT                   (default 4001)
 *
 * Exposed route: POST /  (see README)
 */

import express from 'express'
import { chromium, Browser, Page } from 'playwright'

const app = express()
app.use(express.json({ limit: '1mb' }))

const API_KEY = process.env.HP_SCRAPER_API_KEY || ''
const PORT = Number(process.env.PORT || 4001)

// Simple UA rotation (in addition to the rotation in Next.js)
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
]

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function randomDelay(minMs = 800, maxMs = 2200): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs))
  return new Promise((r) => setTimeout(r, ms))
}

interface ScrapedReservation {
  externalId: string | null
  customerName: string | null
  customerNameKana: string | null
  phone: string | null
  reservationDate: string
  startTime: string
  endTime: string | null
  menu: string | null
  staffName: string | null
  price: number | null
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}

async function loginToSalonBoard(
  page: Page,
  email: string,
  password: string
): Promise<boolean> {
  // NOTE: Selectors below are placeholders. Update to match the current
  // サロンボード DOM before deploying. Recruit changes their markup
  // frequently — expect to re-tune these every few months.
  await page.goto('https://salonboard.com/login/', { waitUntil: 'domcontentloaded' })
  await randomDelay()

  try {
    await page.fill('input[name="userId"]', email)
    await randomDelay(300, 800)
    await page.fill('input[name="password"]', password)
    await randomDelay(400, 1000)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click('button[type="submit"]'),
    ])
  } catch {
    return false
  }

  // Consider login successful only if we're no longer on /login/
  return !page.url().includes('/login/')
}

async function scrapeReservations(
  page: Page,
  daysAhead: number
): Promise<ScrapedReservation[]> {
  // Placeholder navigation to the reservation list page.
  // Replace with the real サロンボード URL for予約台帳 when deploying.
  await page.goto('https://salonboard.com/reserve/list/', {
    waitUntil: 'domcontentloaded',
  })
  await randomDelay(1500, 3000)

  // Example extraction — ADJUST to actual DOM before production use.
  const rows = await page.$$eval('[data-testid="reservation-row"]', (els) =>
    els.map((el) => {
      const get = (sel: string) => el.querySelector(sel)?.textContent?.trim() || ''
      return {
        externalId: get('[data-testid="ext-id"]') || null,
        customerName: get('[data-testid="cust-name"]') || null,
        customerNameKana: get('[data-testid="cust-kana"]') || null,
        phone: get('[data-testid="cust-phone"]').replace(/[^\d]/g, '') || null,
        reservationDate: get('[data-testid="date"]'),
        startTime: get('[data-testid="start"]'),
        endTime: get('[data-testid="end"]') || null,
        menu: get('[data-testid="menu"]') || null,
        staffName: get('[data-testid="staff"]') || null,
        price: Number(get('[data-testid="price"]').replace(/[^\d]/g, '')) || null,
        status: 'confirmed' as const,
      }
    })
  )

  // Filter to [today, today+daysAhead]
  const today = new Date()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + daysAhead)
  return rows.filter((r) => {
    if (!r.reservationDate) return false
    const d = new Date(r.reservationDate)
    return d >= today && d <= horizon
  }) as ScrapedReservation[]
}

app.post('/', async (req, res) => {
  const apiKey = req.headers['x-scraper-api-key']
  if (!API_KEY || apiKey !== API_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const { salonId, email, password, daysAhead = 7 } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email/password required' })
  }

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: pickUA(),
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    const loggedIn = await loginToSalonBoard(page, email, password)
    if (!loggedIn) {
      return res.json({ ok: false, loginFailed: true, error: 'login failed', reservations: [] })
    }

    const reservations = await scrapeReservations(page, Number(daysAhead))
    console.log(`[scraper] salon=${salonId} scraped=${reservations.length}`)
    return res.json({ ok: true, reservations })
  } catch (e) {
    console.error('[scraper] error', e)
    return res.status(500).json({ ok: false, error: String(e), reservations: [] })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
})

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`[scraper] listening on :${PORT}`)
})
