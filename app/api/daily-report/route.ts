import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const salonId = searchParams.get('salon_id') || getSalonIdFromCookie()

    if (date) {
      const { data, error } = await getSupabaseAdmin()
        .from('daily_reports')
        .select('*')
        .eq('salon_id', salonId)
        .eq('report_date', date)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return NextResponse.json({ report: data })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('daily_reports')
      .select('*')
      .eq('salon_id', salonId)
      .order('report_date', { ascending: false })
      .limit(30)

    if (error) throw error
    return NextResponse.json({ reports: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { report_date, kpi_data, ai_content, edited_content } = body
    const salonId = body.salon_id || getSalonIdFromCookie()

    if (!report_date) {
      return NextResponse.json({ error: 'report_date が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase
      .from('daily_reports')
      .select('id')
      .eq('salon_id', salonId)
      .eq('report_date', report_date)
      .maybeSingle()

    const payload = {
      salon_id: salonId,
      report_date,
      kpi_data: kpi_data ?? {},
      ai_content: ai_content ?? null,
      edited_content: edited_content ?? null,
    }

    if (existing) {
      const { data, error } = await supabase
        .from('daily_reports')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ report: data })
    }

    const { data, error } = await supabase
      .from('daily_reports')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ report: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
