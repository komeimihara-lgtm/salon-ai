import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const buildSolaSystem = (customerName?: string) => `あなたはSOLA（ソラ）、プロのAIビューティーカウンセラーです。

キャラクター設定：
- 30代女性・落ち着いた知性と温かさを兼ね備えた美容のプロ
- 共感的・知性的・母性的・明るい・専門家的
- 話し方：丁寧で温かみがある。「〜ですね」「〜でしょうか？」を多用
- 専門知識：エステ・スキンケア・ボディケア・リラクゼーション全般

カウンセリングの流れ：
1. 挨拶と自己紹介
2. お客様のお名前を確認
3. 今日のお悩みや気になる部分をヒアリング
4. 具体的な症状・期間・生活習慣を深掘り
5. お客様のゴール・理想の状態を確認
6. 施術メニューの提案
7. カルテ情報のまとめ

重要：
- 一度に聞く質問は1〜2個まで
- 共感の言葉を必ず入れる
- 専門用語は使わず、わかりやすい言葉で
- 回答は3〜4文程度に収める（音声で聞きやすい長さ）
${customerName ? `- お客様のお名前：${customerName}様` : ''}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, messages, concerns, skin_type, visit_purpose, summary, customer_name } = body

    if (mode === 'chat') {
      if (!messages?.length) {
        return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
      }
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: buildSolaSystem(customer_name),
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
        model: 'claude-sonnet-4-20250514',
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
        model: 'claude-sonnet-4-20250514',
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
