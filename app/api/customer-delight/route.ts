/**
 * 感動体験提案 API
 *  - GET:  キャッシュ済の今日〜明後日の提案を返す（生成済なら AI 呼ばない）
 *  - POST: 「再分析」ボタン用。今日〜明後日の予約から AI 再生成し DB に保存
 *
 * キャッシュ戦略:
 *  - DB の customer_delight_proposals に保存
 *  - 同一 (salon_id, customer_id, reservation_date) 単位でユニーク扱い
 *  - 来店日 < 今日−3日 の古い提案は自動クリーンアップ
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function jstDateStr(d = new Date()): string {
  // JST = UTC+9
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}
function addDays(s: string, days: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

interface ProposalRow {
  id: string
  customer_id: string | null
  customer_name: string
  customer_rank: string | null
  reservation_date: string
  reason: string | null
  initiative: string | null
  special_experience: string | null
  action_type: string | null
  message_template: string | null
  priority: number
  generated_at: string
  is_done: boolean
}

function rowToProposal(r: ProposalRow) {
  return {
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    customer_rank: r.customer_rank ?? 'active',
    reservation_date: r.reservation_date,
    reason: r.reason ?? '',
    initiative: r.initiative ?? '',
    special_experience: r.special_experience ?? undefined,
    action_type: r.action_type ?? 'message',
    message_template: r.message_template ?? undefined,
    priority: r.priority,
    is_done: !!r.is_done,
  }
}

async function fetchCachedProposals(salonId: string) {
  const supabase = getSupabaseAdmin()
  const today = jstDateStr()
  const dayPlus2 = addDays(today, 2)

  const { data } = await supabase
    .from('customer_delight_proposals')
    .select('*')
    .eq('salon_id', salonId)
    .gte('reservation_date', today)
    .lte('reservation_date', dayPlus2)
    .order('reservation_date', { ascending: true })
    .order('priority', { ascending: false })
    .limit(30)

  return (data || []) as ProposalRow[]
}

async function cleanupOldProposals(salonId: string) {
  const supabase = getSupabaseAdmin()
  const cutoff = addDays(jstDateStr(), -3)
  await supabase
    .from('customer_delight_proposals')
    .delete()
    .eq('salon_id', salonId)
    .lt('reservation_date', cutoff)
}

async function generateAndSave(salonId: string) {
  const supabase = getSupabaseAdmin()
  const today = jstDateStr()
  const dayPlus2 = addDays(today, 2)

  // 今日〜明後日の confirmed 予約を取得
  const { data: reservations } = await supabase
    .from('reservations')
    .select('customer_id, customer_name, reservation_date, menu, start_time')
    .eq('salon_id', salonId)
    .eq('status', 'confirmed')
    .gte('reservation_date', today)
    .lte('reservation_date', dayPlus2)
    .order('reservation_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(20)

  if (!reservations || reservations.length === 0) {
    return { proposals: [], message: '今日〜明後日の予約がありません' }
  }

  // 顧客情報
  const customerIds = reservations.filter((r) => r.customer_id).map((r) => r.customer_id) as string[]
  const { data: customers } = customerIds.length > 0
    ? await supabase
        .from('customers')
        .select('id, name, visit_count, last_visit_date, birthday, memo, concerns, status')
        .in('id', customerIds)
    : { data: [] }

  const summary = reservations.map((r) => {
    const customer = customers?.find((c) => c.id === r.customer_id)
    const birthday = customer?.birthday
    let daysToBirthday: number | null = null
    if (birthday) {
      const [, m, d] = birthday.split('-').map(Number)
      const bday = new Date(new Date().getFullYear(), m - 1, d)
      if (bday < new Date()) bday.setFullYear(bday.getFullYear() + 1)
      daysToBirthday = Math.ceil((bday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    }
    return {
      customer_id: r.customer_id,
      name: r.customer_name,
      reservation_date: r.reservation_date,
      menu: r.menu || '',
      visit_count: customer?.visit_count || 0,
      birthday_soon: daysToBirthday !== null && daysToBirthday >= 0 && daysToBirthday <= 14,
      days_to_birthday: daysToBirthday,
      concerns: customer?.concerns || '',
      memo: (customer?.memo || '').slice(0, 100),
      customer_rank: (() => {
        const status = customer?.status
        if (status === 'vip') return 'vip'
        if (status === 'at_risk') return 'at_risk'
        if (status === 'dormant') return 'dormant'
        const visitCount = customer?.visit_count || 0
        if (visitCount === 0 || visitCount === 1) return 'new'
        return 'active'
      })(),
    }
  })

  const systemPrompt = `あなたは美容室・ヘアサロンの「感動体験」を設計するプロのコンサルタントです。
お客様一人ひとりに合わせた特別な体験を提案します。

以下の点を意識:
- 来店回数・お悩み・誕生日・カラー履歴等を踏まえた提案
- 失客予備軍・休眠客には特別オファー（無料追加施術等）
- VIP には最高級の感謝体験
- 新規客には「来てよかった」を実感できる工夫

出力フォーマット (JSON のみ・前置きなし):
{"proposals": [
  {
    "customer_name": "...",
    "customer_rank": "vip|at_risk|dormant|new|active",
    "reason": "提案する理由 (50字以内)",
    "initiative": "具体的な施策 (60字以内)",
    "special_experience": "特別体験の内容 (任意)",
    "action_type": "message|task|offer|surprise",
    "message_template": "LINEで送るメッセージ (任意)",
    "priority": 1-5
  }
]}`

  const userPrompt = `以下、本日から明後日までのご予約一覧:
${JSON.stringify(summary, null, 2)}

各お客様への感動体験を 1人1件、合計 ${Math.min(summary.length, 12)} 件以内で提案してください。
priority 5 が最重要です。`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('予期しないレスポンス形式')

  let parsed: { proposals?: Array<Record<string, unknown>> }
  try {
    const text = content.text.replace(/```json\n?|\n?```/g, '').trim()
    const m = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : text)
  } catch {
    parsed = { proposals: [] }
  }

  const items = (parsed.proposals || []).slice(0, 15)

  // summary から customer_id を引いて挿入
  const records = items.map((p) => {
    const match = summary.find((s) => s.name === (p.customer_name as string))
    return {
      salon_id: salonId,
      customer_id: match?.customer_id || null,
      customer_name: (p.customer_name as string) || '',
      customer_rank: (p.customer_rank as string) || match?.customer_rank || 'active',
      reservation_date: match?.reservation_date || jstDateStr(),
      reason: (p.reason as string) || null,
      initiative: (p.initiative as string) || null,
      special_experience: (p.special_experience as string) || null,
      action_type: (p.action_type as string) || 'message',
      message_template: (p.message_template as string) || null,
      priority: typeof p.priority === 'number' ? p.priority : 3,
    }
  })

  if (records.length > 0) {
    // 同日の既存提案を削除してから挿入（再分析時の置き換え）
    await supabase
      .from('customer_delight_proposals')
      .delete()
      .eq('salon_id', salonId)
      .gte('reservation_date', today)
      .lte('reservation_date', dayPlus2)

    await supabase.from('customer_delight_proposals').insert(records)
  }

  return { proposals: records }
}

export async function GET() {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })

    // 古い提案を掃除
    await cleanupOldProposals(salonId)

    // キャッシュ取得
    const cached = await fetchCachedProposals(salonId)
    if (cached.length > 0) {
      return NextResponse.json({ proposals: cached.map(rowToProposal), cached: true })
    }

    // 初回 / 期限切れ → 生成
    const result = await generateAndSave(salonId)
    const fresh = await fetchCachedProposals(salonId)
    return NextResponse.json({
      proposals: fresh.map(rowToProposal),
      cached: false,
      message: result.message,
    })
  } catch (e) {
    console.error('customer-delight GET error', e)
    return NextResponse.json({ error: '提案の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })

    await cleanupOldProposals(salonId)

    // 強制再生成
    await generateAndSave(salonId)
    const fresh = await fetchCachedProposals(salonId)
    return NextResponse.json({ proposals: fresh.map(rowToProposal), cached: false })
  } catch (e) {
    console.error('customer-delight POST error', e)
    return NextResponse.json({ error: '提案の生成に失敗しました' }, { status: 500 })
  }
}
