import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'

const SUB_STATUSES = new Set(['active', 'paused', 'cancelled'])

function toCustomerSubscription(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    planId: row.plan_id,
    planName: row.plan_name,
    menuName: row.menu_name,
    price: row.price,
    sessionsPerMonth: row.sessions_per_month,
    startedAt: row.started_at,
    nextBillingDate: row.next_billing_date,
    sessionsUsedInPeriod: row.sessions_used_in_period,
    status: row.status,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const body = await req.json()

    const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : ''
    const isManual = reasonRaw.length > 0

    const supabase = getSupabaseAdmin()
    const { data: cur, error: fetchError } = await supabase
      .from('customer_subscriptions')
      .select('*')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single()

    if (fetchError || !cur) {
      return NextResponse.json({ error: 'サブスクが見つかりません' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.next_billing_date !== undefined) updates.next_billing_date = body.next_billing_date

    if (body.status !== undefined) {
      const s = String(body.status)
      if (!SUB_STATUSES.has(s)) {
        return NextResponse.json({ error: 'status が不正です' }, { status: 400 })
      }
      updates.status = s
    }

    if (body.remaining_sessions !== undefined) {
      const spm = Number(cur.sessions_per_month ?? 0)
      const rem = Number(body.remaining_sessions)
      if (!Number.isFinite(rem) || rem < 0) {
        return NextResponse.json({ error: 'remaining_sessions が不正です' }, { status: 400 })
      }
      const clamped = Math.max(0, Math.min(spm, rem))
      updates.sessions_used_in_period = spm - clamped
    } else if (body.sessions_used_in_period !== undefined) {
      updates.sessions_used_in_period = Number(body.sessions_used_in_period)
    }

    // Plan / price / session-count edits (from the subscriptions 編集モーダル)
    if (body.plan_name !== undefined) updates.plan_name = String(body.plan_name)
    if (body.menu_name !== undefined) updates.menu_name = String(body.menu_name)
    if (body.price !== undefined) {
      const p = Number(body.price)
      if (Number.isFinite(p) && p >= 0) updates.price = p
    }
    if (body.sessions_per_month !== undefined) {
      const spm = Number(body.sessions_per_month)
      if (Number.isFinite(spm) && spm >= 0) updates.sessions_per_month = spm
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customer_subscriptions')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error) throw error

    if (isManual) {
      const prevStatus = String(cur.status ?? '')
      const newStatus = String(data.status ?? prevStatus)
      const prevUsed = Number(cur.sessions_used_in_period ?? 0)
      const newUsed = Number(data.sessions_used_in_period ?? 0)
      if (prevStatus !== newStatus || prevUsed !== newUsed) {
        const { error: logErr } = await supabase.from('customer_subscription_logs').insert({
          salon_id: salonId,
          customer_subscription_id: id,
          previous_status: prevStatus,
          new_status: newStatus,
          previous_sessions_used: prevUsed,
          new_sessions_used: newUsed,
          reason: reasonRaw,
        })
        if (logErr) console.error('customer_subscription_logs insert:', logErr)
      }
    }

    return NextResponse.json({ subscription: toCustomerSubscription(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const { error } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
