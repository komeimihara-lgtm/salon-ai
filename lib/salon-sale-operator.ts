import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export type SalonSaleRole = 'owner' | 'staff' | null

export type SalonSaleOperator = {
  salonId: string
  email: string | null
  displayName: string
  role: SalonSaleRole
}

/**
 * Cookie の salon_id と Supabase セッションから、売上取消・修正の権限を判定する。
 * - salons.owner_email と一致 → owner
 * - staff.login_email と一致 → staff.role（owner / staff）
 */
export async function getSalonSaleOperator(): Promise<SalonSaleOperator> {
  const salonId = getSalonIdFromCookie()
  const cookieStore = cookies()
  let email: string | null = null
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
