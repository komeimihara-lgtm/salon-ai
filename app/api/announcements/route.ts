import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const salonId = getSalonIdFromCookie()
    const supabase = getSupabaseAdmin()

    // サロンのプランを取得
    const { data: salon } = await supabase
      .from('salons')
      .select('plan')
      .eq('id', salonId)
      .single()

    const plan = salon?.plan || 'LITE'

    // 公開済みお知らせを取得（自サロンのプランに合致するもの）
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .or(`target_plan.eq.all,target_plan.eq.${plan}`)
      .order('published_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 既読情報を取得
    const announcementIds = (announcements || []).map(a => a.id)
    const { data: reads } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('salon_id', salonId)
      .in('announcement_id', announcementIds.length > 0 ? announcementIds : ['00000000-0000-0000-0000-000000000000'])

    const readSet = new Set((reads || []).map(r => r.announcement_id))

    const result = (announcements || []).map(a => ({
      ...a,
      is_read: readSet.has(a.id),
    }))

    const unread_count = result.filter(a => !a.is_read).length

    return NextResponse.json({ announcements: result, unread_count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'お知らせ取得失敗' }, { status: 500 })
  }
}
