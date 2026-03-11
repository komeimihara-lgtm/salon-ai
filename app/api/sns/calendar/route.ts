import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const salonId = getSalonId()
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') || new Date().getFullYear().toString()
  const month = searchParams.get('month') || (new Date().getMonth() + 1).toString()

  const startDate = `${year}-${month.padStart(2, '0')}-01`
  const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('content_plans')
    .select('*')
    .eq('salon_id', salonId)
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', endDate + 'T23:59:59')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data || [] })
}
