import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const salonId = getSalonIdFromCookie()
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
