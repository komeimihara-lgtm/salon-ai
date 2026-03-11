import { NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function POST() {
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
