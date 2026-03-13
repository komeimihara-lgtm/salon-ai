import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // ログイン済みユーザー: salon_id cookieが未セットなら自動セット
  if (session?.user?.email && !req.cookies.get('salon_id')?.value) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: salon } = await admin
        .from('salons')
        .select('id')
        .eq('owner_email', session.user.email)
        .limit(1)
        .maybeSingle()

      if (salon?.id) {
        // レスポンスを作り直してcookieをセット
        res = NextResponse.next({ request: { headers: req.headers } })
        res.cookies.set('salon_id', salon.id, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
      }
    } catch {
      // salon_id取得失敗時はスキップ
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|liff|admin|login|register|api).*)'],
}
