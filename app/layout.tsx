import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: 'SOLA AI SALON MANAGER — by LENARD Corporation',
  description: 'サロン経営参謀AI',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  )
}
