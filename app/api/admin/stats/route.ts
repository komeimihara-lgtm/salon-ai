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
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 12ヶ月前の開始日
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // 並列で一括取得（N+1クエリを排除）
    const [
      salonsResult,
      churnResult,
      allReservationsResult,
      recentReservationsResult,
      counselingResult,
      lineMessagesResult,
      snsPostsResult,
    ] = await Promise.all([
      supabase
        .from('salons')
        .select('id, name, plan, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('salons')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('updated_at', monthStart),
      // 予約（過去12ヶ月分を一括取得）
      supabase
        .from('reservations')
        .select('salon_id, created_at, reservation_date, price')
        .gte('created_at', twelveMonthsAgo.toISOString()),
      // 直近30日の予約（カウント用）
      supabase
        .from('reservations')
        .select('salon_id')
        .gte('created_at', thirtyDaysAgo),
      // 機能エンゲージメント（直近30日、一括）
      supabase
        .from('counseling_sessions')
        .select('salon_id')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('line_messages')
        .select('salon_id')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('content_plans')
        .select('salon_id')
        .gte('created_at', thirtyDaysAgo),
    ])

    if (salonsResult.error) return NextResponse.json({ error: salonsResult.error.message }, { status: 500 })

    const allSalons = salonsResult.data || []
    const totalSalons = allSalons.length

    // プラン別分布
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

    // 今月の新規・解約
    const newThisMonth = allSalons.filter(s => s.created_at >= monthStart).length
    const churnThisMonth = churnResult.count || 0
    const churnRate = totalSalons > 0 ? Math.round((churnThisMonth / totalSalons) * 1000) / 10 : 0

    // 全予約データをメモリで集計
    const allReservations = allReservationsResult.data || []
    const recentReservations = recentReservationsResult.data || []
    const counselingSessions = counselingResult.data || []
    const lineMessages = lineMessagesResult.data || []
    const snsPosts = snsPostsResult.data || []

    // 月別予約数・売上（過去12ヶ月）
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

    const monthlyReservations = months.map(m => {
      const inMonth = allReservations.filter(r => r.created_at >= m.start && r.created_at < m.end)
      const startDate = m.start.slice(0, 10)
      const endDate = m.end.slice(0, 10)
      const revenue = allReservations
        .filter(r => r.reservation_date && r.reservation_date >= startDate && r.reservation_date < endDate)
        .reduce((sum, r) => sum + (r.price || 0), 0)
      return { month: m.month, count: inMonth.length, revenue }
    })

    // サロン別集計（ループ内DBクエリなし）
    const recentBySalon = new Map<string, number>()
    for (const r of recentReservations) {
      recentBySalon.set(r.salon_id, (recentBySalon.get(r.salon_id) || 0) + 1)
    }

    const totalBySalon = new Map<string, number>()
    for (const r of allReservations) {
      totalBySalon.set(r.salon_id, (totalBySalon.get(r.salon_id) || 0) + 1)
    }

    const counselingBySalon = new Map<string, number>()
    for (const r of counselingSessions) {
      counselingBySalon.set(r.salon_id, (counselingBySalon.get(r.salon_id) || 0) + 1)
    }

    const lineBySalon = new Map<string, number>()
    for (const r of lineMessages) {
      lineBySalon.set(r.salon_id, (lineBySalon.get(r.salon_id) || 0) + 1)
    }

    const snsBySalon = new Map<string, number>()
    for (const r of snsPosts) {
      snsBySalon.set(r.salon_id, (snsBySalon.get(r.salon_id) || 0) + 1)
    }

    // 月別売上ヘルパー（過去6ヶ月分）
    const salonMonths: { month: string; start: string; end: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      salonMonths.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d.toISOString().slice(0, 10),
        end: nextD.toISOString().slice(0, 10),
      })
    }

    const salonDetails = allSalons.map(salon => {
      const reservationCount = totalBySalon.get(salon.id) || 0
      const recentRes = recentBySalon.get(salon.id) || 0
      const counselingCount = counselingBySalon.get(salon.id) || 0
      const lineMessageCount = lineBySalon.get(salon.id) || 0
      const snsPostCount = snsBySalon.get(salon.id) || 0

      const isActive = recentRes > 0
      const engagementScore = counselingCount + lineMessageCount + snsPostCount + recentRes

      const daysSinceCreation = Math.floor((now.getTime() - new Date(salon.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const riskReasons: string[] = []
      if (recentRes === 0) riskReasons.push('30日間予約なし')
      if (engagementScore <= 1) riskReasons.push('機能をほぼ未使用')
      if (daysSinceCreation >= 90 && !isActive) riskReasons.push('契約90日超で非アクティブ')
      const isChurnRisk = riskReasons.length >= 2

      // サロン別月別売上（メモリ集計）
      const salonReservations = allReservations.filter(r => r.salon_id === salon.id)
      const monthly_revenue = salonMonths.map(m => {
        const revenue = salonReservations
          .filter(r => r.reservation_date && r.reservation_date >= m.start && r.reservation_date < m.end)
          .reduce((sum, r) => sum + (r.price || 0), 0)
        return { month: m.month, revenue }
      })

      return {
        id: salon.id,
        name: salon.name,
        plan: normalizePlan(salon.plan),
        created_at: salon.created_at,
        last_activity: salon.updated_at,
        reservation_count: reservationCount,
        recent_reservations: recentRes,
        is_active: isActive,
        engagement: {
          counseling: counselingCount,
          line_messages: lineMessageCount,
          sns_posts: snsPostCount,
          reservations: recentRes,
          score: engagementScore,
        },
        is_churn_risk: isChurnRisk,
        risk_reasons: riskReasons,
        days_since_creation: daysSinceCreation,
        mrr_contribution: PLAN_PRICES[normalizePlan(salon.plan)] || 0,
        monthly_revenue,
      }
    })

    const engagementRanking = [...salonDetails]
      .sort((a, b) => b.engagement.score - a.engagement.score)
      .slice(0, 20)

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
    console.error('Admin stats error:', e)
    return NextResponse.json({ error: '統計取得失敗' }, { status: 500 })
  }
}
