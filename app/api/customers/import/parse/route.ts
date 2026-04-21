/**
 * CSVパースAPI
 * UTF-8 / Shift-JIS 自動判定対応
 * FormData(file) または JSON(csvBase64, csvText) で受け付け
 */
import { NextRequest, NextResponse } from 'next/server'
import iconv from 'iconv-lite'
import { parseCSVToCustomers } from '@/lib/csv-parse'

/** Shift-JISかどうかを推定（UTF-8として無効なバイト列があればSJISと判定） */
function detectEncoding(buf: Buffer): 'utf8' | 'sjis' {
  // BOM付きUTF-8
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return 'utf8'
  // UTF-8としてデコードして文字化けチェック
  const utf8 = buf.toString('utf8')
  // UTF-8の置換文字（U+FFFD）が含まれていたらSJISの可能性が高い
  if (utf8.includes('\uFFFD')) return 'sjis'
  // Shift-JIS特有のバイトパターンをチェック
  for (let i = 0; i < Math.min(buf.length, 1000); i++) {
    const b = buf[i]
    if ((b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xFC)) {
      if (i + 1 < buf.length) {
        const b2 = buf[i + 1]
        if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFC)) {
          // UTF-8としてデコードした結果に日本語が少なければSJIS
          const sjisText = iconv.decode(buf.slice(0, 200), 'shift_jis')
          const hasJapanese = /[ぁ-ん]|[ァ-ヴ]|[一-龥]|[Ａ-Ｚ]/.test(sjisText)
          if (hasJapanese) return 'sjis'
        }
      }
    }
  }
  return 'utf8'
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let csvRaw: string

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const encHint = formData.get('encoding') as string
      if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })
      const buf = Buffer.from(await file.arrayBuffer())
      // ユーザー指定があればそれを使い、なければ自動判定
      const encoding = encHint === 'sjis' ? 'sjis' : encHint === 'utf8' ? 'utf8' : detectEncoding(buf)
      csvRaw = encoding === 'sjis' ? iconv.decode(buf, 'shift_jis') : buf.toString('utf8')
    } else {
      const body = await req.json() as {
        csvBase64?: string
        csvText?: string
        encoding?: 'utf8' | 'sjis'
      }
      if (body.csvBase64) {
        const buf = Buffer.from(body.csvBase64, 'base64')
        const encoding = body.encoding === 'sjis' ? 'sjis' : body.encoding === 'utf8' ? 'utf8' : detectEncoding(buf)
        csvRaw = encoding === 'sjis' ? iconv.decode(buf, 'shift_jis') : buf.toString('utf8')
      } else if (body.csvText) {
        csvRaw = body.csvText
      } else {
        return NextResponse.json({ error: 'csvBase64、csvText、または file が必要です' }, { status: 400 })
      }
    }

    const customers = parseCSVToCustomers(csvRaw)

    if (customers.length === 0) {
      return NextResponse.json({
        error: '有効な顧客データが見つかりませんでした。CSVのヘッダー行に「氏名」「名前」等のカラムが含まれているか確認してください。',
      }, { status: 400 })
    }

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('CSVパースエラー:', error)
    return NextResponse.json({ error: 'CSVのパースに失敗しました' }, { status: 500 })
  }
}
