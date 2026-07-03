/**
 * 口コミ返信文の AI 生成
 * 入力: review_id (or review_text + salon_id)
 * 出力: { reply_text }
 *
 * サロンの「特徴・推しポイント」(review_custom_points) を加味して
 * 自然で温かいトーンの返信文を生成。
 */
import { CLAUDE_MODELS } from '@/lib/ai-models'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    let reviewText = String(body.review_text || '').trim()
    let salonId = String(body.salon_id || '').trim()
    let customerName: string | null = null
    let satisfaction: string | null = null

    // review_id 指定なら DB から本文を取得
    if (body.review_id) {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase
        .from('reviews')
        .select('salon_id, edited_review, generated_review, satisfaction, customer_id, customers(name)')
        .eq('id', body.review_id)
        .maybeSingle()

      if (data) {
        salonId = String(data.salon_id)
        reviewText = String(data.edited_review || data.generated_review || '').trim()
        satisfaction = (data.satisfaction as string | null) ?? null
        const cust = data.customers as { name?: string } | { name?: string }[] | null | undefined
        customerName = Array.isArray(cust) ? (cust[0]?.name ?? null) : (cust?.name ?? null)
      }
    }

    if (!reviewText || !salonId) {
      return NextResponse.json({ error: 'review_id か review_text+salon_id が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: salon } = await supabase
      .from('salons')
      .select('name, review_custom_points')
      .eq('id', salonId)
      .maybeSingle()

    const salonName = salon?.name || 'サロン'
    const customPoints = (salon?.review_custom_points as string | null)?.trim() || ''

    const isNegative = satisfaction === '不満' || /がっかり|残念|二度と|最悪|ひどい/.test(reviewText)

    const prompt = `あなたは美容室「${salonName}」のオーナーとして、Googleマップ等の口コミに対して返信文を書きます。

【お店の特徴】
${customPoints || '（未設定）'}

【お客様の口コミ】
${reviewText}
${customerName ? `（投稿者: ${customerName} 様）` : ''}
${satisfaction ? `（アンケート満足度: ${satisfaction}）` : ''}

【返信文の書き方】
- 100〜180文字程度
- 丁寧だが堅すぎず、温かみのあるトーン
- お客様の具体的な内容に触れて感謝を伝える
- 営業色・宣伝色は薄めに（次回お待ちしてます程度はOK）
- 絵文字は0〜1個まで
${isNegative ? '- お客様にご不便があった可能性を真摯に受け止め、改善する姿勢を示す。言い訳しない。' : ''}
- 末尾の改行は不要

【出力形式】
返信文だけを出力（前置き・解説・引用符は付けない）。`

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.sonnet,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0]
    const reply = (text.type === 'text' ? text.text : '').trim()

    return NextResponse.json({ reply_text: reply })
  } catch (e) {
    console.error('[reviews/reply] error', e)
    return NextResponse.json({ error: '返信文生成に失敗しました' }, { status: 500 })
  }
}
