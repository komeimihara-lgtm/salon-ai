import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

    // プラン別分布（小文字→大文字に正規化）
    const normalizePlan = (p: string | null) => (p || 'LITE').toUpperCase()
    const planDistribution = Object.entries(
      allSalons.reduce<Record<string, number>>((acc, s) => {
        const plan = normalizePlan(s.plan)
        acc[plan] = (acc[plan] || 0) + 1
        return acc
      }, {})
    ).map(([plan, count]) => ({ plan, count, ratio: totalSalons > 0 ? Math.round((count / totalSalons) * 100) : 0 }))

    // MRR / ARR
    const mrr = allSalons.reduce((sum, s) => sum + (PLAN_PRICES[normalizePlan(s.plan)] || 0), 0)
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

      const { data: revData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', m.start.slice(0, 10))
        .lt('reservation_date', m.end.slice(0, 10))

      const revenue = (revData || []).reduce((sum, r) => sum + (r.price || 0), 0)
      monthlyReservations.push({ month: m.month, count: count || 0, revenue })
    }

    // サロン別の予約数・アクティブ状態・機能エンゲージメント
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const salonDetails = []

    for (const salon of allSalons) {
      // 予約数（全期間・直近30日）
      const { count: reservationCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)

      const { count: recentReservations } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('created_at', thirtyDaysAgo)

      // 機能エンゲージメント（直近30日）
      const { count: counselingCount } = await supabase
        .from('counseling_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('created_at', thirtyDaysAgo)

      const { count: lineMessageCount } = await supabase
        .from('line_messages')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('created_at', thirtyDaysAgo)

      const { count: snsPostCount } = await supabase
        .from('content_plans')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .gte('created_at', thirtyDaysAgo)

      const isActive = (recentReservations || 0) > 0
      const engagementScore = (counselingCount || 0) + (lineMessageCount || 0) + (snsPostCount || 0) + (recentReservations || 0)

      // 解約リスク判定（理由付き）
      const daysSinceCreation = Math.floor((now.getTime() - new Date(salon.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const riskReasons: string[] = []
      if ((recentReservations || 0) === 0) riskReasons.push('30日間予約なし')
      if (engagementScore <= 1) riskReasons.push('機能をほぼ未使用')
      if (daysSinceCreation >= 90 && !isActive) riskReasons.push('契約90日超で非アクティブ')
      const isChurnRisk = riskReasons.length >= 2

      // 月別売上（導入後6ヶ月分）
      const salonMonthlyRevenue = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const { data: revData } = await supabase
          .from('reservations')
          .select('price')
          .eq('salon_id', salon.id)
          .gte('reservation_date', d.toISOString().slice(0, 10))
          .lt('reservation_date', nextD.toISOString().slice(0, 10))

        const revenue = (revData || []).reduce((sum, r) => sum + (r.price || 0), 0)
        salonMonthlyRevenue.push({
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          revenue,
        })
      }

      salonDetails.push({
        id: salon.id,
        name: salon.name,
        plan: normalizePlan(salon.plan),
        created_at: salon.created_at,
        last_activity: salon.updated_at,
        reservation_count: reservationCount || 0,
        recent_reservations: recentReservations || 0,
        is_active: isActive,
        // 機能エンゲージメント
        engagement: {
          counseling: counselingCount || 0,
          line_messages: lineMessageCount || 0,
          sns_posts: snsPostCount || 0,
          reservations: recentReservations || 0,
          score: engagementScore,
        },
        // 解約リスク
        is_churn_risk: isChurnRisk,
        risk_reasons: riskReasons,
        days_since_creation: daysSinceCreation,
        mrr_contribution: PLAN_PRICES[normalizePlan(salon.plan)] || 0,
        // 月別売上
        monthly_revenue: salonMonthlyRevenue,
      })
    }

    // エンゲージメントランキング（スコア降順）
    const engagementRanking = [...salonDetails]
      .sort((a, b) => b.engagement.score - a.engagement.score)
      .slice(0, 20)

    // 解約リスクサロン
    const churnRiskSalons = salonDetails.filter(s => s.is_churn_risk)

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
      engagementRanking,
      churnRiskSalons,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '統計取得失敗' }, { status: 500 })
  }
}
