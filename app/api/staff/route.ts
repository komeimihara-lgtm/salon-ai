import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const salonId = getSalonIdFromCookie()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data || [] })
}

export async function POST(req: NextRequest) {
  const salonId = getSalonIdFromCookie()
  const supabase = getSupabaseAdmin()
  const { name, color } = await req.json()
  const { data, error } = await supabase
    .from('staff')
    .insert({ salon_id: salonId, name, color: color || '#C4728A' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data })
}
