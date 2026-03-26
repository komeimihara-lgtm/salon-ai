import Image from 'next/image'

type Props = {
  /** sm=40px（AppShell）、md=44px（白サイドバー） */
  size?: 'sm' | 'md'
  /** 濃色サイドバー用の白ベース。白背景レイアウトでは false */
  lightBackdrop?: boolean
  className?: string
}

const dim = { sm: 40, md: 44 } as const
const imgPx = { sm: 32, md: 36 } as const

/**
 * favicon.png 全体を枠内に収め、flex で幾何学的に中央配置。
 * cover/scale によるクリップずれを避ける。
 */
export function SolaNavLogo({ size = 'sm', lightBackdrop = true, className = '' }: Props) {
  const box = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11'
  const bg = lightBackdrop ? 'bg-white/95' : ''
  const ip = imgPx[size]
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${bg} ${box} ${className}`.trim()}
    >
      <Image
        src="/favicon.png"
        alt="SOLA"
        width={ip}
        height={ip}
        className="object-contain"
        priority
      />
    </div>
  )
}
