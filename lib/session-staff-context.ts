import { getSalonSaleOperator } from '@/lib/salon-sale-operator'
import { getSupabaseAdmin } from '@/lib/supabase'

export type SessionStaffContext = {
  salonId: string
  email: string
  /** salons.owner_email と一致（店舗オーナー）。勤怠管理・売上サマリーはこのユーザーのみ。 */
  isSalonOwner: boolean
  /** staff.login_email 一致時。打刻は staffId 必須。 */
  staffId: string | null
  staffName: string | null
}

/**
 * Cookie のサロン + セッションから、店舗オーナー判定とスタッフ行を解決する。
 */
export async function getSessionStaffContext(): Promise<SessionStaffContext | null> {
  const op = await getSalonSaleOperator()
  if (!op.salonId || !op.email) return null

  const admin = getSupabaseAdmin()
  const emailNorm = op.email.trim().toLowerCase()

  const { data: staffRow } = await admin
    .from('staff')
    .select('id, name')
    .eq('salon_id', op.salonId)
    .ilike('login_email', op.email)
    .maybeSingle()

  const { data: salon } = await admin.from('salons').select('owner_email').eq('id', op.salonId).maybeSingle()
  const ownerEmail = (salon?.owner_email as string | null)?.trim().toLowerCase()
  const isSalonOwner = !!ownerEmail && ownerEmail === emailNorm

  return {
    salonId: op.salonId,
    email: op.email,
    isSalonOwner,
    staffId: (staffRow?.id as string) ?? null,
    staffName: (staffRow?.name as string) ?? null,
  }
}
