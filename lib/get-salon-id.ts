import { cookies } from 'next/headers'

/** サーバーサイドAPIルート用: cookieからsalon_idを取得 */
export function getSalonIdFromCookie(): string {
  try {
    const cookieStore = cookies()
    const cookieSalonId = cookieStore.get('salon_id')?.value
    if (cookieSalonId) return cookieSalonId
  } catch {}
  // 環境変数があればそれを使う（DEMO_SALON_IDへのフォールバックは廃止）
  return process.env.NEXT_PUBLIC_SALON_ID || ''
}
