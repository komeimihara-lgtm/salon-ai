/**
 * SOLA カウンセリング読み上げ
 * 優先: ElevenLabs（ELEVENLABS_API_KEY あり）
 * フォールバック: Google Cloud TTS（キー未設定時または EL 用 voice_id 未設定時）
 */

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[✨🌸💆🌿🍃🌱]/g, '')
    .replace(/[\u2600-\u26FF\u2700-\u27BF\uFE00-\uFE0F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // 全角スラッシュ（候補列挙）は TTS が「スラッシュ」と読むため読点に
    .replace(/\uFF0F/g, '、')
    // 「A / B」形式の半角スラッシュ（URLの // にはスペースが無いので通常触れない）
    .replace(/\s*\/\s+/g, '、')
    .replace(/\s+\/\s*/g, '、')
    .trim()
}

/** ElevenLabs へ送る前に SSML / XML 風タグを除去 */
function stripSsmlTags(text: string): string {
  let s = text
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/<[^>]+>/g, '')
  }
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

/** Google SSML 用（ElevenLabs には使わない） */
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

const GOOGLE_VOICE = {
  languageCode: 'ja-JP',
  name: 'ja-JP-Neural2-C',
  ssmlGender: 'FEMALE' as const,
}

const GOOGLE_AUDIO = {
  audioEncoding: 'MP3' as const,
  speakingRate: 0.94,
  pitch: 2.0,
  volumeGainDb: 2.0,
}

type GoogleSynthBody = {
  input: { ssml?: string; text?: string }
  voice: typeof GOOGLE_VOICE
  audioConfig: typeof GOOGLE_AUDIO
}

async function callGoogleTts(apiKey: string, body: GoogleSynthBody) {
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

async function synthesizeWithGoogle(googleKey: string, text: string, plain: string): Promise<ArrayBuffer | null> {
  let { data } = await callGoogleTts(googleKey, {
    input: { ssml: textToSsml(text) },
    voice: GOOGLE_VOICE,
    audioConfig: GOOGLE_AUDIO,
  })

  if (!data.audioContent) {
    console.warn('[counseling/speech] SSML synthesis failed, fallback to plain text', data.error?.message)
    ;({ data } = await callGoogleTts(googleKey, {
      input: { text: plain },
      voice: GOOGLE_VOICE,
      audioConfig: GOOGLE_AUDIO,
    }))
  }

  if (!data.audioContent) {
    console.error('[counseling/speech]', data.error?.message || '音声生成エラー')
    return null
  }

  const buf = Buffer.from(data.audioContent, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

async function synthesizeWithElevenLabs(
  apiKey: string,
  voiceId: string,
  plainForSpeech: string,
): Promise<{ audio: ArrayBuffer } | { error: string }> {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`)
  url.searchParams.set('output_format', 'mp3_44100_128')

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: plainForSpeech,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    let msg = `ElevenLabs error: ${response.status}`
    try {
      const err = (await response.json()) as { detail?: unknown }
      if (err.detail != null) msg = `${msg} ${JSON.stringify(err.detail)}`
    } catch {
      const t = await response.text()
      if (t) msg = `${msg} ${t.slice(0, 200)}`
    }
    return { error: msg }
  }

  const audio = await response.arrayBuffer()
  if (audio.byteLength === 0) return { error: 'ElevenLabs returned empty audio' }
  return { audio }
}

export async function POST(req: Request) {
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

    const elevenKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID

    if (elevenKey && voiceId) {
      const elevenText = stripSsmlTags(plain)
      if (!elevenText) {
        return new Response(JSON.stringify({ error: '読み上げ可能なテキストがありません' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const result = await synthesizeWithElevenLabs(elevenKey, voiceId, elevenText)
      if ('audio' in result) {
        return new Response(result.audio, {
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      }
      console.error('[counseling/speech]', result.error)
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const googleKey = process.env.GOOGLE_TTS_API_KEY
    if (!googleKey) {
      return new Response(
        JSON.stringify({ error: '音声合成が未設定です（ELEVENLABS_API_KEY または GOOGLE_TTS_API_KEY）' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const audio = await synthesizeWithGoogle(googleKey, text, plain)
    if (!audio) {
      return new Response(JSON.stringify({ error: '音声生成エラー' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    console.error('[counseling/speech]', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Speech synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
