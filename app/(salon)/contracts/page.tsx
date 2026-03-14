'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Loader2, CheckCircle, Clock } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/contracts')
      .then(r => r.json())
      .then(d => setContracts(d.contracts || []))
      .catch(() => setContracts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all'
    ? contracts
    : contracts.filter(c => c.status === filter)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
          <FileText className="w-5 h-5 text-rose" />
          契約書管理
        </h1>
        <Link
          href="/contracts/new"
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          新規契約書作成
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'draft', 'signed'] as const).map(f => (
          <button
            key={f}
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
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="block bg-white rounded-2xl p-4 card-shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
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
                <p className="text-base font-bold text-text-main ml-4">
                  ¥{c.amount.toLocaleString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
