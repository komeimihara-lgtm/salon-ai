'use client'

/**
 * SOLA 音声カウンセラー（Realtime / WebRTC 版）— 動作確認用の別ルート。
 * 既存のカウンセリング画面・The Core 連携には一切影響しない独立ページ。
 *
 * 接続フロー:
 *   1) /api/session でエフェメラルトークン取得（OPENAI_API_KEY はサーバ側のみ）
 *   2) RTCPeerConnection を作成
 *   3) マイクを addTrack、リモート音声を <audio> で再生
 *   4) SDP offer を https://api.openai.com/v1/realtime/calls に直接送信
 *   5) 返ってきた answer を setRemoteDescription して通話開始
 */

import { useRef, useState } from 'react'
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react'

// モデルはトークン発行（/api/session のセッション）側で gpt-realtime-2 に束縛されるため、
// calls エンドポイントにはクエリを付けず直結する（参考実装と同じ）。
const CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

type Status = 'idle' | 'connecting' | 'live' | 'error'

export default function CounselingRealtimePage() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop())
      pcRef.current?.close()
    } catch {
      /* noop */
    }
    pcRef.current = null
    micRef.current?.getTracks().forEach((t) => t.stop())
    micRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
    setStatus('idle')
  }

  const start = async () => {
    setError(null)
    setStatus('connecting')
    try {
      // 1) エフェメラルトークン取得（鍵はサーバ側 /api/session のみが保持）
      const tokenRes = await fetch('/api/session')
      if (!tokenRes.ok) {
        throw new Error(`トークン取得に失敗しました (${tokenRes.status}): ${await tokenRes.text()}`)
      }
      const data = await tokenRes.json()
      // client_secrets のレスポンス形に応じてキーを取り出す
      const ephemeralKey: string | undefined = data?.value ?? data?.client_secret?.value
      if (!ephemeralKey) {
        throw new Error('エフェメラルトークン (value) が取得できませんでした')
      }

      // 2) PeerConnection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // 3) リモート音声の再生
      pc.ontrack = (e) => {
        if (audioRef.current) audioRef.current.srcObject = e.streams[0]
      }

      // 4) マイクを追加
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      micRef.current = mic
      mic.getTracks().forEach((t) => pc.addTrack(t, mic))

      // イベント用データチャネル（接続後にAIから先に挨拶させる）
      const dc = pc.createDataChannel('oai-events')
      dc.addEventListener('open', () => {
        // 「最初のひとこと」をAI側から発話させる
        dc.send(JSON.stringify({ type: 'response.create' }))
      })

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState
        if (st === 'connected') setStatus('live')
        else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
          if (pcRef.current) setStatus('idle')
        }
      }

      // 5) SDP offer → /v1/realtime/calls
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpRes = await fetch(CALLS_URL, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      })
      if (!sdpRes.ok) {
        throw new Error(`音声接続(SDP)に失敗しました (${sdpRes.status}): ${await sdpRes.text()}`)
      }
      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      setStatus('live')
    } catch (e) {
      console.error('[counseling-rt] connect error', e)
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
      stop()
    }
  }

  const live = status === 'live'
  const connecting = status === 'connecting'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FBF8F4] to-[#F8F5FF] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl card-shadow overflow-hidden">
        <div className="h-[4px] w-full bg-gradient-to-r from-rose to-lavender" />
        <div className="p-8 text-center">
          <p className="text-xs tracking-[0.2em] text-text-sub font-dm-sans">SOLA · REALTIME (β)</p>
          <h1 className="mt-2 text-2xl font-bold text-text-main">音声カウンセリング</h1>
          <p className="mt-2 text-sm text-text-sub">
            マイクで話しかけると、SOLAがリアルタイムに音声で応答します。
          </p>

          <div className="my-8 flex flex-col items-center gap-3">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                live
                  ? 'bg-gradient-to-br from-rose to-lavender animate-pulse'
                  : 'bg-light-lav'
              }`}
            >
              {connecting ? (
                <Loader2 className="w-10 h-10 text-rose animate-spin" />
              ) : live ? (
                <Volume2 className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-rose" />
              )}
            </div>
            <span className="text-sm font-medium text-text-sub">
              {status === 'idle' && '未接続'}
              {connecting && '接続中…'}
              {live && '通話中 — どうぞお話しください'}
              {status === 'error' && '接続エラー'}
            </span>
          </div>

          {!live && !connecting ? (
            <button
              onClick={start}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose to-lavender text-white font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Mic className="w-5 h-5" /> カウンセリングを始める
            </button>
          ) : (
            <button
              onClick={stop}
              disabled={connecting}
              className="w-full py-3 rounded-2xl border border-rose/40 text-rose font-bold hover:bg-rose/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <MicOff className="w-5 h-5" /> 終了する
            </button>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-500 bg-red-50 rounded-xl p-3 text-left whitespace-pre-wrap break-words">
              {error}
            </p>
          )}

          <p className="mt-6 text-[11px] text-text-sub/70">
            ※ 動作確認用の別ルートです。既存のカウンセリング画面とは独立しています。
          </p>
        </div>
      </div>

      {/* リモート音声の出力先 */}
      <audio ref={audioRef} autoPlay />
    </div>
  )
}
