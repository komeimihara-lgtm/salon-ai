import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { image, instruction } = await req.json()
    const apiKey = process.env.GOOGLE_TTS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Google APIキーが設定されていません' }, { status: 400 })
    }

    // base64からデータ部分を抽出
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              },
              {
                text: `この画像を以下の指示通りに編集してください：${instruction}\n\n編集した画像のみを返してください。`
              }
            ]
          }],
          generationConfig: { responseModalities: ['image'] }
        })
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || '画像編集失敗')
    }

    const data = await response.json()
    const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
    if (!imageData) throw new Error('画像データが取得できませんでした')

    return NextResponse.json({
      image: `data:${imageData.mimeType};base64,${imageData.data}`
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : '画像編集に失敗しました' }, { status: 500 })
  }
}
