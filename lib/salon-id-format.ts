/** salons.id（UUID）のクエリ用バリデーション（クライアント・サーバー共通） */
const SALON_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseSalonIdQueryValue(raw: string | null | undefined): string {
  const s = (raw || '').trim()
  return SALON_UUID_RE.test(s) ? s : ''
}
