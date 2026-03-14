import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const salonId = getSalonIdFromCookie()
    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .select('*, customers(name, name_kana, phone, email, address)')
      .eq('id', params.id)
      .eq('salon_id', salonId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '契約書が見つかりません' }, { status: 404 })
    }

    // サロン情報も取得
    const { data: salon } = await getSupabaseAdmin()
      .from('salons')
      .select('name, phone, address')
      .eq('id', salonId)
      .single()

    return NextResponse.json({ contract: data, salon: salon || {} })
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
    const body = await req.json()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.signature_image !== undefined) updates.signature_image = body.signature_image
    if (body.signed_at !== undefined) updates.signed_at = body.signed_at
    if (body.signer_ip !== undefined) updates.signer_ip = body.signer_ip
    if (body.status !== undefined) updates.status = body.status

    const { data, error } = await getSupabaseAdmin()
      .from('contracts')
      .update(updates)
      .eq('id', params.id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ contract: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
