/**
 * SOLA カウンセリング読み上げ（ElevenLabs ストリーミングのみ）
 *
 * cleanTextForSpeech → stripSsmlTags → toVoiceTextForElevenLabs の結果を送信する。
 * リクエスト本文の text は変更しない（画面表示はクライアントの messages のまま）。
 */

function cleanTextForSpeech(text: string): string {
  return text
    // ブランド名 SOLA が「ソーラ」と伸びるのを防ぎ「ソラ」で読ませる（表示テキストはクライアント側のまま）
    .replace(/\bsola\b/gi, 'ソラ')
    // 「80万件」が誤読されやすい（やまんけん等）ため、はちじゅうまんけんと読ませる
    .replace(/80万件以上/g, 'はちじゅうまんけんいじょう')
    .replace(/80万件/g, 'はちじゅうまんけん')
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

const JP_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

/** 0–999 を計数読み（一、十、十一、二十、…）に変換。n===0 で空文字を返す（上位桁結合用） */
function belowThousand(n: number): string {
  if (n === 0) return ''
  if (n < 10) return JP_DIGITS[n] ?? ''
  if (n < 20) return n === 10 ? '十' : '十' + (JP_DIGITS[n % 10] ?? '')
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return (JP_DIGITS[tens] ?? '') + '十' + (ones ? (JP_DIGITS[ones] ?? '') : '')
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  let s = h === 1 ? '百' : (JP_DIGITS[h] ?? '') + '百'
  if (rest === 0) return s
  if (rest < 10) return s + (JP_DIGITS[rest] ?? '')
  return s + belowThousand(rest)
}

/** 0–9999 */
function belowTenThousand(n: number): string {
  if (n === 0) return ''
  if (n < 1000) return belowThousand(n)
  const th = Math.floor(n / 1000)
  const rest = n % 1000
  let s = th === 1 ? '千' : (JP_DIGITS[th] ?? '') + '千'
  if (rest === 0) return s
  if (rest < 100) return s + belowThousand(rest)
  return s + belowThousand(rest)
}

/**
 * 非負整数を日本語計数読みに（1→一、10→十、11→十一、58→五十八、100→百）
 * 負数・非有限はそのまま文字列化
 */
function numberToJapaneseReading(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n)
  const int = Math.trunc(n)
  if (int === 0) return 'ゼロ'
  if (int < 10000) return belowTenThousand(int)
  const man = Math.floor(int / 10000)
  const rest = int % 10000
  let s = numberToJapaneseReading(man) + '万'
  if (rest === 0) return s
  if (rest < 1000) return s + belowTenThousand(rest)
  return s + belowTenThousand(rest)
}

/** 全角数字を半角に寄せる */
function normalizeDigitsForSpeech(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

/**
 * 数字＋単位・年代・ヶ月を ElevenLabs 向けに日本語読みへ（長い単位から先に置換）
 */
function expandNumbersForVoice(text: string): string {
  const jpWith = (digits: string, suffix: string) => {
    const n = parseInt(digits, 10)
    return Number.isNaN(n) ? digits + suffix : numberToJapaneseReading(n) + suffix
  }

  let s = text
  s = s.replace(/(\d+)\s*mm\b/gi, (_, d: string) => jpWith(d, 'ミリメートル'))
  s = s.replace(/(\d+)\s*cm\b/gi, (_, d: string) => jpWith(d, 'センチ'))
  s = s.replace(/(\d+)\s*kg\b/gi, (_, d: string) => jpWith(d, 'キログラム'))
  s = s.replace(/(\d+)\s*%/g, (_, d: string) => jpWith(d, 'パーセント'))
  // メートル（mm / cm / kg 処理後）
  s = s.replace(/(\d+)\s*m\b/gi, (_, d: string) => jpWith(d, 'メートル'))

  s = s.replace(/(\d+)\s*ヶ月/g, (_, d: string) => jpWith(d, 'ヶ月'))
  s = s.replace(/(\d+)\s*か月/g, (_, d: string) => jpWith(d, 'か月'))
  s = s.replace(/(\d+)\s*カ月/g, (_, d: string) => jpWith(d, 'カ月'))

  s = s.replace(/(\d+)代/g, (_, d: string) => jpWith(d, '代'))

  return s
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

/**
 * ElevenLabs 送信用テキスト（画面に表示する text はクライアント側で保持・変更しない）
 * 処理順: cleanTextForSpeech → stripSsmlTags → 本関数
 */
function toVoiceTextForElevenLabs(text: string): string {
  const normalized = normalizeDigitsForSpeech(text)
  const withNumbers = expandNumbersForVoice(normalized)
  const voiceText = withNumbers
    .replace(/\p{Emoji}/gu, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return voiceText
}

function buildElevenLabsStreamRequestBody(voiceText: string): string {
  return JSON.stringify({
    text: voiceText,
    model_id: 'eleven_v3',
    voice_settings: {
      stability: 0.3,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
      speed: 1.12,
    },
  })
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

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID
    if (!apiKey || !voiceId) {
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs が未設定です（ELEVENLABS_API_KEY と ELEVENLABS_VOICE_ID が必要です）',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const plain = cleanTextForSpeech(text)
    if (!plain) {
      return new Response(JSON.stringify({ error: '読み上げ可能なテキストがありません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const afterSsml = stripSsmlTags(plain)
    if (!afterSsml) {
      return new Response(JSON.stringify({ error: '読み上げ可能なテキストがありません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const voiceText = toVoiceTextForElevenLabs(afterSsml)
    if (!voiceText) {
      return new Response(JSON.stringify({ error: '読み上げ可能なテキストがありません' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const streamUrl = new URL(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
    )
    streamUrl.searchParams.set('output_format', 'mp3_44100_128')

    const elResponse = await fetch(streamUrl.toString(), {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: buildElevenLabsStreamRequestBody(voiceText),
    })

    if (!elResponse.ok) {
      let msg = `ElevenLabs error: ${elResponse.status}`
      try {
        const err = (await elResponse.json()) as { detail?: unknown }
        if (err.detail != null) msg = `${msg} ${JSON.stringify(err.detail)}`
      } catch {
        const t = await elResponse.text()
        if (t) msg = `${msg} ${t.slice(0, 300)}`
      }
      console.error('[counseling/speech]', msg)
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!elResponse.body) {
      return new Response(JSON.stringify({ error: 'ElevenLabs からストリームを取得できませんでした' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(elResponse.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[counseling/speech]', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Speech synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
