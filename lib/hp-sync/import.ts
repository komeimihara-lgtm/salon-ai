/**
 * Shared logic used by both the email webhook and the scrape endpoint:
 * given a normalized reservation payload, dedup it, upsert the customer,
 * insert the reservation, and return what happened.
 */

import { getSupabaseAdmin } from '@/lib/supabase'
import { findDuplicate } from './dedup'
import type { ParsedReservation } from './parser'
import type { ScrapedReservation } from './scraper-client'

export interface ImportInput {
  salonId: string
  externalId: string | null
  customerName: string | null
  customerNameKana?: string | null
  phone: string | null
  reservationDate: string | null
  startTime: string | null
  endTime: string | null
  menu: string | null
  staffName: string | null
  price: number | null
  source: 'email' | 'scrape' | 'manual'
  eventType?: 'new' | 'change' | 'cancel' | 'unknown'
}

export interface ImportResult {
  status: 'inserted' | 'updated' | 'cancelled' | 'duplicate' | 'skipped' | 'error'
  reservationId: string | null
  message: string
}

export function parsedToImport(p: ParsedReservation, salonId: string): ImportInput {
  return {
    salonId,
    externalId: p.externalId,
    customerName: p.customerName,
    customerNameKana: p.customerNameKana,
    phone: p.phone,
    reservationDate: p.reservationDate,
    startTime: p.startTime,
    endTime: p.endTime,
    menu: p.menu,
    staffName: p.staffName,
    price: p.price,
    source: 'email',
    eventType: p.eventType,
  }
}

export function scrapedToImport(s: ScrapedReservation, salonId: string): ImportInput {
  return {
    salonId,
    externalId: s.externalId,
    customerName: s.customerName,
    customerNameKana: s.customerNameKana,
    phone: s.phone,
    reservationDate: s.reservationDate,
    startTime: s.startTime,
    endTime: s.endTime,
    menu: s.menu,
    staffName: s.staffName,
    price: s.price,
    source: 'scrape',
    eventType: s.status === 'cancelled' ? 'cancel' : 'new',
  }
}

async function upsertCustomer(input: ImportInput): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const phoneDigits = input.phone ? input.phone.replace(/[^\d]/g, '') : null

  // 1. Try phone match first (best identifier)
  if (phoneDigits) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('salon_id', input.salonId)
      .eq('phone', phoneDigits)
      .limit(1)
      .maybeSingle()
    if (data) return data.id as string
  }

  // 2. Fall back to name match
  if (input.customerName) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('salon_id', input.salonId)
      .eq('name', input.customerName)
      .limit(1)
      .maybeSingle()
    if (data) return data.id as string
  }

  // 3. Create new customer
  if (!input.customerName) return null

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      salon_id: input.salonId,
      name: input.customerName,
      name_kana: input.customerNameKana || null,
      phone: phoneDigits,
      imported_from: 'hotpepper',
      status: 'active',
    })
    .select('id')
    .single()
  if (error || !created) return null
  return created.id as string
}

export async function importReservation(input: ImportInput): Promise<ImportResult> {
  const supabase = getSupabaseAdmin()

  if (!input.reservationDate || !input.startTime || !input.customerName) {
    return {
      status: 'skipped',
      reservationId: null,
      message: '日付・時刻・顧客名のいずれかが欠落しているためスキップ',
    }
  }

  // Dedup first — same external_id or same slot+name+menu
  const dup = await findDuplicate({
    salonId: input.salonId,
    externalId: input.externalId,
    reservationDate: input.reservationDate,
    startTime: input.startTime,
    customerName: input.customerName,
    menu: input.menu,
  })

  // Cancellation: mark existing row cancelled (if found)
  if (input.eventType === 'cancel') {
    if (dup.duplicate && dup.reservationId) {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', dup.reservationId)
      if (error) return { status: 'error', reservationId: null, message: error.message }
      return {
        status: 'cancelled',
        reservationId: dup.reservationId,
        message: 'キャンセルとしてマークしました',
      }
    }
    return { status: 'skipped', reservationId: null, message: 'キャンセル対象が見つかりませんでした' }
  }

  if (dup.duplicate && dup.reservationId) {
    // Change event: update the row if scrape/email says something different
    if (input.eventType === 'change') {
      const patch: Record<string, unknown> = {}
      if (input.menu) patch.menu = input.menu
      if (input.endTime) patch.end_time = input.endTime
      if (input.staffName) patch.staff_name = input.staffName
      if (typeof input.price === 'number') patch.price = input.price
      if (Object.keys(patch).length) {
        await supabase.from('reservations').update(patch).eq('id', dup.reservationId)
      }
      return {
        status: 'updated',
        reservationId: dup.reservationId,
        message: `既存予約を更新しました（${dup.reason}）`,
      }
    }
    return {
      status: 'duplicate',
      reservationId: dup.reservationId,
      message: `重複のためスキップ（${dup.reason}）`,
    }
  }

  // New insert
  const customerId = await upsertCustomer(input)

  const insertRow: Record<string, unknown> = {
    salon_id: input.salonId,
    customer_id: customerId,
    customer_name: input.customerName,
    customer_phone: input.phone ? input.phone.replace(/[^\d]/g, '') : null,
    reservation_date: input.reservationDate,
    start_time: input.startTime,
    end_time: input.endTime,
    menu: input.menu,
    staff_name: input.staffName,
    price: typeof input.price === 'number' ? input.price : 0,
    status: 'confirmed',
    hp_external_id: input.externalId,
    hp_source: input.source,
  }

  const { data, error } = await supabase
    .from('reservations')
    .insert(insertRow)
    .select('id')
    .single()
  if (error || !data) {
    return { status: 'error', reservationId: null, message: error?.message || 'insert failed' }
  }
  return { status: 'inserted', reservationId: data.id as string, message: '新規登録しました' }
}
