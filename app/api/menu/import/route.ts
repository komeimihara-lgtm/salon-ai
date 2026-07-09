import { CLAUDE_MODELS } from '@/lib/ai-models'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// 画像/PDFのVision解析は時間がかかるためタイムアウトを延長
export const maxDuration = 60
export const dynamic = 'force-dynamic'

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

【最重要】施術内容と価格（割引後）が特定できるものは、クーポン/キャンペーン/コースであっても必ず menus に含めてください（name=施術名, price=割引後の金額, duration=所要時間, category=施術カテゴリ）。取り込み対象は menus です。

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

type MenuLike = { name?: string; menuName?: string; duration?: number; price?: number; category?: string; needsReview?: boolean }
type Extracted = { menus?: MenuLike[]; courses?: MenuLike[]; campaigns?: MenuLike[]; coupons?: MenuLike[]; subscriptions?: MenuLike[]; categories?: string[] }

const DEFAULT_CATEGORIES = ['フェイシャル', 'ボディ', '脱毛', 'オプション', '物販', 'キャンペーン', 'クーポン']

/** 途中で切れたJSONから完全なオブジェクトだけ救出（max_tokens超過対策） */
function salvageMenus(s: string): Extracted | null {
  const idx = s.indexOf('"menus"')
  if (idx < 0) return null
  const items: MenuLike[] = []
  const re = /\{[^{}]*\}/g
  let m: RegExpExecArray | null
  const region = s.slice(idx)
  while ((m = re.exec(region))) { try { items.push(JSON.parse(m[0])) } catch { /* 不完全要素は無視 */ } }
  return items.length ? { menus: items } : null
}

function normalizeMediaType(t: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' {
  if (t === 'application/pdf') return 'application/pdf'
  if (t === 'image/jpeg' || t === 'image/webp' || t === 'image/png') return t
  return 'image/png'
}

/** 1コンテンツをVisionで解析してJSON化（壊れていたら救出） */
async function extractFromContent(content: Anthropic.MessageParam['content']): Promise<Extracted | null> {
  const response = await client.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 8000,
    messages: [{ role: 'user', content }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) as Extracted } catch { return salvageMenus(clean) }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const type = formData.get('type') as string
    const url = formData.get('url') as string | null
    const files = formData.getAll('files') as File[]
    const file = formData.get('file') as File | null
    const fileList = files.length > 0 ? files : (file ? [file] : [])

    const results: Extracted[] = []

    if (type === 'url') {
      if (!url?.trim()) {
        return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
      }
      const pageText = await fetchAndParseUrl(url)
      const p = await extractFromContent([{
        type: 'text' as const,
        text: `【以下のWebページのテキストを解析してメニューを抽出してください】\n\n${pageText}\n\n${MENU_EXTRACT_PROMPT}`,
      }])
      if (p) results.push(p)
    } else {
      if (fileList.length === 0) {
        return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
      }
      if (fileList.length > 20) {
        return NextResponse.json({ error: '画像は最大20枚までアップロードできます' }, { status: 400 })
      }
      // 1枚ずつ解析（複数まとめると出力JSONが max_tokens 超過で途中で切れるため）
      // 1ファイルの失敗（破損画像・API一時エラー等）は警告扱いにして他のファイルは処理を続ける
      for (const f of fileList) {
        try {
          const base64 = Buffer.from(await f.arrayBuffer()).toString('base64')
          const mediaType = normalizeMediaType(f.type || 'image/png')
          const content = [
            { type: mediaType === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: MENU_EXTRACT_PROMPT },
          ] as Anthropic.MessageParam['content']
          let p = await extractFromContent(content)
          // 稀に空で返るため1回だけ再試行
          const isEmpty = (x: Extracted | null) => !x || !((x.menus?.length) || (x.campaigns?.length) || (x.coupons?.length) || (x.courses?.length))
          if (isEmpty(p)) p = await extractFromContent(content)
          if (p) results.push(p)
        } catch (fileErr) {
          console.error(`メニューインポート: ファイル ${f.name} の解析に失敗`, fileErr)
        }
      }
    }
    }

    // 全結果を menus に集約（クーポン/キャンペーン/コース/サブスクも取りこぼさない）
    const toMenu = (x: MenuLike, cat: string) => ({
      name: (x?.name || x?.menuName || '要確認'),
      duration: typeof x?.duration === 'number' ? x.duration : 60,
      price: typeof x?.price === 'number' ? x.price : 0,
      category: x?.category || cat,
      needsReview: x?.needsReview ?? (!x?.name || x?.name === '要確認'),
    })
    const collected: ReturnType<typeof toMenu>[] = []
    let categories = DEFAULT_CATEGORIES
    for (const r of results) {
      for (const m of r.menus || []) collected.push(toMenu(m, 'フェイシャル'))
      for (const c of r.campaigns || []) collected.push(toMenu(c, 'キャンペーン'))
      for (const c of r.coupons || []) collected.push(toMenu(c, 'クーポン'))
      for (const c of r.courses || []) collected.push(toMenu(c, 'オプション'))
      for (const s of r.subscriptions || []) collected.push(toMenu(s, 'オプション'))
      if (r.categories && r.categories.length) categories = r.categories
    }
    // ¥0（割引ラベルのみ等のノイズ）を除去し、名前で重複除去（最高価格を残す）
    // 【7月限定】等の飾りを外して正規化 →「【2ヶ月以内3回】○○コース」と「○○コース」を同一視
    const nameKey = (s: string) => s
      .replace(/【[^】]*】/g, '')
      .replace(/[★☆◎♪！!？?　\s]/g, '')
      .toLowerCase()
    const byName = new Map<string, ReturnType<typeof toMenu>>()
    for (const m of collected) {
      if (!(m.price > 0) || !m.name || m.name === '要確認') continue
      const key = nameKey(m.name)
      if (!key) continue
      const ex = byName.get(key)
      if (!ex || m.price > ex.price) byName.set(key, m)
    }
    const menus = [...byName.values()]

    return NextResponse.json({ menus, categories })
  } catch (e) {
    console.error('メニューインポートエラー:', e)
    return NextResponse.json({ error: `読み取りに失敗しました（${String(e).slice(0, 120)}）` }, { status: 500 })
  }
}
