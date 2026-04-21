import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const salonIdCookie = cookieStore.get('salon_id')?.value
  const allCookieNames = cookieStore.getAll().map(c => c.name)

  // Auth session確認
  let userEmail: string | null = null
  let sessionError: string | null = null
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { session }, error } = await supabase.auth.getSession()
    userEmail = session?.user?.email || null
    if (error) sessionError = error.message
  } catch (e: any) {
    sessionError = e.message
  }

  // salon_id解決
  let salonFromDb: string | null = null
  let dbError: string | null = null
  if (userEmail) {
    try {
      const admin = getSupabaseAdmin()
      const { data, error } = await admin
        .from('salons')
        .select('id, name')
        .eq('owner_email', userEmail)
        .limit(1)
        .maybeSingle()
      salonFromDb = data ? `${data.id} (${data.name})` : 'NOT FOUND'
      if (error) dbError = error.message
    } catch (e: any) {
      dbError = e.message
    }
  }

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return NextResponse.json({
    salon_id_cookie: salonIdCookie || 'NOT SET',
    all_cookie_names: allCookieNames,
    auth_user_email: userEmail || 'NOT LOGGED IN',
    auth_session_error: sessionError,
    salon_from_db: salonFromDb,
    db_error: dbError,
    /** LIFF 予約は URL クエリ salon_id（マルチテナント） */
    liff_salon_hint: 'LIFF: /liff/booking?salon_id=<salons.id>',
    has_SERVICE_ROLE_KEY: hasServiceKey,
  }, { status: 200 })
}
