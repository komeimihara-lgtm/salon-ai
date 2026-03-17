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

    const [customer, reservations, visits] = await Promise.all([
      supabase.from('customers').select('*').eq('id', userId).single(),
      supabase.from('reservations').select('*').eq('customer_id', userId)
        .order('date', { ascending: false }).limit(5),
      supabase.from('visits').select('*').eq('customer_id', userId)
        .order('visit_date', { ascending: false }).limit(10),
    ])

    return {
      // 基本情報
      name: customer.data?.name,

      // サロン固有コンテキスト
      visitCount: customer.data?.visit_count ?? 0,
      lastVisitDate: customer.data?.last_visit_date,
      todaysCourse: reservations.data?.[0]?.menu,
      staffName: reservations.data?.[0]?.staff_name,

      // 施術履歴
      treatmentHistory: visits.data ?? [],

      // カルテ情報
      skinConcerns: customer.data?.concerns ?? '',
      allergies: customer.data?.allergies ?? '',

      // カウンセリング目標
      counselingGoals: {},
    }
  },

  // メッセージ保存
  async saveConversation(userId: string, messages: ConversationMessage[]): Promise<void> {
    const supabase = getSupabaseAdmin()
    await supabase.from('counseling_messages').upsert(
      messages.map(m => ({ ...m, customer_id: userId }))
    )
  },

  // Bond Score保存（信頼関係スコア）
  async saveBondProfile(userId: string, bond: BondUpdate): Promise<void> {
    const supabase = getSupabaseAdmin()
    await supabase.from('customer_bond_profiles').upsert({
      customer_id: userId,
      ...bond,
      updated_at: new Date().toISOString(),
    })
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

  // 記憶保存
  async saveMemory(userId: string, memory: MemoryUpdate): Promise<void> {
    const supabase = getSupabaseAdmin()
    await supabase.from('customer_memories').upsert({
      customer_id: userId,
      ...memory,
      updated_at: new Date().toISOString(),
    })
  },
}
