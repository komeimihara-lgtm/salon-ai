import { createClient } from '@supabase/supabase-js'

export const DEMO_SALON_ID = 'a0000000-0000-0000-0000-000000000001'

// 実行時に初期化（ビルド時エラー回避）
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase環境変数が設定されていません')
  return createClient(url, key)
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase環境変数が設定されていません')
  return createClient(url, key)
}
