import { createClient, getSalonId } from '@/lib/supabase'

export interface ManualTask {
  id: string
  salon_id?: string
  text: string
  source: 'manual' | 'leo' | 'customer_delight'
  priority: 'high' | 'medium' | 'low'
  due_date?: string | null
  done: boolean
  created_at?: string
}

export async function fetchTasks(): Promise<ManualTask[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('salon_id', getSalonId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addTask(task: Omit<ManualTask, 'id' | 'salon_id' | 'created_at'>): Promise<ManualTask> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, salon_id: getSalonId() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ done })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export interface DelightProposal {
  customer_name: string
  initiative: string
  message_template?: string
}

// 感動体験提案をタスク文言に変換（customer-delight ページで「追加済み」判定に利用）。
// サーバー側 generateAndSave のタスク文言生成と同じフォーマットに揃えること。
export function buildDelightTaskText(p: DelightProposal): string {
  return p.message_template
    ? `${p.customer_name}様: ${p.initiative} — 「${p.message_template.slice(0, 50)}${p.message_template.length > 50 ? '…' : ''}」`
    : `${p.customer_name}様: ${p.initiative}`
}

// 感動体験の提案生成をトリガーする。
// GET はキャッシュがあれば返し、未生成/期限切れなら生成し、その際サーバー側で
// tasks テーブルへ customer_delight タスクを自動投入する（route.ts の generateAndSave）。
// クライアントでは insert せず、呼び出し後にタスク一覧を再取得するだけにする。
// （クライアントで再 insert するとユーザーが削除したタスクが復活してしまうため）
export async function ensureCustomerDelightTasks(): Promise<void> {
  try {
    await fetch('/api/customer-delight', { method: 'GET' })
  } catch {
    // 失敗してもUIは既存タスクのまま。次回の読込で反映される。
  }
}
