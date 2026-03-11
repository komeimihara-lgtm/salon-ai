import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data: salon, error } = await supabase
    .from('salons')
    .select('beds, closed_weekdays, business_hours, targets')
    .eq('id', salonId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']
  const closed_weekdays: number[] = Array.isArray(salon?.closed_weekdays) ? salon.closed_weekdays : []
  const bh = salon?.business_hours as { openTime?: string; closeTime?: string } | null
  const businessHours = { openTime: bh?.openTime || '10:00', closeTime: bh?.closeTime || '21:00' }
  const t = salon?.targets as Record<string, number> | null
  const targets = {
    sales: t?.sales ?? 600000,
    visits: t?.visits ?? 60,
    avgPrice: t?.avgPrice ?? 10000,
    productSales: t?.productSales ?? 50000,
    newCustomers: t?.newCustomers ?? 10,
    newReservations: t?.newReservations ?? 15,
  }
  return NextResponse.json({ beds, closed_weekdays, businessHours, targets })
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const { beds, closed_weekdays, business_hours, targets } = body
  const updates: Record<string, unknown> = {}
  if (Array.isArray(beds)) updates.beds = beds
  if (Array.isArray(closed_weekdays)) updates.closed_weekdays = closed_weekdays
  if (business_hours && typeof business_hours === 'object') updates.business_hours = business_hours
  if (targets && typeof targets === 'object') updates.targets = targets
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  const { error } = await supabase
    .from('salons')
    .update(updates)
    .eq('id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
