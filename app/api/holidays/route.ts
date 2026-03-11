import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  let query = supabase
    .from('salon_holidays')
    .select('*')
    .eq('salon_id', salonId)
    .order('date', { ascending: true })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    query = query.gte('date', `${month}-01`).lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holidays: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { date, reason, staff_id } = await req.json()
  const { data, error } = await supabase
    .from('salon_holidays')
    .insert({ salon_id: salonId, date, reason: reason || '', staff_id: staff_id || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holiday: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { id } = await req.json()
  const { error } = await supabase
    .from('salon_holidays')
    .delete()
    .eq('id', id)
    .eq('salon_id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
