import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ salon_id: null }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_email', email)
      .single()

    const salonId = data?.id || null
    const response = NextResponse.json({ salon_id: salonId })
    if (salonId) {
      response.cookies.set('salon_id', salonId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
    }
    return response
  } catch {
    return NextResponse.json({ salon_id: null }, { status: 500 })
  }
}
