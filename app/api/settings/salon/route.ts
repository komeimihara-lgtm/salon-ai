import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'
import { cookies } from 'next/headers'

const DEMO_SALON_ID_FIXED = 'de000000-0000-0000-0000-000000000001'

function getSalonIdFromRequest(): string {
  const cookieStore = cookies()
  const demoMode = cookieStore.get('demo_mode')?.value
  if (demoMode === 'true') return DEMO_SALON_ID_FIXED
  return process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID
}

export async function GET() {
  const salonId = getSalonIdFromRequest()
  const supabase = getSupabaseAdmin()
  const { data: salon, error } = await supabase
    .from('salons')
    .select('id, name, owner_name, plan, phone, address, beds, closed_days, business_hours, targets')
    .eq('id', salonId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']
  const closed_days: number[] = Array.isArray(salon?.closed_days) ? salon.closed_days : []
  return NextResponse.json({
    name: salon?.name || '',
    owner_name: salon?.owner_name || '',
    plan: salon?.plan || '',
    phone: salon?.phone || '',
    address: salon?.address || '',
    beds,
    closed_days,
    business_hours: salon?.business_hours || null,
    targets: salon?.targets || null,
  })
}

export async function PATCH(req: NextRequest) {
  const salonId = getSalonIdFromRequest()
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (Array.isArray(body.beds)) update.beds = body.beds
  if (Array.isArray(body.closed_days)) update.closed_days = body.closed_days
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'beds or closed_days must be provided as array' }, { status: 400 })
  }
  const { error } = await supabase
    .from('salons')
    .update(update)
    .eq('id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
