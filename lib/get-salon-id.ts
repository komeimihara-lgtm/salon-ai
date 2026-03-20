import { cookies } from 'next/headers'
import { parseSalonIdQueryValue } from '@/lib/salon-id-format'

/**
 * サーバーAPI: Cookie の salon_id のみ（ログイン後のテナント分離）
 */
export function getSalonIdFromCookie(): string {
  try {
    const cookieStore = cookies()
    return cookieStore.get('salon_id')?.value?.trim() || ''
  } catch {
    return ''
  }
}

/** URLSearchParams の salon_id を検証して返す */
export function parseQuerySalonId(searchParams: URLSearchParams): string {
  return parseSalonIdQueryValue(searchParams.get('salon_id'))
}

/**
 * ダッシュボード: cookie 優先。
 * LIFF 等（未ログイン）: クエリ `salon_id` が有効なUUID形式ならその値（マルチテナント）。
 */
export function resolveSalonTenantId(searchParams: URLSearchParams): string {
  const fromCookie = getSalonIdFromCookie()
  if (fromCookie) return fromCookie
  return parseQuerySalonId(searchParams)
}
