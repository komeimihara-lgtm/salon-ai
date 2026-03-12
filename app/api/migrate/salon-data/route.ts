import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

/**
 * DEMO_SALON_IDに紐づいているデータを、ログイン中のサロンIDに移行する。
 * POST /api/migrate/salon-data
 */
export async function POST() {
  const salonId = getSalonIdFromCookie()
  if (!salonId || salonId === DEMO_SALON_ID) {
    return NextResponse.json({ error: 'salon_id not set or is demo' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const tables = [
    'staff',
    'shifts',
    'reservations',
    'customers',
    'sales',
    'menus',
    'daily_reports',
    'tasks',
    'sns_posts',
    'products',
    'stock_movements',
    'ticket_plans',
    'customer_tickets',
    'subscription_plans',
    'customer_subscriptions',
    'customer_coupons',
    'counseling_sessions',
    'messages',
    'announcements',
  ]

  const results: Record<string, number> = {}

  for (const table of tables) {
    try {
      const { data } = await supabase
        .from(table)
        .select('id')
        .eq('salon_id', DEMO_SALON_ID)

      if (data && data.length > 0) {
        const { error } = await supabase
          .from(table)
          .update({ salon_id: salonId })
          .eq('salon_id', DEMO_SALON_ID)

        if (!error) {
          results[table] = data.length
        }
      }
    } catch {
      // テーブルが存在しない場合はスキップ
    }
  }

  return NextResponse.json({ migrated: results, from: DEMO_SALON_ID, to: salonId })
}
