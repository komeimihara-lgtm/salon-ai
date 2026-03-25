import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSessionStaffContext } from '@/lib/session-staff-context'

export type PunchContext = { salonId: string; staffId: string; staffName: string | null }

export async function requirePunchContext(): Promise<{ ok: true; ctx: PunchContext } | { ok: false; response: NextResponse }> {
  const session = await getSessionStaffContext()
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: '未認証またはサロン未選択です' }, { status: 401 }) }
  }
  if (!session.staffId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '打刻はスタッフのログインメール（staff.login_email）が設定されたアカウントのみ利用できます' },
        { status: 403 }
      ),
    }
  }
  return {
    ok: true,
    ctx: { salonId: session.salonId, staffId: session.staffId, staffName: session.staffName },
  }
}

export async function requireSalonOwner(): Promise<{ ok: true; salonId: string } | { ok: false; response: NextResponse }> {
  const session = await getSessionStaffContext()
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: '未認証またはサロン未選択です' }, { status: 401 }) }
  }
  if (!session.isSalonOwner) {
    return { ok: false, response: NextResponse.json({ error: 'オーナーのみアクセスできます' }, { status: 403 }) }
  }
  return { ok: true, salonId: session.salonId }
}

export async function fetchShift(salonId: string, staffId: string, date: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('shifts')
    .select('start_time, end_time')
    .eq('salon_id', salonId)
    .eq('staff_id', staffId)
    .eq('date', date)
    .maybeSingle()
  return data as { start_time?: string; end_time?: string } | null
}
