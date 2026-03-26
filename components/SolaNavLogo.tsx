import Image from 'next/image'

type Props = {
  /** sm=40px（AppShell）、md=44px（白サイドバー） */
  size?: 'sm' | 'md'
  /** 濃色サイドバー用の白ベース。白背景レイアウトでは false */
  lightBackdrop?: boolean
  className?: string
}

const dim = { sm: 40, md: 44 } as const

/**
 * favicon.png はキャンバス下半分にロゴがあり、素のままだと枠内で下に沈む。
 * 50% 上にずらして視覚的に中央付近へ寄せる。
 */
export function SolaNavLogo({ size = 'sm', lightBackdrop = true, className = '' }: Props) {
  const px = dim[size]
  const box = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11'
  const bg = lightBackdrop ? 'bg-white/95' : ''
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg ${bg} ${box} ${className}`.trim()}>
      <Image
        src="/favicon.png"
        alt="SOLA"
        width={px}
        height={px}
        className="block -translate-y-1/2"
        priority
      />
    </div>
  )
}
