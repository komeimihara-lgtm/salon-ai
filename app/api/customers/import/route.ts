import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

// ペンギンCSVの日付フォーマットを変換（YYYY/MM/DD → YYYY-MM-DD）
function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  const cleaned = dateStr.trim().replace(/\//g, '-')
  return cleaned || null
}

// 金額文字列を数値に変換（"¥1,234" → 1234）
function parseAmount(amountStr: string | undefined): number {
  if (!amountStr) return 0
  return parseInt(amountStr.replace(/[¥,，\s]/g, '')) || 0
}

// 性別変換
function parseGender(genderStr: string | undefined): string {
  if (!genderStr) return 'unknown'
  if (genderStr.includes('女') || genderStr.toLowerCase() === 'female') return 'female'
  if (genderStr.includes('男') || genderStr.toLowerCase() === 'male') return 'male'
  return 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rows } = body // CSVをパースした行データ配列

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'データが空です' }, { status: 400 })
    }

    // ペンギンCSVフォーマットに対応したマッピング
    const customers = rows.map((row: Record<string, string>) => {
      // カラム名の揺れに対応
      const name = row['氏名'] || row['顧客名'] || row['name'] || ''
      const nameKana = row['フリガナ'] || row['ふりがな'] || row['name_kana'] || ''
      const phone = row['電話番号'] || row['TEL'] || row['tel'] || ''
      const email = row['メールアドレス'] || row['メール'] || row['email'] || ''
      const birthday = row['生年月日'] || row['誕生日'] || ''
      const gender = row['性別'] || ''
      const address = row['住所'] || ''
      const firstVisit = row['初回来店日'] || row['初回来店'] || ''
      const lastVisit = row['最終来店日'] || row['最終来店'] || ''
      const visitCount = row['来店回数'] || '0'
      const totalSpent = row['累計売上'] || row['累計金額'] || '0'
      const memo = row['メモ'] || row['備考'] || ''

      const visitCountNum = parseInt(visitCount) || 0
      const totalSpentNum = parseAmount(totalSpent)

      return {
        salon_id: getSalonIdFromCookie(),
        name: name.trim(),
        name_kana: nameKana.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        birthday: parseDate(birthday),
        gender: parseGender(gender),
        address: address.trim() || null,
        first_visit_date: parseDate(firstVisit),
        last_visit_date: parseDate(lastVisit),
        visit_count: visitCountNum,
        total_spent: totalSpentNum,
        avg_unit_price: visitCountNum > 0 ? Math.round(totalSpentNum / visitCountNum) : 0,
        memo: memo.trim() || null,
        status: 'active' as const,
        imported_from: 'penguin',
      }
    }).filter((c: { name: string }) => c.name) // 名前が空の行は除外

    if (customers.length === 0) {
      return NextResponse.json({ error: '有効なデータが見つかりませんでした' }, { status: 400 })
    }

    // バッチINSERT（重複時はUPDATE）
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .upsert(customers, {
        onConflict: 'salon_id,phone', // 同じサロン・電話番号なら更新
        ignoreDuplicates: false,
      })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      imported: customers.length,
      message: `${customers.length}件の顧客データをインポートしました`,
    })
  } catch (error) {
    console.error('CSVインポートエラー:', error)
    return NextResponse.json({ error: 'インポートに失敗しました' }, { status: 500 })
  }
}
