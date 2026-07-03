import { NextRequest, NextResponse } from 'next/server'
import { IMAGE_MODELS } from '@/lib/ai-models'

// 画像編集は時間がかかるため関数タイムアウトを延長
export const maxDuration = 60

/**
 * SNS画像の編集（OpenAI gpt-image2）。
 * 入出力の契約は従来（Gemini版）と同じ：
 *   入力  { image: "data:image/...;base64,...", instruction: string, size? }
 *   出力  { image: "data:image/png;base64,..." }
 */
export async function POST(req: NextRequest) {
  try {
    const { image, instruction, size } = await req.json()
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'image が必要です' }, { status: 400 })
    }
    if (!instruction || typeof instruction !== 'string') {
      return NextResponse.json({ error: 'instruction が必要です' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI APIキー（OPENAI_API_KEY）が設定されていません' },
        { status: 400 }
      )
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png'
    const ext = mimeType.split('/')[1] || 'png'
    const bytes = new Uint8Array(Buffer.from(base64Data, 'base64'))

    const form = new FormData()
    form.append('model', IMAGE_MODELS.sns)
    form.append('prompt', instruction)
    form.append('image', new Blob([bytes], { type: mimeType }), `image.${ext}`)
    form.append('n', '1')
    form.append('size', size || '1024x1024')

    // Content-Type は FormData（boundary付き）を fetch に任せるため指定しない
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `画像編集失敗 (${response.status})`)
    }

    const data = await response.json()
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) throw new Error('画像データが取得できませんでした')

    return NextResponse.json({ image: `data:image/png;base64,${b64}` })
  } catch (e) {
    console.error('[sns/edit-image]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '画像編集に失敗しました' },
      { status: 500 }
    )
  }
}
