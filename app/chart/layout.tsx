import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
export default function ChartLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-rose animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}
