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
      customer_id, course_name, treatment_content,
      sessions, start_date, end_date, amount, payment_method, payment_detail,
    } = body

    if (!customer_id || !course_name || amount == null || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .insert({
        salon_id: salonId,
        customer_id,
        course_name,
        treatment_content: treatment_content || null,
        sessions: sessions || null,
        start_date: start_date || null,
        end_date: end_date || null,
        amount: Math.round(Number(amount)),
        payment_method: payment_method || 'lump_sum',
        payment_detail: payment_detail || null,
        status: 'draft',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ contract: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
