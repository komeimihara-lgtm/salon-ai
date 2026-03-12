import { createSupabaseBrowser } from './supabase-browser'
import { DEMO_SALON_ID } from './supabase'

const DEMO_SALON_ID_FIXED = 'de000000-0000-0000-0000-000000000001'

/** cookieからデモモードかどうかを判定 */
function isDemoMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith('demo_mode=true'))
}

/** ログイン中ユーザーのサロンIDを取得（デモモードまたは未ログインはデモID） */
export async function getCurrentSalonId(): Promise<string> {
  if (isDemoMode()) return DEMO_SALON_ID_FIXED

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
