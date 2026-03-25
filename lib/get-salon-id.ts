import type { NextRequest } from 'next/server'
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

/** Cookie ヘッダー文字列から salon_id を抜き出す（フォールバック用） */
export function parseSalonIdFromCookieHeader(header: string | null | undefined): string {
  if (!header) return ''
  for (const segment of header.split(';')) {
    const i = segment.indexOf('=')
    if (i === -1) continue
    const key = segment.slice(0, i).trim()
    if (key !== 'salon_id') continue
    let val = segment.slice(i + 1).trim()
    try {
      val = decodeURIComponent(val)
    } catch {
      /* 生のまま */
    }
    return val.trim()
  }
  return ''
}

/**
 * Route Handler 用: リクエストに付いた salon_id を確実に取る。
 * next/headers の cookies() だけだと Route Handler（Vercel 等）で空になることがあるため、
 * NextRequest.cookies → cookies() → Cookie 生ヘッダーの順で試す。
 */
export function getSalonIdFromApiRequest(req: NextRequest): string {
  const fromReq = req.cookies.get('salon_id')?.value?.trim() || ''
  if (fromReq) return fromReq
  try {
    const fromStore = cookies().get('salon_id')?.value?.trim() || ''
    if (fromStore) return fromStore
  } catch {
    /* request スコープ外など */
  }
  return parseSalonIdFromCookieHeader(req.headers.get('cookie'))
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
