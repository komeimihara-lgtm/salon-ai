'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

function ChartRedirectContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const name = searchParams.get('name')

  useEffect(() => {
    if (!name?.trim()) {
      router.replace('/customers')
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch(`/api/customers/find?name=${encodeURIComponent(name.trim())}`)
        const data = await res.json()
        const customers = data.customers || []
        if (cancelled) return
        if (customers.length > 0) {
          router.replace(`/chart/${customers[0].id}`)
        }
      } catch {
        if (!cancelled) router.replace('/customers')
      }
    }
    run()
    return () => { cancelled = true }
  }, [name, router])

  if (!name?.trim()) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-rose animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="w-8 h-8 text-rose animate-spin" />
      <p className="text-sm text-text-sub">顧客を検索しています...</p>
      <Link href="/customers" className="text-rose hover:underline text-sm">
        顧客一覧に戻る
      </Link>
    </div>
  )
}

export default function ChartRedirectPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>}>
      <ChartRedirectContent />
    </Suspense>
  )
}
