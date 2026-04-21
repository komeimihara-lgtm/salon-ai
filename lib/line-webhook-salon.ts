import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase'

type AdminClient = ReturnType<typeof getSupabaseAdmin>

export function verifyLineSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

export type SalonLineRow = {
  id: string
  line_channel_access_token: string | null
  line_channel_secret: string | null
  name: string | null
}

/**
 * Webhook の署名が一致するサロンを検索（Cookie に依存しない）
 */
export async function resolveSalonByLineSignature(
  supabase: AdminClient,
  rawBody: string,
  signature: string
): Promise<SalonLineRow | null> {
  const { data: salons } = await supabase
    .from('salons')
    .select('id, line_channel_access_token, line_channel_secret, name')
    .not('line_channel_secret', 'is', null)

  for (const s of salons || []) {
    const secret = s.line_channel_secret
    if (!secret) continue
    if (verifyLineSignature(rawBody, signature, secret)) {
      return s as SalonLineRow
    }
  }
  return null
}
