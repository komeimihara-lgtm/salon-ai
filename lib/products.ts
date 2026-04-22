/**
 * 商品 (物販) 管理クライアント。
 *
 * 従来はクライアント側 Supabase (anon key) を直接使っていたが、
 * RLS ポリシーで 42501 (row-level security policy violation) により
 * INSERT/UPDATE/DELETE が全拒否されていた。
 * service_role を使うサーバ API 経由に統一している。
 */

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

async function readJsonOrThrow(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg =
      (typeof json?.error === 'string' && json.error) ||
      (typeof json?.message === 'string' && json.message) ||
      `HTTP ${res.status}`
    throw new Error(msg as string)
  }
  return json
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { credentials: 'include' })
  const j = await readJsonOrThrow(res)
  return (j.products as Product[]) || []
}

export async function createProduct(
  data: Omit<Product, 'id' | 'salon_id' | 'created_at'>
): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  const j = await readJsonOrThrow(res)
  return j.product as Product
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  const j = await readJsonOrThrow(res)
  return j.product as Product
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  await readJsonOrThrow(res)
}

export async function adjustStock(
  productId: string,
  type: 'in' | 'out' | 'adjust',
  quantity: number,
  memo?: string
): Promise<void> {
  const res = await fetch('/api/products/stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ product_id: productId, type, quantity, memo }),
  })
  await readJsonOrThrow(res)
}
