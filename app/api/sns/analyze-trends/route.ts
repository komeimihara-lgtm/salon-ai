import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const salonId = getSalonIdFromCookie()

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()

    const { data: posts, error } = await supabase
      .from('content_plans')
      .select('platform, content, title, hashtags, archive_memo, created_at')
      .eq('salon_id', salonId)
      .eq('is_archived', true)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        analysis: 'アーカイブ済みの投稿がありません。反響が良かった投稿をアーカイブしてから、再度分析してください。',
      })
    }

    const postsText = posts
      .map(
        (p: { platform: string; content?: string; title?: string; hashtags?: string[]; archive_memo?: string; created_at: string }) =>
          `【${p.platform}】${(p.created_at || '').slice(0, 10)}\n内容: ${(p.content || p.title || '').slice(0, 200)}\nハッシュタグ: ${(p.hashtags || []).join(', ')}\nメモ: ${p.archive_memo || 'なし'}`
      )
      .join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'あなたはサロン専門のSNSマーケティング分析AIです。反響があった投稿の傾向を分析し、わかりやすい日本語で「どんな投稿が反響を得やすいか」をまとめてください。',
      messages: [
        {
          role: 'user',
          content: `以下のアーカイブ済み（反響があった）投稿データを分析し、「どんな投稿が反響を得やすいか」の傾向をテキストでまとめてください。\n\n${postsText}`,
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '分析結果を取得できませんでした。'

    return NextResponse.json({ analysis: text })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '分析に失敗しました' },
      { status: 500 }
    )
  }
}
