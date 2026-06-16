// SOLA サンプルデータ一括投入スクリプト（AYAMI版に倣った手動シード）
//
// 使い方:
//   SEED_SALON_ID=<対象salon_id> node scripts/seed-sample-data.mjs
//   または:  node scripts/seed-sample-data.mjs <対象salon_id>
//   未指定時は SOLA デモサロン(de000000-...) を対象にする
//
// 投入内容（実行日を基準に動的生成）:
//   - スタッフ 4名 / 顧客 15名
//   - シフト（日曜定休・10:00〜20:00）
//   - 予約: 過去2週間=completed / 今日=混在 / 今後2週間=confirmed（各日4-6件）
//     → 感動体験API（今日〜明後日のconfirmed）が必ず対象を拾えるようにする
//   - 売上: completed 予約に紐づけて生成
//   - 顧客の visit_count / total_spent / last_visit_date を集計更新
//
// 既存データがある場合は二重投入を防ぐためエラー終了する（SEED_FORCE=1 で強制実行）
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
if (!SUPA_URL || !SERVICE_KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が .env.local にありません'); process.exit(1) }
const sb = createClient(SUPA_URL, SERVICE_KEY)

const SALON_ID = process.env.SEED_SALON_ID || process.argv[2] || 'de000000-0000-0000-0000-000000000001'

// ── 日付ユーティリティ（JST基準） ──────────────────────────
function jstDateStr(d = new Date()) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}
function addDays(s, days) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}
function* dateRange(start, end) {
  for (let d = start; d <= end; d = addDays(d, 1)) yield d
}
function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
function pickN(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n) }
function timeAdd(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}

const TODAY = jstDateStr()
const START = addDays(TODAY, -14)
const END = addDays(TODAY, 14)

console.log('=== SOLA サンプルデータ投入 ===')
console.log(`対象 salon_id : ${SALON_ID}`)
console.log(`期間          : ${START} 〜 ${END}（today=${TODAY}）`)

// ── 二重投入ガード ──────────────────────────
{
  const { count } = await sb.from('customers').select('id', { count: 'exact', head: true }).eq('salon_id', SALON_ID)
  if (count && count > 0 && process.env.SEED_FORCE !== '1') {
    console.error(`\n⚠ このサロンには既に顧客 ${count} 件があります。二重投入を防ぐため中止しました。`)
    console.error('  強制実行する場合は SEED_FORCE=1 を付けて再実行してください。')
    process.exit(1)
  }
}

// ── 1. スタッフ ──────────────────────────
const STAFF = [
  { name: '山田 美咲', color: '#C4728A' },
  { name: '佐藤 玲奈', color: '#9B8EC4' },
  { name: '鈴木 さくら', color: '#7DC0A2' },
  { name: '田中 由美', color: '#E0A458' },
]
console.log('=== スタッフ投入 ===')
const { data: insertedStaff, error: e1 } = await sb
  .from('staff')
  .insert(STAFF.map(s => ({ ...s, salon_id: SALON_ID, is_active: true })))
  .select()
if (e1) { console.error(e1); process.exit(1) }
console.log(`✓ ${insertedStaff.length} 名`)

// ── 2. 顧客 ──────────────────────────
const CUSTOMERS = [
  { name: '小林 杏奈', name_kana: 'コバヤシ アンナ', phone: '090-1111-1001', email: 'anna@example.com', gender: 'female', birthday: '1992-07-14', first_visit_date: '2025-08-12', status: 'active', concerns: 'たるみ、毛穴', memo: 'カウンセリング丁寧に' },
  { name: '佐々木 優', name_kana: 'ササキ ユウ', phone: '090-1111-1002', email: 'yu@example.com', gender: 'female', birthday: '1988-03-22', first_visit_date: '2024-11-03', status: 'vip', concerns: '結婚式前のブライダルケア', memo: '敏感肌・薬剤注意' },
  { name: '田中 麻衣', name_kana: 'タナカ マイ', phone: '090-1111-1003', email: 'mai@example.com', gender: 'female', birthday: '1995-11-08', first_visit_date: '2026-01-10', status: 'active', concerns: 'ニキビ跡', memo: '' },
  { name: '伊藤 香織', name_kana: 'イトウ カオリ', phone: '090-1111-1004', email: 'kaori@example.com', gender: 'female', birthday: '1980-05-30', first_visit_date: '2024-06-14', status: 'vip', concerns: 'シミ、しわ', memo: 'VIP・お茶を出す' },
  { name: '渡辺 由佳', name_kana: 'ワタナベ ユカ', phone: '090-1111-1005', email: 'yuka@example.com', gender: 'female', birthday: '1990-02-19', first_visit_date: '2025-04-22', status: 'active', concerns: 'くすみ', memo: '' },
  { name: '山本 真理', name_kana: 'ヤマモト マリ', phone: '090-1111-1006', email: 'mari@example.com', gender: 'female', birthday: '1985-09-11', first_visit_date: '2025-02-05', status: 'active', concerns: '小顔ケア', memo: '' },
  { name: '中村 美和', name_kana: 'ナカムラ ミワ', phone: '090-1111-1007', email: 'miwa@example.com', gender: 'female', birthday: '1993-12-25', first_visit_date: '2025-10-17', status: 'active', concerns: '保湿', memo: '誕生日近い' },
  { name: '小川 千夏', name_kana: 'オガワ チナツ', phone: '090-1111-1008', email: 'chinatsu@example.com', gender: 'female', birthday: '1998-06-30', first_visit_date: '2026-03-04', status: 'active', concerns: 'ニキビ', memo: '' },
  { name: '加藤 さやか', name_kana: 'カトウ サヤカ', phone: '090-1111-1009', email: 'sayaka@example.com', gender: 'female', birthday: '1982-01-17', first_visit_date: '2024-09-21', status: 'at_risk', concerns: '更年期肌悩み', memo: '前回から2ヶ月空き' },
  { name: '吉田 まな', name_kana: 'ヨシダ マナ', phone: '090-1111-1010', email: 'mana@example.com', gender: 'female', birthday: '1996-04-08', first_visit_date: '2026-02-20', status: 'active', concerns: 'リフトアップ', memo: '' },
  { name: '橋本 玲', name_kana: 'ハシモト レイ', phone: '090-1111-1011', email: 'rei@example.com', gender: 'female', birthday: '1991-08-03', first_visit_date: '2025-12-02', status: 'active', concerns: '毛穴開き', memo: '' },
  { name: '森田 麗子', name_kana: 'モリタ レイコ', phone: '090-1111-1012', email: 'reiko@example.com', gender: 'female', birthday: '1978-10-26', first_visit_date: '2024-03-15', status: 'vip', concerns: 'エイジングケア全般', memo: '長年のお得意様' },
  { name: '高橋 凛', name_kana: 'タカハシ リン', phone: '090-1111-1013', email: 'rin@example.com', gender: 'female', birthday: '1999-11-14', first_visit_date: '2026-05-09', status: 'active', concerns: 'ニキビ', memo: '20代前半' },
  { name: '清水 由貴', name_kana: 'シミズ ユキ', phone: '090-1111-1014', email: 'yuki@example.com', gender: 'female', birthday: '1987-07-21', first_visit_date: '2025-06-18', status: 'active', concerns: '産後ケア', memo: '' },
  { name: '木村 杏', name_kana: 'キムラ アン', phone: '090-1111-1015', email: 'an@example.com', gender: 'female', birthday: '1994-03-09', first_visit_date: '2025-11-25', status: 'active', concerns: '美白', memo: '' },
]
console.log('=== 顧客投入 ===')
const { data: insertedCustomers, error: e2 } = await sb
  .from('customers')
  .insert(CUSTOMERS.map(c => ({ ...c, salon_id: SALON_ID, visit_count: 0, total_spent: 0, avg_unit_price: 0 })))
  .select()
if (e2) { console.error(e2); process.exit(1) }
console.log(`✓ ${insertedCustomers.length} 名`)

// ── 3. シフト（日曜定休・10:00〜20:00） ──────────────────────────
console.log('=== シフト投入 ===')
const shifts = []
for (const date of dateRange(START, END)) {
  if (dayOfWeek(date) === 0) continue
  const onDuty = dayOfWeek(date) === 6 ? insertedStaff : pickN(insertedStaff, 3)
  for (const st of onDuty) {
    shifts.push({ salon_id: SALON_ID, staff_id: st.id, date, start_time: '10:00:00', end_time: '20:00:00' })
  }
}
const { error: e3 } = await sb.from('shifts').insert(shifts)
if (e3) { console.error(e3); process.exit(1) }
console.log(`✓ ${shifts.length} シフト`)

// ── 4. 予約 & 売上 ──────────────────────────
const MENUS = [
  { name: 'フェイシャル60分', price: 8800, duration: 60 },
  { name: 'フェイシャル90分（プレミアム）', price: 13200, duration: 90 },
  { name: '小顔リフトアップ', price: 11000, duration: 60 },
  { name: '美白集中ケア', price: 12000, duration: 75 },
  { name: '毛穴洗浄＋パック', price: 9800, duration: 75 },
  { name: 'BAブライダルケア', price: 16500, duration: 90 },
  { name: 'カウンセリング＋初回ケア', price: 5500, duration: 60 },
  { name: 'デコルテケアセット', price: 13800, duration: 90 },
  { name: 'たるみ集中ケア', price: 14300, duration: 75 },
  { name: 'リラクゼーション全身', price: 11000, duration: 90 },
]
const BEDS = ['A', 'B']
console.log('=== 予約 & 売上 投入 ===')
const reservations = []
const sales = []
let rsvCount = 0
let salesAmount = 0

for (const date of dateRange(START, END)) {
  if (dayOfWeek(date) === 0) continue
  const isPast = date < TODAY
  const isToday = date === TODAY
  const dailyStaff = pickN(insertedStaff, dayOfWeek(date) === 6 ? 4 : 3)
  const numRsv = 4 + Math.floor(Math.random() * 3) // 4-6件
  const bedNextStart = { A: '10:00', B: '10:30' }
  for (let i = 0; i < numRsv; i++) {
    const menu = MENUS[Math.floor(Math.random() * MENUS.length)]
    const cust = insertedCustomers[Math.floor(Math.random() * insertedCustomers.length)]
    const staff = dailyStaff[i % dailyStaff.length]
    const bed = BEDS[i % 2]
    const start = bedNextStart[bed]
    if (parseInt(start) >= 19) break // 19:00以降は打ち切り
    const end = timeAdd(start, menu.duration + 15)
    bedNextStart[bed] = timeAdd(end, 0)
    // ステータス: 過去=completed / 今日=半々 / 未来=confirmed
    let status = 'confirmed'
    if (isPast) status = 'completed'
    else if (isToday && Math.random() < 0.5) status = 'completed'

    reservations.push({
      salon_id: SALON_ID,
      customer_id: cust.id,
      customer_name: cust.name,
      customer_phone: cust.phone,
      reservation_date: date,
      start_time: start.length === 5 ? start + ':00' : start,
      end_time: end,
      menu: menu.name,
      staff_name: staff.name,
      price: menu.price,
      status,
      bed_id: `bed-${bed === 'A' ? 1 : 2}`,
      duration_minutes: menu.duration,
    })
    rsvCount++

    if (status === 'completed') {
      sales.push({
        salon_id: SALON_ID,
        sale_date: date,
        amount: menu.price,
        customer_id: cust.id,
        customer_name: cust.name,
        menu: menu.name,
        staff_name: staff.name,
        payment_method: ['cash', 'card'][Math.floor(Math.random() * 2)],
        sale_type: ['cash', 'card'][Math.floor(Math.random() * 2)],
      })
      salesAmount += menu.price
    }
  }
}

const { error: e4 } = await sb.from('reservations').insert(reservations)
if (e4) { console.error(e4); process.exit(1) }
console.log(`✓ 予約 ${rsvCount} 件`)

const { error: e5 } = await sb.from('sales').insert(sales)
if (e5) { console.error(e5); process.exit(1) }
console.log(`✓ 売上 ${sales.length} 件 / 合計 ¥${salesAmount.toLocaleString()}`)

// ── 5. 顧客サマリ更新 ──────────────────────────
console.log('=== 顧客サマリ更新 ===')
const completedByCust = {}
for (const r of reservations.filter(r => r.status === 'completed')) {
  if (!r.customer_id) continue
  const c = completedByCust[r.customer_id] || { count: 0, sum: 0, last: '' }
  c.count++
  c.sum += r.price
  if (r.reservation_date > c.last) c.last = r.reservation_date
  completedByCust[r.customer_id] = c
}
for (const [cid, agg] of Object.entries(completedByCust)) {
  await sb.from('customers').update({
    visit_count: agg.count,
    total_spent: agg.sum,
    avg_unit_price: Math.round(agg.sum / agg.count),
    last_visit_date: agg.last,
  }).eq('id', cid)
}
console.log(`✓ ${Object.keys(completedByCust).length} 名の顧客サマリ更新`)

console.log('\n=== 完了 ===')
console.log(`salon_id: ${SALON_ID}`)
console.log(`スタッフ: ${insertedStaff.length}、顧客: ${insertedCustomers.length}、シフト: ${shifts.length}`)
console.log(`予約: ${rsvCount}、売上: ${sales.length}件 (¥${salesAmount.toLocaleString()})`)
console.log('\n次の手順:')
console.log('  1) /customer-delight を開いて感動体験を生成')
console.log('  2) /dashboard を開く → 「今日のタスク」に感動体験タスクが表示される')
