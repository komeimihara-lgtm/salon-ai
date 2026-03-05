import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: 'date が必要です' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
    }

    const supabase = getSupabaseAdmin()

    const { data: sales } = await supabase
      .from('sales')
      .select('amount, sale_type')
      .eq('salon_id', DEMO_SALON_ID)
      .eq('sale_date', date)

    let cashSales = 0
    let consumeSales = 0
    let productSales = 0
    for (const s of sales || []) {
      const amt = Number(s.amount ?? 0)
      const st = (s.sale_type as string) || 'cash'
      if (st === 'ticket_consume' || st === 'subscription_consume') {
        consumeSales += amt
      } else if (st === 'product') {
        productSales += amt
      } else {
        cashSales += amt
      }
    }

    const { data: tickets } = await supabase
      .from('customer_tickets')
      .select('remaining_sessions, unit_price')
      .eq('salon_id', DEMO_SALON_ID)

    let serviceLiability = 0
    for (const t of tickets || []) {
      const r = Number(t.remaining_sessions ?? 0)
      const u = Number(t.unit_price ?? 0)
      if (r > 0 && u > 0) serviceLiability += r * u
    }

    const visitors = (sales || []).length
    const unitPrice = visitors > 0 ? Math.round(consumeSales / visitors) : 0

    const { count: newVisitors } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', DEMO_SALON_ID)
      .eq('first_visit_date', date)

    const { count: newReservations } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', DEMO_SALON_ID)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59.999`)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('salon_id', DEMO_SALON_ID)
      .eq('reservation_date', date)

    const totalReservations = (reservations || []).length
    const completedReservations = (reservations || []).filter((r: { status: string }) => r.status === 'completed').length

    const totalSales = cashSales + consumeSales + productSales
    const targets = body.targets || {}
    const dailyTarget = Number(targets.dailyTarget) || 0
    const achievementRate = dailyTarget > 0 ? Math.round((totalSales / dailyTarget) * 100) : 0

    const kpiData = {
      date,
      cashSales,
      consumeSales,
      productSales,
      totalSales,
      serviceLiability,
      visitors,
      unitPrice,
      newVisitors: newVisitors ?? 0,
      newReservations: newReservations ?? 0,
      totalReservations,
      completedReservations,
      taskCompletionRate: totalReservations > 0 ? Math.round((completedReservations / totalReservations) * 100) : 0,
      targets: {
        dailyTarget,
        visits: targets.visits ?? 0,
        avgPrice: targets.avgPrice ?? 0,
        productSales: targets.productSales ?? 0,
        newCustomers: targets.newCustomers ?? 0,
        newReservations: targets.newReservations ?? 0,
      },
      achievementRate,
    }

    const systemPrompt = `あなたはサロン経営の専門コンサルタントです。当日のデータを分析し、日報用のアドバイスを生成してください。
出力は以下の4セクションに分けて、箇条書きで簡潔に記載してください。温かみのある文体で、スタッフのモチベーションを上げる表現を使ってください。

1. 本日の数字まとめ（目標の何%達成かを必ず含める。例：日割り目標の85%達成）
2. 素晴らしかった点（具体的に褒める）
3. 改善点と明日へのアクション
4. 一言メッセージ（モチベーションアップ）`

    const userContent = `以下の${date}の経営データを分析し、日報用のアドバイスを生成してください。目標対比・達成率を評価コメントに反映してください。\n\n${JSON.stringify(kpiData, null, 2)}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式')
    }

    return NextResponse.json({ advice: content.text, kpiData })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
