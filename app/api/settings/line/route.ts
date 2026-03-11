import { NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const { error } = await supabase
    .from('salons')
    .update({
      line_channel_access_token: body.line_channel_access_token,
      line_channel_secret: body.line_channel_secret,
      line_webhook_enabled: true,
    })
    .eq('id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
