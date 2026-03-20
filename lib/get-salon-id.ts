import { cookies } from 'next/headers'

/**
 * サーバーAPI: Cookie の salon_id のみ（ログイン後のテナント分離）
 * 環境変数フォールバックは廃止（未認証でのテナント固定を防ぐ）
 */
export function getSalonIdFromCookie(): string {
  try {
    const cookieStore = cookies()
    return cookieStore.get('salon_id')?.value?.trim() || ''
  } catch {
    return ''
  }
}

/**
 * LIFF 等: Cookie が無いとき、URL の salon_id が NEXT_PUBLIC_LIFF_SALON_ID と一致する場合のみテナント確定。
 * ダッシュボードの API は cookie 必須。LIFF からはクエリで同一UUIDを付与すること。
 */
export function resolveSalonTenantId(searchParams: URLSearchParams): string {
  const fromCookie = getSalonIdFromCookie()
  if (fromCookie) return fromCookie
  const liffSalon = process.env.NEXT_PUBLIC_LIFF_SALON_ID?.trim() || ''
  if (!liffSalon) return ''
  const q = searchParams.get('salon_id')?.trim() || ''
  return q === liffSalon ? q : ''
}

/** LIFF 専用API（booking / check-customer）用。環境変数で1サロンに紐づくLIFFアプリ向け */
export function getLiffSalonId(): string {
  return process.env.NEXT_PUBLIC_LIFF_SALON_ID?.trim() || ''
}
