/**
 * モバイル対応ポリシー
 *
 * 各画面を3つに分類:
 *   A. FULL    : スマホでも完全に使える（軽量・閲覧/承認系）
 *   B. READ    : スマホでは閲覧のみ可。編集はPC推奨（バナーで案内）
 *   C. PC_ONLY : スマホでは "PCで開いてください" 画面を表示
 *
 * 判定は pathname の prefix マッチ。
 * 未分類は B (閲覧のみ) 扱い — 安全側に倒す。
 */

export type MobileSupport = 'full' | 'read' | 'pc_only'

/** A: スマホ完全対応（編集も可） */
const FULL: string[] = [
  '/dashboard',
  '/announcements',
  '/messages',
  '/reviews',
  '/daily-report',
  '/customer-delight',
  '/leo',
  '/follow',
]

/** B: スマホ閲覧のみ（編集はPC推奨） */
const READ: string[] = [
  '/reservations',
  '/sales-analysis',
  '/customers',
  '/chart',
  '/courses',
  '/subscriptions',
  '/kpi',
  '/management',
  '/qa-chat',
]

/** C: PC/タブレット専用（スマホでは案内画面のみ） */
const PC_ONLY: string[] = [
  '/sales',
  '/menu',
  '/menu-settings',
  '/products',
  '/staff',
  '/staff-shift',
  '/attendance',
  '/sns',
  '/settings',
  '/contracts',
  '/marketing',
]

/** path から所属カテゴリを判定 */
export function getMobileSupport(pathname: string): MobileSupport {
  const normalize = pathname.replace(/\/+$/, '') || '/'
  if (FULL.some((p) => normalize === p || normalize.startsWith(p + '/'))) return 'full'
  if (PC_ONLY.some((p) => normalize === p || normalize.startsWith(p + '/'))) return 'pc_only'
  if (READ.some((p) => normalize === p || normalize.startsWith(p + '/'))) return 'read'
  // 未分類は安全側で「閲覧のみ」
  return 'read'
}

/** モバイル幅判定の閾値（px） */
export const MOBILE_BREAKPOINT = 768
