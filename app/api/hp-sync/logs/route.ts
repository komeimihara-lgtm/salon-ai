import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/**
 * GET /api/hp-sync/logs
 *   Returns the 10 most recent sync log rows for the current salon.
 */
export async function GET() {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) return NextResponse.json({ logs: [] })

    const { data, error } = await getSupabaseAdmin()
      .from('hp_sync_logs')
      .select('id, source, status, message, created_at, details')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return NextResponse.json({ logs: data || [] })
  } catch (e) {
    console.error('GET /api/hp-sync/logs error', e)
    return NextResponse.json({ error: String(e), logs: [] }, { status: 500 })
  }
}
