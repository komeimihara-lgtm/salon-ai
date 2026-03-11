import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

// LINE署名検証
function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-line-signature') || ''
    const body = JSON.parse(rawBody)

    // LINEの検証リクエスト（eventsが空配列）の場合は即200を返す
    if (!body.events || body.events.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // サロンのシークレットを取得
    const supabase = getSupabaseAdmin()
    const { data: salon } = await supabase
      .from('salons')
      .select('line_channel_access_token, line_channel_secret, name')
      .eq('id', salonId)
      .single()

    if (!salon?.line_channel_secret) {
      return NextResponse.json({ error: 'LINE設定なし' }, { status: 400 })
    }

    // 署名検証
    if (!verifySignature(rawBody, signature, salon.line_channel_secret)) {
      return NextResponse.json({ error: '署名検証失敗' }, { status: 401 })
    }

    const events = body.events || []

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue

      const lineUserId = event.source.userId
      const userMessage = event.message.text
      const replyToken = event.replyToken

      // カウンセリングセッションを取得
      const { data: session } = await supabase
        .from('counseling_sessions')
        .select('*')
        .eq('line_user_id', lineUserId)
        .eq('status', 'active')
        .single()

      if (!session) continue

      // 会話履歴を更新
      const history = session.conversation_history || []
      history.push({ role: 'user', content: userMessage })

      // AIで次の質問を生成（スタッフとして）
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `あなたは${salon.name}のスタッフです。
お客様のご来店前にLINEでプレカウンセリングを行っています。
以下のルールを必ず守ってください：
- AIであることは絶対に明かさない
- サロンのスタッフとして自然に会話する
- 温かく丁寧な言葉遣い（敬語）
- 絵文字を適度に使い親しみやすく
- 質問は一度に1つだけ
- 全質問が終わったら「ありがとうございます！当日お会いできるのを楽しみにしております😊」で締める

【収集する情報（8問以内）】
1. これまでのお手入れ履歴（ホームケア・エステ・クリニック・なし）
2. 現在のお悩み（予約メニューに関連して）
3. 理想の状態
4. 今回の来店で望むこと（効果重視・根本解決・リラックス）
5. 接客で望むこと（ゆっくりしたい・悩みを聞いてほしい・効果重視）
6. 肌の最近の調子
7. アレルギー・敏感肌の有無
8. スタッフへの一言（任意）

すでに収集した情報：${JSON.stringify(session.collected_data || {})}
予約メニュー：${session.menu || ''}
お客様のお名前：${session.customer_name || ''}様

全質問が完了したらJSONを含めてください：
COUNSELING_COMPLETE:{"collected_data": {...}}`,
        messages: history.map((h: { role: string; content: string }) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      })

      const aiReply = response.content[0].type === 'text' ? response.content[0].text : ''

      // カウンセリング完了チェック
      let replyText = aiReply
      let isComplete = false
      let collectedData = session.collected_data || {}

      if (aiReply.includes('COUNSELING_COMPLETE:')) {
        const jsonMatch = aiReply.match(/COUNSELING_COMPLETE:(\{[\s\S]*\})/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            collectedData = { ...collectedData, ...parsed.collected_data }
            isComplete = true
            replyText = aiReply.replace(/COUNSELING_COMPLETE:[\s\S]*/, '').trim()
          } catch { }
        }
      }

      history.push({ role: 'assistant', content: replyText })

      // セッション更新
      await supabase
        .from('counseling_sessions')
        .update({
          conversation_history: history,
          collected_data: collectedData,
          status: isComplete ? 'completed' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)

      // カウンセリング完了時にカルテに保存
      if (isComplete && session.customer_id) {
        await supabase
          .from('customers')
          .update({ concerns: JSON.stringify(collectedData) })
          .eq('id', session.customer_id)
      }

      // LINEに返信
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${salon.line_channel_access_token}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: 'text', text: replyText }],
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Webhook処理失敗' }, { status: 500 })
  }
}
