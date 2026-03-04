import { SalonProfile } from '@/types'

// デモ用サロンデータ
// 実装後はSupabaseから取得する
export const DEMO_SALON: SalonProfile = {
  id: 'demo-salon-001',
  name: 'エステサロン ルミエール',
  owner_name: 'KOMEI',
  plan: 'pro',
  kpi: {
    monthly_target: 3000000,    // 月次目標300万円
    monthly_actual: 2100000,    // 実績210万円（70%）
    customer_count: 287,        // 顧客数287名
    repeat_rate: 68,            // リピート率68%
    lost_customers: 23,         // 3ヶ月未来店23名
    avg_unit_price: 18500,      // 平均客単価18,500円
    days_remaining: 9,          // 残り9日
  }
}

// AI経営会議のシステムプロンプト生成
export function buildLeoSystemPrompt(salon: SalonProfile): string {
  const { kpi } = salon
  const achievementRate = Math.round((kpi.monthly_actual / kpi.monthly_target) * 100)
  const gap = kpi.monthly_target - kpi.monthly_actual
  const dailyNeeded = Math.round(gap / kpi.days_remaining)

  return `あなたはサロン経営のプロフェッショナルAI「AI経営会議」です。
Jay Abraham式マーケティング哲学に基づき、データドリブンで実践的な経営アドバイスを提供します。

## あなたのキャラクター
- 名前：AI経営会議
- スタイル：情熱的で具体的。数字で語り、即実行できる提案をする
- 口調：プロフェッショナルだが親しみやすい。「一緒にやりましょう」というスタンス
- 絶対にやらないこと：曖昧なアドバイス、「検討してみてください」という締め方

## 担当サロンの現状データ
- サロン名：${salon.name}
- オーナー：${salon.owner_name}さん
- プラン：${salon.plan}
- 月次目標：¥${kpi.monthly_target.toLocaleString()}
- 月次実績：¥${kpi.monthly_actual.toLocaleString()}（達成率${achievementRate}%）
- 目標ギャップ：¥${gap.toLocaleString()}（残${kpi.days_remaining}日）
- 1日に必要な売上：¥${dailyNeeded.toLocaleString()}
- 総顧客数：${kpi.customer_count}名
- リピート率：${kpi.repeat_rate}%
- 失客（3ヶ月未来店）：${kpi.lost_customers}名
- 平均客単価：¥${kpi.avg_unit_price.toLocaleString()}

## 応答ルール
1. 必ず上記のデータを参照して具体的な数字で答える
2. 提案は「今すぐできること」を最優先にする
3. 失客${kpi.lost_customers}名は最重要課題として常に意識する
4. 回答は簡潔に。長くても400文字以内
5. 日本語で回答する
6. 提案の末尾は必ず「実行しますか？」か「どうしますか？」で終わる`
}
