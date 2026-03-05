/**
 * 回数券管理
 * - 回数券マスタ（ticket_plans）→ Supabase API
 * - 顧客の保有回数券（customer_tickets）→ Supabase API
 * LocalStorage は使用しない
 */

import { getSalonId } from '@/lib/supabase'

/** 回数券マスタ（商品定義） */
export interface TicketPlan {
  id: string
  name: string
  menuName: string
  totalSessions: number
  price: number
  unitPrice: number
  expiryDays: number | null
  category: string
  isActive?: boolean
  createdAt?: string
}

/** 顧客が購入した回数券（個別インスタンス） */
export interface CustomerTicket {
  id: string
  customerId: string
  customerName: string
  ticketPlanId: string | null
  planName: string
  menuName: string
  totalSessions: number
  remainingSessions: number
  unitPrice: number | null
  purchasedAt: string
  expiryDate: string | null
}

// ========== 回数券マスタ（Supabase API） ==========
function mapRowToPlan(r: Record<string, unknown>): TicketPlan {
  const price = Number(r.price ?? 0)
  const totalSessions = Number(r.totalSessions ?? r.total_sessions ?? 0)
  const unitPrice = r.unitPrice != null ? Number(r.unitPrice) : r.unit_price != null ? Number(r.unit_price) : (totalSessions > 0 ? Math.round(price / totalSessions) : 0)
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    menuName: String(r.menuName ?? r.menu_name ?? ''),
    totalSessions,
    price,
    unitPrice,
    expiryDays: r.expiryDays != null ? Number(r.expiryDays) : r.expiry_days != null ? Number(r.expiry_days) : null,
    category: String(r.category ?? ''),
    isActive: Boolean(r.isActive ?? r.is_active ?? true),
    createdAt: r.createdAt != null ? String(r.createdAt) : r.created_at != null ? String(r.created_at) : undefined,
  }
}

export async function fetchTicketPlans(salonIdOverride?: string): Promise<TicketPlan[]> {
  const salonId = salonIdOverride ?? getSalonId()
  const url = `/api/tickets?salon_id=${encodeURIComponent(salonId)}`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.plans || []
  const plans = rows.map((r: Record<string, unknown>) => mapRowToPlan(r))
  if (typeof window !== 'undefined') {
    console.log('ticket_plans:', plans)
    console.log('salon_id:', salonId)
  }
  return plans
}

export async function createTicketPlan(plan: {
  name: string
  menuName: string
  totalSessions: number
  price: number
  expiryDays?: number | null
  category?: string
}): Promise<TicketPlan> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: plan.name,
      menu_name: plan.menuName,
      total_sessions: plan.totalSessions,
      price: plan.price,
      expiry_days: plan.expiryDays ?? null,
      category: plan.category ?? '',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  return mapRowToPlan(json.plan)
}

export async function updateTicketPlan(
  id: string,
  updates: Partial<{ name: string; menuName: string; totalSessions: number; price: number; expiryDays: number | null; isActive: boolean }>
): Promise<TicketPlan> {
  const body: Record<string, unknown> = {}
  if (updates.name != null) body.name = updates.name
  if (updates.menuName != null) body.menu_name = updates.menuName
  if (updates.totalSessions != null) body.total_sessions = updates.totalSessions
  if (updates.price != null) body.price = updates.price
  if (updates.expiryDays != null) body.expiry_days = updates.expiryDays
  if (updates.isActive != null) body.is_active = updates.isActive

  const res = await fetch(`/api/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '更新に失敗しました')
  return mapRowToPlan(json.plan)
}

export async function deleteTicketPlan(id: string): Promise<void> {
  const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '削除に失敗しました')
}

// ========== 顧客の保有回数券（Supabase API） ==========
function mapRowToTicket(r: Record<string, unknown>): CustomerTicket {
  const purchasedAt = r.purchasedAt ?? r.purchased_at
  const expiryDate = r.expiryDate ?? r.expiry_date
  const unitPrice = r.unitPrice != null ? Number(r.unitPrice) : r.unit_price != null ? Number(r.unit_price) : null
  return {
    id: String(r.id),
    customerId: String(r.customerId ?? r.customer_id),
    customerName: String(r.customerName ?? r.customer_name ?? ''),
    ticketPlanId: r.ticketPlanId != null ? String(r.ticketPlanId) : r.ticket_plan_id != null ? String(r.ticket_plan_id) : null,
    planName: String(r.planName ?? r.plan_name ?? ''),
    menuName: String(r.menuName ?? r.menu_name ?? ''),
    totalSessions: Number(r.totalSessions ?? r.total_sessions ?? 0),
    remainingSessions: Number(r.remainingSessions ?? r.remaining_sessions ?? 0),
    unitPrice,
    purchasedAt: purchasedAt ? new Date(purchasedAt as string).toISOString().slice(0, 10) : '',
    expiryDate: expiryDate ? new Date(expiryDate as string).toISOString().slice(0, 10) : null,
  }
}

export async function fetchCustomerTickets(customerId?: string): Promise<CustomerTicket[]> {
  const url = customerId
    ? `/api/customer-tickets?customer_id=${encodeURIComponent(customerId)}`
    : '/api/customer-tickets'
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.tickets || []
  return rows.map((r: Record<string, unknown>) => mapRowToTicket(r))
}

export async function addCustomerTicket(
  customerId: string,
  customerName: string,
  plan: TicketPlan,
  options?: {
    purchasedAt?: string
    paymentMethod?: 'cash' | 'card' | 'online' | 'loan'
    campaignId?: string
  }
): Promise<CustomerTicket> {
  const purchasedAt = options?.purchasedAt ?? new Date().toISOString().slice(0, 10)
  const expiryDays = plan.expiryDays ?? 180
  const expiry = new Date(purchasedAt)
  expiry.setDate(expiry.getDate() + expiryDays)
  const expiryDate = expiry.toISOString().slice(0, 10)

  const unitPrice = plan.unitPrice ?? (plan.totalSessions > 0 ? Math.round(plan.price / plan.totalSessions) : 0)
  const isCampaign = !!options?.campaignId
  const body: Record<string, unknown> = {
    customer_id: customerId,
    customer_name: customerName,
    ticket_plan_id: isCampaign ? null : plan.id,
    plan_name: plan.name,
    menu_name: plan.menuName,
    total_sessions: plan.totalSessions,
    remaining_sessions: plan.totalSessions,
    unit_price: unitPrice,
    purchased_at: purchasedAt,
    expiry_date: expiryDate,
    payment_method: options?.paymentMethod ?? 'card',
    record_sale: true,
  }
  if (options?.campaignId) body.campaign_id = options.campaignId
  if (isCampaign) body.amount = plan.price

  const res = await fetch('/api/customer-tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.details || json.error || '登録に失敗しました')
  window.dispatchEvent(new Event('customer-tickets-updated'))
  return mapRowToTicket(json.ticket)
}

export async function consumeTicket(ticketId: string): Promise<boolean> {
  const tickets = await fetchCustomerTickets()
  const ticket = tickets.find(t => t.id === ticketId)
  if (!ticket || ticket.remainingSessions <= 0) return false

  const newRemaining = ticket.remainingSessions - 1
  const res = await fetch(`/api/customer-tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remaining_sessions: newRemaining }),
  })
  if (!res.ok) return false
  window.dispatchEvent(new Event('customer-tickets-updated'))
  return true
}

export async function fetchExpiringSoonTickets(days = 30): Promise<CustomerTicket[]> {
  const all = await fetchCustomerTickets()
  const today = new Date()
  const limit = new Date()
  limit.setDate(limit.getDate() + days)
  return all.filter(t => {
    if (t.remainingSessions <= 0) return false
    const expStr = t.expiryDate
    if (!expStr) return false
    const exp = new Date(expStr)
    return exp >= today && exp <= limit
  })
}

export async function fetchExpiredTickets(): Promise<CustomerTicket[]> {
  const all = await fetchCustomerTickets()
  const today = new Date().toISOString().slice(0, 10)
  return all.filter(t => t.expiryDate != null && t.expiryDate < today && t.remainingSessions > 0)
}

export function isTicketExpired(ticket: CustomerTicket): boolean {
  if (!ticket.expiryDate) return false
  return new Date(ticket.expiryDate) < new Date()
}

export function daysUntilTicketExpiry(ticket: CustomerTicket): number {
  if (!ticket.expiryDate) return 999
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(ticket.expiryDate)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
