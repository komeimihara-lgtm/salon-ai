import { createClient } from '@/lib/supabase'
import { DEMO_SALON_ID } from '@/lib/supabase'

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
  created_at?: string
}

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function fetchProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createProduct(data: Omit<Product, 'id' | 'salon_id' | 'created_at'>): Promise<Product> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('products')
    .insert({ ...data, salon_id: salonId })
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
    .eq('salon_id', salonId)
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
    .eq('salon_id', salonId)
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
    .insert({ salon_id: salonId, product_id: productId, type, quantity, memo })
}
