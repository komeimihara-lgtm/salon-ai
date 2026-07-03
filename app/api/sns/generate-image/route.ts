import { NextRequest, NextResponse } from 'next/server'
import { IMAGE_MODELS } from '@/lib/ai-models'

// 画像生成は時間がかかるため関数タイムアウトを延長
export const maxDuration = 60

/**
 * SNS投稿用の画像生成（OpenAI gpt-image2）。
 * 入出力の契約は従来（Gemini版）と同じ：
 *   入力  { prompt, size? }
 *   出力  { image: "data:image/png;base64,..." }
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt, size } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt が必要です' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI APIキー（OPENAI_API_KEY）が設定されていません' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODELS.sns,
        prompt,
        n: 1,
        size: size || '1024x1024',
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `画像生成失敗 (${response.status})`)
    }

    const data = await response.json()
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) throw new Error('画像データが取得できませんでした')

    return NextResponse.json({ image: `data:image/png;base64,${b64}` })
  } catch (e) {
    console.error('[sns/generate-image]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '画像生成に失敗しました' },
      { status: 500 }
    )
  }
}
