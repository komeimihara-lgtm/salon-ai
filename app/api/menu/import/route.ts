import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

/** URLのHTMLを取得し、テキストを抽出 */
async function fetchAndParseUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SalonAI/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`URL取得失敗: ${res.status}`)
  const html = await res.text()
  // script/style除去、タグ除去、余分な空白整理
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 50000) // トークン制限のため
}

const MENU_EXTRACT_PROMPT = `
以下のコンテンツからメニュー情報を抽出してください。

【重要】クーポン名が「30%OFF」「初回限定」などの割引表現のみの場合、
前後の文脈から施術内容を推定して補完してください。

例：
- 「初回30%OFF」→ 周辺のテキストから施術名を特定
- 「フェイシャル30%OFF 通常12,000円→8,400円」→ 施術名:フェイシャル
- 施術内容が全く不明な場合のみ「要確認」とし、needsReview: true を付与

必ず以下を推定・補完すること：
- 施術カテゴリ（フェイシャル/ボディ/脱毛/まつ毛/ネイル等）
- 施術名（具体的に）
- 通常価格と割引後価格を分けて抽出（割引後をpriceに）
- 所要時間（記載があれば、不明なら60）

分類ルール：
- 「クーポン」「割引券」→ coupons
- 「○回コース」「回数券」→ courses
- 「月額」「サブスク」→ subscriptions
- 「初回限定」「○○OFF」「キャンペーン」→ campaigns
- それ以外の通常施術メニュー → menus

以下のJSON形式のみで返してください。他のテキストは一切含めないでください：
{
  "menus": [
    {
      "name": "メニュー名",
      "duration": 60,
      "price": 8000,
      "category": "フェイシャル",
      "needsReview": false
    }
  ],
  "courses": [{"name":"","menuName":"","totalSessions":5,"price":0,"expiryMonths":6}],
  "campaigns": [{"name":"","discountType":"percent","discountValue":0,"startDate":"","endDate":""}],
  "coupons": [{"name":"","targetMenu":"","discountType":"percent","discountValue":0,"conditions":"","expiryDate":""}],
  "subscriptions": [{"name":"","menuName":"","price":0,"sessionsPerMonth":1,"billingDay":1}],
  "categories": ["フェイシャル", "ボディ", "脱毛", "オプション", "物販", "キャンペーン", "クーポン"]
}

注意：
- nameが「要確認」の場合はneedsReview: true
- durationが不明な場合は60、expiryMonthsが不明な場合は6
- categoryは上記から選択、discountTypeはpercentまたはamount
- 空の配列でも必ずキーを含めること
`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const type = formData.get('type') as string
    const url = formData.get('url') as string | null
    const files = formData.getAll('files') as File[]
    const file = formData.get('file') as File | null
    const fileList = files.length > 0 ? files : (file ? [file] : [])

    let content: Anthropic.MessageParam['content'] = []

    if (type === 'url') {
      if (!url?.trim()) {
        return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
      }
      const pageText = await fetchAndParseUrl(url)
      content = [{
        type: 'text' as const,
        text: `【以下のWebページのテキストを解析してメニューを抽出してください】\n\n${pageText}\n\n${MENU_EXTRACT_PROMPT}`,
      }]
    } else {
      if (fileList.length === 0) {
        return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
      }
      const blocks: Array<{ type: 'image' | 'document'; source: { type: 'base64'; media_type: string; data: string } } | { type: 'text'; text: string }> = []
      for (const f of fileList) {
        const bytes = await f.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mediaType = (f.type || 'image/png') as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
        blocks.push({
          type: mediaType === 'application/pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        })
      }
      blocks.push({ type: 'text', text: MENU_EXTRACT_PROMPT })
      content = blocks as Anthropic.MessageParam['content']
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // needsReviewのデフォルト設定（nameが要確認の場合）
    if (parsed.menus) {
      parsed.menus = parsed.menus.map((m: { name?: string; needsReview?: boolean }) => ({
        ...m,
        needsReview: m.needsReview ?? (m.name === '要確認' || !m.name?.trim()),
      }))
    }

    return NextResponse.json(parsed)
  } catch (e) {
    console.error('メニューインポートエラー:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
