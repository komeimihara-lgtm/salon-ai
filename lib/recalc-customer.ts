import { getSupabaseAdmin } from './supabase'
import { getSalonIdFromCookie } from './get-salon-id'
import { calcCustomerStatus } from './customer-status'

/** キャンセル後に顧客データを再集計（visit_count, last_visit_date, status） */
export async function recalcCustomerAfterCancel(customerId: string) {
  const supabase = getSupabaseAdmin()

  const { data: reservations } = await supabase
    .from('reservations')
    .select('reservation_date, status')
    .eq('customer_id', customerId)
    .eq('salon_id', getSalonIdFromCookie())
    .neq('status', 'cancelled')
    .in('status', ['completed', 'visited'])
    .order('reservation_date', { ascending: false })

  const totalVisits = reservations?.length ?? 0
  const lastVisitDate = reservations?.[0]?.reservation_date ?? null

  const { data: customer } = await supabase
    .from('customers')
    .select('created_at')
    .eq('id', customerId)
    .single()

  const status = calcCustomerStatus(
    totalVisits,
    lastVisitDate,
    customer?.created_at ?? new Date().toISOString()
  )

  await supabase
    .from('customers')
    .update({
      visit_count: totalVisits,
      last_visit_date: lastVisitDate,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
}
