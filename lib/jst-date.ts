/**
 * JST (Asia/Tokyo, UTC+9) 基準の日付ユーティリティ。
 *
 * 背景: プロジェクト各所で `new Date().toISOString().slice(0, 10)` で
 * "今日の日付" を求めていたが、これはサーバ(Vercel=UTC)はもちろん、
 * クライアント(ブラウザがJST)でも toISOString は UTC に変換するため、
 * JST 0:00〜9:00 の時間帯で "昨日" の日付文字列を返す。
 * 月またぎに当たると「当月が前月扱いになる」などの致命的なズレに繋がる。
 *
 * 本モジュールは Intl.DateTimeFormat (timeZone: 'Asia/Tokyo') で
 * JST 基準の year/month/day を取り出すため、実行環境の TZ に依存しない。
 *
 * 規約:
 *  - 文字列は常に "YYYY-MM-DD" (ゼロ埋め)
 *  - month 引数はすべて 1-indexed (1=Jan, 12=Dec)
 */

const JST_TZ = 'Asia/Tokyo'

interface JstParts {
  year: number
  month: number // 1-indexed
  day: number
  hour: number
}

function partsInJst(d: Date): JstParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  const hourRaw = Number(parts.hour)
  // en-CA + hour12:false でも環境により '24' が返る場合があるので正規化
  const hour = hourRaw === 24 ? 0 : hourRaw
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 現在の JST 日付を { year, month, day, hour } で返す（month は 1-indexed）。 */
export function jstNow(): JstParts {
  return partsInJst(new Date())
}

/** 任意の Date を JST の YYYY-MM-DD に変換。 */
export function toJstDateString(d: Date): string {
  const { year, month, day } = partsInJst(d)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** 現在の JST 日付を YYYY-MM-DD で返す。 */
export function todayJstString(): string {
  return toJstDateString(new Date())
}

/** 指定年月(1-indexed)の末日(DD)を返す。うるう年対応。 */
export function jstLastDayOfMonth(year: number, month: number): number {
  // 翌月の 0 日 = 当月末日。Date.UTC を使い実行環境TZに依存させない。
  // 例: lastDay(2026, 4) = Date.UTC(2026, 4, 0) = 2026-04-30 UTC → .getUTCDate() = 30
  const endOfMonthUtc = new Date(Date.UTC(year, month, 0))
  return endOfMonthUtc.getUTCDate()
}

/** 指定した年月(1-indexed)の初日と末日を { start, end } (YYYY-MM-DD) で返す。 */
export function jstMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month)}-01`
  const end = `${year}-${pad2(month)}-${pad2(jstLastDayOfMonth(year, month))}`
  return { start, end }
}

/** 現在の JST 年月の月初〜月末を返す。 */
export function currentJstMonthRange(): { start: string; end: string } {
  const { year, month } = jstNow()
  return jstMonthRange(year, month)
}

/** YYYY-MM-DD を起点に ±N ヶ月ずらした月の { start, end } を返す。 */
export function shiftJstMonthRange(
  yyyyMmDd: string,
  diffMonths: number
): { start: string; end: string } {
  const [ys, ms] = yyyyMmDd.split('-')
  const y0 = Number(ys)
  const m0 = Number(ms) // 1-indexed
  if (!Number.isFinite(y0) || !Number.isFinite(m0)) {
    // フォールバック: 現在月
    return currentJstMonthRange()
  }
  // 1-indexed → 0-indexed に直して加算し、再度 1-indexed に戻す
  const m0zero = m0 - 1 + diffMonths
  const newYear = y0 + Math.floor(m0zero / 12)
  const newMonth = ((m0zero % 12) + 12) % 12 + 1
  return jstMonthRange(newYear, newMonth)
}

/** YYYY-MM-DD 同士を JST 基準で比較した日数差 (a - b)。 */
export function diffDaysJst(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const aMs = Date.UTC(ay, (am || 1) - 1, ad || 1)
  const bMs = Date.UTC(by, (bm || 1) - 1, bd || 1)
  return Math.round((aMs - bMs) / (1000 * 60 * 60 * 24))
}
