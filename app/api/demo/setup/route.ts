import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const DEMO_SALON_ID = 'demo0000-0000-0000-0000-000000000001'

export async function POST() {
  const supabase = getSupabaseAdmin()

  // === 既存デモデータを全削除（冪等性） ===
  await supabase.from('sales').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('visits').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('reservations').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('customer_tickets').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('customer_subscriptions').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('customer_coupons').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('customer_courses').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('counseling_sessions').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('customers').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('staff').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('staff_shifts').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('menus').delete().eq('salon_id', DEMO_SALON_ID)
  await supabase.from('sns_posts').delete().eq('salon_id', DEMO_SALON_ID)

  // === スタッフ3名 ===
  const staffData = [
    { salon_id: DEMO_SALON_ID, name: '田中 美咲', color: '#C4728A', role: 'stylist', is_active: true },
    { salon_id: DEMO_SALON_ID, name: '鈴木 あかり', color: '#9B8EC4', role: 'stylist', is_active: true },
    { salon_id: DEMO_SALON_ID, name: '佐藤 由美', color: '#5A9EC4', role: 'stylist', is_active: true },
  ]
  await supabase.from('staff').insert(staffData)

  // === シフト（今週分） ===
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const shiftData: { salon_id: string; staff_name: string; shift_date: string; start_time: string; end_time: string }[] = []
  for (let d = 0; d < 7; d++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + d)
    const dateStr = date.toISOString().split('T')[0]
    if (d < 5) { // 平日
      staffData.forEach(s => {
        shiftData.push({ salon_id: DEMO_SALON_ID, staff_name: s.name, shift_date: dateStr, start_time: '10:00', end_time: '19:00' })
      })
    } else if (d === 5) { // 土曜は2名
      shiftData.push({ salon_id: DEMO_SALON_ID, staff_name: '田中 美咲', shift_date: dateStr, start_time: '10:00', end_time: '18:00' })
      shiftData.push({ salon_id: DEMO_SALON_ID, staff_name: '鈴木 あかり', shift_date: dateStr, start_time: '10:00', end_time: '18:00' })
    }
  }
  await supabase.from('staff_shifts').insert(shiftData)

  // === 顧客10名 ===
  const customerNames = [
    { name: '山田 花子', phone: '090-1234-5678', status: 'active' },
    { name: '佐々木 美優', phone: '090-2345-6789', status: 'vip' },
    { name: '伊藤 さくら', phone: '090-3456-7890', status: 'active' },
    { name: '渡辺 真理', phone: '090-4567-8901', status: 'at_risk' },
    { name: '高橋 えみ', phone: '090-5678-9012', status: 'active' },
    { name: '中村 あい', phone: '090-6789-0123', status: 'vip' },
    { name: '小林 ゆき', phone: '090-7890-1234', status: 'dormant' },
    { name: '加藤 れな', phone: '090-8901-2345', status: 'active' },
    { name: '吉田 もも', phone: '090-9012-3456', status: 'temporary' },
    { name: '松本 りこ', phone: '090-0123-4567', status: 'active' },
  ]
  const { data: customers } = await supabase
    .from('customers')
    .insert(customerNames.map(c => ({
      salon_id: DEMO_SALON_ID,
      name: c.name,
      phone: c.phone,
      status: c.status,
      visit_count: Math.floor(Math.random() * 20) + 1,
      total_spent: Math.floor(Math.random() * 500000) + 10000,
    })))
    .select('id, name')

  // === メニュー10件 ===
  const menuData = [
    { name: 'フェイシャル ベーシック', category: 'facial', price: 8000, duration: 60 },
    { name: 'フェイシャル プレミアム', category: 'facial', price: 15000, duration: 90 },
    { name: 'ボディ リラクゼーション', category: 'body', price: 10000, duration: 60 },
    { name: 'ボディ デトックス', category: 'body', price: 18000, duration: 90 },
    { name: '全身脱毛', category: 'hair_removal', price: 25000, duration: 120 },
    { name: 'VIO脱毛', category: 'hair_removal', price: 12000, duration: 45 },
    { name: 'ヘッドスパ', category: 'head', price: 6000, duration: 30 },
    { name: '小顔矯正', category: 'facial', price: 12000, duration: 60 },
    { name: 'まつげパーマ', category: 'eye', price: 5000, duration: 45 },
    { name: 'ブライダルエステ', category: 'special', price: 35000, duration: 120 },
  ]
  await supabase.from('menus').insert(menuData.map(m => ({
    salon_id: DEMO_SALON_ID,
    name: m.name,
    price: m.price,
    duration: m.duration,
    is_active: true,
  })))

  // === 予約20件（過去・未来含む） ===
  if (customers && customers.length > 0) {
    const staffNames = staffData.map(s => s.name)
    const beds = ['A', 'B']
    const statuses = ['confirmed', 'confirmed', 'confirmed', 'completed', 'cancelled', 'no_show']
    const reservations: {
      salon_id: string; customer_id: string; customer_name: string;
      reservation_date: string; start_time: string; end_time: string;
      menu: string; staff_name: string; price: number; status: string;
      bed_id: string; duration_minutes: number
    }[] = []

    for (let i = 0; i < 20; i++) {
      const dayOffset = i < 8 ? -(i + 1) : i - 7 // 8件過去、12件未来
      const d = new Date()
      d.setDate(d.getDate() + dayOffset)
      const hour = 10 + (i % 8)
      const cust = customers[i % customers.length]
      const menuItem = menuData[i % menuData.length]
      const isPast = dayOffset < 0

      reservations.push({
        salon_id: DEMO_SALON_ID,
        customer_id: cust.id,
        customer_name: cust.name,
        reservation_date: d.toISOString().split('T')[0],
        start_time: `${hour.toString().padStart(2, '0')}:00`,
        end_time: `${(hour + 1).toString().padStart(2, '0')}:00`,
        menu: menuItem.name,
        staff_name: staffNames[i % staffNames.length],
        price: menuItem.price,
        status: isPast ? (i % 5 === 0 ? 'cancelled' : 'completed') : statuses[i % 3],
        bed_id: beds[i % beds.length],
        duration_minutes: menuItem.duration,
      })
    }
    await supabase.from('reservations').insert(reservations)
  }

  // === 売上データ3ヶ月分 ===
  const salesData: {
    salon_id: string; sale_date: string; amount: number;
    customer_name: string; menu: string; staff_name: string;
    payment_method: string; sale_type: string
  }[] = []
  for (let month = 2; month >= 0; month--) {
    for (let day = 1; day <= 25; day++) {
      const d = new Date()
      d.setMonth(d.getMonth() - month)
      d.setDate(day)
      if (d > new Date()) break
      const dateStr = d.toISOString().split('T')[0]
      const numSales = Math.floor(Math.random() * 4) + 2
      for (let s = 0; s < numSales; s++) {
        const menuItem = menuData[Math.floor(Math.random() * menuData.length)]
        const cust = customerNames[Math.floor(Math.random() * customerNames.length)]
        salesData.push({
          salon_id: DEMO_SALON_ID,
          sale_date: dateStr,
          amount: menuItem.price,
          customer_name: cust.name,
          menu: menuItem.name,
          staff_name: staffData[Math.floor(Math.random() * staffData.length)].name,
          payment_method: ['cash', 'card', 'online'][Math.floor(Math.random() * 3)],
          sale_type: ['cash', 'card', 'online'][Math.floor(Math.random() * 3)],
        })
      }
    }
  }
  // Supabase has row limit per insert, batch by 500
  for (let i = 0; i < salesData.length; i += 500) {
    await supabase.from('sales').insert(salesData.slice(i, i + 500))
  }

  // === SNS投稿5件 ===
  const snsPosts = [
    { title: '春のフェイシャルキャンペーン', content: '春限定のフェイシャルトリートメントが20%OFF！', platform: 'instagram', status: 'published' },
    { title: 'スタッフ紹介 - 田中美咲', content: '今月のMVPスタッフ田中をご紹介します。', platform: 'instagram', status: 'published' },
    { title: 'ヘッドスパ体験レポート', content: 'お客様の声をご紹介。極上のリラクゼーション体験。', platform: 'twitter', status: 'draft' },
    { title: 'サロン内装リニューアル', content: '新しい施術室をオープンしました！', platform: 'instagram', status: 'published' },
    { title: 'ブライダルエステプラン', content: '結婚式前の集中ケアプランのご案内です。', platform: 'line', status: 'scheduled' },
  ]
  await supabase.from('sns_posts').insert(snsPosts.map(p => ({
    salon_id: DEMO_SALON_ID,
    ...p,
    created_at: new Date().toISOString(),
  })))

  return NextResponse.json({ success: true, message: 'デモデータをセットアップしました' })
}
