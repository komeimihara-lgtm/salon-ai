import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

async function resolveSalonId(req: NextRequest): Promise<string> {
  const fromOwner = await resolveSalonIdForOwnerApi(req).catch(() => '')
  return fromOwner || getSalonIdFromApiRequest(req) || ''
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const salonId = await resolveSalonId(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .update(body)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()
    if (error) {
      console.error('[api/products/[id]] PATCH update error', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    return NextResponse.json({ product: data })
  } catch (e) {
    console.error('[api/products/[id]] PATCH error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const salonId = await resolveSalonId(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })

    const { id } = await params
    const { error } = await getSupabaseAdmin()
      .from('products')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)
    if (error) {
      console.error('[api/products/[id]] DELETE error', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/products/[id]] DELETE error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
