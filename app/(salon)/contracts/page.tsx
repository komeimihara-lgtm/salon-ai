'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, FileText, Loader2, CheckCircle, Clock } from 'lucide-react'
import { ContractDraftEditModal } from '@/components/contracts/ContractDraftEditModal'

interface Contract {
  id: string
  course_name: string
  amount: number
  status: string
  created_at: string
  signed_at: string | null
  customers: { name: string; phone: string | null } | null
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'signed' | 'draft'>('all')
  const [canManageContracts, setCanManageContracts] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadContracts = useCallback(async () => {
    const r = await fetch('/api/contracts', { credentials: 'include' })
    const d = await r.json()
    setContracts(d.contracts || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/contracts', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/contracts/permissions', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([contractsRes, permRes]) => {
        if (cancelled) return
        setContracts(contractsRes.contracts || [])
        setCanManageContracts(Boolean(permRes.canManageContracts))
      })
      .catch(() => {
        if (!cancelled) setContracts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.status === filter)

  const handleDelete = async (c: Contract) => {
    if (
      !window.confirm('この契約書を削除しますか？この操作は取り消せません')
    ) {
      return
    }
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(c.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : '削除に失敗しました')
        return
      }
      await loadContracts()
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
          <FileText className="w-5 h-5 text-rose" />
          契約書管理
        </h1>
        {canManageContracts && (
          <Link
            href="/contracts/new"
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            新規契約書作成
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'draft', 'signed'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === f ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'すべて' : f === 'signed' ? '署名済み' : '未署名'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-sub">契約書がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-4 card-shadow hover:shadow-md transition-shadow flex gap-3 items-stretch"
            >
              <Link
                href={`/contracts/${c.id}`}
                className="flex-1 min-w-0 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-bold text-text-main truncate">
                      {c.customers?.name || '—'} 様
                    </p>
                    {c.status === 'signed' ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> 署名済み
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" /> 未署名
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-sub">{c.course_name}</p>
                  <p className="text-xs text-text-sub mt-1">
                    {new Date(c.created_at).toLocaleDateString('ja-JP')}
                    {c.signed_at && ` / 署名日: ${new Date(c.signed_at).toLocaleDateString('ja-JP')}`}
                  </p>
                </div>
                <p className="text-base font-bold text-text-main shrink-0">¥{c.amount.toLocaleString()}</p>
              </Link>

              {canManageContracts && (
                <div className="flex flex-col justify-center gap-1.5 shrink-0 border-l border-gray-100 pl-3">
                  {c.status === 'signed' ? (
                    <p className="text-[10px] text-text-sub leading-tight max-w-[7rem] text-right">
                      署名済みのため編集不可
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditId(c.id)}
                      className="text-xs font-medium text-rose hover:underline text-left whitespace-nowrap"
                    >
                      ✏️ 編集
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={deletingId === c.id}
                    onClick={() => handleDelete(c)}
                    className="text-xs font-medium text-red-600 hover:underline text-left whitespace-nowrap disabled:opacity-50"
                  >
                    {deletingId === c.id ? '削除中...' : '🗑️ 削除'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ContractDraftEditModal
        contractId={editId}
        open={Boolean(editId)}
        onClose={() => setEditId(null)}
        onSaved={() => void loadContracts()}
      />
    </div>
  )
}
