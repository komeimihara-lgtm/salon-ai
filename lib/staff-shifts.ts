'use client'

import { useState, useEffect } from 'react'
import { getSalonSettings } from '@/lib/salon-settings'

export interface TodayShift {
  staffName: string
  staffColor: string
  start: string
  end: string
  bookings?: number
  freeSlots?: string
}

export function useTodayShifts(): TodayShift[] {
  const [shifts, setShifts] = useState<TodayShift[]>([])

  useEffect(() => {
    const settings = getSalonSettings()
    const today = settings.staff.map((s, i) => ({
      staffName: s.name,
      staffColor: s.color || (i % 2 ? '#C4728A' : '#9B8EC4'),
      start: '09:00',
      end: '18:00',
      bookings: 0,
      freeSlots: '-',
    }))
    setShifts(today)
  }, [])

  return shifts
}
