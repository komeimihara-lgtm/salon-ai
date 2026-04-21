import Image from 'next/image'

type Props = {
  /** sm=40px（AppShell）、md=44px（白サイドバー） */
  size?: 'sm' | 'md'
  /** 濃色サイドバー用の白ベース。白背景レイアウトでは false */
  lightBackdrop?: boolean
  className?: string
}

const imgPx = { sm: 40, md: 44 } as const

/** アセット（public/favicon.png）を枠いっぱいに表示。余計な縮小・クロップはしない */
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
        className="h-full w-full object-contain object-center"
        priority
      />
    </div>
  )
}
