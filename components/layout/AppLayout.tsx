'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

const STANDALONE_PATHS = ['/counseling']

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandalone = STANDALONE_PATHS.some((p) => pathname?.startsWith(p))

  if (isStandalone) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-[#FDFAF7]">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
