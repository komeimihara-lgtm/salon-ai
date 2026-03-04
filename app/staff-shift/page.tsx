'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StaffShiftRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/staff')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[200px] text-text-sub">
      スタッフ管理へリダイレクト中...
    </div>
  )
}
