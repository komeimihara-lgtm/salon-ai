import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSessionStaffContext } from '@/lib/session-staff-context'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function requireSalonIdFromCookie(): Promise<
  { ok: true; salonId: string } | { ok: false; response: NextResponse }
> {
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return { ok: false, response: NextResponse.json({ error: 'サロン未選択です（salon_id Cookie）' }, { status: 401 }) }
  }
  return { ok: true, salonId }
}

/**
 * 打刻: Cookie の salon に所属する staff_id か検証する。
 */
export async function resolveStaffForAttendance(
  salonId: string,
  staffIdRaw: string | null | undefined
): Promise<
  { ok: true; staffId: string; staffName: string | null } | { ok: false; response: NextResponse }
> {
  const staffId = (staffIdRaw || '').trim()
  if (!staffId) {
    return { ok: false, response: NextResponse.json({ error: 'staff_id が必要です' }, { status: 400 }) }
  }
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('staff')
    .select('id, name')
    .eq('id', staffId)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (error) {
    return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) }
  }
  if (!data?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'スタッフが見つからないか、このサロンに所属していません' }, { status: 404 }),
    }
  }
  return { ok: true, staffId: data.id as string, staffName: (data.name as string) || null }
}

export async function requireSalonAndStaffFromPost(
  req: NextRequest
): Promise<
  | { ok: true; salonId: string; staffId: string; staffName: string | null }
  | { ok: false; response: NextResponse }
> {
  const salon = await requireSalonIdFromCookie()
  if (!salon.ok) return salon
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const staff = await resolveStaffForAttendance(salon.salonId, body.staff_id as string | undefined)
  if (!staff.ok) return staff
  return { ok: true, salonId: salon.salonId, staffId: staff.staffId, staffName: staff.staffName }
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
