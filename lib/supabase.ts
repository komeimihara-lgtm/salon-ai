import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const DEMO_SALON_ID = 'a0000000-0000-0000-0000-000000000001'

/** 使用するサロンID（NEXT_PUBLIC_SALON_ID が設定されていればそれを使用） */
export function getSalonId(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SALON_ID) {
    return process.env.NEXT_PUBLIC_SALON_ID
  }
  return DEMO_SALON_ID
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
