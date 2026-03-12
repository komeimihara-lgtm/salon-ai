import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const salonId = getSalonIdFromCookie()
    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('announcement_reads')
      .upsert({
        announcement_id: id,
        salon_id: salonId,
        read_at: new Date().toISOString(),
      }, { onConflict: 'announcement_id,salon_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '既読登録失敗' }, { status: 500 })
  }
}
