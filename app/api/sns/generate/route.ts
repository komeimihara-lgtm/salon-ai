import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function POST(req: NextRequest) {
  try {
    const { purpose, platform, menu_name, details, tone } = await req.json()

    const supabase = getSupabaseAdmin()

    const { data: archivedPosts } = await supabase
      .from('content_plans')
      .select('title, content, platform, archive_memo, archive_metrics')
      .eq('salon_id', salonId)
      .eq('is_archived', true)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: salon } = await supabase
      .from('salons')
      .select('name, address, phone')
      .eq('id', salonId)
      .single()

    const salonName = salon?.name || 'サロン'
    const salonPhone = salon?.phone || ''
    const hotpepperUrl = ''

    const purposeLabels: Record<string, string> = {
      before_after: 'ビフォーアフター',
      menu_promo: 'メニュー紹介',
      staff_intro: 'スタッフ紹介',
      seasonal: '季節のお知らせ',
      event: 'イベント告知',
      tips: '美容Tips',
      customer_voice: 'お客様の声',
      campaign: 'キャンペーン',
    }

    const toneLabels: Record<string, string> = {
      professional: 'プロフェッショナル・信頼感重視',
      friendly: 'フレンドリー・親しみやすい',
      luxury: 'ラグジュアリー・高級感',
      casual: 'カジュアル・気軽な雰囲気',
    }

    const platformRules: Record<string, string> = {
      instagram: 'ビジュアル重視、ハッシュタグ20-30個、ストーリー性のある文章、改行を多用して読みやすく',
      x: '140文字以内、インパクトのある一文、ハッシュタグ3-5個',
      tiktok: 'トレンド要素、若者向け、キャッチーなフレーズ、動画内容の説明',
      line: '来店促進、親しみやすいトーン、絵文字を適度に使用、200文字以内',
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `あなたはサロン専門のSNSマーケティングAIです。
サロン名: ${salonName}
電話番号: ${salonPhone}
ホットペッパーURL: ${hotpepperUrl}

以下のルールに従って投稿を生成してください：
- プラットフォーム(${platform})のルール: ${platformRules[platform] || ''}
- トーン: ${toneLabels[tone] || 'フレンドリー'}
- 顧客の悩みに寄り添うベネフィット訴求（機能ではなく顧客メリット）
- 予約導線を必ず含める
- 季節感を取り入れる

必ず以下のJSON形式のみで返してください。説明文は不要です：
{
  "variations": [
    {
      "main_text": "投稿本文",
      "hashtags": ["ハッシュタグ1", "ハッシュタグ2"],
      "image_suggestion": "画像の方向性・構図の提案",
      "cta": "行動を促す一文",
      "best_post_time": "推奨投稿時間"
    }
  ]
}
variationsは必ず3パターン生成してください。${archivedPosts && archivedPosts.length > 0 ? `
【過去に反響が良かった投稿（必ず参考にすること）】
${archivedPosts.map((p: { title: string; content?: string; platform: string; archive_memo?: string; archive_metrics?: { likes?: string; saves?: string; bookings?: string } }) => `
・${p.title}
  内容：${(p.content || '').slice(0, 100)}...
  メモ：${p.archive_memo || 'なし'}
  反響：いいね${p.archive_metrics?.likes || 0} 保存${p.archive_metrics?.saves || 0} 予約${p.archive_metrics?.bookings || 0}
`).join('')}
これらの投稿の傾向・トーン・テーマを参考に、今回の投稿を生成してください。` : ''}`,
      messages: [{
        role: 'user',
        content: `以下の条件でSNS投稿を3パターン生成してください。

投稿タイプ: ${purposeLabels[purpose] || purpose}
プラットフォーム: ${platform}
${menu_name ? `メニュー名: ${menu_name}` : ''}
${details ? `追加情報: ${details}` : ''}`,
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '投稿生成に失敗しました' }, { status: 500 })
  }
}
