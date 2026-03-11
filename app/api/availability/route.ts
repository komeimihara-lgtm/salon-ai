import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SLOT_MINUTES = 15

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const salonId = getSalonId()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const duration = Number(searchParams.get('duration') || '60')

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  // 休業日チェック
  const { data: holidays } = await supabase
    .from('salon_holidays')
    .select('*')
    .eq('salon_id', salonId)
    .eq('date', date)
    .is('staff_id', null)

  if (holidays && holidays.length > 0) {
    return NextResponse.json({ available: false, reason: holidays[0].reason || '休業日', slots: [] })
  }

  // ベッド一覧取得
  const { data: salon } = await supabase
    .from('salons')
    .select('beds')
    .eq('id', salonId)
    .single()
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']

  // シフト取得
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, staff(id, name, color)')
    .eq('salon_id', salonId)
    .eq('date', date)

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ available: false, reason: 'シフトなし', slots: [] })
  }

  // 予約取得
  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('salon_id', salonId)
    .eq('reservation_date', date)
    .not('status', 'eq', 'cancelled')

  // 時間→分変換
  const toMinutes = (time: string) => {
    const [h, m] = (time || '00:00').slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const toTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // スタッフごとの空き枠を計算
  const slots: {
    staff_id: string
    staff_name: string
    staff_color: string
    start: string
    end: string
    bed_id: string
  }[] = []

  for (const shift of shifts) {
    const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff
    if (!staff) continue

    const staffReservations = reservations?.filter((r: { staff_name?: string }) =>
      r.staff_name === staff.name
    ) || []

    const startTime = typeof shift.start_time === 'string' ? shift.start_time : '09:00'
    const endTime = typeof shift.end_time === 'string' ? shift.end_time : '18:00'
    const shiftStart = toMinutes(startTime)
    const shiftEnd = toMinutes(endTime)

    // 15分刻みで空き枠を生成
    for (let t = shiftStart; t + duration <= shiftEnd; t += SLOT_MINUTES) {
      // スタッフの予約との重複チェック
      const isStaffBooked = staffReservations.some((r: { start_time: string; duration_minutes?: number }) => {
        const resStart = toMinutes(r.start_time)
        const resEnd = resStart + (r.duration_minutes || 60)
        return t < resEnd && t + duration > resStart
      })
      if (isStaffBooked) continue

      // ベッドの空きチェック（その時間帯に空いているベッドを探す）
      const bookedBeds = (reservations || [])
        .filter((r: { start_time: string; duration_minutes?: number }) => {
          const resStart = toMinutes(r.start_time)
          const resEnd = resStart + (r.duration_minutes || 60)
          return t < resEnd && t + duration > resStart
        })
        .map((r: { bed_id?: string }) => r.bed_id)
        .filter(Boolean)

      const availableBed = beds.find(b => !bookedBeds.includes(b))
      if (!availableBed) continue

      slots.push({
        staff_id: staff.id,
        staff_name: staff.name,
        staff_color: staff.color || '#C4728A',
        start: toTime(t),
        end: toTime(t + duration),
        bed_id: availableBed,
      })
    }
  }

  return NextResponse.json({ available: slots.length > 0, slots })
}
