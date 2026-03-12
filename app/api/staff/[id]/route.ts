import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin()
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabase
    .from('staff')
    .update(body)
    .eq('id', id)
    .eq('salon_id', salonId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin()
  const { id } = await params
  const { error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', id)
    .eq('salon_id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
