import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonTenantId } from '@/lib/get-salon-id'

export const dynamic = 'force-dynamic'

const SLOT_MINUTES = 15

type ReservationRow = {
  start_time: string
  end_time?: string | null
  duration_minutes?: number | null
  staff_name?: string | null
  bed_id?: string | null
  status?: string | null
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const salonId = resolveSalonTenantId(searchParams)
  if (!salonId) {
    return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
  }
  const date = searchParams.get('date')
  const duration = Number(searchParams.get('duration') || '60')

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data: holidays } = await supabase
    .from('salon_holidays')
    .select('*')
    .eq('salon_id', salonId)
    .eq('date', date)
    .is('staff_id', null)

  if (holidays && holidays.length > 0) {
    return NextResponse.json({ available: false, reason: holidays[0].reason || '休業日', slots: [] })
  }

  const { data: salon } = await supabase
    .from('salons')
    .select('beds')
    .eq('id', salonId)
    .single()
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']

  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, staff(id, name, color)')
    .eq('salon_id', salonId)
    .eq('date', date)

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ available: false, reason: 'シフトなし', slots: [] })
  }

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('salon_id', salonId)
    .eq('reservation_date', date)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')

  const toMinutes = (time: string) => {
    const [h, m] = (time || '00:00').slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const toTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const resWindow = (r: ReservationRow) => {
    const resStart = toMinutes(r.start_time)
    let resEnd = r.end_time ? toMinutes(r.end_time) : resStart + (r.duration_minutes || 60)
    if (resEnd <= resStart) resEnd = resStart + (r.duration_minutes || 60)
    return { resStart, resEnd }
  }

  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    aStart < bEnd && aEnd > bStart

  const blockingReservations: ReservationRow[] = reservations || []

  let globalMin = 24 * 60
  let globalMax = 0
  for (const shift of shifts) {
    const startTime = typeof shift.start_time === 'string' ? shift.start_time : '09:00'
    const endTime = typeof shift.end_time === 'string' ? shift.end_time : '18:00'
    globalMin = Math.min(globalMin, toMinutes(startTime))
    globalMax = Math.max(globalMax, toMinutes(endTime))
  }

  const slots: {
    staff_id: string
    staff_name: string
    staff_color: string
    start: string
    end: string
    bed_id: string
  }[] = []

  for (let t = globalMin; t + duration <= globalMax; t += SLOT_MINUTES) {
    const slotEnd = t + duration

    const onDutyById = new Map<string, { id: string; name: string; color: string }>()
    for (const shift of shifts) {
      const staff = Array.isArray(shift.staff) ? shift.staff[0] : shift.staff
      if (!staff) continue
      const startTime = typeof shift.start_time === 'string' ? shift.start_time : '09:00'
      const endTime = typeof shift.end_time === 'string' ? shift.end_time : '18:00'
      const shiftStart = toMinutes(startTime)
      const shiftEnd = toMinutes(endTime)
      if (shiftStart <= t && shiftEnd >= slotEnd) {
        onDutyById.set(staff.id, {
          id: staff.id,
          name: staff.name,
          color: staff.color || '#C4728A',
        })
      }
    }

    const onDuty = Array.from(onDutyById.values()).sort((a, b) => a.id.localeCompare(b.id))

    const availableStaff = onDuty.filter(staff => {
      return !blockingReservations.some(r => {
        if (r.staff_name !== staff.name) return false
        const { resStart, resEnd } = resWindow(r)
        return overlaps(t, slotEnd, resStart, resEnd)
      })
    })

    const occupiedBeds = new Set<string>()
    for (const r of blockingReservations) {
      const { resStart, resEnd } = resWindow(r)
      if (!overlaps(t, slotEnd, resStart, resEnd)) continue
      const bid = r.bed_id != null && r.bed_id !== '' ? String(r.bed_id) : null
      if (bid && beds.includes(bid)) occupiedBeds.add(bid)
    }
    const freeBeds = beds.filter(b => !occupiedBeds.has(b))

    const cap = Math.min(freeBeds.length, availableStaff.length)
    for (let i = 0; i < cap; i++) {
      const st = availableStaff[i]
      slots.push({
        staff_id: st.id,
        staff_name: st.name,
        staff_color: st.color,
        start: toTime(t),
        end: toTime(slotEnd),
        bed_id: freeBeds[i],
      })
    }
  }

  return NextResponse.json({ available: slots.length > 0, slots })
}
