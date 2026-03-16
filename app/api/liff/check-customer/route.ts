import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const salonId = getSalonIdFromCookie()
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
    customer_id: data?.id || null,
    name: data?.name || '',
    phone: data?.phone || '',
  })
}
