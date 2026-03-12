import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('unmatched_line_users')
    .select('line_user_id, followed_at')
    .eq('salon_id', salonId)
    .order('followed_at', { ascending: false })
  return NextResponse.json({ users: data || [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { line_user_id } = await req.json()
  await supabase
    .from('unmatched_line_users')
    .delete()
    .eq('line_user_id', line_user_id)
  return NextResponse.json({ success: true })
}
