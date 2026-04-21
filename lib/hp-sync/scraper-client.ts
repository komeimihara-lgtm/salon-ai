/**
 * Client for an EXTERNAL scraper service (AWS Lambda / Browserbase /
 * self-hosted). We do NOT run Playwright inside Vercel serverless —
 * this module just POSTs to HP_SCRAPER_ENDPOINT with the salon's
 * decrypted credentials and returns whatever reservations it scraped.
 *
 * Scraper service is expected to:
 *   1. Log in to サロンボード (salonboard.com) with (email, password).
 *   2. Read reservations for [today, today+7].
 *   3. Return them as the JSON shape below.
 *
 * A reference implementation lives in /scraper-service/hp-scraper.ts
 * and can be deployed to AWS Lambda / any Node host.
 */

export interface ScrapedReservation {
  externalId: string | null
  customerName: string | null
  customerNameKana: string | null
  phone: string | null
  reservationDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string | null // HH:mm
  menu: string | null
  staffName: string | null
  price: number | null
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}

export interface ScrapeResult {
  ok: boolean
  reservations: ScrapedReservation[]
  error?: string
  loginFailed?: boolean
}

export async function callScraperService(input: {
  salonId: string
  email: string
  password: string
  daysAhead?: number
}): Promise<ScrapeResult> {
  const endpoint = process.env.HP_SCRAPER_ENDPOINT
  const apiKey = process.env.HP_SCRAPER_API_KEY

  if (!endpoint) {
    return {
      ok: false,
      reservations: [],
      error: 'HP_SCRAPER_ENDPOINT is not configured',
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scraper-Api-Key': apiKey || '',
      },
      body: JSON.stringify({
        salonId: input.salonId,
        email: input.email,
        password: input.password,
        daysAhead: input.daysAhead ?? 7,
      }),
      // scrape takes time (login + parse)
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return {
        ok: false,
        reservations: [],
        error: `scraper responded ${res.status}: ${txt.slice(0, 200)}`,
        loginFailed: res.status === 401,
      }
    }

    const json = (await res.json()) as ScrapeResult
    return {
      ok: json.ok !== false,
      reservations: Array.isArray(json.reservations) ? json.reservations : [],
      error: json.error,
      loginFailed: json.loginFailed,
    }
  } catch (e) {
    return {
      ok: false,
      reservations: [],
      error: `scraper call failed: ${String(e)}`,
    }
  }
}
