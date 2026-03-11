'use client'

import { useState, useEffect } from 'react'

export interface StaffShift {
  id: string
  staffName: string
  staffColor: string
  date: string
  start: string
  end: string
  bookings?: number
  freeSlots?: string
}

function mapShiftFromApi(s: { id: string; staff_id: string; date: string; start_time: string; end_time: string; staff?: { id: string; name: string; color: string } | null }): StaffShift {
  const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff
  return {
    id: s.id,
    staffName: staff?.name ?? '',
    staffColor: staff?.color ?? '#C4728A',
    date: s.date,
    start: s.start_time?.slice(0, 5) ?? '09:00',
    end: s.end_time?.slice(0, 5) ?? '18:00',
  }
}

export async function fetchTodayShifts(): Promise<StaffShift[]> {
  const today = new Date().toISOString().slice(0, 10)
  const res = await fetch(`/api/shifts?date=${today}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return (json.shifts || []).map(mapShiftFromApi)
}

export function useTodayShifts(): StaffShift[] {
  const [shifts, setShifts] = useState<StaffShift[]>([])

  useEffect(() => {
    let cancelled = false
    fetchTodayShifts()
      .then(data => { if (!cancelled) setShifts(data) })
      .catch(() => { if (!cancelled) setShifts([]) })
    return () => { cancelled = true }
  }, [])

  return shifts
}
