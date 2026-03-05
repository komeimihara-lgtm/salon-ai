'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import type { Reservation } from '@/types'

export interface UseReservationsOptions {
  date?: string // YYYY-MM-DD
  week?: string // YYYY-MM-DD (週の開始日)
  status?: string
}

export interface UseReservationsResult {
  reservations: Reservation[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  handleVisit: (id: string) => Promise<void>
  handleReschedule: (id: string, form: { reservation_date: string; start_time: string; end_time: string }) => Promise<void>
  handleNoShow: (id: string) => Promise<void>
  handleEdit: (id: string, form: { menu?: string; reservation_date: string; start_time: string; end_time: string; staff_name?: string; price: number; memo?: string }) => Promise<void>
  handleStatusChange: (id: string, status: Reservation['status']) => Promise<void>
}

function buildListUrl(options: UseReservationsOptions): string {
  const params = new URLSearchParams()
  if (options.date) params.set('date', options.date)
  if (options.week) params.set('week', options.week)
  if (options.status) params.set('status', options.status)
  const q = params.toString()
  return `/api/reservations/list${q ? `?${q}` : ''}`
}

export function useReservations(options: UseReservationsOptions = {}): UseReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { date, week, status } = options

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = buildListUrl({ date, week, status })
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReservations(data.reservations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約の取得に失敗しました')
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [date, week, status])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  // Supabase リアルタイム購読
  useEffect(() => {
    try {
      const supabase = getSupabaseClient()
      const channel = supabase
        .channel('reservations-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations' },
          () => {
            fetchReservations()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      // Supabase未設定時は無視
    }
  }, [fetchReservations])

  const refresh = useCallback(async () => {
    await fetchReservations()
  }, [fetchReservations])

  const handleVisit = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/reservations/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await fetchReservations()
    } catch (err) {
      console.error(err)
    }
  }, [fetchReservations])

  const handleNoShow = useCallback(async (id: string) => {
    if (!confirm('無断キャンセルとして記録しますか？')) return
    try {
      const res = await fetch('/api/reservations/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await fetchReservations()
    } catch (err) {
      console.error(err)
    }
  }, [fetchReservations])

  const handleReschedule = useCallback(async (
    id: string,
    form: { reservation_date: string; start_time: string; end_time: string }
  ) => {
    try {
      const res = await fetch('/api/reservations/reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await fetchReservations()
    } catch (err) {
      throw err
    }
  }, [fetchReservations])

  const handleEdit = useCallback(async (
    id: string,
    form: { menu?: string; reservation_date: string; start_time: string; end_time: string; staff_name?: string; price: number; memo?: string }
  ) => {
    try {
      const res = await fetch('/api/reservations/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await fetchReservations()
    } catch (err) {
      throw err
    }
  }, [fetchReservations])

  const handleStatusChange = useCallback(async (id: string, status: Reservation['status']) => {
    try {
      const res = await fetch('/api/reservations/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await fetchReservations()
    } catch (err) {
      console.error(err)
    }
  }, [fetchReservations])

  return {
    reservations,
    loading,
    error,
    refresh,
    handleVisit,
    handleReschedule,
    handleNoShow,
    handleEdit,
    handleStatusChange,
  }
}
