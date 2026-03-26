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
  const voiceText = text
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
