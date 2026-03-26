/**
 * SOLA カウンセリング読み上げ（Google Cloud TTS）
 * SSML 失敗時はプレーンテキストにフォールバック（Neural2-C 非対応環境など）。
 */

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[✨🌸💆🌿🍃🌱]/g, '')
    .replace(/[\u2600-\u26FF\u2700-\u27BF\uFE00-\uFE0F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .trim()
}

/** 長いフレーズから順に置換し、誤って分割されないようにする */
const EMPHASIS_PHRASES = ['ありがとうございます', '素晴らしい', '素敵', '嬉しい'] as const

function applyEmphasisXml(escaped: string): string {
  let s = escaped
  for (const phrase of EMPHASIS_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    s = s.replace(re, `<emphasis level="moderate">${phrase}</emphasis>`)
  }
  return s
}

function textToSsml(text: string): string {
  let cleaned = cleanTextForSpeech(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  if (!cleaned) return '<speak></speak>'

  cleaned = applyEmphasisXml(cleaned)

  cleaned = cleaned.replace(/、/g, '、<break time="120ms"/>')
  cleaned = cleaned.replace(/。/g, '。<break time="350ms"/>')
  cleaned = cleaned.replace(/？/g, '？<break time="300ms"/>')
  cleaned = cleaned.replace(/！/g, '！<break time="280ms"/>')

  return `<speak>${cleaned}</speak>`
}

const VOICE = {
  languageCode: 'ja-JP',
  name: 'ja-JP-Neural2-C',
  ssmlGender: 'FEMALE' as const,
}

const AUDIO = {
  audioEncoding: 'MP3' as const,
  speakingRate: 0.94,
  pitch: 2.0,
  volumeGainDb: 2.0,
}

type SynthBody = {
  input: { ssml?: string; text?: string }
  voice: typeof VOICE
  audioConfig: typeof AUDIO
}

async function callGoogleTts(apiKey: string, body: SynthBody) {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  const data = (await response.json()) as { audioContent?: string; error?: { message?: string } }
  return { data }
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
    const plain = cleanTextForSpeech(text)
    if (!plain) {
      return new Response(JSON.stringify({ error: '読み上げ可能なテキストがありません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let { data } = await callGoogleTts(apiKey, {
      input: { ssml: textToSsml(text) },
      voice: VOICE,
      audioConfig: AUDIO,
    })

    if (!data.audioContent) {
      console.warn('[counseling/speech] SSML synthesis failed, fallback to plain text', data.error?.message)
      ;({ data } = await callGoogleTts(apiKey, {
        input: { text: plain },
        voice: VOICE,
        audioConfig: AUDIO,
      }))
    }

    if (!data.audioContent) {
      const errMsg = data.error?.message || '音声生成エラー'
      console.error('[counseling/speech]', errMsg)
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
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
