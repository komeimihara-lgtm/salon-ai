import { NextRequest, NextResponse } from 'next/server'
import { getSalonSaleOperator, canModifySale } from '@/lib/salon-sale-operator'

export const dynamic = 'force-dynamic'

/** 契約の作成・編集・削除がオーナーのみかどうか（一覧・フォーム用） */
export async function GET(req: NextRequest) {
  const op = await getSalonSaleOperator(req)
  return NextResponse.json({
    canManageContracts: canModifySale(op.role),
    role: op.role,
  })
}
