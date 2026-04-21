import { createClient, getSalonId } from '@/lib/supabase'

export type Product = {
  id: string
  salon_id: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  low_stock_threshold: number
  barcode?: string
  memo?: string
  /** 販売日からの消費期限までの日数。未設定なら期限トラッキングしない */
  expiry_days?: number | null
  /** 期限の何日前からアラートするか（既定14） */
  expiry_alert_days?: number | null
  created_at?: string
}

export async function fetchProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('salon_id', getSalonId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createProduct(data: Omit<Product, 'id' | 'salon_id' | 'created_at'>): Promise<Product> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('products')
    .insert({ ...data, salon_id: getSalonId() })
    .select()
    .single()
  if (error) throw error
  return row
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .eq('salon_id', getSalonId())
    .select()
    .single()
  if (error) throw error
  return row
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('salon_id', getSalonId())
  if (error) throw error
}

export async function adjustStock(
  productId: string,
  type: 'in' | 'out' | 'adjust',
  quantity: number,
  memo?: string
): Promise<void> {
  const supabase = createClient()
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single()
  if (fetchError) throw fetchError
  const newStock =
    type === 'in' ? product.stock + quantity :
    type === 'out' ? Math.max(0, product.stock - quantity) :
    quantity
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', productId)
  if (updateError) throw updateError
  await supabase
    .from('product_stock_logs')
    .insert({ salon_id: getSalonId(), product_id: productId, type, quantity, memo })
}
