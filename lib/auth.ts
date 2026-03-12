import { createSupabaseBrowser } from './supabase-browser'
import { DEMO_SALON_ID } from './supabase'

/** ログイン中ユーザーのサロンIDを取得（未ログインはデモID） */
export async function getCurrentSalonId(): Promise<string> {
  const supabase = createSupabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEMO_SALON_ID

  const { data: salon } = await supabase
    .from('salons')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  return salon?.id || DEMO_SALON_ID
}
