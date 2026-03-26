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
 * favicon.png は上に余白・ロゴはやや下寄り。
 * translate だけだと -50% で上が欠け下半分が背景色だけになるため、
 * 軽く拡大して object-position でロゴを枠の中央付近に収める。
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
        fill
        sizes={`${px}px`}
        className="object-cover scale-[1.28] object-[50%_72%]"
        priority
      />
    </div>
  )
}
