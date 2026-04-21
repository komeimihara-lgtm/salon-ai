import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id')
    .eq('id', id)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (saleErr) {
    return NextResponse.json({ error: saleErr.message }, { status: 500 })
  }
  if (!sale) {
    return NextResponse.json({ error: '売上が見つかりません' }, { status: 404 })
  }

  const { data: logs, error: logErr } = await supabase
    .from('sale_logs')
    .select('id, action, operated_at, operated_by, before_data, after_data')
    .eq('sale_id', id)
    .eq('salon_id', salonId)
    .order('operated_at', { ascending: false })

  if (logErr) {
    if (String(logErr.message ?? '').includes('sale_logs') || String(logErr.message ?? '').includes('does not exist')) {
      return NextResponse.json({ logs: [] })
    }
    return NextResponse.json({ error: logErr.message }, { status: 500 })
  }

  return NextResponse.json({ logs: logs || [] })
}
