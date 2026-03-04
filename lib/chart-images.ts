/**
 * カルテ画像の取得・判定
 * - ローカルキー（IndexedDB等）の場合は非同期で取得
 * - URLの場合はそのまま返す
 */

const LOCAL_PREFIX = 'local:'

export function isLocalImageKey(src: string): boolean {
  return typeof src === 'string' && src.startsWith(LOCAL_PREFIX)
}

export async function getImage(src: string): Promise<string | null> {
  if (!isLocalImageKey(src)) return src
  // TODO: IndexedDB から取得する実装
  // 現時点ではプレースホルダー
  return null
}
