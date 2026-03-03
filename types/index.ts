// ============================================================
// Salon AI — 型定義
// ============================================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface LeoMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SalonKPI {
  monthly_target: number
  monthly_actual: number
  customer_count: number
  repeat_rate: number
  lost_customers: number
  avg_unit_price: number
  days_remaining: number
}

export interface SalonProfile {
  id: string
  name: string
  owner_name: string
  plan: 'standard' | 'pro' | 'premium'
  kpi: SalonKPI
}

export interface Customer {
  id: string
  salon_id: string
  name: string
  name_kana?: string
  phone?: string
  email?: string
  birthday?: string
  gender?: 'female' | 'male' | 'other' | 'unknown'
  address?: string
  first_visit_date?: string
  last_visit_date?: string
  visit_count: number
  total_spent: number
  avg_unit_price: number
  skin_type?: string
  concerns?: string
  allergies?: string
  memo?: string
  line_user_id?: string
  status: 'active' | 'lost' | 'vip'
  imported_from?: string
  created_at: string
  updated_at: string
}

export interface Visit {
  id: string
  salon_id: string
  customer_id: string
  visit_date: string
  menu?: string
  staff_name?: string
  amount: number
  skin_condition?: string
  treatment_note?: string
  counseling_note?: string
  next_visit_suggestion?: string
  scope_image_before?: string
  scope_image_after?: string
  scope_analysis?: string
  created_at: string
}

export interface Reservation {
  id: string
  salon_id: string
  customer_id?: string
  customer_name: string
  customer_phone?: string
  reservation_date: string
  start_time: string
  end_time?: string
  menu?: string
  staff_name?: string
  price: number
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  memo?: string
  reminder_sent_at?: string
  created_at: string
  updated_at: string
}

export interface PenguinCSVRow {
  顧客番号?: string
  氏名: string
  フリガナ?: string
  電話番号?: string
  メールアドレス?: string
  生年月日?: string
  性別?: string
  住所?: string
  初回来店日?: string
  最終来店日?: string
  来店回数?: string
  累計売上?: string
  メモ?: string
}
