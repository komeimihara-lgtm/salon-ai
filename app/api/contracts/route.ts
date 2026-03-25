import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { buildContractRowFromBody, computeContractRemainingAmount } from '@/lib/contract-payload'
import { getSalonSaleOperator, canModifySale } from '@/lib/salon-sale-operator'

export const dynamic = 'force-dynamic'

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export async function GET(req: NextRequest) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .select('*, customers(name, phone)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const rows = data || []
    const contracts = rows.map(c => ({
      ...c,
      remaining_amount: computeContractRemainingAmount(
        Number(c.amount),
        c.deposit_amount as number | null | undefined,
      ),
    }))
    return NextResponse.json({ contracts })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const salonId = await resolveSalonIdForOwnerApi(req)
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }

    const op = await getSalonSaleOperator(req)
    if (!canModifySale(op.role)) {
      return NextResponse.json({ error: '契約書の作成はオーナーのみ可能です' }, { status: 403 })
    }

    const customer_id = body.customer_id
    if (!customer_id || typeof customer_id !== 'string') {
      return NextResponse.json({ error: '顧客を選択してください' }, { status: 400 })
    }

    const bodyNorm = {
      ...body,
      total_amount: body.total_amount ?? body.amount ?? 0,
      amount: body.amount ?? body.total_amount ?? 0,
    }

    const built = buildContractRowFromBody(bodyNorm, {
      salonId,
      customerId: customer_id,
      mode: 'insert',
    })
    if (!built.ok) {
      return NextResponse.json({ error: built.message }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .insert(built.row)
      .select()
      .single()

    if (error) throw error

    const contract = data
      ? {
          ...data,
          remaining_amount: computeContractRemainingAmount(
            Number(data.amount),
            data.deposit_amount as number | null | undefined,
          ),
        }
      : data

    return NextResponse.json({ contract })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
