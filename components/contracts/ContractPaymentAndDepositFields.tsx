'use client'

import { CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL } from '@/lib/contracts-payment'

export type ContractPaymentDepositFieldsValues = {
  amount: number | ''
  depositAmount: number | ''
  depositPaidAt: string
  remainingPaidAt: string
  depositPaymentMethod: 'cash' | 'card' | 'loan' | 'transfer' | ''
  instrumentMethod: 'cash' | 'card' | 'loan' | 'transfer' | 'auto_billing'
  cardBrand: 'visa' | 'master' | 'jcb' | 'amex' | 'diners' | 'unionpay' | 'other'
  loanCompany: string
  paymentType: 'lump_sum' | 'installment'
  installPreset: '3' | '6' | '12' | '24' | '36' | 'other'
  installOtherCount: number
  installMonthly: number | ''
  installFirst: number | ''
  installNote: string
  billingDay: number
  billingMethod: 'card' | 'bank_transfer'
  firstBillingDate: string
  billingCycle: 'monthly' | 'quarterly' | 'biannual' | 'annual'
}

type Props = {
  values: ContractPaymentDepositFieldsValues
  onPatch: (p: Partial<ContractPaymentDepositFieldsValues>) => void
  /** 残金の表示用（省略時は amount - deposit を計算） */
  remainingAmountDisplay?: number
}

export function defaultContractPaymentDepositValues(): ContractPaymentDepositFieldsValues {
  return {
    amount: 0,
    depositAmount: 0,
    depositPaidAt: '',
    remainingPaidAt: '',
    depositPaymentMethod: '',
    instrumentMethod: 'cash',
    cardBrand: 'visa',
    loanCompany: '',
    paymentType: 'lump_sum',
    installPreset: '12',
    installOtherCount: 18,
    installMonthly: 0,
    installFirst: 0,
    installNote: '',
    billingDay: 1,
    billingMethod: 'card',
    firstBillingDate: '',
    billingCycle: 'monthly',
  }
}

export function ContractPaymentAndDepositFields({
  values: v,
  onPatch,
  remainingAmountDisplay,
}: Props) {
  const amountNum = Number(v.amount)
  const depositNum =
    v.depositAmount === '' ? 0 : Math.max(0, Math.min(Number(v.depositAmount), amountNum || 0))
  const remaining =
    remainingAmountDisplay !== undefined
      ? remainingAmountDisplay
      : Number.isFinite(amountNum)
        ? Math.max(0, amountNum - depositNum)
        : 0

  const patch = onPatch

  return (
    <>
      <div>
        <label className="text-xs text-[#4A5568] mb-1 block">契約金額 *</label>
        <input
          type="number"
          min={0}
          value={v.amount}
          onChange={e => patch({ amount: e.target.value ? parseInt(e.target.value, 10) : '' })}
          className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-[#FFFBEB] border border-amber-200 rounded-lg p-3 space-y-3">
        <p className="text-xs font-medium text-[#4A5568]">頭金・残金</p>
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">頭金（円）</label>
          <input
            type="number"
            min={0}
            max={Number.isFinite(amountNum) ? amountNum : undefined}
            value={v.depositAmount}
            onChange={e =>
              patch({ depositAmount: e.target.value ? parseInt(e.target.value, 10) : '' })
            }
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <p className="text-sm text-[#1A202C]">
          残金: <span className="font-semibold tabular-nums">¥{remaining.toLocaleString()}</span>
          <span className="text-xs text-[#4A5568] ml-1">（契約金額 − 頭金）</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">頭金入金日</label>
            <input
              type="date"
              value={v.depositPaidAt}
              onChange={e => patch({ depositPaidAt: e.target.value })}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">残金入金日</label>
            <input
              type="date"
              value={v.remainingPaidAt}
              onChange={e => patch({ remainingPaidAt: e.target.value })}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">頭金の支払い方法</label>
          <select
            value={v.depositPaymentMethod}
            onChange={e =>
              patch({
                depositPaymentMethod: e.target.value as ContractPaymentDepositFieldsValues['depositPaymentMethod'],
              })
            }
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">未選択</option>
            {(Object.keys(CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL) as Array<
              keyof typeof CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL
            >).map(k => (
              <option key={k} value={k}>
                {CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#4A5568] mb-1 block">支払い方法（契約全体）</label>
        <select
          value={v.instrumentMethod}
          onChange={e =>
            patch({ instrumentMethod: e.target.value as ContractPaymentDepositFieldsValues['instrumentMethod'] })
          }
          className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
        >
          <option value="cash">現金</option>
          <option value="card">クレジットカード</option>
          <option value="loan">ローン</option>
          <option value="transfer">銀行振込</option>
          <option value="auto_billing">自動引き落とし（サブスク用）</option>
        </select>
      </div>

      {v.instrumentMethod === 'card' && (
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">カード種別</label>
          <select
            value={v.cardBrand}
            onChange={e =>
              patch({ cardBrand: e.target.value as ContractPaymentDepositFieldsValues['cardBrand'] })
            }
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="visa">VISA</option>
            <option value="master">Mastercard</option>
            <option value="jcb">JCB</option>
            <option value="amex">AMEX</option>
            <option value="diners">Diners Club</option>
            <option value="unionpay">銀聯（UnionPay）</option>
            <option value="other">その他</option>
          </select>
        </div>
      )}

      {v.instrumentMethod === 'loan' && (
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">ローン会社名</label>
          <input
            type="text"
            value={v.loanCompany}
            onChange={e => patch({ loanCompany: e.target.value })}
            placeholder="例: ○○信販"
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {v.instrumentMethod === 'auto_billing' && (
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-[#4A5568]">自動引き落とし（将来の Stripe 等と連携可能な項目）</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">引き落とし日（毎月）</label>
              <select
                value={v.billingDay}
                onChange={e => patch({ billingDay: parseInt(e.target.value, 10) })}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">初回決済日</label>
              <input
                type="date"
                value={v.firstBillingDate}
                onChange={e => patch({ firstBillingDate: e.target.value })}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">引き落とし方法</label>
            <select
              value={v.billingMethod}
              onChange={e =>
                patch({ billingMethod: e.target.value as ContractPaymentDepositFieldsValues['billingMethod'] })
              }
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            >
              <option value="card">クレジットカード自動決済</option>
              <option value="bank_transfer">口座振替</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">決済サイクル</label>
            <select
              value={v.billingCycle}
              onChange={e =>
                patch({
                  billingCycle: e.target.value as ContractPaymentDepositFieldsValues['billingCycle'],
                })
              }
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            >
              <option value="monthly">毎月</option>
              <option value="quarterly">毎3ヶ月</option>
              <option value="biannual">毎6ヶ月</option>
              <option value="annual">毎年</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-[#4A5568] mb-1 block">支払い回数</label>
        <select
          value={v.paymentType}
          onChange={e =>
            patch({ paymentType: e.target.value as ContractPaymentDepositFieldsValues['paymentType'] })
          }
          className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
        >
          <option value="lump_sum">一括</option>
          <option value="installment">分割</option>
        </select>
      </div>

      {v.paymentType === 'installment' && (
        <div className="bg-[#F8F5FF] border border-[#BAE6FD] rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-[#4A5568]">分割払い詳細</p>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">分割回数</label>
            <select
              value={v.installPreset}
              onChange={e =>
                patch({ installPreset: e.target.value as ContractPaymentDepositFieldsValues['installPreset'] })
              }
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm mb-2"
            >
              <option value="3">3回</option>
              <option value="6">6回</option>
              <option value="12">12回</option>
              <option value="24">24回</option>
              <option value="36">36回</option>
              <option value="other">その他</option>
            </select>
            {v.installPreset === 'other' && (
              <input
                type="number"
                min={2}
                value={v.installOtherCount}
                onChange={e => patch({ installOtherCount: parseInt(e.target.value, 10) || 2 })}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                placeholder="回数"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">月額</label>
              <input
                type="number"
                min={0}
                value={v.installMonthly}
                onChange={e =>
                  patch({ installMonthly: e.target.value ? parseInt(e.target.value, 10) : '' })
                }
                placeholder="¥10,000"
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">初回金額</label>
              <input
                type="number"
                min={0}
                value={v.installFirst}
                onChange={e =>
                  patch({ installFirst: e.target.value ? parseInt(e.target.value, 10) : '' })
                }
                placeholder="¥20,000"
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">備考</label>
            <input
              type="text"
              value={v.installNote}
              onChange={e => patch({ installNote: e.target.value })}
              placeholder="例: 毎月27日引き落とし"
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </>
  )
}
