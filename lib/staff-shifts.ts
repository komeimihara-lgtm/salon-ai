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

export async function fetchTodayShifts(): Promise<StaffShift[]> {
  const today = new Date().toISOString().slice(0, 10)
  const res = await fetch(`/api/shifts?date=${today}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  const shifts = (json.shifts || []).map((s: { id: string; staffName: string; staffColor: string; date: string; start: string; end: string }) => ({
    id: s.id,
    staffName: s.staffName,
    staffColor: s.staffColor || '#C4728A',
    date: s.date,
    start: s.start,
    end: s.end,
  }))
  return shifts
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
