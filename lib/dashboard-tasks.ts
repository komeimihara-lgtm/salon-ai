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
