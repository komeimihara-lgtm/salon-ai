'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  Search,
  Plus,
  Check,
  MessageCircle,
  ChevronLeft as BackIcon,
  Volume2,
  VolumeX,
} from 'lucide-react'

const STORAGE_KEY = 'sola_counseling_draft'

const SOLA_AVATAR_URL = '/images/sola-avatar.png'

/** カウンセリング読み上げ用（MediaSource + ElevenLabs ストリーム） */
const COUNSELING_SPEECH_MPEG = 'audio/mpeg'

/**
 * ElevenLabs 相当の MP3 ストリームを MediaSource で再生。
 * 先頭チャンクを append した時点で play() し、以降のチャンクを継続 append する。
 */
async function playCounselingSpeechFromMpegStream(response: Response, audio: HTMLAudioElement): Promise<void> {
  const body = response.body
  if (!body) throw new Error('ストリームがありません')

  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported(COUNSELING_SPEECH_MPEG)) {
    throw new Error('MSE_MPEG_UNSUPPORTED')
  }

  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  audio.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
    mediaSource.addEventListener('error', () => reject(new Error('MediaSource error')), { once: true })
  })

  const sourceBuffer = mediaSource.addSourceBuffer(COUNSELING_SPEECH_MPEG)
  const reader = body.getReader()
  let playbackStarted = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        if (mediaSource.readyState === 'open') {
          mediaSource.endOfStream()
        }
        break
      }

      await new Promise<void>((resolve, reject) => {
        const onEnd = () => {
          sourceBuffer.removeEventListener('updateend', onEnd)
          sourceBuffer.removeEventListener('error', onErr)
          resolve()
        }
        const onErr = () => {
          sourceBuffer.removeEventListener('updateend', onEnd)
          sourceBuffer.removeEventListener('error', onErr)
          reject(new Error('SourceBuffer error'))
        }
        sourceBuffer.addEventListener('updateend', onEnd, { once: true })
        sourceBuffer.addEventListener('error', onErr, { once: true })
        try {
          sourceBuffer.appendBuffer(value)
        } catch (err) {
          sourceBuffer.removeEventListener('updateend', onEnd)
          sourceBuffer.removeEventListener('error', onErr)
          reject(err)
        }
      })

      if (!playbackStarted) {
        playbackStarted = true
        await audio.play()
      }
    }
  } catch (e) {
    URL.revokeObjectURL(objectUrl)
    if (mediaSource.readyState === 'open') {
      try {
        mediaSource.endOfStream('decode')
      } catch (_) {
        /* noop */
      }
    }
    throw e
  }

  const revokeMsObject = () => URL.revokeObjectURL(objectUrl)
  audio.addEventListener('ended', revokeMsObject, { once: true })
  audio.addEventListener('error', revokeMsObject, { once: true })
}

/** 非ストリーミングフォールバック（Blob 全体取得後に再生） */
async function playCounselingSpeechFromBlobResponse(
  response: Response,
  audio: HTMLAudioElement,
): Promise<string> {
  const blob = await response.blob()
  if (blob.size === 0) throw new Error('音声データが空です')
  const audioUrl = URL.createObjectURL(blob)
  audio.src = audioUrl
  await audio.play()
  return audioUrl
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#3D3D3D]/60"
          style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}

function SolaAvatarImg({ size = 36, isSpeaking = false }: { size?: number; isSpeaking?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div
        className={`rounded-full overflow-hidden shrink-0 ring-2 ring-offset-2 ring-[#9B8EC4] bg-gray-100 relative z-10 ${isSpeaking ? 'sola-speaking' : ''}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={SOLA_AVATAR_URL}
          alt="SOLA"
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  )
}

function SolaWaveform({ isSpeaking }: { isSpeaking: boolean }) {
  if (!isSpeaking) return null
  return (
    <div className="flex items-end justify-center gap-1 h-8 mt-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-[#C4728A] to-[#9B8EC4]"
          style={{
            height: `${16 + i * 6}px`,
            animation: `sola-wave ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}

function VoiceInputField({
  value,
  onChange,
  placeholder,
  rows = 1,
  disabled,
  onFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  onFocus?: () => void
}) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('お使いのブラウザは音声入力に対応していません')
      return
    }
    const SR = (window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }).webkitSpeechRecognition
      || (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    if (!SR || typeof SR !== 'function') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e: { results: { length: number; [i: number]: { transcript: string; isFinal?: boolean } | Iterable<{ transcript: string }> } }) => {
      const last = e.results.length - 1
      const result = e.results[last]
      const text = Array.from(result as Iterable<{ transcript: string }>).map((r) => r.transcript).join('')
      if ((result as { isFinal?: boolean }).isFinal) {
        onChange(value ? `${value} ${text}` : text)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }, [value, onChange])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white text-[#3D3D3D] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C4728A]/30 focus:border-[#C4728A] resize-none"
      />
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
          listening ? 'bg-[#C4728A] text-white animate-pulse' : 'bg-[#F8F5FF] text-[#C4728A] hover:bg-[#C4728A]/10'
        }`}
        title={listening ? '録音停止' : '音声入力'}
      >
        {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    </div>
  )
}

type SkinType = 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive' | null

const SKIN_TYPE_LABELS: Record<Exclude<SkinType, null>, string> = {
  dry: '乾燥肌',
  oily: '脂性肌',
  combination: '混合肌',
  normal: '普通肌',
  sensitive: '敏感肌',
}

interface MenuItem {
  name: string
  reason: string
  duration: string
}

interface SessionData {
  customerName: string
  customerId?: string
  courseName: string
  visitPurpose: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  skinAnswers: Record<string, string>
  skinType: SkinType
  hasAllergy: boolean
  allergyDetail: string
  pregnancy: boolean
  otherCautions: string
  medication: string
  concerns: string[]
  selectedMenu: MenuItem | null
  menus: MenuItem[]
}

const DEFAULT_SESSION: SessionData = {
  customerName: '',
  courseName: '',
  visitPurpose: 'first',
  messages: [],
  skinAnswers: {},
  skinType: null,
  hasAllergy: false,
  allergyDetail: '',
  pregnancy: false,
  otherCautions: '',
  medication: '',
  concerns: [],
  selectedMenu: null,
  menus: [],
}

function CounselingContent() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') === 'online' ? 'online' : 'salon') as 'online' | 'salon'

  const [step, setStep] = useState(1)
  const [data, setData] = useState<SessionData>(DEFAULT_SESSION)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [solaComment, setSolaComment] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([])
  const [newCustomer, setNewCustomer] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [salonMenus, setSalonMenus] = useState<{ id: string; name: string; price?: number }[]>([])
  const [autoSaved, setAutoSaved] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const initialSpokenRef = useRef(false)
  const audioUnlockedRef = useRef(false)
  const autoSaveTriggeredRef = useRef(false)
  const speechAbortRef = useRef<AbortController | null>(null)
  const speechAudioRef = useRef<HTMLAudioElement | null>(null)

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return
    audioUnlockedRef.current = true
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
      ctx.resume()
      const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
      silent.volume = 0
      silent.play().catch(() => {})
    } catch (_) {}
  }, [])

  // リロード時は常にリセット（新しいカウンセリングとして開始）
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (step > 1 && !completed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, step, data }))
      } catch (_) {}
    }
  }, [step, data, mode, completed])

  useEffect(() => {
    fetch('/api/menus').then(r => r.json()).then(j => setSalonMenus(j.menus || [])).catch(() => {})
  }, [])

  const scrollChatToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const speakMessage = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return
    setSpeechError(null)

    speechAbortRef.current?.abort()
    speechAbortRef.current = null
    speechAudioRef.current?.pause()
    speechAudioRef.current = null

    const ac = new AbortController()
    speechAbortRef.current = ac

    let blobUrlToRevoke: string | null = null

    try {
      setIsSpeaking(true)
      const response = await fetch('/api/counseling/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
        signal: ac.signal,
      })
      if (!response.ok) {
        const errBody = await response.text()
        let errMsg = '音声生成に失敗しました'
        try {
          const parsed = JSON.parse(errBody)
          if (parsed.error) errMsg = parsed.error
        } catch (_) {
          /* noop */
        }
        throw new Error(errMsg)
      }

      const audio = new Audio()
      speechAudioRef.current = audio

      const finish = () => {
        if (blobUrlToRevoke) {
          URL.revokeObjectURL(blobUrlToRevoke)
          blobUrlToRevoke = null
        }
        setIsSpeaking(false)
        if (speechAudioRef.current === audio) speechAudioRef.current = null
      }

      audio.onended = finish
      audio.onerror = () => {
        finish()
        setSpeechError('音声の再生に失敗しました')
      }

      const canMse =
        !!response.body &&
        typeof MediaSource !== 'undefined' &&
        MediaSource.isTypeSupported(COUNSELING_SPEECH_MPEG)

      if (canMse) {
        const cloned = response.clone()
        try {
          await playCounselingSpeechFromMpegStream(response, audio)
          cloned.body?.cancel().catch(() => {})
        } catch (streamErr) {
          console.warn('[counseling] MediaSource ストリーム再生に失敗、Blob にフォールバック', streamErr)
          try {
            blobUrlToRevoke = await playCounselingSpeechFromBlobResponse(cloned, audio)
          } catch {
            throw streamErr instanceof Error ? streamErr : new Error('音声再生に失敗しました')
          }
        }
      } else {
        blobUrlToRevoke = await playCounselingSpeechFromBlobResponse(response, audio)
      }

      if (audio.paused) {
        await audio.play()
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsSpeaking(false)
        return
      }
      const msg = error instanceof Error ? error.message : '音声再生エラー'
      console.error('音声再生エラー:', error)
      setSpeechError(msg)
      setIsSpeaking(false)
    }
  }, [voiceEnabled])

  const doSearch = useCallback(async () => {
    if (!customerSearch.trim()) return
    const res = await fetch(`/api/customers/find?name=${encodeURIComponent(customerSearch.trim())}`)
    const json = await res.json()
    setSearchResults(json.customers || [])
  }, [customerSearch])

  const sendChat = useCallback(async (overrideMsg?: string) => {
    const msg = overrideMsg || chatInput
    if (!msg.trim() || chatLoading) return
    unlockAudio()
    const userMsg = msg.trim()
    if (!overrideMsg) setChatInput('')
    const newMessages = [...data.messages, { role: 'user' as const, content: userMsg }]
    setData((d) => ({ ...d, messages: newMessages }))
    setChatLoading(true)
    scrollChatToBottom()
    try {
      const res = await fetch('/api/counseling/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          messages: newMessages,
          customer_name: data.customerName || undefined,
          course_name: data.courseName || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'エラー')
      const assistantMsg = json.message || 'ありがとうございます。'
      setData((d) => ({ ...d, messages: [...newMessages, { role: 'assistant', content: assistantMsg }] }))
      scrollChatToBottom()
      speakMessage(assistantMsg)
    } catch {
      setData((d) => ({ ...d, messages: [...newMessages, { role: 'assistant', content: '申し訳ございません。もう一度お試しください。' }] }))
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, data.messages, data.customerName, data.courseName, speakMessage, unlockAudio])

  // PHASE 5 完了検出 → カウンセリング自動保存
  useEffect(() => {
    if (autoSaveTriggeredRef.current || data.messages.length < 4) return
    const lastMsg = data.messages.at(-1)
    if (lastMsg?.role !== 'assistant') return
    if (!lastMsg.content.includes('これより施術に入ります')) return

    autoSaveTriggeredRef.current = true
    const userMsgs = data.messages.filter(m => m.role === 'user').map(m => m.content)
    const payload = {
      customer_name: data.customerName || 'お客様',
      customer_id: data.customerId || null,
      course_name: data.courseName || null,
      messages: data.messages,
      concerns: userMsgs.slice(0, 3).join('、'),
      chat_history: data.messages,
      mode: 'salon',
    }
    fetch('/api/counseling/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(() => setAutoSaved(true)).catch(() => {})
  }, [data.messages, data.customerName, data.customerId, data.courseName])

  const diagnoseSkinType = (answers: Record<string, string>): SkinType => {
    const q1 = answers.q1
    const q2 = answers.q2
    const q3 = answers.q3
    const q4 = answers.q4
    if (q1 === 'tight' && (q2 === 'dry' || q3 === 'often')) return 'sensitive'
    if (q1 === 'oily' && q2 === 'oily') return 'oily'
    if (q1 === 'tight' && q2 === 'dry') return 'dry'
    if ((q1 === 'oily' && q2 === 'dry') || (q1 === 'tight' && q2 === 'oily')) return 'combination'
    return 'normal'
  }

  const fetchMenus = useCallback(async () => {
    const concerns = data.messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ')
    const res = await fetch('/api/counseling/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'menu',
        concerns: concerns || undefined,
        skin_type: data.skinType ? SKIN_TYPE_LABELS[data.skinType] : undefined,
        visit_purpose: data.visitPurpose === 'first' ? '初回' : data.visitPurpose === 'repeat' ? 'リピート' : '特別ケア',
      }),
    })
    const json = await res.json()
    setData((d) => ({ ...d, menus: json.menus || [] }))
  }, [data.messages, data.skinType, data.visitPurpose])

  useEffect(() => {
    if (step === 5 && data.menus.length === 0) fetchMenus()
  }, [step, data.menus.length, fetchMenus])

  const customerName = data.customerName || 'お客様'
  const buildInitialGreeting = useCallback(() => {
    return `${customerName}様、本日はご来店いただきありがとうございます😊
はじめまして、私はSOLAと申します。
これまで80万件以上の施術に関わってきた経験と知見をもとに、
${customerName}様の施術をより心地よく、より効果的なものにするために
サポートさせていただきます。
お話は、画面のテキストで入力いただくか、
マイクボタンを押して音声でお話しいただくこともできます😊
どちらでもお好きな方法でお答えください。
AIがお伺いするので、
スタッフには少し話しにくいことも、
どうか気兼ねなくお話しいただけたら嬉しいです😊

まず最初に教えてください。
当サロンのことは、どちらでお知りになりましたか？
ホットペッパー／SNS／ご紹介／Google／その他`
  }, [customerName])

  // step 2 に入ったとき、挨拶をassistantメッセージとして追加（会話履歴に含める）
  useEffect(() => {
    if (step === 2 && data.messages.length === 0 && !initialSpokenRef.current) {
      initialSpokenRef.current = true
      const greeting = buildInitialGreeting()
      setData((d) => ({ ...d, messages: [{ role: 'assistant', content: greeting }] }))
      speakMessage(greeting)
    }
  }, [step, data.messages.length, speakMessage, buildInitialGreeting])

  const fetchSolaComment = useCallback(async () => {
    const summary = [
      `お悩み: ${data.concerns.join('、') || '-'}`,
      `肌タイプ: ${data.skinType ? SKIN_TYPE_LABELS[data.skinType] : '-'}`,
      `アレルギー: ${data.hasAllergy ? data.allergyDetail : 'なし'}`,
      data.pregnancy ? '妊娠中・授乳中' : '',
      data.otherCautions ? `その他: ${data.otherCautions}` : '',
      data.selectedMenu ? `選択メニュー: ${data.selectedMenu.name}` : '',
    ].filter(Boolean).join('\n')
    const res = await fetch('/api/counseling/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'comment', summary }),
    })
    const json = await res.json()
    setSolaComment(json.comment || '')
  }, [data.concerns, data.skinType, data.hasAllergy, data.allergyDetail, data.pregnancy, data.otherCautions, data.selectedMenu])

  useEffect(() => {
    if (step === 6 && !solaComment) fetchSolaComment()
  }, [step, solaComment, fetchSolaComment])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/counseling/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: data.customerId || null,
          customer_name: data.customerName || 'お客様',
          mode,
          concerns: data.concerns,
          skin_type: data.skinType ? SKIN_TYPE_LABELS[data.skinType] : null,
          allergies: data.hasAllergy ? data.allergyDetail : null,
          cautions: [data.pregnancy && '妊娠中・授乳中', data.otherCautions, data.medication].filter(Boolean).join('\n') || null,
          selected_menu: data.selectedMenu?.name || null,
          aria_comment: solaComment || null,
          chat_history: data.messages,
        }),
      })
      if (!res.ok) throw new Error()
      localStorage.removeItem(STORAGE_KEY)
      setCompleted(true)
      if (mode === 'salon' && data.customerId) {
        window.location.href = `/chart/${data.customerId}`
      }
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }, [data, mode, solaComment])

  // AIの返答から選択肢を抽出
  const extractChoices = (text: string): string[] => {
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // ／区切り（2つ以上）
      if (trimmed.includes('／')) {
        const parts = trimmed.split('／').map(s => s.trim()).filter(s => s.length > 0 && s.length <= 25)
        if (parts.length >= 2) return parts
      }
    }
    return []
  }

  // 最後のassistantメッセージの選択肢
  const lastAssistantMsg = data.messages.filter(m => m.role === 'assistant').at(-1)
  const lastMsgIsAssistant = data.messages.at(-1)?.role === 'assistant'
  const choices = lastAssistantMsg && lastMsgIsAssistant && !chatLoading ? extractChoices(lastAssistantMsg.content) : []

  const resetAndStartOver = () => {
    setData(DEFAULT_SESSION)
    setStep(1)
    setCompleted(false)
    setSolaComment('')
    setAutoSaved(false)
    setChatInput('')
    setCustomerSearch('')
    setSearchResults([])
    setNewCustomer(true)
    initialSpokenRef.current = false
    autoSaveTriggeredRef.current = false
    localStorage.removeItem(STORAGE_KEY)
  }

  const steps = [1, 2, 3, 4, 5, 6]

  if (completed) {
    return (
      <div className="bg-white flex flex-col h-[calc(100vh-64px)]">
        <header className="flex items-center h-14 px-4 border-b border-gray-100">
          <Link href="/dashboard" className="p-2 -ml-2 text-[#3D3D3D]">
            <BackIcon className="w-5 h-5" />
          </Link>
          <h1 className="flex-1 text-center text-sm font-bold text-[#3D3D3D]">SOLA カウンセリング</h1>
          <div className="w-9" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-36 h-36 rounded-full overflow-hidden ring-2 ring-offset-2 ring-[#9B8EC4] mb-4">
            <Image src={SOLA_AVATAR_URL} alt="SOLA" width={144} height={144} className="w-full h-full object-cover" />
          </div>
          <p className="text-sm font-medium text-[#C4728A] mb-1">SOLA</p>
          <h2 className="text-xl font-bold text-[#3D3D3D] mb-2">
            {mode === 'online' ? 'スタッフに送信しました' : 'カルテに保存しました'}
          </h2>
          <p className="text-sm text-gray-500 mb-8 text-center">
            {mode === 'online' ? 'ご来店の際にスタッフが内容を確認いたします。' : 'カルテ画面で内容を確認できます。'}
          </p>
          <button
            onClick={resetAndStartOver}
            className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> もう一度カウンセリングする
          </button>
          {mode === 'salon' && (
            <Link href="/counseling/sessions" className="mt-4 text-sm text-[#C4728A] hover:underline">
              セッション一覧へ
            </Link>
          )}
        </div>
      </div>
    )
  }

  const isChatStep = step === 2
  const useSplitLayout = isChatStep

  return (
    <div className={`bg-white flex flex-col h-[calc(100vh-64px)] ${useSplitLayout ? 'lg:flex-row lg:max-w-none -mx-4 lg:-mx-8 -mt-4 lg:-mt-8' : 'max-w-lg mx-auto'}`}>
      <header className={`flex items-center h-14 px-4 border-b border-gray-100 shrink-0 ${useSplitLayout ? 'lg:absolute lg:top-0 lg:left-0 lg:right-0 lg:z-20 lg:bg-white/95 lg:backdrop-blur' : ''}`}>
        <Link href="/dashboard" className="p-2 -ml-2 text-[#3D3D3D]">
          <BackIcon className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-[#3D3D3D]">SOLA カウンセリング</h1>
        {step === 2 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { unlockAudio(); speakMessage('こんにちは') }}
              disabled={isSpeaking}
              className="p-2 rounded-lg text-[#3D3D3D] hover:bg-[#F8F5FF] text-xs"
              title="音声テスト"
            >
              🔊
            </button>
            <button
              type="button"
              onClick={() => { unlockAudio(); setVoiceEnabled((v) => !v) }}
              className="p-2 rounded-lg text-[#3D3D3D] hover:bg-[#F8F5FF]"
              title={voiceEnabled ? '音声をオフ' : '音声をオン'}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        ) : (
          <div className="w-9" />
        )}
      </header>

      <div className={`flex justify-center gap-1 py-3 shrink-0 ${useSplitLayout ? 'lg:pt-16' : ''}`}>
        {steps.map((s) => (
          <button
            key={s}
            onClick={() => s < step && setStep(s)}
            className={`w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-colors ${
              s === step ? 'bg-[#C4728A] text-white' : s < step ? 'bg-[#C4728A]/30 text-[#C4728A]' : 'bg-gray-200 text-gray-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!useSplitLayout && (
        <div className="flex flex-col items-center py-4 shrink-0">
          <div className={`relative inline-block w-36 h-36 rounded-full overflow-hidden ring-2 ring-offset-2 ring-[#9B8EC4] bg-gray-100 ${isSpeaking ? 'sola-speaking' : ''}`}>
            <Image src={SOLA_AVATAR_URL} alt="SOLA" width={144} height={144} className="w-full h-full object-cover" />
          </div>
          <SolaWaveform isSpeaking={isSpeaking} />
          <p className="text-sm font-medium text-[#3D3D3D] mt-2">✨ SOLA</p>
          <p className="text-xs text-gray-500">AIビューティーカウンセラー</p>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto px-4 pb-4 min-h-0 ${useSplitLayout ? 'lg:flex lg:flex-row lg:p-0' : ''}`}>
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#3D3D3D]">基本情報</h3>
            {mode === 'salon' && (
              <div>
                <label className="text-xs text-gray-500 block mb-2">顧客</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                    placeholder="名前で検索"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
                  />
                  <button onClick={doSearch} className="p-2 bg-[#C4728A] text-white rounded-lg">
                    <Search className="w-5 h-5" />
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setData((d) => ({ ...d, customerName: c.name, customerId: c.id }))
                          setNewCustomer(false)
                          setSearchResults([])
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[#F8F5FF] text-left"
                      >
                        <User className="w-4 h-4 text-[#C4728A]" /> {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {newCustomer ? (
                  <input
                    type="text"
                    value={data.customerName}
                    onChange={(e) => setData((d) => ({ ...d, customerName: e.target.value }))}
                    placeholder="新規のお客様のお名前"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F5FF] border border-[#9B8EC4]/30">
                    <span className="font-medium text-[#3D3D3D]">{data.customerName}</span>
                    <button type="button" onClick={() => { setNewCustomer(true); setData((d) => ({ ...d, customerId: undefined, customerName: '' })) }} className="text-xs text-[#C4728A] hover:underline">
                      変更
                    </button>
                  </div>
                )}
              </div>
            )}
            {mode === 'online' && (
              <div>
                <label className="text-xs text-gray-500 block mb-2">お名前</label>
                <VoiceInputField value={data.customerName} onChange={(v) => setData((d) => ({ ...d, customerName: v }))} placeholder="お名前を入力" rows={1} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-2">来店目的</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'first', label: '初回' },
                  { value: 'repeat', label: 'リピート' },
                  { value: 'special', label: '特別ケア' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setData((d) => ({ ...d, visitPurpose: value }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${data.visitPurpose === value ? 'bg-[#C4728A] text-white' : 'bg-[#F8F5FF] text-[#3D3D3D]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">本日のメニュー</label>
              {salonMenus.length === 0 ? (
                <p className="text-xs text-gray-400">メニューを読み込み中...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {salonMenus.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setData((d) => ({ ...d, courseName: m.name }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${data.courseName === m.name ? 'bg-[#C4728A] text-white' : 'bg-[#F8F5FF] text-[#3D3D3D]'}`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {data.courseName && (
                <p className="text-xs text-[#C4728A] mt-1">選択中: {data.courseName}</p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={`flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 ${useSplitLayout ? 'lg:h-[calc(100vh-140px)]' : 'h-[calc(100vh-320px)] min-h-[280px]'}`}>
            {/* デスクトップ: 左40% アバターエリア */}
            <div className="hidden lg:flex lg:w-2/5 lg:flex-col lg:items-center lg:justify-center lg:py-12 lg:border-r lg:border-gray-100" style={{ background: 'linear-gradient(135deg, #F8F5FF, #FDFAF7)' }}>
              <div className={`w-72 h-72 rounded-full overflow-hidden ring-2 ring-offset-2 ring-[#9B8EC4] bg-gray-100 ${isSpeaking ? 'sola-speaking' : ''}`}>
                <Image src={SOLA_AVATAR_URL} alt="SOLA" width={288} height={288} className="w-full h-full object-cover" />
              </div>
              <SolaWaveform isSpeaking={isSpeaking} />
              <h2 className="text-xl font-bold mt-6" style={{ fontFamily: 'var(--font-noto-serif)', color: '#5A4A6E' }}>SOLA</h2>
              <p className="text-sm mt-1" style={{ color: '#9B8EC4', fontFamily: 'var(--font-noto-sans)' }}>AIビューティーカウンセラー</p>
              <div className="mt-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-rose-400 animate-pulse' : chatLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-xs" style={{ color: '#9B8EC4' }}>
                  {isSpeaking ? 'お話し中...' : chatLoading ? '考え中...' : 'オンライン'}
                </span>
              </div>
            </div>
            {/* 右60% チャットエリア */}
            <div className="flex flex-col flex-1 min-h-0 lg:w-3/5 lg:border-l lg:border-gray-100">
            <div className="flex-1 overflow-y-auto space-y-4 pt-4 pb-4 px-2 lg:px-6 lg:pt-20">
              {data.messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-[85%]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2">
                    <SolaAvatarImg size={48} isSpeaking={isSpeaking} />
                    <div className="bg-[#F8F5FF] rounded-2xl rounded-tl-none px-4 py-3 text-base text-[#3D3D3D] max-w-[85%] leading-relaxed whitespace-pre-line">
                      {m.content}
                    </div>
                  </div>
                )
              )}
              {chatLoading && (
                <div className="flex gap-2">
                  <SolaAvatarImg size={48} isSpeaking={isSpeaking} />
                  <div className="bg-[#F8F5FF] rounded-2xl rounded-tl-none px-4 py-3 text-sm text-[#3D3D3D]">
                    <TypingDots />
                  </div>
                </div>
              )}
              {choices.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-14">
                  {choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => sendChat(choice)}
                      className="px-4 py-2 rounded-xl bg-white border-2 border-[#C4728A]/30 text-sm font-medium text-[#C4728A] hover:bg-[#C4728A] hover:text-white transition-colors"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              {autoSaved && (
                <div className="text-center py-2">
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    <Check className="w-3 h-3" /> カウンセリング内容を保存しました
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* チャット入力（デスクトップでは右カラム内に表示） */}
            <div className="shrink-0 p-4 pt-0 border-t border-gray-100 bg-white space-y-3 lg:mx-4">
              {speechError && (
                <div className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                  {speechError}
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <VoiceInputField value={chatInput} onChange={setChatInput} onFocus={unlockAudio} placeholder="メッセージを入力..." rows={1} disabled={chatLoading} />
                </div>
                <button
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="shrink-0 px-4 py-3 rounded-xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white disabled:opacity-50 flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-gray-500">
                  <ChevronLeft className="w-5 h-5" /> 戻る
                </button>
                <button
                  onClick={() => { const concerns = data.messages.filter((m) => m.role === 'user').map((m) => m.content); setData((d) => ({ ...d, concerns })); setStep(3) }}
                  disabled={data.messages.filter((m) => m.role === 'user').length < 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white font-medium disabled:opacity-50"
                >
                  次へ <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#3D3D3D]">肌タイプ診断</h3>
            {[
              { key: 'q1', label: '洗顔後の肌の状態', options: [{ value: 'tight', label: 'つっぱる' }, { value: 'normal', label: '普通' }, { value: 'oily', label: 'べたつく' }] },
              { key: 'q2', label: 'Tゾーンの脂っぽさ', options: [{ value: 'oily', label: '気になる' }, { value: 'normal', label: '普通' }, { value: 'dry', label: '乾燥' }] },
              { key: 'q3', label: '肌トラブルの頻度', options: [{ value: 'often', label: 'よくある' }, { value: 'sometimes', label: 'たまにある' }, { value: 'rare', label: 'ほぼない' }] },
              { key: 'q4', label: '紫外線対策', options: [{ value: 'daily', label: '毎日' }, { value: 'sometimes', label: 'たまに' }, { value: 'rare', label: 'ほぼしない' }] },
            ].map((q) => (
              <div key={q.key}>
                <label className="text-xs text-gray-500 block mb-2">{q.label}</label>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => {
                        const next = { ...data.skinAnswers, [q.key]: o.value }
                        const st = Object.keys(next).length === 4 ? diagnoseSkinType(next) : null
                        setData((d) => ({ ...d, skinAnswers: next, skinType: st }))
                      }}
                      className={`px-3 py-2 rounded-lg text-sm ${data.skinAnswers[q.key] === o.value ? 'bg-[#C4728A] text-white' : 'bg-[#F8F5FF] text-[#3D3D3D]'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(data.skinAnswers).length === 4 && (() => {
              const st = diagnoseSkinType(data.skinAnswers)
              return st ? <p className="text-sm font-medium text-[#C4728A]">診断結果: {SKIN_TYPE_LABELS[st]}</p> : null
            })()}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#3D3D3D]">アレルギー・注意事項</h3>
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={data.hasAllergy} onChange={(e) => setData((d) => ({ ...d, hasAllergy: e.target.checked }))} className="rounded text-[#C4728A]" />
                <span className="text-sm">アレルギーがある</span>
              </label>
              {data.hasAllergy && <VoiceInputField value={data.allergyDetail} onChange={(v) => setData((d) => ({ ...d, allergyDetail: v }))} placeholder="具体的な内容を入力" rows={2} />}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.pregnancy} onChange={(e) => setData((d) => ({ ...d, pregnancy: e.target.checked }))} className="rounded text-[#C4728A]" />
                <span className="text-sm">妊娠中・授乳中</span>
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">その他注意事項</label>
              <VoiceInputField value={data.otherCautions} onChange={(v) => setData((d) => ({ ...d, otherCautions: v }))} placeholder="特記事項があれば" rows={2} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">現在使用中の薬（任意）</label>
              <VoiceInputField value={data.medication} onChange={(v) => setData((d) => ({ ...d, medication: v }))} placeholder="薬の名前など" rows={1} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#3D3D3D]">おすすめメニュー</h3>
            {data.menus.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#C4728A]" /></div>
            ) : (
              <div className="space-y-3">
                {data.menus.map((menu, i) => (
                  <div key={i} className={`p-4 rounded-xl border-2 ${data.selectedMenu?.name === menu.name ? 'border-[#C4728A] bg-[#C4728A]/5' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-[#3D3D3D]">{menu.name}</span>
                      <span className="text-xs text-gray-500">{menu.duration}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{menu.reason}</p>
                    <button
                      onClick={() => setData((d) => ({ ...d, selectedMenu: menu }))}
                      className={`w-full py-2 rounded-lg text-sm font-medium ${data.selectedMenu?.name === menu.name ? 'bg-[#C4728A] text-white' : 'bg-[#F8F5FF] text-[#3D3D3D]'}`}
                    >
                      {data.selectedMenu?.name === menu.name ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> 選択済み</span> : 'これにする'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#3D3D3D]">カルテ確認</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">お悩み:</span><p className="text-[#3D3D3D] mt-1">{data.messages.filter((m) => m.role === 'user').map((m) => m.content).join(' / ') || '-'}</p></div>
              <div><span className="text-gray-500">肌タイプ:</span><p className="text-[#3D3D3D]">{data.skinType ? SKIN_TYPE_LABELS[data.skinType] : '-'}</p></div>
              <div><span className="text-gray-500">アレルギー・注意事項:</span><p className="text-[#3D3D3D]">{[data.hasAllergy && data.allergyDetail, data.pregnancy && '妊娠中・授乳中', data.otherCautions, data.medication].filter(Boolean).join(' / ') || 'なし'}</p></div>
              <div><span className="text-gray-500">選んだメニュー:</span><p className="text-[#3D3D3D]">{data.selectedMenu?.name || '-'}</p></div>
              {solaComment && (
                <div className="bg-[#F8F5FF] rounded-xl p-4">
                  <span className="text-gray-500 text-xs block mb-1">SOLAからのコメント</span>
                  <p className="text-[#3D3D3D]">{solaComment}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><MessageCircle className="w-5 h-5" /> {mode === 'online' ? 'スタッフに共有する' : 'カルテに保存'}</>}
            </button>
          </div>
        )}
      </main>

      {step !== 2 && !completed && (
        <div className="shrink-0 flex justify-between p-4 border-t border-gray-100">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="flex items-center gap-1 text-gray-500 disabled:opacity-40">
            <ChevronLeft className="w-5 h-5" /> 戻る
          </button>
          <button
            onClick={() => {
              if (step === 1) unlockAudio()
              if (step === 2) {
                const concerns = data.messages.filter((m) => m.role === 'user').map((m) => m.content)
                setData((d) => ({ ...d, concerns }))
              }
              setStep((s) => Math.min(6, s + 1))
            }}
            disabled={
              (step === 1 && (!data.customerName.trim() || !data.courseName)) ||
              (step === 2 && data.messages.filter((m) => m.role === 'user').length < 1) ||
              (step === 3 && Object.keys(data.skinAnswers).length < 4) ||
              (step === 5 && !data.selectedMenu)
            }
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white font-medium disabled:opacity-50"
          >
            次へ <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function CounselingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-[#C4728A] animate-spin" />
      </div>
    }>
      <CounselingContent />
    </Suspense>
  )
}
