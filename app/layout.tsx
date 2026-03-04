import type { Metadata } from 'next'
import { Noto_Sans_JP, Noto_Serif_JP } from 'next/font/google'
import AppLayout from '@/components/layout/AppLayout'
import './globals.css'

const notoSans = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans' })
const notoSerif = Noto_Serif_JP({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-noto-serif' })

export const metadata: Metadata = {
  title: 'SOLA AI SALON MANAGER — by LENARD Corporation',
  description: 'サロン経営参謀AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSans.variable} ${notoSerif.variable}`}>
      <body className="font-sans antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
