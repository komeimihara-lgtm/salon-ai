'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Upload,
  Image,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertTriangle,
  X,
  Edit2,
} from 'lucide-react'

type ImportRow = {
  name: string
  name_kana?: string
  phone?: string
  email?: string
  address?: string
  birthday?: string
  gender?: string
  first_visit_date?: string
  memo?: string
  purchase_history?: { date: string; menu: string; amount: number }[]
  ticket_plan_name?: string
  remaining_sessions?: number
  expiry_date?: string
  visit_count?: number
  total_spent?: number
  avg_unit_price?: number
}

type Toast = { type: 'success' | 'error'; message: string }

function CustomerImportContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<'csv' | 'image'>(tabParam === 'image' ? 'image' : 'csv')

  useEffect(() => {
    if (tabParam === 'image') setTab('image')
    else if (tabParam === 'csv') setTab('csv')
  }, [tabParam])
  const [customers, setCustomers] = useState<ImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [encoding, setEncoding] = useState<'utf8' | 'sjis'>('utf8')
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite'>('skip')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleCSVFile = async (file: File) => {
    setLoading(true)
    setError('')
    setCustomers([])
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('encoding', encoding)
      const res = await fetch('/api/customers/import/parse', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'パースに失敗しました')
      setCustomers(data.customers || [])
      if (!data.customers?.length) setError('有効な顧客データが見つかりませんでした')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSVの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setLoading(true)
    setError('')
    setCustomers([])
    setResult(null)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      const res = await fetch('/api/customers/import/image', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '読み取りに失敗しました')
      setCustomers(data.customers || [])
      if (!data.customers?.length) setError('画像から顧客情報を読み取れませんでした')
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像の読み取りに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent, type: 'csv' | 'image') => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (type === 'csv') {
      const f = Array.from(files).find(f => f.name.endsWith('.csv'))
      if (f) handleCSVFile(f)
    } else {
      const imageFiles = Array.from(files).filter(f =>
        f.type.startsWith('image/') || f.type === 'application/pdf'
      )
      if (imageFiles.length) {
        const dt = new DataTransfer()
        imageFiles.forEach(f => dt.items.add(f))
        handleImageFiles(dt.files)
      }
    }
  }

  const handleExecute = async () => {
    if (!customers.length) return
    setExecuting(true)
    setError('')
    try {
      const res = await fetch('/api/customers/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers, duplicateAction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'インポートに失敗しました')
      setResult(data)
      showToast({ type: 'success', message: `${data.imported}件インポート、${data.skipped}件スキップ` })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'インポートに失敗しました')
      showToast({ type: 'error', message: e instanceof Error ? e.message : 'インポートに失敗しました' })
    } finally {
      setExecuting(false)
    }
  }

  const updateCustomer = (index: number, updates: Partial<ImportRow>) => {
    setCustomers(prev => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)))
    setEditingIndex(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/customers"
          className="flex items-center gap-1 text-sm text-[#4A5568] hover:text-[#1A202C]"
        >
          <ChevronLeft className="w-4 h-4" />
          顧客一覧へ
        </Link>
      </div>

      <h1 className="text-xl font-bold text-[#1A202C]">顧客インポート</h1>

      {/* タブ */}
      <div className="flex gap-2 border-b border-[#BAE6FD]">
        <button
          onClick={() => { setTab('csv'); setCustomers([]); setError(''); setResult(null) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'csv' ? 'border-rose text-rose' : 'border-transparent text-[#4A5568] hover:text-[#1A202C]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-2" />
          CSV
        </button>
        <button
          onClick={() => { setTab('image'); setCustomers([]); setError(''); setResult(null) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'image' ? 'border-rose text-rose' : 'border-transparent text-[#4A5568] hover:text-[#1A202C]'
          }`}
        >
          <Image className="w-4 h-4 inline mr-2" />
          画像から読み取り
        </button>
      </div>

      {/* アップロードエリア */}
      {customers.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            loading ? 'border-rose/50 bg-rose/5' : 'border-[#BAE6FD] hover:border-[#0891B2] cursor-pointer'
          }`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, tab)}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-rose animate-spin" />
              <p className="text-sm font-medium text-[#1A202C]">
                {tab === 'image' ? 'AIが顧客情報を読み取っています...' : 'CSVを解析しています...'}
              </p>
            </div>
          ) : (
            <>
              {tab === 'csv' ? (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
                  <p className="text-sm text-[#1A202C] mb-1">CSVファイルをドラッグ＆ドロップ</p>
                  <p className="text-xs text-[#4A5568] mb-4">または</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0891B2] text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
                    <Upload className="w-4 h-4" />
                    ファイルを選択
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleCSVFile(f)
                      }}
                    />
                  </label>
                  <div className="mt-4 flex justify-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-[#4A5568]">
                      <input
                        type="radio"
                        checked={encoding === 'utf8'}
                        onChange={() => setEncoding('utf8')}
                        className="rounded"
                      />
                      UTF-8
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#4A5568]">
                      <input
                        type="radio"
                        checked={encoding === 'sjis'}
                        onChange={() => setEncoding('sjis')}
                        className="rounded"
                      />
                      Shift-JIS
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <Image className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
                  <p className="text-sm text-[#1A202C] mb-1">画像・PDFをドラッグ＆ドロップ</p>
                  <p className="text-xs text-[#4A5568] mb-4">JPG / PNG / PDF（ホットペッパー等の管理画面対応）</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0891B2] text-white rounded-lg text-sm font-medium cursor-pointer hover:opacity-90">
                    <Upload className="w-4 h-4" />
                    ファイルを選択
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={e => handleImageFiles(e.target.files)}
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* プレビュー */}
      {customers.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1A202C]">
              プレビュー（{customers.length}件）・編集可能
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#4A5568]">
                重複時:
                <select
                  value={duplicateAction}
                  onChange={e => setDuplicateAction(e.target.value as 'skip' | 'overwrite')}
                  className="border border-[#BAE6FD] rounded-lg px-2 py-1 text-sm"
                >
                  <option value="skip">スキップ</option>
                  <option value="overwrite">上書き</option>
                </select>
              </label>
              <button
                onClick={() => { setCustomers([]); setError(''); setResult(null) }}
                className="text-sm text-[#4A5568] hover:text-red-600"
              >
                やり直す
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto border border-[#BAE6FD] rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F0F9FF] border-b border-[#BAE6FD]">
                <tr>
                  <th className="text-left p-2">名前</th>
                  <th className="text-left p-2">電話</th>
                  <th className="text-left p-2">メール</th>
                  <th className="text-left p-2">初回来店</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={i} className="border-b border-[#BAE6FD]/50 hover:bg-white/50">
                    <td className="p-2">
                      {editingIndex === i ? (
                        <input
                          value={c.name}
                          onChange={e => updateCustomer(i, { name: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                    </td>
                    <td className="p-2">{c.phone || '—'}</td>
                    <td className="p-2">{c.email || '—'}</td>
                    <td className="p-2">{c.first_visit_date || '—'}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                        className="text-[#4A5568] hover:text-rose"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setCustomers([]); setError(''); setResult(null) }}
              className="px-4 py-2 border border-[#BAE6FD] rounded-xl text-sm text-[#4A5568] hover:bg-white"
            >
              キャンセル
            </button>
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {executing ? 'インポート中...' : 'インポート実行'}
            </button>
          </div>
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div className="p-6 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#1A202C]">インポート完了</p>
              <p className="text-sm text-[#4A5568]">
                {result.imported}件成功 · {result.skipped}件スキップ
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <p className="font-medium text-amber-800 mb-1">エラー（{result.errors.length}件）</p>
              <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 5 && <li>...他{result.errors.length - 5}件</li>}
              </ul>
            </div>
          )}
          <Link
            href="/customers"
            className="inline-block mt-4 px-4 py-2 bg-[#0891B2] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            顧客一覧へ
          </Link>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function CustomerImportPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-rose" /></div>}>
      <CustomerImportContent />
    </Suspense>
  )
}
