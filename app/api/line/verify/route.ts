import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const salonId = getSalonIdFromCookie()
  try {
    const supabase = getSupabaseAdmin()
    const { data: salon } = await supabase
      .from('salons')
      .select('line_channel_access_token')
      .eq('id', salonId)
      .single()

    const connected = !!(salon?.line_channel_access_token)
    return NextResponse.json({ ok: connected, connected })
  } catch {
    return NextResponse.json({ ok: false, connected: false })
  }
}
