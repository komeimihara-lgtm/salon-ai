import type { HostAdapter, UserContext, ConversationMessage, BondUpdate, EmotionState, MemoryUpdate } from './types'
import { getSupabaseAdmin } from '@/lib/supabase'

export const solaHostAdapter: HostAdapter = {

  // カウンセリング履歴を取得
  async getConversationHistory(userId: string, limit = 20): Promise<ConversationMessage[]> {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('counseling_messages')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data?.reverse() ?? []) as ConversationMessage[]
  },

  // SOLAならではのコンテキスト（カルテ・施術履歴・予約情報）
  async getUserContext(userId: string): Promise<UserContext> {
    const supabase = getSupabaseAdmin()

    // JST基準の「今日」を使って今日の予約メニューを特定する
    const { todayJstString } = await import('@/lib/jst-date')
    const today = todayJstString()

    const [customer, todayReservation, visits, memories] = await Promise.all([
      supabase.from('customers').select('*').eq('id', userId).single(),
      // 今日の予約（確定済み）のメニュー／スタッフを優先的に取得
      supabase.from('reservations')
        .select('menu, staff_name, start_time, reservation_date, status')
        .eq('customer_id', userId)
        .eq('reservation_date', today)
        .in('status', ['confirmed', 'visited', 'completed'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('visits').select('*').eq('customer_id', userId)
        .order('visit_date', { ascending: false }).limit(10),
      supabase
        .from('customer_memories')
        .select('short_term, long_term')
        .eq('customer_id', userId)
        .maybeSingle(),
    ])

    const st = memories.data?.short_term
    const lt = memories.data?.long_term
    const memoryShortTerm =
      st && typeof st === 'object' && !Array.isArray(st) ? (st as Record<string, unknown>) : undefined
    const memoryLongTerm =
      lt && typeof lt === 'object' && !Array.isArray(lt) ? (lt as Record<string, unknown>) : undefined

    return {
      // 基本情報
      name: customer.data?.name,

      // サロン固有コンテキスト
      visitCount: customer.data?.visit_count ?? 0,
      lastVisitDate: customer.data?.last_visit_date,
      todaysCourse: todayReservation.data?.menu,
      staffName: todayReservation.data?.staff_name,

      // 施術履歴
      treatmentHistory: visits.data ?? [],

      // カルテ情報
      skinConcerns: customer.data?.concerns ?? '',
      allergies: customer.data?.allergies ?? '',

      // カウンセリング目標
      counselingGoals: {},

      memoryShortTerm,
      memoryLongTerm,
    }
  },

  // メッセージ保存（複数行をそのまま insert）
  async saveConversation(userId: string, messages: ConversationMessage[]): Promise<void> {
    const supabase = getSupabaseAdmin()
    if (messages.length === 0) return
    await supabase.from('counseling_messages').insert(
      messages.map((m) => ({ role: m.role, content: m.content, customer_id: userId })),
    )
  },

  /**
   * 画面の会話履歴と同期：初回（DBが空）かつ直前がウェルカム1通のみのとき assistant を先に保存し、
   * 続けて user / 今回の assistant を保存する。
   */
  async appendCounselingTurn(
    userId: string,
    historyPrefix: ConversationMessage[],
    userContent: string,
    assistantContent: string,
  ): Promise<void> {
    const supabase = getSupabaseAdmin()
    const { count, error: countErr } = await supabase
      .from('counseling_messages')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', userId)
    if (countErr) console.warn('[solaHostAdapter] counseling_messages count', countErr)

    const rows: { customer_id: string; role: 'user' | 'assistant'; content: string }[] = []
    const isEmpty = (count ?? 0) === 0
    if (
      isEmpty &&
      historyPrefix.length === 1 &&
      historyPrefix[0].role === 'assistant' &&
      historyPrefix[0].content.trim().length > 0
    ) {
      rows.push({
        customer_id: userId,
        role: 'assistant',
        content: historyPrefix[0].content,
      })
    }
    rows.push(
      { customer_id: userId, role: 'user', content: userContent },
      { customer_id: userId, role: 'assistant', content: assistantContent },
    )
    const { error } = await supabase.from('counseling_messages').insert(rows)
    if (error) console.warn('[solaHostAdapter] counseling_messages insert', error)
  },

  // Bond Score保存（bond_score_delta は既存値に加算して 0〜100 に収める）
  async saveBondProfile(userId: string, bond: BondUpdate): Promise<void> {
    const supabase = getSupabaseAdmin()
    const { data: row } = await supabase
      .from('customer_bond_profiles')
      .select('bond_score, bond_stage, trust_indicators')
      .eq('customer_id', userId)
      .maybeSingle()

    const prevScore = row?.bond_score != null ? Number(row.bond_score) : 0
    const prevStage = row?.bond_stage != null ? Number(row.bond_stage) : 1
    const prevTrust = (row?.trust_indicators as Record<string, unknown> | null) ?? {}

    let nextScore = prevScore
    if (typeof bond.bond_score === 'number' && !Number.isNaN(bond.bond_score)) {
      nextScore = bond.bond_score
    } else if (typeof bond.bond_score_delta === 'number' && !Number.isNaN(bond.bond_score_delta)) {
      nextScore = prevScore + bond.bond_score_delta
    }
    nextScore = Math.max(0, Math.min(100, nextScore))

    const nextStage =
      typeof bond.bond_stage === 'number' && !Number.isNaN(bond.bond_stage) ? bond.bond_stage : prevStage
    const trust =
      bond.trust_indicators && Object.keys(bond.trust_indicators).length > 0
        ? { ...prevTrust, ...bond.trust_indicators }
        : prevTrust

    const { error } = await supabase.from('customer_bond_profiles').upsert(
      {
        customer_id: userId,
        bond_score: nextScore,
        bond_stage: nextStage,
        trust_indicators: trust,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id' },
    )
    if (error) console.warn('[solaHostAdapter] customer_bond_profiles upsert', error)
  },

  // 感情ログ保存（施術スタッフへの引き渡し用）
  async saveEmotionLog(userId: string, emotion: EmotionState, messageIndex: number): Promise<void> {
    const supabase = getSupabaseAdmin()
    await supabase.from('counseling_emotion_logs').insert({
      customer_id: userId,
      emotion,
      message_index: messageIndex,
      session_date: new Date().toISOString(),
    })
  },

  // 記憶保存（短期・長期をマージ）
  async saveMemory(userId: string, memory: MemoryUpdate): Promise<void> {
    const supabase = getSupabaseAdmin()
    const { data: row } = await supabase
      .from('customer_memories')
      .select('short_term, long_term')
      .eq('customer_id', userId)
      .maybeSingle()

    const shortPrev = (row?.short_term as Record<string, unknown> | null) ?? {}
    const longPrev = (row?.long_term as Record<string, unknown> | null) ?? {}
    const short = { ...shortPrev, ...(memory.short_term ?? {}) }
    const long = { ...longPrev, ...(memory.long_term ?? {}) }

    const { error } = await supabase.from('customer_memories').upsert(
      {
        customer_id: userId,
        short_term: short,
        long_term: long,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id' },
    )
    if (error) console.warn('[solaHostAdapter] customer_memories upsert', error)
  },
}
