import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const DEMO_SALON_ID = 'a0000000-0000-0000-0000-000000000001'

/** 使用するサロンID（環境変数 > デモID） */
export function getSalonId(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SALON_ID) {
    return process.env.NEXT_PUBLIC_SALON_ID
  }
  return DEMO_SALON_ID
}

/** API Route用: cookieからsalon_idを取得（cookie > 環境変数 > デモID） */
export function getSalonIdFromCookies(cookieHeader?: string | null): string {
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)salon_id=([^;]+)/)
    if (match?.[1]) return match[1]
  }
  return getSalonId()
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
