'use client'

import { Info } from 'lucide-react'

/** B群（閲覧のみ可）画面の上部に出すバナー */
export default function MobileReadOnlyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2 text-xs text-amber-900">
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
      <p className="leading-relaxed">
        この画面はスマホでは<strong>閲覧のみ</strong>対応です。編集はPCまたはタブレットでお願いします。
      </p>
    </div>
  )
}
