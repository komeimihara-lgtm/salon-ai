'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sola_staff_shifts'

export interface StaffShift {
  id: string
  staffName: string
  staffColor: string
  date: string // YYYY-MM-DD
  start: string // HH:mm
  end: string // HH:mm
  bookings?: number
  freeSlots?: string
}

const DEFAULT_SHIFTS: StaffShift[] = [
  { id: '1', staffName: '田中', staffColor: '#C4728A', date: '', start: '09:00', end: '18:00', bookings: 5, freeSlots: '12:00-13:00' },
  { id: '2', staffName: '鈴木', staffColor: '#9B8EC4', date: '', start: '10:00', end: '19:00', bookings: 4, freeSlots: '14:00-14:30' },
]

export function getStaffShifts(): StaffShift[] {
  if (typeof window === 'undefined') return DEFAULT_SHIFTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SHIFTS
    }
  } catch (_) {}
  return DEFAULT_SHIFTS
}

export function setStaffShifts(shifts: StaffShift[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts))
    window.dispatchEvent(new Event('staff-shifts-updated'))
  } catch (_) {}
}

export function getTodayShifts(): StaffShift[] {
  const today = new Date().toISOString().slice(0, 10)
  const all = getStaffShifts()
  return all
    .filter(s => !s.date || s.date === today)
    .map(s => ({ ...s, date: s.date || today }))
}

export function useTodayShifts(): StaffShift[] {
  const [shifts, setShifts] = useState<StaffShift[]>(() =>
    typeof window !== 'undefined' ? getTodayShifts() : []
  )
  useEffect(() => {
    const update = () => setShifts(getTodayShifts())
    update()
    window.addEventListener('staff-shifts-updated', update)
    return () => window.removeEventListener('staff-shifts-updated', update)
  }, [])
  return shifts
}
