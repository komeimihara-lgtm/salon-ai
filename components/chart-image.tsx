'use client'

import { useState, useEffect, useRef } from 'react'
import { getImage, isLocalImageKey } from '@/lib/chart-images'

interface ChartImageProps {
  src: string
  alt?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

/**
 * カルテ写真表示コンポーネント
 * - ローカルキー（IndexedDB）の場合は非同期で取得して表示
 * - URLの場合はそのまま表示
 */
export function ChartImage({ src, alt = '', className, onClick }: ChartImageProps) {
  const [resolved, setResolved] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!src) return
    if (isLocalImageKey(src)) {
      setLoading(true)
      getImage(src)
        .then((url) => {
          objectUrlRef.current = url
          setResolved(url)
        })
        .catch(() => setResolved(null))
        .finally(() => setLoading(false))
    } else {
      setResolved(src)
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [src])

  if (loading) {
    return (
      <div className={`bg-gray-100 animate-pulse flex items-center justify-center ${className || ''}`}>
        <span className="text-xs text-gray-400">読込中</span>
      </div>
    )
  }
  if (!resolved) return null
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onClick={onClick}
    />
  )
}
