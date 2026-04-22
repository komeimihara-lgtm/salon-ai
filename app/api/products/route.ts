import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

/**
 * 商品 (products) CRUD。
 * 以前はクライアント側Supabase(anon key)を直接使っていたが
 * RLS ポリシーで INSERT/UPDATE/DELETE が 42501 で拒否されていたため、
 * service_role を使う API 経由に統一した。
 */

async function resolveSalonId(req: NextRequest): Promise<string> {
  const fromOwner = await resolveSalonIdForOwnerApi(req).catch(() => '')
  return fromOwner || getSalonIdFromApiRequest(req) || ''
}

export async function GET(req: NextRequest) {
  try {
    const salonId = await resolveSalonId(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })

    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ products: data || [] })
  } catch (e) {
    console.error('[api/products] GET error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const salonId = await resolveSalonId(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })

    const body = await req.json()
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .insert({ ...body, salon_id: salonId })
      .select()
      .single()
    if (error) {
      console.error('[api/products] POST insert error', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    return NextResponse.json({ product: data })
  } catch (e) {
    console.error('[api/products] POST error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
