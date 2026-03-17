function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[✨🌸💆🌿🍃🌱]/g, '')
    .replace(/[\u2600-\u26FF\u2700-\u27BF\uFE00-\uFE0F]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .trim()
}

function textToSsml(text: string): string {
  const cleaned = cleanTextForSpeech(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const sentences = cleaned.split(/(?<=[。？！])/).filter(Boolean)
  const withBreaks = sentences.map((s) => s.trim()).filter(Boolean).join('<break time="120ms"/>')
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
            name: 'ja-JP-Neural2-B',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.98,
            pitch: 0.5,
            volumeGainDb: 1.5,
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
