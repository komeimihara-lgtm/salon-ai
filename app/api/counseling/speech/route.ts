import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!voiceId || !apiKey) {
    return new Response(JSON.stringify({ error: 'ElevenLabs credentials not configured' }), {
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

    const elevenlabs = new ElevenLabsClient({ apiKey })
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      voiceSettings: {
        stability: 0.35,
        similarityBoost: 0.85,
        style: 0.45,
        useSpeakerBoost: true,
        speed: 1.15,
      },
    })

    const reader = audioStream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const buffer = Buffer.concat(chunks)

    return new Response(buffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    console.error('ElevenLabs TTS error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Speech synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
