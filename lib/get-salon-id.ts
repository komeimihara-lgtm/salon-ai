import { cookies } from 'next/headers'
import { DEMO_SALON_ID } from './supabase'

/** サーバーサイドAPIルート用: cookieからsalon_idを取得 */
export function getSalonIdFromCookie(): string {
  try {
    const cookieStore = cookies()
    const cookieSalonId = cookieStore.get('salon_id')?.value
    if (cookieSalonId) return cookieSalonId
  } catch {}
  return process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID
}
