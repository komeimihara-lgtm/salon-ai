/**
 * 商品（物販）管理
 */

import { getSalonId } from '@/lib/supabase'

export type Product = {
  id: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  low_stock_threshold: number
  barcode?: string
  memo?: string
}

function mapRow(r: Record<string, unknown>): Product {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    category: String(r.category ?? '物販'),
    price: Number(r.price ?? 0),
    cost: Number(r.cost ?? 0),
    stock: Number(r.stock ?? 0),
    low_stock_threshold: Number(r.low_stock_threshold ?? 5),
    barcode: r.barcode != null ? String(r.barcode) : undefined,
    memo: r.memo != null ? String(r.memo) : undefined,
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const salonId = getSalonId()
  const res = await fetch(`/api/products?salon_id=${encodeURIComponent(salonId)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  return (json.products || []).map((r: Record<string, unknown>) => mapRow(r))
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      price: data.price,
      cost: data.cost,
      stock: data.stock,
      low_stock_threshold: data.low_stock_threshold,
      barcode: data.barcode ?? null,
      memo: data.memo ?? null,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  return mapRow(json.product)
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const body: Record<string, unknown> = {}
  if (data.name != null) body.name = data.name
  if (data.category != null) body.category = data.category
  if (data.price != null) body.price = data.price
  if (data.cost != null) body.cost = data.cost
  if (data.stock != null) body.stock = data.stock
  if (data.low_stock_threshold != null) body.low_stock_threshold = data.low_stock_threshold
  if (data.barcode !== undefined) body.barcode = data.barcode
  if (data.memo !== undefined) body.memo = data.memo

  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '更新に失敗しました')
  return mapRow(json.product)
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '削除に失敗しました')
}

export async function adjustStock(
  productId: string,
  type: 'in' | 'out' | 'adjust',
  quantity: number,
  memo?: string
): Promise<void> {
  const res = await fetch(`/api/products/${productId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, quantity, memo }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '在庫調整に失敗しました')
}
