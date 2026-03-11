import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data: salon, error } = await supabase
    .from('salons')
    .select('beds')
    .eq('id', salonId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']
  return NextResponse.json({ beds })
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const { beds } = body
  if (!Array.isArray(beds)) return NextResponse.json({ error: 'beds must be an array' }, { status: 400 })
  const { error } = await supabase
    .from('salons')
    .update({ beds })
    .eq('id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
