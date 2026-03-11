import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// キャッシュ（サーバーメモリ、デプロイまでの間保持）
let cachedProposals: unknown = null
let cacheDate: string = ''

export async function POST(req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // 同じ日のキャッシュがあれば返す
    if (cachedProposals && cacheDate === today) {
      return NextResponse.json({ proposals: cachedProposals })
    }

    const supabase = getSupabaseAdmin()

    // 今日〜3日以内の予約を取得
    const in3days = new Date()
    in3days.setDate(in3days.getDate() + 3)
    const in3daysStr = in3days.toISOString().slice(0, 10)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('customer_id, customer_name, reservation_date, menu, start_time')
      .eq('salon_id', DEMO_SALON_ID)
      .eq('status', 'confirmed')
      .gte('reservation_date', today)
      .lte('reservation_date', in3daysStr)
      .order('reservation_date', { ascending: true })
      .limit(20)

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ proposals: [], message: '今後3日以内の予約がありません' })
    }

    // 顧客詳細を取得
    const customerIds = reservations
      .filter(r => r.customer_id)
      .map(r => r.customer_id)

    const { data: customers } = customerIds.length > 0
      ? await supabase
          .from('customers')
          .select('id, name, visit_count, last_visit_date, birthday, memo, concerns, status')
          .in('id', customerIds)
      : { data: [] }

    const summary = reservations.map(r => {
      const customer = customers?.find(c => c.id === r.customer_id)
      const birthday = customer?.birthday
      let daysToBirthday = null
      if (birthday) {
        const [y, m, d] = birthday.split('-').map(Number)
        const bday = new Date(new Date().getFullYear(), m - 1, d)
        if (bday < new Date()) bday.setFullYear(bday.getFullYear() + 1)
        daysToBirthday = Math.ceil((bday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }
      return {
        name: r.customer_name,
        reservation_date: r.reservation_date,
        menu: r.menu || '',
        visit_count: customer?.visit_count || 0,
        birthday_soon: daysToBirthday !== null && daysToBirthday >= 0 && daysToBirthday <= 14,
        days_to_birthday: daysToBirthday,
        concerns: customer?.concerns || '',
        memo: (customer?.memo || '').slice(0, 100),
        customer_rank: (() => {
          const status = customer?.status
          if (status === 'vip') return 'vip'
          if (status === 'at_risk') return 'at_risk'
          if (status === 'dormant') return 'dormant'
          const visitCount = customer?.visit_count || 0
          if (visitCount === 0 || visitCount === 1) return 'new'
          return 'active'
        })(),
      }
    })

    const systemPrompt = `あなたはエステサロンの「感動体験」を設計するプロのコンサルタントです。
私たちの仕事の本質は「お客様を幸せにすること」です。私たちは「幸せ屋さん」です。

お客様が本当に求めているのは：
- 悩みの解決の先にある美しさ
- 自分への自信
- 今よりも気持ちの良い毎日

【感動体験のアイデアリスト】
以下の中から顧客のランク・状況に合わせて提案すること：

＜特別体験＞
- 📸 ビフォーアフター写真で施術効果を数値化してプレゼント（肌スコア・毛穴・ハリなど）
- 💆 ちょっとした無料追加施術（5〜10分の特別ケア）
- 💧 お悩みに合わせた特別美容液・美容成分の塗布
- 🍵 美容ハーブティー・美容ドリンクのサービス
- 🌸 好きな香り（アロマ）・季節のお花のプレゼント
- ✨ お悩みに合わせた施術アレンジ（手順・美容液の変更）
- 🎁 サプライズプレゼント（サンプル・ミニコスメ）
- 💌 手書きメッセージカード

＜ランク別対応方針＞
※ 割引・値引きは絶対に提案しない。
  代わりに「時間・コストをかけずに特別感を演出する体験」を提案すること。
  特別な施術のサービス・バージョンUPはOK。

- VIP（来店10回以上 or 累計10万円以上）:
  最高級の感謝体験。
  例：特別美容液での仕上げケア・ビフォーアフター写真のプレゼント・
  手書きメッセージカード・限定アロマの使用・施術後の特別ドリンク

- アクティブ（通常来店中）:
  来店のたびに「また来たい」と思わせる体験。
  例：今回のお悩みに合わせた美容液の変更・
  5分間の無料追加ケア・季節のハーブティーサービス

- 失客予備軍（60〜120日未来店）:
  「このサロンは私のことを気にかけてくれている」と感じさせる体験。
  例：5分間の特別無料ケア・お悩みに合わせた施術アレンジ・
  ウェルカムメッセージで近況を気にかける言葉

- 休眠客（120日以上未来店・3回以上来店）:
  「おかえりなさい」の温かい歓迎体験。
  例：久しぶりの来店を歓迎する特別アロマ演出・
  前回からの変化に寄り添うカウンセリング・
  ビフォーアフター写真で現状確認のプレゼント

- 初回来店:
  不安を安心・感動に変えるお出迎え体験。
  例：丁寧なカウンセリングシートの説明・
  お悩みに合わせた施術内容の事前説明・
  施術後のスキンケアサンプルプレゼント・
  ビフォーアフター写真でお土産作り

message_templateは実際にLINEで送れる自然な日本語文にすること。
敬語・温かみ・パーソナライズを意識すること。
お客様の名前・来店回数・お悩みを必ず織り込むこと。

出力は必ず以下のJSON形式のみ。説明文は含めない。
{"proposals":[{
  "customer_name":"顧客名",
  "customer_rank":"vip|active|at_risk|dormant|new",
  "reason":"提案理由（短く）",
  "initiative":"具体的な取り組み内容",
  "special_experience":"特別体験の具体的内容（例：ビフォーアフター写真撮影＋肌スコアカードプレゼント）",
  "action_type":"message|task|offer|surprise",
  "message_template":"実際にLINEで送れるメッセージ文",
  "priority":1
}]}

priorityは1-5（1が最優先）。最大5件まで。`

    const userPrompt = `【今後3日以内の来店予定顧客】
${JSON.stringify(summary, null, 2)}

各顧客のランク・来店回数・お悩みを考慮して、
その人だけの特別な感動体験を設計してください。
特にat_risk（失客予備軍）・dormant（休眠客）のお客様には
特別オファーや無料追加施術を積極的に提案してください。`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('予期しないレスポンス形式')

    let parsed: { proposals?: unknown[] }
    try {
      const text = content.text.replace(/```json\n?|\n?```/g, '').trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      parsed = { proposals: [] }
    }

    const proposals = (parsed.proposals || []).slice(0, 5)

    // 当日キャッシュに保存
    cachedProposals = proposals
    cacheDate = today

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('customer-delight API Error:', error)
    return NextResponse.json(
      { error: '提案の生成に失敗しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
