/** salons.owner_email の保存・照合用（大文字小文字を統一） */
export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * ILIKE で「完全一致」に近づける（% _ \ をリテラル扱い）
 * ※メールに _ が含まれる場合の誤マッチを防ぐ
 */
export function escapeForIlikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
