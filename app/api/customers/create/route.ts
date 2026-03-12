import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .insert({
        salon_id: getSalonIdFromCookie(),
        name: body.name,
        name_kana: body.name_kana || null,
        phone: body.phone || null,
        email: body.email || null,
        birthday: body.birthday || null,
        gender: body.gender || 'unknown',
        address: body.address || null,
        first_visit_date: body.first_visit_date || null,
        last_visit_date: body.last_visit_date || null,
        visit_count: body.visit_count || 0,
        total_spent: body.total_spent || 0,
        avg_unit_price: body.avg_unit_price || 0,
        skin_type: body.skin_type || null,
        concerns: body.concerns || null,
        allergies: body.allergies || null,
        memo: body.memo || null,
        status: body.status === 'temporary' ? 'temporary' : 'active',
        imported_from: body.imported_from || 'manual',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('顧客作成エラー:', error)
    return NextResponse.json({ error: '顧客の登録に失敗しました' }, { status: 500 })
  }
}
