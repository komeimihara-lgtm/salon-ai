import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { escapeForIlikeExact, normalizeOwnerEmail } from '@/lib/normalize-owner-email'

const cookieOpts = {
  path: '/' as const,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const raw = typeof body?.email === 'string' ? body.email : ''
    const email = normalizeOwnerEmail(raw)
    if (!email) {
      return NextResponse.json({ salon_id: null, error: 'email が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    let { data, error } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // レガシー行（大文字混在など）: エスケープ付き ILIKE
    if (!error && !data?.id) {
      const r2 = await supabase
        .from('salons')
        .select('id')
        .ilike('owner_email', escapeForIlikeExact(email))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      data = r2.data
      error = r2.error
    }

    if (error) {
      console.error('[auth/salon-id]', error.message)
      return NextResponse.json({ salon_id: null, error: error.message }, { status: 500 })
    }

    const salonId = data?.id || null
    const response = NextResponse.json({ salon_id: salonId })
    if (salonId) {
      response.cookies.set('salon_id', salonId, cookieOpts)
    }
    return response
  } catch (e) {
    console.error('[auth/salon-id]', e)
    return NextResponse.json({ salon_id: null, error: '内部エラー' }, { status: 500 })
  }
}
