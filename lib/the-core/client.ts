/** The Core — クライアント */

import Anthropic from '@anthropic-ai/sdk'
import { buildCounselingSolaFlowInstructions } from '@/lib/counseling-sola-flow-prompt'
import { SOLA_HUMAN_SPEECH_BLOCK } from '@/lib/counseling-sola-human-speech'
import type { ProcessMessageInput, TheCoreResponse } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_MEMORY_PROMPT_CHARS = 2000

function memoryContextBlock(userContext: ProcessMessageInput['userContext']): string {
  const st = userContext.memoryShortTerm
  const lt = userContext.memoryLongTerm
  const hasSt = st && typeof st === 'object' && Object.keys(st).length > 0
  const hasLt = lt && typeof lt === 'object' && Object.keys(lt).length > 0
  if (!hasSt && !hasLt) return 'なし'
  const chunks: string[] = []
  if (hasSt) chunks.push(`短期: ${JSON.stringify(st)}`)
  if (hasLt) chunks.push(`長期: ${JSON.stringify(lt)}`)
  return chunks.join(' ').slice(0, MAX_MEMORY_PROMPT_CHARS)
}

function buildSystemPrompt(input: ProcessMessageInput): string {
  const { persona, userContext } = input
  const customerName = userContext.name || 'お客様'
  const courseName = userContext.todaysCourse || '（未設定）'
  const staffName = userContext.staffName || '（未設定）'

  const historyText =
    userContext.treatmentHistory.length > 0
      ? userContext.treatmentHistory
          .map((t: Record<string, unknown>) => `${t.visit_date}: ${t.menu || '施術'}`)
          .join('\n')
      : 'なし'

  const memoryText = memoryContextBlock(userContext)

  return `あなたは${persona.name}、${persona.basePersonality}。
話し方のスタイル：${persona.speakingStyle}

【キャラクター・魂の設定】
あなたは単なる質問ボットではありません。
目の前のお客様の人生に、本気で関わろうとする存在です。

- 温かく・知性的・共感的。お客様の言葉の奥にある気持ちを感じ取る
- 「この方のことを、もっと知りたい」という純粋な関心を持って接する
- AIだからこそ、評価しない・比べない・プレッシャーをかけない
  → 人間のスタッフには話しにくいことも、自然と話せる空気をつくる
- AIだからこそ、これまで積み重ねてきた施術の経験と知見から
  その方だけに合ったご提案ができる

話し方のトーン：
- 丁寧だけど、堅くない。親しみがある
- 共感の言葉は必ず心から。形式的な「そうなんですね」は使わない
- お客様の言葉を大切に扱う。必ず名前で呼ぶ
- 沈黙や迷いも、温かく受け止める

${SOLA_HUMAN_SPEECH_BLOCK}

【全体の設計思想】
最初は「アンケートに答えているだけ」でいい。
会話を重ね、お悩み・期待・ゴールが明確になり、本日の施術へ安心して進める状態をつくる。
急がない。押しつけない。

${buildCounselingSolaFlowInstructions({ customerName, courseName, staffName })}

【補足】
- お客様が迷う・答えにくいときは「無理に答えなくて大丈夫です」と伝えてよい。
- 料金・契約の詳細はこのチャットの役割外。施術内容の希望・不安の共有に徹する。

【利用可能なコンテキスト】
- お客様の名前：${customerName}
- 本日のコース：${courseName}
- 担当スタッフ：${staffName}
- 施術履歴：${historyText}
- お肌の悩み：${userContext.skinConcerns || 'なし'}
- アレルギー：${userContext.allergies || 'なし'}
- SOLAの記憶（過去の会話で蓄積。参考にしつつ、今日のお話を最優先）：${memoryText}

【追加指示：感情分析・Bond Score】
会話の最後に、以下のJSON形式でメタデータを <!-- CORE_META: {...} --> タグ内に出力してください。
このタグはお客様には表示されません。

{
  "emotion": {
    "primary": "お客様の主要な感情（例: 期待、不安、安心）",
    "intensity": 0.0〜1.0,
    "valence": -1.0〜1.0,
    "notes": "感情に関するメモ"
  },
  "bondUpdate": {
    "bond_score_delta": -0.1〜0.3,
    "bond_score": null,
    "trust_indicators": {}
  },
  "memoryUpdates": {
    "short_term": { "今回の会話で分かったこと（任意・キーは自由）" },
    "long_term": { "次回以降も覚えておきたいこと（任意）" }
  },
  "counselingPhaseAdvice": "phase1〜phase8、phase2.5（禁忌）、phase7.5（不安確認）など。今どの段階か"
}
※ memoryUpdates・bond_score は省略可。bond_score を数値で出す場合は絶対値として保存されます。bond_score_delta は既存スコアに加算されます。`
}

function parseCoreMeta(text: string): {
  cleanMessage: string
  emotion?: TheCoreResponse['emotion']
  bondUpdate?: TheCoreResponse['bondUpdate']
  memoryUpdates?: TheCoreResponse['memoryUpdates']
  counselingPhaseAdvice?: string
} {
  const metaMatch = text.match(/<!--\s*CORE_META:\s*([\s\S]*?)\s*-->/)
  const cleanMessage = text.replace(/<!--\s*CORE_META:[\s\S]*?-->/g, '').trim()

  if (!metaMatch) {
    return { cleanMessage }
  }

  try {
    const meta = JSON.parse(metaMatch[1]) as Record<string, unknown>
    const mem = meta.memoryUpdates
    const memoryUpdates =
      mem && typeof mem === 'object' && !Array.isArray(mem)
        ? {
            short_term:
              typeof (mem as { short_term?: unknown }).short_term === 'object' &&
              (mem as { short_term?: unknown }).short_term !== null &&
              !Array.isArray((mem as { short_term?: unknown }).short_term)
                ? ((mem as { short_term: Record<string, unknown> }).short_term)
                : undefined,
            long_term:
              typeof (mem as { long_term?: unknown }).long_term === 'object' &&
              (mem as { long_term?: unknown }).long_term !== null &&
              !Array.isArray((mem as { long_term?: unknown }).long_term)
                ? ((mem as { long_term: Record<string, unknown> }).long_term)
                : undefined,
          }
        : undefined
    const memoryUpdatesClean =
      memoryUpdates &&
      ((memoryUpdates.short_term && Object.keys(memoryUpdates.short_term).length > 0) ||
        (memoryUpdates.long_term && Object.keys(memoryUpdates.long_term).length > 0))
        ? memoryUpdates
        : undefined

    return {
      cleanMessage,
      emotion: meta.emotion as TheCoreResponse['emotion'],
      bondUpdate: meta.bondUpdate as TheCoreResponse['bondUpdate'],
      memoryUpdates: memoryUpdatesClean,
      counselingPhaseAdvice: meta.counselingPhaseAdvice as string | undefined,
    }
  } catch {
    return { cleanMessage }
  }
}

export const theCore = {
  async processMessage(input: ProcessMessageInput): Promise<TheCoreResponse> {
    const systemPrompt = buildSystemPrompt(input)

    const messages = [
      ...input.conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: input.message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const rawText =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'ありがとうございます。'

    const { cleanMessage, emotion, bondUpdate, memoryUpdates, counselingPhaseAdvice } =
      parseCoreMeta(rawText)

    return {
      message: cleanMessage,
      emotion,
      bondUpdate,
      memoryUpdates,
      counselingPhaseAdvice,
    }
  },
}
