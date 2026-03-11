import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const lineUserId = searchParams.get('line_user_id')
  if (!lineUserId) return NextResponse.json({ exists: false })

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('line_user_id', lineUserId)
    .eq('salon_id', salonId)
    .not('status', 'eq', 'temporary')
    .single()

  return NextResponse.json({
    exists: !!data,
    name: data?.name || '',
    phone: data?.phone || '',
  })
}
