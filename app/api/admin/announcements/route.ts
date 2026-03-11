import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ announcements: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'お知らせ取得失敗' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const { title, body: content, type, target_plan, is_published } = body

    if (!title) return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        body: content || '',
        type: type || 'info',
        target_plan: target_plan || 'all',
        is_published: is_published || false,
        published_at: is_published ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ announcement: data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'お知らせ作成失敗' }, { status: 500 })
  }
}
