import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const DEMO_SALON_ID = 'a0000000-0000-0000-0000-000000000001'

/** ブラウザ用: document.cookie の salon_id のみ（レジ等・ログイン後） */
export function getSalonId(): string {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)salon_id=([^;]+)/)
    if (match?.[1]) return decodeURIComponent(match[1]).trim()
  }
  return ''
}

/** Cookie ヘッダ文字列から salon_id のみ解析 */
export function getSalonIdFromCookies(cookieHeader?: string | null): string {
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)salon_id=([^;]+)/)
    if (match?.[1]) return decodeURIComponent(match[1]).trim()
  }
  return ''
}

// 実行時に初期化（ビルド時エラー回避）
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase環境変数が設定されていません')
  return createSupabaseClient(url, key)
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase環境変数が設定されていません')
  return createSupabaseClient(url, key)
}

/** createClient のエイリアス（互換用） */
export const createClient = getSupabaseClient
