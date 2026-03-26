/**
 * SOLA カウンセリング読み上げ（Google Cloud TTS）
 * ロボット感を抑えるため、話速・音高・間・再生プロファイルを調整
 */

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[✨🌸💆🌿🍃🌱]/g, '')
    .replace(/[\u2600-\u26FF\u2700-\u27BF\uFE00-\uFE0F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .trim()
}

/** 読点・句読点で息継ぎを入れ、一文が続けざまに聞こえないようにする */
function textToSsml(text: string): string {
  let cleaned = cleanTextForSpeech(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  cleaned = cleaned.replace(/、/g, '、<break time="85ms"/>')
  const sentences = cleaned.split(/(?<=[。？！])/).filter(Boolean)
  const withBreaks = sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .join('<break time="240ms"/>')
  return `<speak>${withBreaks || cleaned}</speak>`
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google TTS API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const ssml = textToSsml(text)
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: 'ja-JP',
            /** Neural2-C は B より柔らかい印象の女性声（対話向き） */
            name: 'ja-JP-Neural2-C',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            /** ややゆっくり＝機械的な早口感を抑える */
            speakingRate: 0.92,
            /** 0 = 自然な基準音高（やや高い設定はアナウンス調になりやすい） */
            pitch: 0,
            volumeGainDb: 1.0,
            /** スマホ・イヤホン再生で聞き取りやすいチューニング */
            effectsProfileId: ['headphone-class-device'],
          },
        }),
      }
    )
    const data = await response.json()
    if (!data.audioContent) {
      const errMsg = data.error?.message || '音声生成エラー'
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const audioBuffer = Buffer.from(data.audioContent, 'base64')
    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    console.error('Google TTS error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Speech synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
