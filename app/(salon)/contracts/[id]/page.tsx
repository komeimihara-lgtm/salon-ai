'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Printer, CheckCircle } from 'lucide-react'

interface ContractData {
  id: string
  customer_id: string
  course_name: string
  treatment_content: string | null
  sessions: number | null
  start_date: string | null
  end_date: string | null
  amount: number
  payment_method: string
  status: string
  signature_image: string | null
  signed_at: string | null
  signer_ip: string | null
  created_at: string
  customers: {
    name: string
    name_kana?: string
    phone?: string
    email?: string
    address?: string
  } | null
}

interface SalonInfo {
  name?: string
  phone?: string
  address?: string
}

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [contract, setContract] = useState<ContractData | null>(null)
  const [salon, setSalon] = useState<SalonInfo>({})
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${id}`)
      const data = await res.json()
      if (res.ok) {
        setContract(data.contract)
        setSalon(data.salon || {})
      }
    } catch {
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContract()
  }, [fetchContract])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || contract?.status === 'signed') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1A202C'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [contract?.status, loading])

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    isDrawingRef.current = true
    lastPointRef.current = getPos(e)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !lastPointRef.current) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPointRef.current = pos
  }

  const endDraw = () => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const isCanvasEmpty = () => {
    const canvas = canvasRef.current
    if (!canvas) return true
    const ctx = canvas.getContext('2d')
    if (!ctx) return true
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false
    }
    return true
  }

  const handleSign = async () => {
    if (!contract || isCanvasEmpty()) {
      alert('署名を記入してください')
      return
    }

    setSigning(true)
    try {
      const canvas = canvasRef.current!
      const signatureImage = canvas.toDataURL('image/png')
      const signedAt = new Date().toISOString()

      // Get IP (best-effort)
      let signerIp = ''
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        signerIp = ipData.ip || ''
      } catch { /* ignore */ }

      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_image: signatureImage,
          signed_at: signedAt,
          signer_ip: signerIp,
          status: 'signed',
        }),
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      // PDF generation
      try {
        const contractEl = document.getElementById('contract-template')
        if (contractEl) {
          const html2canvas = (await import('html2canvas')).default
          const { jsPDF } = await import('jspdf')
          const canvasImg = await html2canvas(contractEl, { scale: 2, useCORS: true })
          const imgData = canvasImg.toDataURL('image/png')
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pdfW = pdf.internal.pageSize.getWidth()
          const pdfH = (canvasImg.height * pdfW) / canvasImg.width
          pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
          pdf.save(`contract_${contract.id.slice(0, 8)}.pdf`)
        }
      } catch (pdfErr) {
        console.error('PDF生成エラー:', pdfErr)
      }

      // LINE送信（line_user_idがある場合）
      try {
        const customerRes = await fetch(`/api/customers/${contract.customer_id}`)
        const customerData = await customerRes.json()
        if (customerData.customer?.line_user_id) {
          await fetch('/api/line/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              line_user_id: customerData.customer.line_user_id,
              message: `【契約書署名完了】\n${contract.course_name}の契約書に署名が完了しました。\n金額: ¥${contract.amount.toLocaleString()}\n署名日時: ${new Date(signedAt).toLocaleString('ja-JP')}`,
            }),
          })
        }
      } catch { /* LINE送信失敗は無視 */ }

      await fetchContract()
      showToast('署名が完了しました')
    } catch {
      alert('署名の保存に失敗しました')
    } finally {
      setSigning(false)
    }
  }

  const handlePrint = () => window.print()

  const handleDownloadPdf = async () => {
    const contractEl = document.getElementById('contract-template')
    if (!contractEl) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvasImg = await html2canvas(contractEl, { scale: 2, useCORS: true })
      const imgData = canvasImg.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvasImg.height * pdfW) / canvasImg.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      pdf.save(`contract_${contract?.id.slice(0, 8)}.pdf`)
    } catch (err) {
      console.error('PDF生成エラー:', err)
      alert('PDF生成に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-rose animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-text-sub mb-4">契約書が見つかりません</p>
        <Link href="/contracts" className="text-rose font-medium hover:underline">一覧に戻る</Link>
      </div>
    )
  }

  const cust = contract.customers
  const isSigned = contract.status === 'signed'

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/contracts" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          {isSigned && (
            <>
              <button
                onClick={handleDownloadPdf}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                PDF保存
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" /> 印刷
              </button>
            </>
          )}
        </div>
      </div>

      {isSigned && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl print:hidden">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700">
            署名済み（{contract.signed_at ? new Date(contract.signed_at).toLocaleString('ja-JP') : ''}）
          </p>
        </div>
      )}

      {/* 契約書テンプレート */}
      <div id="contract-template" className="bg-white rounded-2xl p-6 sm:p-8 card-shadow print:shadow-none print:rounded-none">
        <h2 className="text-xl font-bold text-center text-text-main mb-6 border-b-2 border-text-main pb-2">
          エステティックサービス契約書
        </h2>

        {/* 事業者情報 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">事業者情報</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>サロン名: {salon.name || '—'}</p>
            <p>住所: {salon.address || '—'}</p>
            <p>電話番号: {salon.phone || '—'}</p>
          </div>
        </div>

        {/* 契約者情報 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">契約者情報</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>氏名: {cust?.name || '—'}</p>
            <p>住所: {cust?.address || '—'}</p>
            <p>電話番号: {cust?.phone || '—'}</p>
          </div>
        </div>

        {/* 契約内容 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">契約内容</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>契約日: {new Date(contract.created_at).toLocaleDateString('ja-JP')}</p>
            <p>コース名: {contract.course_name}</p>
            {contract.treatment_content && <p>施術内容: {contract.treatment_content}</p>}
            {contract.sessions && <p>回数: {contract.sessions}回</p>}
            <p>
              期間: {contract.start_date || '—'} 〜 {contract.end_date || '—'}
            </p>
            <p>契約金額: ¥{contract.amount.toLocaleString()}（税込）</p>
            <p>支払方法: {contract.payment_method === 'lump_sum' ? '一括払い' : '分割払い'}</p>
          </div>
        </div>

        {/* クーリングオフ */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            クーリングオフに関する事項
          </h3>
          <div className="text-xs text-text-sub leading-relaxed bg-[#F8F5FF] p-3 rounded-lg">
            <p>契約書面を受領した日から起算して8日間は、書面により無条件で契約の解除（クーリングオフ）を行うことができます。</p>
            <p className="mt-1">クーリングオフの通知は、上記事業者住所宛に書面（はがき可）にて行ってください。効力は書面を発信した時点で生じます。</p>
            <p className="mt-1">クーリングオフを行った場合、事業者は損害賠償・違約金を請求することはできません。既に役務が提供されている場合でも、その対価の支払いは不要です。</p>
          </div>
        </div>

        {/* 中途解約・返金 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            中途解約・返金について
          </h3>
          <div className="text-xs text-text-sub leading-relaxed bg-[#F8F5FF] p-3 rounded-lg">
            <p>クーリングオフ期間経過後も、契約期間中は中途解約が可能です。中途解約時の精算は以下のとおりです。</p>
            <p className="mt-2 font-medium text-text-main">【役務提供開始前】</p>
            <p>解約手数料: 2万円または契約残額の10%のいずれか低い額</p>
            <p className="mt-2 font-medium text-text-main">【役務提供開始後】</p>
            <p>解約手数料: 5万円または契約残額の20%のいずれか低い額</p>
            <p className="mt-1">返金額 = 契約金額 - 既提供役務の対価 - 解約手数料</p>
          </div>
        </div>

        {/* 損害賠償上限 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            損害賠償上限額
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            施術に起因する損害が発生した場合、事業者の賠償責任は契約金額を上限とします。ただし、事業者の故意または重過失による場合はこの限りではありません。
          </p>
        </div>

        {/* 禁忌事項・免責 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            禁忌事項・免責事項
          </h3>
          <div className="text-xs text-text-sub leading-relaxed">
            <p>以下に該当する場合、施術をお断りまたは中止する場合があります。この場合、施術中止に伴う損害について事業者は責任を負いません。</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>妊娠中またはその可能性がある場合</li>
              <li>施術部位に炎症・傷・皮膚疾患がある場合</li>
              <li>医師から施術を止められている場合</li>
              <li>事前カウンセリングで虚偽の申告をした場合</li>
              <li>飲酒状態での来店</li>
            </ul>
          </div>
        </div>

        {/* 個人情報 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            個人情報の取扱い
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            お客様の個人情報は、施術の提供・予約管理・アフターフォロー等の目的に限り使用します。法令に基づく場合を除き、お客様の同意なく第三者に提供することはありません。
          </p>
        </div>

        {/* 効果の個人差 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            効果の個人差に関する説明
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            施術の効果には個人差があり、すべてのお客様に同一の結果を保証するものではありません。効果の現れ方は体質・生活習慣・施術部位等により異なります。
          </p>
        </div>

        {/* 署名エリア */}
        <div className="border-t-2 border-text-main pt-4">
          <p className="text-sm text-text-main mb-1 font-medium">
            上記内容に同意し、契約を締結します。
          </p>
          <p className="text-xs text-text-sub mb-3">
            契約日: {new Date(contract.created_at).toLocaleDateString('ja-JP')}
          </p>

          {isSigned && contract.signature_image ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-text-sub">署名:</p>
              <img
                src={contract.signature_image}
                alt="署名"
                className="border border-gray-200 rounded-lg max-w-[300px] h-auto"
              />
              <p className="text-xs text-text-sub">
                署名日時: {contract.signed_at ? new Date(contract.signed_at).toLocaleString('ja-JP') : '—'}
              </p>
            </div>
          ) : (
            <div className="print:hidden">
              <p className="text-xs text-text-sub mb-2">下の枠内に署名してください:</p>
              <canvas
                ref={canvasRef}
                className="w-full h-[150px] border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none bg-white"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={clearCanvas}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  クリア
                </button>
                <button
                  onClick={handleSign}
                  disabled={signing}
                  className="flex-1 py-2 rounded-xl bg-rose text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> 署名中...
                    </>
                  ) : (
                    '同意して署名する'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-6 py-4 rounded-2xl shadow-lg bg-emerald-600 text-white font-medium print:hidden">
          {toast}
        </div>
      )}
    </div>
  )
}
