import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `以下のサロン経営アドバイスから、今すぐ取り組むべきタスクを抽出してください。
タスクがない場合は空配列を返してください。
JSONのみ返してください。マークダウン不要。

形式:
{
  "tasks": [
    {
      "text": "タスクの内容（具体的なアクション）",
      "priority": "high" | "medium" | "low",
      "due_date": "YYYY-MM-DD or null"
    }
  ]
}

アドバイス:
${message}`
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ tasks: [] })
  }
}
