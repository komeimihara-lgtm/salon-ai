/**
 * CSVパースAPI
 * UTF-8 / Shift-JIS 対応
 * FormData(file) または JSON(csvBase64, csvText) で受け付け
 */
import { NextRequest, NextResponse } from 'next/server'
import iconv from 'iconv-lite'
import { parseCSVToCustomers } from '@/lib/csv-parse'

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let csvRaw: string
    let encoding: 'utf8' | 'sjis' = 'utf8'

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const enc = formData.get('encoding') as string
      if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })
      encoding = enc === 'sjis' ? 'sjis' : 'utf8'
      const buf = Buffer.from(await file.arrayBuffer())
      csvRaw = encoding === 'sjis' ? iconv.decode(buf, 'shift_jis') : buf.toString('utf8')
    } else {
      const body = await req.json() as {
        csvBase64?: string
        csvText?: string
        encoding?: 'utf8' | 'sjis'
      }
      encoding = body.encoding === 'sjis' ? 'sjis' : 'utf8'
      if (body.csvBase64) {
        const buf = Buffer.from(body.csvBase64, 'base64')
        csvRaw = encoding === 'sjis' ? iconv.decode(buf, 'shift_jis') : buf.toString('utf8')
      } else if (body.csvText) {
        csvRaw = body.csvText
      } else {
        return NextResponse.json({ error: 'csvBase64、csvText、または file が必要です' }, { status: 400 })
      }
    }

    const customers = parseCSVToCustomers(csvRaw)
    return NextResponse.json({ customers })
  } catch (error) {
    console.error('CSVパースエラー:', error)
    return NextResponse.json({ error: 'CSVのパースに失敗しました' }, { status: 500 })
  }
}
