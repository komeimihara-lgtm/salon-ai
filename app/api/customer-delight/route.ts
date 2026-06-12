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

// AI生成に時間がかかるため関数タイムアウトを延長（Vercel Pro: 最大60s）
export const maxDuration = 60

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

interface CustomerRow {
  id: string
  name: string | null
  visit_count: number | null
  last_visit_date: string | null
  birthday: string | null
  memo: string | null
  concerns: string | null
  status: string | null
}

function daysUntilBirthday(birthday: string | null | undefined): number | null {
  if (!birthday) return null
  const [, m, d] = birthday.split('-').map(Number)
  const bday = new Date(new Date().getFullYear(), m - 1, d)
  if (bday < new Date()) bday.setFullYear(bday.getFullYear() + 1)
  return Math.ceil((bday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

function rankOfCustomer(customer: CustomerRow | undefined): string {
  const status = customer?.status
  if (status === 'vip') return 'vip'
  if (status === 'at_risk') return 'at_risk'
  if (status === 'dormant') return 'dormant'
  const visitCount = customer?.visit_count || 0
  if (visitCount === 0 || visitCount === 1) return 'new'
  return 'active'
}

function summarizeCustomer(
  customer: CustomerRow | undefined,
  name: string,
  reservationDate: string,
  menu: string,
  customerId: string | null,
) {
  const dtb = daysUntilBirthday(customer?.birthday)
  return {
    customer_id: customerId,
    name,
    reservation_date: reservationDate,
    menu,
    visit_count: customer?.visit_count || 0,
    birthday_soon: dtb !== null && dtb >= 0 && dtb <= 14,
    days_to_birthday: dtb,
    concerns: customer?.concerns || '',
    memo: (customer?.memo || '').slice(0, 100),
    customer_rank: rankOfCustomer(customer),
  }
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
    .limit(8)

  let summary: ReturnType<typeof summarizeCustomer>[]

  if (reservations && reservations.length > 0) {
    // 直近予約のある顧客から提案を生成
    const customerIds = reservations.filter((r) => r.customer_id).map((r) => r.customer_id) as string[]
    const { data: customers } = customerIds.length > 0
      ? await supabase
          .from('customers')
          .select('id, name, visit_count, last_visit_date, birthday, memo, concerns, status')
          .in('id', customerIds)
      : { data: [] }

    summary = reservations.map((r) =>
      summarizeCustomer(
        (customers as CustomerRow[] | null)?.find((c) => c.id === r.customer_id),
        r.customer_name,
        r.reservation_date,
        r.menu || '',
        r.customer_id,
      ),
    )
  } else {
    // フォールバック: 直近予約が無くても、感動体験の対象になりやすい顧客を選んで提案する
    //（失客予備軍・休眠客・VIP・誕生日が近い顧客を優先）
    const { data: cands } = await supabase
      .from('customers')
      .select('id, name, visit_count, last_visit_date, birthday, memo, concerns, status')
      .eq('salon_id', salonId)
      .limit(80)

    if (!cands || cands.length === 0) {
      return { proposals: [], message: '提案対象の顧客がいません' }
    }

    const scored = (cands as CustomerRow[])
      .map((c) => {
        const rank = rankOfCustomer(c)
        const dtb = daysUntilBirthday(c.birthday)
        let score =
          rank === 'at_risk' ? 50 : rank === 'dormant' ? 45 : rank === 'vip' ? 40 : rank === 'new' ? 25 : 15
        if (dtb !== null && dtb >= 0 && dtb <= 14) score += 30
        return { c, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    summary = scored.map(({ c }) => summarizeCustomer(c, c.name || '', today, '', c.id))
  }

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

  const userPrompt = `以下、感動体験を届けたいお客様の一覧です（reservation_date は来店予定日。予約が無いお客様は本日付）:
${JSON.stringify(summary, null, 2)}

各お客様への感動体験を 1人1件、合計 ${Math.min(summary.length, 8)} 件以内で提案してください。
priority 5 が最重要です。`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8000,
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
  } catch (parseErr) {
    // JSON parse 失敗時は原因をログに残す（max_tokens切れ等の調査用）
    console.error('customer-delight JSON parse failed', {
      stop_reason: response.stop_reason,
      output_tokens: response.usage?.output_tokens,
      text_head: content.text.slice(0, 200),
      text_tail: content.text.slice(-200),
      err: String(parseErr),
    })
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

    const { error: insertErr } = await supabase.from('customer_delight_proposals').insert(records)
    if (insertErr) console.error('customer_delight_proposals insert failed:', insertErr.message)
  }

  return { proposals: records }
}

// 感動体験のタスク文言（クライアントの buildDelightTaskText と同じフォーマットに揃える）
function proposalTaskText(r: Pick<ProposalRow, 'customer_name' | 'initiative' | 'message_template'>): string {
  const mt = r.message_template
  return mt
    ? `${r.customer_name}様: ${r.initiative ?? ''} — 「${mt.slice(0, 50)}${mt.length > 50 ? '…' : ''}」`
    : `${r.customer_name}様: ${r.initiative ?? ''}`
}

// 現在の提案をダッシュボードのタスクへ同期する。
// GET/POST のたびに呼ぶことで、キャッシュヒット時（generateAndSave を通らない時）でも
// タスクが確実に入る。既存タスクの文言と照合して重複は作らず、削除もしない
// （ユーザーが消したタスクを毎回復活させない）。
async function syncProposalsToTasks(salonId: string, rows: ProposalRow[]) {
  if (!rows || rows.length === 0) return
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase
    .from('tasks')
    .select('text')
    .eq('salon_id', salonId)
    .eq('source', 'customer_delight')

  const existingTexts = new Set((existing || []).map((t: { text: string }) => t.text))

  const toInsert = rows
    .map((r) => ({
      text: proposalTaskText(r),
      priority: (r.priority >= 4 ? 'high' : r.priority >= 2 ? 'medium' : 'low') as
        | 'high'
        | 'medium'
        | 'low',
      due_date: r.reservation_date,
    }))
    .filter((t) => !existingTexts.has(t.text))
    .map((t) => ({
      salon_id: salonId,
      text: t.text,
      source: 'customer_delight' as const,
      priority: t.priority,
      due_date: t.due_date,
      done: false,
    }))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('tasks').insert(toInsert)
    if (error) console.error('customer-delight task sync insert failed:', error.message)
  }
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
      // キャッシュヒット時でも、現在の提案を毎回タスクへ同期する
      await syncProposalsToTasks(salonId, cached)
      return NextResponse.json({ proposals: cached.map(rowToProposal), cached: true })
    }

    // 初回 / 期限切れ → 生成
    const result = await generateAndSave(salonId)
    const fresh = await fetchCachedProposals(salonId)
    await syncProposalsToTasks(salonId, fresh)
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
    await syncProposalsToTasks(salonId, fresh)
    return NextResponse.json({ proposals: fresh.map(rowToProposal), cached: false })
  } catch (e) {
    console.error('customer-delight POST error', e)
    return NextResponse.json({ error: '提案の生成に失敗しました' }, { status: 500 })
  }
}
