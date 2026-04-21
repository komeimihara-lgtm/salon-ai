import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'

export type SalonSaleRole = 'owner' | 'staff' | null

export type SalonSaleOperator = {
  salonId: string
  email: string | null
  displayName: string
  role: SalonSaleRole
}

async function getSessionEmailFromRequest(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
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
    return session?.user?.email?.trim().toLowerCase() ?? null
  } catch {
    return null
  }
}

/**
 * Cookie / リクエストの salon_id と Supabase セッションから、売上取消・修正の権限を判定する。
 * - Route Handler では `req` を渡すこと（middleware 外でも owner メールから salon_id を解決できる）
 * - salons.owner_email と一致 → owner
 * - staff.login_email と一致 → staff.role（owner / staff）
 */
export async function getSalonSaleOperator(req?: NextRequest): Promise<SalonSaleOperator> {
  const salonId = req ? await resolveSalonIdForOwnerApi(req) : getSalonIdFromCookie()

  let email: string | null = null
  if (req) {
    email = await getSessionEmailFromRequest(req)
  } else {
    const cookieStore = cookies()
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: () => {},
          },
        }
      )
      const {
        data: { session },
      } = await supabase.auth.getSession()
      email = session?.user?.email?.trim().toLowerCase() ?? null
    } catch {
      email = null
    }
  }

  if (!salonId || !email) {
    return { salonId: salonId || '', email, displayName: '', role: null }
  }

  const admin = getSupabaseAdmin()
  const { data: salon } = await admin.from('salons').select('owner_email').eq('id', salonId).maybeSingle()
  const ownerEmail = (salon?.owner_email as string | null)?.trim().toLowerCase()
  if (ownerEmail && ownerEmail === email) {
    return { salonId, email, displayName: 'オーナー', role: 'owner' }
  }

  type StaffRow = { name?: string; role?: string; login_email?: string | null }
  let staffList: StaffRow[] = []
  const staffRes = await admin
    .from('staff')
    .select('name, role, login_email')
    .eq('salon_id', salonId)
  if (!staffRes.error && staffRes.data) {
    staffList = staffRes.data as StaffRow[]
  } else {
    const legacy = await admin.from('staff').select('name').eq('salon_id', salonId)
    if (!legacy.error && legacy.data) staffList = legacy.data as StaffRow[]
  }

  const staffRow = staffList.find(
    (s) => (s.login_email as string | null)?.trim().toLowerCase() === email
  )
  if (staffRow && (staffRow.role === 'owner' || staffRow.role === 'staff')) {
    return {
      salonId,
      email,
      displayName: (staffRow.name as string) || 'スタッフ',
      role: staffRow.role as 'owner' | 'staff',
    }
  }

  return { salonId, email, displayName: '', role: null }
}

export function canCancelSale(role: SalonSaleRole): boolean {
  return role === 'owner' || role === 'staff'
}

export function canModifySale(role: SalonSaleRole): boolean {
  return role === 'owner'
}
