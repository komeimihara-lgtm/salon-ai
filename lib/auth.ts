import { createSupabaseBrowser } from './supabase-browser'
import { getSalonId } from './supabase'

/** ログイン中ユーザーのサロンIDを取得（DB優先、なければ cookie） */
export async function getCurrentSalonId(): Promise<string> {
  const supabase = createSupabaseBrowser()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return getSalonId()

  const { data: salon } = await supabase
    .from('salons')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  return salon?.id || getSalonId()
}
