import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ users: [] })
  }
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('unmatched_line_users')
    .select('line_user_id, followed_at')
    .eq('salon_id', salonId)
    .order('followed_at', { ascending: false })
  return NextResponse.json({ users: data || [] })
}

export async function DELETE(req: NextRequest) {
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { line_user_id } = await req.json()
  await supabase
    .from('unmatched_line_users')
    .delete()
    .eq('salon_id', salonId)
    .eq('line_user_id', line_user_id)
  return NextResponse.json({ success: true })
}
