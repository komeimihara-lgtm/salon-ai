import { NextRequest, NextResponse } from 'next/server'

/** 出勤スタッフ（日付でフィルタ。現状はデフォルトを返す） */
const DEFAULT_STAFF = [
  { name: '田中', color: '#C4728A' },
  { name: '鈴木', color: '#9B8EC4' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD
  // TODO: 日付ごとのシフトから出勤スタッフを取得
  // 現状はデフォルトを返す
  return NextResponse.json({ staff: DEFAULT_STAFF })
}
