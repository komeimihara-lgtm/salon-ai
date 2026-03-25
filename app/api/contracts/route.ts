import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export async function GET() {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .select('*, customers(name, phone)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ contracts: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const salonId = getSalonIdFromCookie()
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }
    const {
      customer_id,
      course_name,
      treatment_content,
      sessions,
      start_date,
      end_date,
      amount,
      payment_type,
      payment_method: paymentMethodRaw,
      payment_detail,
      card_brand,
      loan_company,
      installment_count,
      billing_cycle,
      billing_day,
      billing_method,
      first_billing_date,
    } = body

    if (!customer_id || !course_name || amount == null || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const INSTRUMENTS = new Set(['cash', 'card', 'loan', 'transfer', 'auto_billing'])
    const rawPm = paymentMethodRaw != null ? String(paymentMethodRaw) : ''

    let ptype: 'lump_sum' | 'installment' =
      String(payment_type) === 'installment' ? 'installment' : 'lump_sum'
    if (payment_type == null && (rawPm === 'lump_sum' || rawPm === 'installment')) {
      ptype = rawPm as 'lump_sum' | 'installment'
    }

    const instrument = INSTRUMENTS.has(rawPm) ? rawPm : 'cash'

    let instCount: number | null = null
    if (ptype === 'installment') {
      const fromBody = installment_count != null ? Number(installment_count) : NaN
      const fromDetail =
        payment_detail && typeof payment_detail.count === 'number' ? payment_detail.count : NaN
      const n = Number.isFinite(fromBody) && fromBody >= 2 ? fromBody : fromDetail
      instCount = Number.isFinite(n) && n >= 2 ? Math.round(n) : null
    }

    const autoBilling = instrument === 'auto_billing'

    const row: Record<string, unknown> = {
      salon_id: salonId,
      customer_id,
      course_name,
      treatment_content: treatment_content || null,
      sessions: sessions || null,
      start_date: start_date || null,
      end_date: end_date || null,
      amount: Math.round(Number(amount)),
      payment_type: ptype,
      payment_method: instrument,
      payment_detail: payment_detail || null,
      card_brand: instrument === 'card' && card_brand ? String(card_brand) : null,
      loan_company: instrument === 'loan' && loan_company ? String(loan_company).trim() : null,
      installment_count: instCount,
      auto_billing: autoBilling,
      billing_cycle:
        autoBilling && billing_cycle ? String(billing_cycle) : null,
      billing_day:
        autoBilling && billing_day != null && Number.isFinite(Number(billing_day))
          ? Math.min(28, Math.max(1, Math.round(Number(billing_day))))
          : null,
      billing_method:
        autoBilling && billing_method ? String(billing_method) : null,
      first_billing_date:
        autoBilling && first_billing_date ? String(first_billing_date).slice(0, 10) : null,
      status: 'draft',
    }

    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ contract: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
