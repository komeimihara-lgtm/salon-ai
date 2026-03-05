import AppShell from '@/components/AppShell'

/** サロン管理画面用レイアウト（サイドバー付き） */
export default function SalonLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
