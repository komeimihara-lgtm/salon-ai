import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const salonId = getSalonIdFromApiRequest(req)

    let query = getSupabaseAdmin()
      .from('blocked_times')
      .select('*')
      .eq('salon_id', salonId)
      .order('block_date', { ascending: true })

    if (start) query = query.gte('block_date', start)
    if (end) query = query.lte('block_date', end)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ blockedTimes: data || [] })
  } catch (e) {
    console.error('ブロック時間取得エラー:', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { block_date, start_time, end_time, bed_id, reason } = body
    if (!block_date || !start_time || !end_time) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const salonId = getSalonIdFromApiRequest(req)
    const { data, error } = await getSupabaseAdmin()
      .from('blocked_times')
      .insert({
        salon_id: salonId,
        block_date,
        start_time,
        end_time,
        bed_id: bed_id || null,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ blockedTime: data })
  } catch (e) {
    console.error('ブロック時間登録エラー:', e)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

    const salonId = getSalonIdFromApiRequest(req)
    const { error } = await getSupabaseAdmin()
      .from('blocked_times')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('ブロック時間削除エラー:', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
