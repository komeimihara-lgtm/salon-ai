import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const PLAN_PRICES: Record<string, number> = {
  LITE: 29800,
  PRO: 68000,
  MAX: 98000,
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    // 全サロン取得
    const { data: salons, error: salonsError } = await supabase
      .from('salons')
      .select('id, name, plan, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (salonsError) return NextResponse.json({ error: salonsError.message }, { status: 500 })

    const allSalons = salons || []
    const totalSalons = allSalons.length

    // プラン別分布
    const planDistribution = Object.entries(
      allSalons.reduce<Record<string, number>>((acc, s) => {
        const plan = s.plan || 'LITE'
        acc[plan] = (acc[plan] || 0) + 1
        return acc
      }, {})
    ).map(([plan, count]) => ({ plan, count, ratio: totalSalons > 0 ? Math.round((count / totalSalons) * 100) : 0 }))

    // MRR / ARR
    const mrr = allSalons.reduce((sum, s) => sum + (PLAN_PRICES[s.plan || 'LITE'] || 0), 0)
    const arr = mrr * 12

    // 今月の新規契約数・解約数
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const newThisMonth = allSalons.filter(s => s.created_at >= monthStart).length

    // 解約はstatus='cancelled'があれば使う。なければ0とする
    const { count: churnCount } = await supabase
      .from('salons')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', monthStart)

    const churnThisMonth = churnCount || 0
    const churnRate = totalSalons > 0 ? Math.round((churnThisMonth / totalSalons) * 1000) / 10 : 0

    // 月別予約数（過去12ヶ月）
    const months: { month: string; start: string; end: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      months.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d.toISOString(),
        end: nextD.toISOString(),
      })
    }

    const monthlyReservations = []
    for (const m of months) {
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', m.start)
        .lt('created_at', m.end)

      monthlyReservations.push({ month: m.month, count: count || 0 })
    }

    // サロン別の予約数・アクティブ状態
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const salonDetails = []

    for (const salon of allSalons) {
      const { count: reservationCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)

      const { count: recentCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('created_at', thirtyDaysAgo)

      salonDetails.push({
        id: salon.id,
        name: salon.name,
        plan: salon.plan || 'LITE',
        created_at: salon.created_at,
        last_activity: salon.updated_at,
        reservation_count: reservationCount || 0,
        is_active: (recentCount || 0) > 0,
      })
    }

    return NextResponse.json({
      totalSalons,
      mrr,
      arr,
      newThisMonth,
      churnThisMonth,
      churnRate,
      planDistribution,
      monthlyReservations,
      salons: salonDetails,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '統計取得失敗' }, { status: 500 })
  }
}
