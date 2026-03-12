/**
 * インポート実行API
 * 重複チェック・購入履歴・回数券の自動登録
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

type ImportCustomer = {
  name: string
  name_kana?: string
  phone?: string
  email?: string
  address?: string
  birthday?: string
  gender?: string
  first_visit_date?: string
  memo?: string
  purchase_history?: { date: string; menu: string; amount: number }[]
  ticket_plan_name?: string
  remaining_sessions?: number
  expiry_date?: string
  visit_count?: number
  total_spent?: number
  avg_unit_price?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customers, duplicateAction = 'skip' } = body as {
      customers: ImportCustomer[]
      duplicateAction?: 'skip' | 'overwrite'
    }

    if (!customers?.length) {
      return NextResponse.json({ error: '顧客データが空です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()
    const result = { imported: 0, skipped: 0, errors: [] as string[] }

    // 既存顧客を電話・メールで検索
    const existingByPhone = new Map<string, { id: string }>()
    const existingByEmail = new Map<string, { id: string }>()
    const { data: existing } = await supabase
      .from('customers')
      .select('id, phone, email')
      .eq('salon_id', salonId)
    for (const c of existing || []) {
      if (c.phone) existingByPhone.set(normalizePhone(c.phone), { id: c.id })
      if (c.email) existingByEmail.set((c.email || '').trim().toLowerCase(), { id: c.id })
    }

    for (const row of customers) {
      if (!row.name?.trim()) {
        result.skipped++
        result.errors.push(`${row.name || '(名前なし)'}: 名前が空のためスキップ`)
        continue
      }

      const phoneNorm = row.phone ? normalizePhone(row.phone) : null
      const emailNorm = row.email ? row.email.trim().toLowerCase() : null
      const existingId = (phoneNorm && existingByPhone.get(phoneNorm)?.id) ||
        (emailNorm && existingByEmail.get(emailNorm)?.id)

      if (existingId && duplicateAction === 'skip') {
        result.skipped++
        continue
      }

      const customerPayload = {
        salon_id: salonId,
        name: row.name.trim(),
        name_kana: row.name_kana?.trim() || null,
        phone: row.phone?.trim() || null,
        email: row.email?.trim() || null,
        address: row.address?.trim() || null,
        birthday: row.birthday || null,
        gender: row.gender || 'unknown',
        first_visit_date: row.first_visit_date || null,
        last_visit_date: row.purchase_history?.length
          ? row.purchase_history.reduce((a: string, p) => (p.date > a ? p.date : a), '')
          : null,
        visit_count: row.visit_count ?? 0,
        total_spent: row.total_spent ?? 0,
        avg_unit_price: row.avg_unit_price ?? 0,
        memo: row.memo?.trim() || null,
        status: 'active' as const,
        imported_from: 'csv' as const,
      }

      let customerId: string
      if (existingId && duplicateAction === 'overwrite') {
        const { error } = await supabase
          .from('customers')
          .update(customerPayload)
          .eq('id', existingId)
        if (error) {
          result.errors.push(`${row.name}: ${error.message}`)
          continue
        }
        customerId = existingId
      } else {
        const { data: inserted, error } = await supabase
          .from('customers')
          .insert(customerPayload)
          .select('id')
          .single()
        if (error) {
          result.errors.push(`${row.name}: ${error.message}`)
          continue
        }
        customerId = inserted.id
      }

      result.imported++

      // 購入履歴
      if (row.purchase_history?.length) {
        for (const ph of row.purchase_history) {
          await supabase.from('purchase_histories').insert({
            salon_id: salonId,
            customer_id: customerId,
            purchase_date: ph.date || null,
            menu_name: ph.menu || null,
            amount: ph.amount ?? 0,
            memo: null,
          })
        }
      }

      // 回数券
      if (row.ticket_plan_name && (row.remaining_sessions ?? 0) > 0) {
        const planName = row.ticket_plan_name.trim()
        const { data: plans } = await supabase
          .from('ticket_plans')
          .select('id, name, menu_name, total_sessions, price, unit_price')
          .eq('salon_id', salonId)
          .eq('is_active', true)
        let plan = plans?.find((p: { name: string }) => p.name === planName)

        if (!plan) {
          const rem = row.remaining_sessions ?? 0
          const { data: created } = await supabase
            .from('ticket_plans')
            .insert({
              salon_id: salonId,
              name: planName,
              menu_name: planName,
              total_sessions: Math.max(rem, 1),
              price: 0,
              unit_price: 0,
              is_active: true,
            })
            .select('id, name, menu_name, total_sessions, price, unit_price')
            .single()
          plan = created ?? undefined
        }

        if (plan) {
          const totalSessions = plan.total_sessions ?? Math.max(row.remaining_sessions ?? 1, 1)
          const unitPrice = plan.unit_price ?? (plan.price ? Math.round(plan.price / totalSessions) : 0)
          await supabase.from('customer_tickets').insert({
            salon_id: salonId,
            customer_id: customerId,
            ticket_plan_id: plan.id,
            plan_name: plan.name,
            menu_name: plan.menu_name ?? plan.name,
            total_sessions: totalSessions,
            remaining_sessions: row.remaining_sessions ?? totalSessions,
            unit_price: unitPrice,
            purchased_at: new Date().toISOString(),
            expiry_date: row.expiry_date || null,
          })
        }
      }

      // 新規の場合は検索マップに追加
      if (!existingId) {
        if (phoneNorm) existingByPhone.set(phoneNorm, { id: customerId })
        if (emailNorm) existingByEmail.set(emailNorm, { id: customerId })
      }
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      message: `${result.imported}件インポート、${result.skipped}件スキップ`,
    })
  } catch (error) {
    console.error('インポート実行エラー:', error)
    return NextResponse.json({ error: 'インポートに失敗しました' }, { status: 500 })
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}
