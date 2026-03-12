import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const { error } = await getSupabaseAdmin()
      .from('subscription_plans')
      .delete()
      .eq('id', id)
      .eq('salon_id', getSalonIdFromCookie())

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
