import { NextResponse } from 'next/server'

/** 全スタッフ一覧（フォールバック用） */
const DEFAULT_STAFF = [
  { name: '田中', color: '#C4728A' },
  { name: '鈴木', color: '#9B8EC4' },
]

export async function GET() {
  return NextResponse.json({ staff: DEFAULT_STAFF })
}
