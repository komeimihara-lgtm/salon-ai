import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest, getSalonIdFromCookie } from '@/lib/get-salon-id'
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

/** Next 14/15 両対応: params が同期オブジェクトでも Promise でも id を取り出す */
async function contractIdFromParams(
  params: Promise<{ id: string }> | { id: string },
): Promise<string> {
  const p = await Promise.resolve(params)
  const raw = p?.id
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  try {
    return decodeURIComponent(String(s).trim())
  } catch {
    return String(s).trim()
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const id = await contractIdFromParams(context.params)
    if (!id) {
      return NextResponse.json({ error: '契約書IDが不正です' }, { status: 400 })
    }

    const salonId = getSalonIdFromApiRequest(req)
    let fromHeadersCookie: string | null | 'error' = null
    try {
      fromHeadersCookie = getSalonIdFromCookie() || null
    } catch {
      fromHeadersCookie = 'error'
    }

    console.log(
      JSON.stringify({
        tag: '[contracts GET] salon_id debug',
        contractId: id,
        salonIdResolved: salonId || null,
        fromNextRequestCookies: req.cookies.get('salon_id')?.value ?? null,
        fromHeadersCookies: fromHeadersCookie,
        hasSalonIdInRawHeader: Boolean(req.headers.get('cookie')?.includes('salon_id')),
      }),
    )

    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()

    let { data, error } = await admin
      .from('contracts')
      .select('*, customers(name, name_kana, phone, email, address)')
      .eq('id', id)
      .eq('salon_id', salonId)
      .maybeSingle()

    if (error) {
      console.error('[contracts GET] supabase', JSON.stringify({ message: error.message, code: error.code, id, salonId }))
      return NextResponse.json({ error: '契約書の取得に失敗しました' }, { status: 500 })
    }

    /** customers 埋め込みが環境によって 0 件扱いになる場合のフォールバック */
    if (!data) {
      const plain = await admin
        .from('contracts')
        .select('*')
        .eq('id', id)
        .eq('salon_id', salonId)
        .maybeSingle()
      if (plain.data) {
        const row = plain.data as Record<string, unknown> & { customer_id?: string }
        let customers: unknown = null
        const cid = row.customer_id
        if (typeof cid === 'string' && cid) {
          const { data: cust } = await admin
            .from('customers')
            .select('name, name_kana, phone, email, address')
            .eq('id', cid)
            .maybeSingle()
          customers = cust
        }
        data = { ...row, customers } as typeof data
        console.log(JSON.stringify({ tag: '[contracts GET] used plain+customer fallback', contractId: id }))
      }
    }

    console.log(
      JSON.stringify({
        tag: '[contracts GET] query result',
        contractId: id,
        salonIdResolved: salonId,
        found: Boolean(data),
      }),
    )

    if (!data) {
      const { data: byId } = await admin.from('contracts').select('id, salon_id').eq('id', id).maybeSingle()
      console.log(
        JSON.stringify({
          tag: '[contracts GET] probe id only (404 診断)',
          contractId: id,
          cookieSalonId: salonId,
          rowExists: Boolean(byId),
          rowSalonId: byId?.salon_id ?? null,
          salonIdMatches: byId ? String(byId.salon_id) === String(salonId) : null,
        }),
      )
      return NextResponse.json({ error: '契約書が見つかりません' }, { status: 404 })
    }

    const { data: salon } = await admin
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
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const id = await contractIdFromParams(context.params)
    if (!id) {
      return NextResponse.json({ error: '契約書IDが不正です' }, { status: 400 })
    }

    const salonId = getSalonIdFromApiRequest(req)
    if (!salonId) {
      return NextResponse.json({ error: 'サロンにログインしてください' }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const admin = getSupabaseAdmin()

    const { data: existing, error: fetchErr } = await admin
      .from('contracts')
      .select('*')
      .eq('id', id)
      .eq('salon_id', salonId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[contracts PATCH fetch]', fetchErr.message, { id, salonId })
      return NextResponse.json({ error: '契約書の取得に失敗しました' }, { status: 500 })
    }
    if (!existing) {
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
        .eq('id', id)
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
      .eq('id', id)
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
