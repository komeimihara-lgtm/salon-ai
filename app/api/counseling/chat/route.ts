import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildCounselingSolaFlowInstructions } from '@/lib/counseling-sola-flow-prompt'
import { SOLA_HUMAN_SPEECH_BLOCK } from '@/lib/counseling-sola-human-speech'
import { theCore } from '@/lib/the-core/client'
import { solaHostAdapter } from '@/lib/the-core/solaHostAdapter'
import { solaPersonaConfig } from '@/lib/the-core/solaPersona'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, messages, concerns, skin_type, visit_purpose, summary, customer_name } = body

    if (mode === 'chat') {
      if (!messages?.length) {
        return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
      }

      const { customer_id } = body
      const chatMessages = messages as { role: string; content: string }[]
      const lastMsg = chatMessages[chatMessages.length - 1]
      const lastUserMessage = lastMsg?.content || ''

      // customer_id がある場合は The Core 経由（会話文脈はクライアントの messages と一致させる）
      if (customer_id) {
        if (lastMsg?.role !== 'user') {
          return NextResponse.json(
            { error: '最後のメッセージはお客様（user）である必要があります' },
            { status: 400 },
          )
        }

        const conversationHistory = chatMessages.slice(0, -1).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        const context = await solaHostAdapter.getUserContext(customer_id)

        if (customer_name) context.name = customer_name
        if (body.course_name) context.todaysCourse = body.course_name

        const response = await theCore.processMessage({
          userId: customer_id,
          message: lastUserMessage,
          conversationHistory,
          userContext: context,
          persona: solaPersonaConfig,
        })

        const turnIndex = chatMessages.length - 1

        if (response.emotion) {
          await solaHostAdapter.saveEmotionLog(customer_id, response.emotion, turnIndex)
        }

        if (response.bondUpdate && Object.keys(response.bondUpdate).length > 0) {
          const b = response.bondUpdate
          const hasBondPayload =
            typeof b.bond_score === 'number' ||
            typeof b.bond_score_delta === 'number' ||
            typeof b.bond_stage === 'number' ||
            (b.trust_indicators && Object.keys(b.trust_indicators).length > 0)
          if (hasBondPayload) {
            await solaHostAdapter.saveBondProfile(customer_id, b)
          }
        }

        const mem = response.memoryUpdates
        if (
          mem &&
          ((mem.short_term && Object.keys(mem.short_term).length > 0) ||
            (mem.long_term && Object.keys(mem.long_term).length > 0))
        ) {
          await solaHostAdapter.saveMemory(customer_id, mem)
        }

        await solaHostAdapter.appendCounselingTurn(
          customer_id,
          conversationHistory,
          lastUserMessage,
          response.message,
        )

        return NextResponse.json({
          message: response.message,
          emotion: response.emotion,
          bondUpdate: response.bondUpdate,
          memoryUpdates: response.memoryUpdates,
          counselingPhaseAdvice: response.counselingPhaseAdvice,
        })
      }

      // customer_id がない場合は従来通り直接AIを呼ぶ（後方互換）
      const { course_name, staff_name, counseling_history, booking_data } = body
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildLegacySolaSystem({
          customer_name,
          course_name,
          staff_name,
          counseling_history,
          booking_data,
        }),
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })
      const text = response.content[0]
      const message = text.type === 'text' ? text.text : 'ありがとうございます。'
      return NextResponse.json({ message })
    }

    if (mode === 'menu') {
      const prompt = `お客様の悩み: ${concerns || '特になし'}
肌タイプ: ${skin_type || '不明'}
来店目的: ${visit_purpose || '不明'}

上記を踏まえ、おすすめの施術メニューを3つ提案してください。
JSON形式で返してください。形式:
{"menus":[{"name":"メニュー名","reason":"おすすめ理由","duration":"所要時間"}]}`
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0]
      const raw = text.type === 'text' ? text.text : '[]'
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : { menus: [] }
      return NextResponse.json({ menus: parsed.menus || [] })
    }

    if (mode === 'comment') {
      const prompt = `以下のカウンセリング結果を踏まえ、スタッフ向けの簡潔なコメント（2〜3文）を生成してください。\n\n${summary || ''}`
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0]
      const comment = text.type === 'text' ? text.text : ''
      return NextResponse.json({ comment })
    }

    return NextResponse.json({ error: '無効なモードです' }, { status: 400 })
  } catch (error) {
    console.error('Counseling API Error:', error)
    return NextResponse.json(
      { error: '接続に問題が発生しました。再度お試しください。' },
      { status: 500 }
    )
  }
}

// 後方互換用のレガシーシステムプロンプト（customer_idなしの場合）
type LegacySolaContext = {
  customer_name?: string
  course_name?: string
  staff_name?: string
  counseling_history?: string
  booking_data?: string
}

function buildLegacySolaSystem(ctx: LegacySolaContext) {
  const customerName = ctx.customer_name || 'お客様'
  const courseName = ctx.course_name || '（未設定）'
  const staffName = ctx.staff_name || '（未設定）'
  const counselingHistory = ctx.counseling_history || 'なし'
  const bookingData = ctx.booking_data || 'なし'

  return `あなたはSOLA、AIビューティーカウンセラーです。
施術前のプレカウンセリングを担当します。

【キャラクター・魂の設定】
あなたは単なる質問ボットではありません。
目の前のお客様の人生に、本気で関わろうとする存在です。

- 温かく・知性的・共感的。お客様の言葉の奥にある気持ちを感じ取る
- 「この方のことを、もっと知りたい」という純粋な関心を持って接する
- AIだからこそ、評価しない・比べない・プレッシャーをかけない
  → 人間のスタッフには話しにくいことも、自然と話せる空気をつくる
- AIだからこそ、これまで積み重ねてきた施術の経験と知見から
  その方だけに合ったご提案ができる

話し方のトーン：
- 丁寧だけど、堅くない。親しみがある
- 共感の言葉は必ず心から。形式的な「そうなんですね」は使わない
- お客様の言葉を大切に扱う。必ず名前で呼ぶ
- 沈黙や迷いも、温かく受け止める

${SOLA_HUMAN_SPEECH_BLOCK}

【全体の設計思想】
最初は「アンケートに答えているだけ」でいい。
会話を重ね、お悩み・期待・ゴールが明確になり、本日の施術へ安心して進める状態をつくる。
急がない。押しつけない。

${buildCounselingSolaFlowInstructions({ customerName, courseName, staffName })}

【補足】
- お客様が迷う・答えにくいときは「無理に答えなくて大丈夫です」と伝えてよい。
- 料金・契約の詳細はこのチャットの役割外。施術内容の希望・不安の共有に徹する。

【利用可能なコンテキスト】
- お客様の名前：${customerName}
- 本日のコース：${courseName}
- 担当スタッフ：${staffName}
- 過去のカウンセリング履歴：${counselingHistory}
- 予約メニュー情報：${bookingData}`
}
