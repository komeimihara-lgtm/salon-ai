import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { consumeSubscriptionAtBooking, consumeTicketAtBooking } from '@/lib/reservation-course-consume'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.customer_name || !body.reservation_date || !body.start_time) {
      return NextResponse.json({ error: '顧客名・日付・時間は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()
    const durationMin = body.duration_minutes ?? 60
    const [sh = 10, sm = 0] = (body.start_time || '10:00').slice(0, 5).split(':').map(Number)
    const endMin = sh * 60 + sm + durationMin
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const computedEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    const reservation_date = body.reservation_date
    const start_time = body.start_time
    const end_time = body.end_time || computedEndTime
    const bed_id = body.bed_id || null
    const staff_name = body.staff_name || null

    // --- 重複チェック1: ベッドの重複 ---
    if (bed_id) {
      const { data: bedConflict } = await supabase
        .from('reservations')
        .select('id, customer_name, start_time, end_time')
        .eq('salon_id', salonId)
        .eq('reservation_date', reservation_date)
        .eq('bed_id', bed_id)
        .neq('status', 'cancelled')
        .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`)

      if (bedConflict && bedConflict.length > 0) {
        return NextResponse.json({
          error: `ベッド${bed_id}は${bedConflict[0].start_time}〜${bedConflict[0].end_time}に${bedConflict[0].customer_name}様の予約が入っています`,
          conflict: bedConflict[0],
          conflictType: 'bed',
        }, { status: 409 })
      }
    }

    // --- 重複チェック2: スタッフの重複 ---
    if (staff_name) {
      const { data: staffConflict } = await supabase
        .from('reservations')
        .select('id, customer_name, start_time, end_time')
        .eq('salon_id', salonId)
        .eq('reservation_date', reservation_date)
        .eq('staff_name', staff_name)
        .neq('status', 'cancelled')
        .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`)

      if (staffConflict && staffConflict.length > 0) {
        return NextResponse.json({
          error: `${staff_name}は${staffConflict[0].start_time}〜${staffConflict[0].end_time}に${staffConflict[0].customer_name}様の予約が入っています`,
          conflict: staffConflict[0],
          conflictType: 'staff',
        }, { status: 409 })
      }
    }

    const isCourse = body.is_course === true
    const ticketId = body.ticket_id || null
    const subscriptionId = body.subscription_id || null

    /** サブスク・回数券は予約作成時に消化＋sales計上（来店時は二重にしない） */
    let courseConsumedAtBooking = false
    const consumeCtx = {
      salonId,
      reservationDate: reservation_date,
      customerId: String(body.customer_id || ''),
      customerName: String(body.customer_name || ''),
      menu: (body.menu as string | null) || null,
      staffName: staff_name,
    }

    if (isCourse && ticketId) {
      try {
        await consumeTicketAtBooking(supabase, ticketId, consumeCtx)
        courseConsumedAtBooking = true
      } catch (e) {
        const code = (e as Error & { code?: string }).code
        if (code === 'TICKET_DEPLETED') {
          return NextResponse.json({ error: (e as Error).message }, { status: 409 })
        }
        console.error('予約作成時コース消化（回数券）:', e)
        return NextResponse.json({ error: '回数券の消化に失敗しました' }, { status: 500 })
      }
    } else if (isCourse && subscriptionId) {
      try {
        await consumeSubscriptionAtBooking(supabase, subscriptionId, consumeCtx)
        courseConsumedAtBooking = true
      } catch (e) {
        const code = (e as Error & { code?: string }).code
        if (code === 'SUB_NOT_FOUND') {
          return NextResponse.json({ error: (e as Error).message }, { status: 404 })
        }
        console.error('予約作成時コース消化（サブスク）:', e)
        return NextResponse.json({ error: 'サブスクの消化に失敗しました' }, { status: 500 })
      }
    }

    const insertData: Record<string, unknown> = {
      salon_id: salonId,
      customer_id: body.customer_id || null,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone || null,
      reservation_date,
      start_time,
      end_time,
      menu: body.menu || null,
      staff_name,
      price: body.is_course ? 0 : (body.price || 0),
      status: 'confirmed',
      memo: body.memo || null,
      bed_id,
      duration_minutes: durationMin,
      is_course: isCourse,
      ticket_id: ticketId,
      subscription_id: subscriptionId,
      course_consumed_at_booking: courseConsumedAtBooking,
    }

    const { data, error } = await supabase
      .from('reservations')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('予約作成エラー:', error)
    return NextResponse.json({ error: '予約の登録に失敗しました' }, { status: 500 })
  }
}
