import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'
export const metadata: Metadata = {
  title: 'SOLA AI SALON MANAGER — by LENARD Corporation',
  description: 'サロン経営参謀AI',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
