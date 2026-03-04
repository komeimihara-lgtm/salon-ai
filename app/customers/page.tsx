'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Search, Plus, Upload, ChevronLeft, ChevronRight,
  AlertTriangle, Crown, Star, Phone, Mail, Calendar,
  TrendingUp, X, Check, Loader2
} from 'lucide-react'
import { Customer } from '@/types'

// ステータスバッジ
function StatusBadge({ status }: { status: Customer['status'] }) {
  const map = {
    active: { label: 'アクティブ', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    lost: { label: '失客', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    vip: { label: 'VIP', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  }
  const { label, color } = map[status]
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {status === 'vip' && <Crown className="w-3 h-3 inline mr-1" />}
      {status === 'lost' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
      {label}
    </span>
  )
}

// 顧客カード
function CustomerCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const daysSinceVisit = customer.last_visit_date
    ? Math.floor((Date.now() - new Date(customer.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      onClick={onClick}
      className="bg-white hover:bg-[#F8F5FF] border border-[#E8E0F0] hover:border-[#9B8EC4]/50 rounded-xl p-4 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#2C2C2C] group-hover:text-[#C4728A] transition-colors">
              {customer.name}
            </h3>
            {customer.name_kana && (
              <span className="text-xs text-[#6B7280]">{customer.name_kana}</span>
            )}
          </div>
          {customer.phone && (
            <div className="flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-[#6B7280]" />
              <span className="text-xs text-[#6B7280]">{customer.phone}</span>
            </div>
          )}
        </div>
        <StatusBadge status={customer.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#E8E0F0]">
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">来店回数</p>
          <p className="text-sm font-bold text-[#2C2C2C]">{customer.visit_count}回</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">客単価</p>
          <p className="text-sm font-bold text-[#2C2C2C]">
            ¥{customer.avg_unit_price.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#6B7280]">最終来店</p>
          <p className={`text-sm font-bold ${
            daysSinceVisit && daysSinceVisit > 90 ? 'text-red-400' :
            daysSinceVisit && daysSinceVisit > 60 ? 'text-amber-600' : 'text-[#2C2C2C]'
          }`}>
            {daysSinceVisit !== null ? `${daysSinceVisit}日前` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// 新規顧客モーダル
function NewCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', name_kana: '', phone: '', email: '',
    birthday: '', gender: 'female', memo: '',
    first_visit_date: '', last_visit_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.name.trim()) { setError('氏名は必須です'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E0F0] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[#E8E0F0]">
          <h2 className="text-base font-bold text-[#2C2C2C]">新規顧客登録</h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">氏名 *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
                placeholder="山田 花子"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">フリガナ</label>
              <input
                value={form.name_kana}
                onChange={e => setForm(p => ({ ...p, name_kana: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
                placeholder="ヤマダ ハナコ"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">電話番号</label>
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
                placeholder="090-0000-0000"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">性別</label>
              <select
                value={form.gender}
                onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
                <option value="other">その他</option>
                <option value="unknown">不明</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">メールアドレス</label>
            <input
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
              placeholder="example@email.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">初回来店日</label>
              <input
                type="date"
                value={form.first_visit_date}
                onChange={e => setForm(p => ({ ...p, first_visit_date: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">最終来店日</label>
              <input
                type="date"
                value={form.last_visit_date}
                onChange={e => setForm(p => ({ ...p, last_visit_date: e.target.value }))}
                className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">メモ</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={3}
              className="w-full bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg px-3 py-2 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4] resize-none"
              placeholder="肌タイプ、アレルギー、特記事項など"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#E8E0F0]">
          <button
            onClick={onClose}
            className="flex-1 bg-[#F8F5FF] border border-[#E8E0F0] text-[#6B7280] rounded-xl py-2.5 text-sm hover:text-[#2C2C2C] transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? '保存中...' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// CSVインポートモーダル
function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; message: string } | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setError('')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setError('データが空です'); return }

      // CSVパース（ヘッダー行 + データ行）
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
      })

      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult(data)
      onImported(data.imported)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E0F0] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#E8E0F0]">
          <h2 className="text-base font-bold text-[#2C2C2C]">ペンギン CSVインポート</h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  ペンギン（サロンズソリューション）から書き出したCSVファイルを選択してください。
                  氏名・電話番号・来店回数などが自動でマッピングされます。
                </p>
              </div>
              <div
                className="border-2 border-dashed border-[#E8E0F0] rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
                onClick={() => document.getElementById('csv-input')?.click()}
              >
                <Upload className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                {file ? (
                  <p className="text-sm text-amber-400 font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-[#6B7280]">CSVファイルを選択</p>
                )}
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-[#2C2C2C] mb-1">{result.imported}件 インポート完了</p>
              <p className="text-sm text-[#6B7280]">{result.message}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-[#E8E0F0]">
          <button
            onClick={onClose}
            className="flex-1 bg-[#F8F5FF] border border-[#E8E0F0] text-[#6B7280] rounded-xl py-2.5 text-sm hover:text-[#2C2C2C] transition-colors"
          >
            {result ? '閉じる' : 'キャンセル'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'インポート中...' : 'インポート開始'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      })
      const res = await fetch(`/api/customers/list?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const totalPages = Math.ceil(total / 20)
  const lostCount = customers.filter(c => c.status === 'lost').length
  const vipCount = customers.filter(c => c.status === 'vip').length

  return (
    <div className="min-h-screen bg-[#F8F5FF]">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[#E8E0F0] px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[#6B7280] hover:text-[#2C2C2C] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h1 className="text-base font-bold text-[#2C2C2C]">顧客管理</h1>
            </div>
            <span className="text-xs text-[#6B7280] bg-[#F8F5FF] rounded-full px-2 py-0.5">
              {total.toLocaleString()}名
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 bg-[#F8F5FF] border border-[#E8E0F0] hover:border-[#9B8EC4] text-[#2C2C2C] hover:text-[#2C2C2C] rounded-lg px-3 py-1.5 text-xs transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              CSVインポート
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              新規登録
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* アラートバー */}
        {lostCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-300">
                <span className="font-bold">失客アラート：</span>
                {lostCount}名が3ヶ月以上未来店です
              </p>
            </div>
            <Link href="/leo" className="text-xs text-red-400 hover:text-red-300 font-semibold underline">
              AI経営会議に対策を相談 →
            </Link>
          </div>
        )}

        {/* 検索・フィルター */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="氏名・フリガナ・電話番号で検索..."
              className="w-full bg-white border border-[#E8E0F0] focus:border-[#9B8EC4] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#2C2C2C] placeholder-[#6B7280] focus:outline-none transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-white border border-[#E8E0F0] rounded-xl px-3 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:border-[#9B8EC4]"
          >
            <option value="">全員</option>
            <option value="active">アクティブ</option>
            <option value="lost">失客</option>
            <option value="vip">VIP</option>
          </select>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '総顧客数', value: total, icon: Users, color: 'text-blue-400' },
            { label: '失客', value: lostCount, icon: AlertTriangle, color: 'text-red-400' },
            { label: 'VIP', value: vipCount, icon: Crown, color: 'text-amber-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-[#E8E0F0] rounded-xl p-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xs text-[#6B7280]">{label}</p>
                <p className="text-lg font-bold text-[#2C2C2C]">{value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 顧客一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-[#6B7280] mx-auto mb-3" />
            <p className="text-[#6B7280] mb-2">
              {search || statusFilter ? '検索結果が見つかりません' : '顧客データがありません'}
            </p>
            {!search && !statusFilter && (
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  CSVでインポートする
                </button>
                <span className="text-[#6B7280]">or</span>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="text-sm text-amber-400 hover:text-amber-300 underline"
                >
                  手動で登録する
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customers.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => setSelectedCustomer(customer)}
              />
            ))}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg bg-white border border-[#E8E0F0] flex items-center justify-center disabled:opacity-30 hover:border-amber-500/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#6B7280]" />
            </button>
            <span className="text-sm text-[#6B7280]">
              {page} / {totalPages}ページ
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-[#E8E0F0] flex items-center justify-center disabled:opacity-30 hover:border-amber-500/50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        )}
      </main>

      {/* モーダル */}
      {showNewModal && (
        <NewCustomerModal
          onClose={() => setShowNewModal(false)}
          onSaved={fetchCustomers}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchCustomers()}
        />
      )}
    </div>
  )
}
