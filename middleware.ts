import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// salon_idのキャッシュ（メール→salon_id）※プロセス単位でキャッシュ
const salonCache = new Map<string, { id: string; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value)
          })
          res = NextResponse.next({ request: { headers: req.headers } })
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // セッション取得
  const { data: { session } } = await supabase.auth.getSession()

  // ルートアクセスは /dashboard にリダイレクト
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // 未ログインユーザーは /login にリダイレクト
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // ログイン済みユーザー: 常にsalon_idを検証・セット
  if (session?.user?.email) {
    const email = session.user.email
    const currentCookie = req.cookies.get('salon_id')?.value

    // キャッシュから取得を試みる
    const cached = salonCache.get(email)
    let correctSalonId: string | null = null

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      correctSalonId = cached.id
    } else {
      // DBから取得
      try {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: salon } = await admin
          .from('salons')
          .select('id')
          .eq('owner_email', email)
          .limit(1)
          .maybeSingle()

        if (salon?.id) {
          correctSalonId = salon.id
          salonCache.set(email, { id: salon.id, ts: Date.now() })
        }
      } catch {
        // DB接続失敗時はスキップ
      }
    }

    // cookieが間違っている or 未セットなら修正
    if (correctSalonId && currentCookie !== correctSalonId) {
      res = NextResponse.next({ request: { headers: req.headers } })
      res.cookies.set('salon_id', correctSalonId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|liff|admin|login|register|api).*)'],
}
