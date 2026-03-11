import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const platform = searchParams.get('platform')
  const archived = searchParams.get('archived')

  let query = supabase
    .from('content_plans')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })

  if (archived === 'true') {
    query = query.eq('is_archived', true)
  } else if (status) {
    query = query.eq('status', status).eq('is_archived', false)
  } else {
    query = query.eq('is_archived', false)
  }
  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const { data, error } = await supabase
    .from('content_plans')
    .insert({ ...body, salon_id: salonId })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
