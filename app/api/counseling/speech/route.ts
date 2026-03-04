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
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'ja-JP',
            name: 'ja-JP-Neural2-B',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.05,
            pitch: 1.5,
            volumeGainDb: 1.0,
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
