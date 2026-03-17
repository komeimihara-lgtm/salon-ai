import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function GET() {
  const salonId = getSalonIdFromCookie()
  const supabase = getSupabaseAdmin()
  const { data: salon, error } = await supabase
    .from('salons')
    .select('id, name, owner_name, plan, phone, address, beds, closed_days, business_hours, targets, external_urls')
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
    external_urls: salon?.external_urls || {},
  })
}

export async function PATCH(req: NextRequest) {
  const salonId = getSalonIdFromCookie()
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (Array.isArray(body.beds)) update.beds = body.beds
  if (Array.isArray(body.closed_days)) update.closed_days = body.closed_days
  if (typeof body.name === 'string') update.name = body.name
  if (typeof body.owner_name === 'string') update.owner_name = body.owner_name
  if (typeof body.phone === 'string') update.phone = body.phone
  if (typeof body.address === 'string') update.address = body.address
  if (body.business_hours && typeof body.business_hours === 'object') update.business_hours = body.business_hours
  if (body.targets && typeof body.targets === 'object') update.targets = body.targets
  if (body.external_urls && typeof body.external_urls === 'object') update.external_urls = body.external_urls
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }
  const { error } = await supabase
    .from('salons')
    .update(update)
    .eq('id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
