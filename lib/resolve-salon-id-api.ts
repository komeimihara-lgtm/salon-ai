import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'
import { getSupabaseAdmin } from '@/lib/supabase'
import { escapeForIlikeExact, normalizeOwnerEmail } from '@/lib/normalize-owner-email'

/**
 * オーナー向け API 用: ログイン中ユーザーのメール → salons.id（middleware と同じロジック）
 * /api は middleware の対象外のため salon_id Cookie が無い・古い場合でも契約取得できるようにする。
 */
export async function resolveSalonIdForOwnerApi(req: NextRequest): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return getSalonIdFromApiRequest(req)

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll() {
        /* 読み取り専用 */
      },
    },
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const email = session?.user?.email
  if (!email) {
    return getSalonIdFromApiRequest(req)
  }

  try {
    const admin = getSupabaseAdmin()
    const normalized = normalizeOwnerEmail(email)
    let { data: salon } = await admin
      .from('salons')
      .select('id')
      .eq('owner_email', normalized)
      .limit(1)
      .maybeSingle()

    if (!salon?.id) {
      const { data: legacy } = await admin
        .from('salons')
        .select('id')
        .ilike('owner_email', escapeForIlikeExact(normalized))
        .limit(1)
        .maybeSingle()
      salon = legacy
    }

    if (salon?.id) return String(salon.id).trim()
  } catch {
    /* fall through */
  }

  return getSalonIdFromApiRequest(req)
}
