import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  const salonId = getSalonIdFromCookie()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
}

export async function POST(req: Request) {
  const salonId = getSalonIdFromCookie()
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('products')
    .insert({ ...body, salon_id: salonId })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}
