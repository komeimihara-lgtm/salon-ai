import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// キャッシュ（サーバーメモリ、デプロイまでの間保持）
let cachedProposals: unknown = null
let cacheDate: string = ''

export async function POST(req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // 同じ日のキャッシュがあれば返す
    if (cachedProposals && cacheDate === today) {
      return NextResponse.json({ proposals: cachedProposals })
    }

    const supabase = getSupabaseAdmin()

    // 今日〜3日以内の予約を取得
    const in3days = new Date()
    in3days.setDate(in3days.getDate() + 3)
    const in3daysStr = in3days.toISOString().slice(0, 10)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('customer_id, customer_name, reservation_date, menu, start_time')
      .eq('salon_id', DEMO_SALON_ID)
      .eq('status', 'confirmed')
      .gte('reservation_date', today)
      .lte('reservation_date', in3daysStr)
      .order('reservation_date', { ascending: true })
      .limit(20)

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ proposals: [], message: '今後3日以内の予約がありません' })
    }

    // 顧客詳細を取得
    const customerIds = reservations
      .filter(r => r.customer_id)
      .map(r => r.customer_id)

    const { data: customers } = customerIds.length > 0
      ? await supabase
          .from('customers')
          .select('id, name, visit_count, last_visit_date, birthday, memo, concerns')
          .in('id', customerIds)
      : { data: [] }

    const summary = reservations.map(r => {
      const customer = customers?.find(c => c.id === r.customer_id)
      const birthday = customer?.birthday
      let daysToBirthday = null
      if (birthday) {
        const [y, m, d] = birthday.split('-').map(Number)
        const bday = new Date(new Date().getFullYear(), m - 1, d)
        if (bday < new Date()) bday.setFullYear(bday.getFullYear() + 1)
        daysToBirthday = Math.ceil((bday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }
      return {
        name: r.customer_name,
        reservation_date: r.reservation_date,
        menu: r.menu || '',
        visit_count: customer?.visit_count || 0,
        birthday_soon: daysToBirthday !== null && daysToBirthday >= 0 && daysToBirthday <= 14,
        days_to_birthday: daysToBirthday,
        concerns: customer?.concerns || '',
        memo: (customer?.memo || '').slice(0, 100),
      }
    })

    const systemPrompt = `あなたはエステサロンの「感動体験」を設計するプロのコンサルタントです。
これから来店するお客様に対して、「普通のサービスを超えた感動」を生む準備・取り組みを提案してください。

提案の考え方：
- 来店前に送るウェルカムメッセージ
- 誕生日が近いお客様への特別サプライズ
- リピーター・VIPへの特別な気遣い
- 初回来店のお客様への丁寧なお出迎え準備
- お悩みに寄り添ったパーソナルな提案

出力は必ず以下のJSON形式のみ。説明文は含めない。
{"proposals":[{"customer_name":"顧客名","reason":"提案理由（短く）","initiative":"具体的な取り組み内容","action_type":"message|task|offer|surprise","message_template":"実行用のメッセージ文（LINE等で送る場合）","priority":1}]}

priorityは1-5（1が最優先）。最大5件まで。`

    const userPrompt = `【今後3日以内の来店予定顧客】
${JSON.stringify(summary, null, 2)}

上記のお客様の来店に向けて、感動レベルの体験を準備するための取り組みを提案してください。`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('予期しないレスポンス形式')

    let parsed: { proposals?: unknown[] }
    try {
      const text = content.text.replace(/```json\n?|\n?```/g, '').trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      parsed = { proposals: [] }
    }

    const proposals = (parsed.proposals || []).slice(0, 5)

    // 当日キャッシュに保存
    cachedProposals = proposals
    cacheDate = today

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('customer-delight API Error:', error)
    return NextResponse.json(
      { error: '提案の生成に失敗しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
