import { NextRequest, NextResponse } from 'next/server'
import {
  getSalonSaleOperator,
  canCancelSale,
  canModifySale,
} from '@/lib/salon-sale-operator'

export const dynamic = 'force-dynamic'

/** 売上一覧の取消・修正ボタン表示用 */
export async function GET(req: NextRequest) {
  const op = await getSalonSaleOperator(req)
  return NextResponse.json({
    role: op.role,
    canCancel: canCancelSale(op.role),
    canModify: canModifySale(op.role),
    displayName: op.displayName || null,
  })
}
