/** The Core — 型定義 */

export interface ConversationMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface UserContext {
  name?: string
  age?: number

  // サロン固有コンテキスト
  visitCount: number
  lastVisitDate?: string
  todaysCourse?: string
  staffName?: string

  // 施術履歴
  treatmentHistory: Record<string, unknown>[]

  // カルテ情報
  skinConcerns: string
  allergies: string

  // カウンセリング目標
  counselingGoals: Record<string, unknown>
}

export interface EmotionState {
  primary: string
  intensity: number
  valence: number
  notes?: string
}

export interface BondUpdate {
  bond_stage?: number
  bond_score?: number
  /** モデルが返す差分。保存時は既存 bond_score に加算 */
  bond_score_delta?: number
  trust_indicators?: Record<string, unknown>
}

export interface MemoryUpdate {
  short_term?: Record<string, unknown>
  long_term?: Record<string, unknown>
}

export interface TheCoreResponse {
  message: string
  emotion?: EmotionState
  bondUpdate?: BondUpdate
  memoryUpdates?: MemoryUpdate
  counselingPhaseAdvice?: string
}

export interface PersonaConfig {
  name: string
  basePersonality: string
  speakingStyle: string
  emotionalRange: {
    empathy: number
    warmth: number
    directness: number
    humor: number
  }
  counselingPhase: 'pre' | 'post'
  adaptByBondStage: boolean
}

export interface ProcessMessageInput {
  userId: string
  message: string
  conversationHistory: ConversationMessage[]
  userContext: UserContext
  persona: PersonaConfig
}

export interface HostAdapter {
  getConversationHistory(userId: string, limit?: number): Promise<ConversationMessage[]>
  getUserContext(userId: string): Promise<UserContext>
  saveConversation(userId: string, messages: ConversationMessage[]): Promise<void>
  /** カウンセリング1ターン分を追記（初回のみウェルカム文を先に insert） */
  appendCounselingTurn(
    userId: string,
    historyPrefix: ConversationMessage[],
    userContent: string,
    assistantContent: string,
  ): Promise<void>
  saveBondProfile(userId: string, bond: BondUpdate): Promise<void>
  saveEmotionLog(userId: string, emotion: EmotionState, messageIndex: number): Promise<void>
  saveMemory(userId: string, memory: MemoryUpdate): Promise<void>
}
