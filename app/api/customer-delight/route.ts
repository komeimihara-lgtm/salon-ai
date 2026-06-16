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

// ── ダッシュボード「今日のタスク」への感動体験タスク同期 ──────────────
type DelightTaskInput = {
  customer_name: string
  initiative: string | null
  message_template: string | null
  priority: number
  reservation_date: string
}

function buildDelightTaskRecord(salonId: string, r: DelightTaskInput) {
  const mt = r.message_template ?? ''
  const taskText = mt
    ? `${r.customer_name}様: ${r.initiative ?? ''} — 「${mt.slice(0, 50)}${mt.length > 50 ? '…' : ''}」`
    : `${r.customer_name}様: ${r.initiative ?? ''}`
  // priority 1〜5 → high/medium/low
  const taskPriority: 'high' | 'medium' | 'low' =
    r.priority >= 4 ? 'high' : r.priority >= 2 ? 'medium' : 'low'
  return {
    salon_id: salonId,
    text: taskText,
    source: 'customer_delight' as const,
    priority: taskPriority,
    due_date: r.reservation_date,
    done: false,
  }
}

/** 生成・再分析時：未完了の感動タスクを総入れ替え（完了済みは履歴として残す） */
async function replaceDelightTasks(salonId: string, items: DelightTaskInput[]) {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('tasks')
    .delete()
    .eq('salon_id', salonId)
    .eq('source', 'customer_delight')
    .eq('done', false)
  if (items.length === 0) return
  const recs = items.map((r) => buildDelightTaskRecord(salonId, r))
  const { error } = await supabase.from('tasks').insert(recs)
  if (error) console.error('replaceDelightTasks insert error', error)
}

/**
 * 閲覧時（キャッシュ命中）：不足分だけ追加し、過去日の未完了は掃除。
 * 重複（同一テキスト）は作らず、完了済みタスクも復活させない。
 */
async function syncDelightTasksFromCache(salonId: string, rows: ProposalRow[]) {
  const supabase = getSupabaseAdmin()
  const today = jstDateStr()
  // 過去日の未完了感動タスクを掃除
  await supabase
    .from('tasks')
    .delete()
    .eq('salon_id', salonId)
    .eq('source', 'customer_delight')
    .eq('done', false)
    .lt('due_date', today)
  if (rows.length === 0) return
  // 既存（完了/未完了問わず）と重複しないものだけ追加
  const { data: existing } = await supabase
    .from('tasks')
    .select('text')
    .eq('salon_id', salonId)
    .eq('source', 'customer_delight')
  const seen = new Set((existing ?? []).map((t: { text: string }) => t.text))
  const recs = rows
    .map((r) =>
      buildDelightTaskRecord(salonId, {
        customer_name: r.customer_name,
        initiative: r.initiative,
        message_template: r.message_template,
        priority: r.priority,
        reservation_date: r.reservation_date,
      })
    )
    .filter((t) => !seen.has(t.text))
  if (recs.length > 0) {
    const { error } = await supabase.from('tasks').insert(recs)
    if (error) console.error('syncDelightTasksFromCache insert error', error)
  }
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
    .limit(8)

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

    await supabase.from('customer_delight_proposals').insert(records)

    // === ダッシュボードのタスクにも自動投入（未完了は総入れ替え）===
    await replaceDelightTasks(salonId, records)
  }

  return { proposals: records }
}

/**
 * 同期直後のタスク一覧をサーバ側（service role）で取得。
 * クライアントの anon + document.cookie 経由だと salon_id が空・RLSで読めない等の
 * 障害が起きうるため、ダッシュボードの「今日のタスク」用にここで返してしまう。
 */
async function fetchTasksForSalon(salonId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchTasksForSalon error', error)
    return []
  }
  return data ?? []
}

export async function GET(req: NextRequest) {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })

    // ダッシュボード等からの呼び出し用：キャッシュのみ返し、AI生成は誘発しない
    const cacheOnly = req.nextUrl.searchParams.get('cache_only') === '1'

    // 古い提案を掃除
    await cleanupOldProposals(salonId)

    // キャッシュ取得
    const cached = await fetchCachedProposals(salonId)
    if (cached.length > 0) {
      // キャッシュ命中時もダッシュボードのタスクに同期（不足分のみ追加）
      await syncDelightTasksFromCache(salonId, cached)
      const tasks = await fetchTasksForSalon(salonId)
      return NextResponse.json({
        proposals: cached.map(rowToProposal),
        cached: true,
        tasks,
      })
    }

    // キャッシュ無し＆生成しないモード → 空提案＋既存タスクを返す
    if (cacheOnly) {
      const tasks = await fetchTasksForSalon(salonId)
      return NextResponse.json({ proposals: [], cached: true, tasks })
    }

    // 初回 / 期限切れ → 生成
    const result = await generateAndSave(salonId)
    const fresh = await fetchCachedProposals(salonId)
    const tasks = await fetchTasksForSalon(salonId)
    return NextResponse.json({
      proposals: fresh.map(rowToProposal),
      cached: false,
      message: result.message,
      tasks,
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
