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

// 感動体験提案をタスク文言に変換（customer-delight ページと dashboard で共通利用）
export function buildDelightTaskText(p: DelightProposal): string {
  return p.message_template
    ? `${p.customer_name}様: ${p.initiative} — 「${p.message_template.slice(0, 50)}${p.message_template.length > 50 ? '…' : ''}」`
    : `${p.customer_name}様: ${p.initiative}`
}

// 感動体験の提案を取得し、まだタスク化されていないものを自動でタスクに追加する。
// 当日の提案はサーバー側でキャッシュされるため、同じ内容を再登録しないよう
// 既存の customer_delight タスクの文言と照合して重複を防ぐ。
export async function syncCustomerDelightTasks(): Promise<ManualTask[]> {
  let proposals: DelightProposal[]
  try {
    const res = await fetch('/api/customer-delight', { method: 'POST' })
    if (!res.ok) return []
    const data = await res.json()
    proposals = data.proposals || []
  } catch {
    return []
  }
  if (proposals.length === 0) return []

  const existing = await fetchTasks()
  const existingDelightTexts = new Set(
    existing.filter(t => t.source === 'customer_delight').map(t => t.text)
  )

  const created: ManualTask[] = []
  for (const p of proposals) {
    const text = buildDelightTaskText(p)
    if (existingDelightTexts.has(text)) continue
    try {
      const task = await addTask({
        text,
        source: 'customer_delight',
        priority: 'high',
        due_date: null,
        done: false,
      })
      created.push(task)
    } catch {
      // 1件失敗しても他の提案の登録は続行
    }
  }
  return created
}
