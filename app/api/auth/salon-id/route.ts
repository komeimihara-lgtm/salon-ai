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

    return NextResponse.json({ salon_id: data?.id || null })
  } catch {
    return NextResponse.json({ salon_id: null }, { status: 500 })
  }
}
