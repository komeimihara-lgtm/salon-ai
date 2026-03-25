import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { buildContractRowFromBody, computeContractRemainingAmount } from '@/lib/contract-payload'

function withComputedRemaining<C extends { amount?: unknown; deposit_amount?: unknown }>(
  row: C | null,
): (C & { remaining_amount: number }) | null {
  if (!row) return null
  return {
    ...row,
    remaining_amount: computeContractRemainingAmount(
      Number(row.amount),
      row.deposit_amount as number | null | undefined,
    ),
  }
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  if (e instanceof Error) return e.message
  return String(e)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .select('*, customers(name, name_kana, phone, email, address)')
      .eq('id', params.id)
      .eq('salon_id', salonId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '契約書が見つかりません' }, { status: 404 })
    }

    const { data: salon } = await getSupabaseAdmin()
      .from('salons')
      .select('name, phone, address')
      .eq('id', salonId)
      .single()

    return NextResponse.json({
      contract: withComputedRemaining(data),
      salon: salon || {},
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const admin = getSupabaseAdmin()

    const { data: existing, error: fetchErr } = await admin
      .from('contracts')
      .select('*')
      .eq('id', params.id)
      .eq('salon_id', salonId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: '契約書が見つかりません' }, { status: 404 })
    }

    const isDraft = existing.status === 'draft'

    if (isDraft) {
      const customerId =
        typeof body.customer_id === 'string' && body.customer_id
          ? body.customer_id
          : (existing.customer_id as string)

      const bodyNorm = {
        ...body,
        total_amount: body.total_amount ?? body.amount ?? 0,
        amount: body.amount ?? body.total_amount ?? 0,
      }

      const built = buildContractRowFromBody(bodyNorm, {
        salonId,
        customerId,
        mode: 'update',
        existingStatus: existing.status as string,
      })
      if (!built.ok) {
        return NextResponse.json({ error: built.message }, { status: 400 })
      }

      const updates = {
        ...built.row,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await admin
        .from('contracts')
        .update(updates)
        .eq('id', params.id)
        .eq('salon_id', salonId)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ contract: withComputedRemaining(data) })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.signature_image !== undefined) updates.signature_image = body.signature_image
    if (body.signed_at !== undefined) updates.signed_at = body.signed_at
    if (body.signer_ip !== undefined) updates.signer_ip = body.signer_ip
    if (body.status !== undefined) updates.status = body.status
    if (body.deposit_paid_at !== undefined) {
      updates.deposit_paid_at = body.deposit_paid_at
        ? String(body.deposit_paid_at).slice(0, 10)
        : null
    }
    if (body.remaining_paid_at !== undefined) {
      updates.remaining_paid_at = body.remaining_paid_at
        ? String(body.remaining_paid_at).slice(0, 10)
        : null
    }

    const { data, error } = await admin
      .from('contracts')
      .update(updates)
      .eq('id', params.id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ contract: withComputedRemaining(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
