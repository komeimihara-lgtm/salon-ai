/**
 * アンケート回答 → AI で自然な口コミ文を生成
 *
 * 入力:
 *   salon_id, satisfaction, good_points[], staff_comment?, revisit_intention?
 * 出力:
 *   { generated_review: string }
 *
 * NG ワードがサロン設定にあれば回避を指示。
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseSalonIdQueryValue } from '@/lib/salon-id-format'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const salonId = parseSalonIdQueryValue(body.salon_id)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 400 })
    }

    const satisfaction = String(body.satisfaction || '').trim()
    const goodPoints: string[] = Array.isArray(body.good_points) ? body.good_points : []
    const staffComment = String(body.staff_comment || '').trim()
    const revisit = String(body.revisit_intention || '').trim()

    if (!satisfaction) {
      return NextResponse.json({ error: 'satisfaction が必要です' }, { status: 400 })
    }

    // サロン情報・カスタム設定を取得
    const supabase = getSupabaseAdmin()
    const { data: salon } = await supabase
      .from('salons')
      .select('name, review_custom_points, review_ng_words')
      .eq('id', salonId)
      .maybeSingle()

    const salonName = salon?.name || 'サロン'
    const customPoints = (salon?.review_custom_points as string | null)?.trim() || ''
    const ngWords = ((salon?.review_ng_words as string | null) || '')
      .split(/[,、，\s]+/)
      .map((w: string) => w.trim())
      .filter(Boolean)

    const prompt = `あなたはお客様になりきって、Googleマップに投稿するナチュラルな口コミ文を書きます。

以下のアンケート回答に基づき、お客様視点で 100〜180 文字程度の口コミ文を1つ作成してください。

【サロン情報】
店名: ${salonName}
${customPoints ? `特徴・推しポイント: ${customPoints}` : ''}

【お客様のアンケート回答】
本日の満足度: ${satisfaction}
良かった点: ${goodPoints.length > 0 ? goodPoints.join('、') : '（特になし）'}
スタッフへの一言: ${staffComment || '（なし）'}
再来意向: ${revisit || '（未回答）'}

【書き方ルール】
- 自然な日本語の口コミ。一人称「私」または書き手から見たやわらかい文体
- ★評価や数字評価は書かない（テキストのみ）
- 過度なセールス調・大げさな表現は避ける
- 絵文字は1〜2個まで。なくてもOK
- 業務連絡・通報のような硬い文体は避ける
- アンケートそのままの転記ではなく、自然な体験談として組み立てる
${ngWords.length > 0 ? `- 以下の語句は使わない: ${ngWords.join(', ')}` : ''}
- 末尾の改行は不要

【出力形式】
口コミ文だけを出力（前置き・解説・引用符・項目名は付けない）。`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0]
    let generated = (text.type === 'text' ? text.text : '').trim()

    // NG ワードが混じっていたら一度だけ再生成
    if (ngWords.length > 0 && ngWords.some((w: string) => generated.includes(w))) {
      const retry = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: generated },
          { role: 'user', content: `次の語句が含まれていたので使わずに書き直してください: ${ngWords.join(', ')}` },
        ],
      })
      const r2 = retry.content[0]
      generated = (r2.type === 'text' ? r2.text : generated).trim()
    }

    return NextResponse.json({ generated_review: generated })
  } catch (e) {
    console.error('[reviews/generate] error', e)
    return NextResponse.json({ error: '口コミ生成に失敗しました' }, { status: 500 })
  }
}
