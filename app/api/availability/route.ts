import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

function timeToMinutes(time: string): number {
  const [h, m] = (time || '00:00').slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD
  const duration = Number(searchParams.get('duration') || '60') // 施術時間（分）

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

  // その日のシフト取得
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, staff(id, name, color)')
    .eq('salon_id', salonId)
    .eq('date', date)

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ available: false, reason: 'シフトなし', slots: [] })
  }

  // その日の予約取得
  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('salon_id', salonId)
    .eq('reservation_date', date)
    .not('status', 'eq', 'cancelled')

  // スタッフごとに空き枠を計算
  const slots: { staff_id: string; staff_name: string; staff_color: string; start: string; end: string }[] = []

  for (const shift of shifts) {
    const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff
    if (!staff) continue

    const staffReservations = reservations?.filter((r: { staff_name?: string }) => r.staff_name === staff.name) || []

    const startTime = typeof shift.start_time === 'string' ? shift.start_time : '09:00'
    const endTime = typeof shift.end_time === 'string' ? shift.end_time : '18:00'
    const shiftStart = timeToMinutes(startTime)
    const shiftEnd = timeToMinutes(endTime)

    for (let t = shiftStart; t + duration <= shiftEnd; t += 30) {
      const slotStart = minutesToTime(t)
      const slotEnd = minutesToTime(t + duration)

      const isBooked = staffReservations.some((r: { start_time: string; duration_minutes?: number }) => {
        const resStart = timeToMinutes(r.start_time)
        const resEnd = resStart + (r.duration_minutes || 60)
        return t < resEnd && t + duration > resStart
      })

      if (!isBooked) {
        slots.push({
          staff_id: staff.id,
          staff_name: staff.name,
          staff_color: staff.color || '#C4728A',
          start: slotStart,
          end: slotEnd,
        })
      }
    }
  }

  return NextResponse.json({ available: slots.length > 0, slots })
}
