import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const body = await req.json()
  const { id } = await params
  const { data, error } = await supabase
    .from('products')
    .update(body)
    .eq('id', id)
    .eq('salon_id', salonId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const { id } = await params
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('salon_id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
