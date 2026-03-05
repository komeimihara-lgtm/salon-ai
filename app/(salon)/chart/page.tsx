'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, User, Search } from 'lucide-react'

function ChartRedirectContent() {
  const searchParams = useSearchParams()
  const nameParam = searchParams.get('name')
  const [name, setName] = useState(nameParam || '')
  const [searchName, setSearchName] = useState(nameParam || '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'multiple' | 'none'>(nameParam ? 'loading' : 'idle')
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (nameParam?.trim()) {
      setSearchName(nameParam)
      setName(nameParam)
    }
  }, [nameParam])
  useEffect(() => {
    if (!searchName?.trim()) {
      if (nameParam) setStatus('none')
      return
    }
    fetch(`/api/customers/find?name=${encodeURIComponent(searchName.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        const list = data.customers || []
        if (list.length === 0) setStatus('none')
        else if (list.length === 1) {
          setStatus('found')
          window.location.href = `/chart/${list[0].id}`
        } else {
          setCustomers(list)
          setStatus('multiple')
        }
      })
      .catch(() => setStatus('none'))
  }, [searchName, nameParam])
  const doSearch = () => {
    setSearchName(name)
    setStatus('loading')
  }
  if (status === 'idle') {
    return (
      <div className="max-w-md mx-auto py-12">
        <h2 className="font-semibold text-text-main mb-4">カルテを開く</h2>
        <p className="text-sm text-text-sub mb-4">
          顧客管理・予約表・来店客一覧で名前をタップするか、下で顧客名を検索してください
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="顧客名で検索"
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200"
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          />
          <button
            onClick={doSearch}
            className="px-4 py-2 rounded-xl bg-rose text-white font-medium flex items-center gap-2"
          >
            <Search className="w-4 h-4" /> 検索
          </button>
        </div>
        <Link href="/customers" className="block mt-6 text-rose font-medium hover:underline">
          顧客一覧へ
        </Link>
      </div>
    )
  }
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-rose animate-spin mb-4" />
        <p className="text-text-sub">顧客を検索中...</p>
      </div>
    )
  }
  if (status === 'none') {
    return (
      <div className="text-center py-16">
        <p className="text-text-sub mb-4">「{searchName}」に該当する顧客が見つかりませんでした</p>
        <Link href="/customers" className="text-rose font-medium hover:underline">
          顧客一覧で検索
        </Link>
      </div>
    )
  }
  if (status === 'multiple') {
    return (
      <div className="max-w-md mx-auto py-12">
        <h2 className="font-semibold text-text-main mb-4">該当する顧客が複数います</h2>
        <div className="space-y-2">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/chart/${c.id}`}
              className="flex items-center gap-3 p-4 rounded-xl bg-white border hover:border-rose/50"
            >
              <User className="w-5 h-5 text-rose" />
              <span className="font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function ChartPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>}>
      <ChartRedirectContent />
    </Suspense>
  )
}
