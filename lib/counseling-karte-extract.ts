import type { CounselingKartePayload } from '@/lib/counseling-karte-types'
import { emptyCounselingKarte } from '@/lib/counseling-karte-types'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** 選択肢行（／のみの行）を除いたアシスタント文面 */
function assistantQuestionBody(content: string): string {
  const lines = content.trim().split('\n').map((l) => l.trim())
  if (lines.length >= 2) {
    const last = lines[lines.length - 1]
    if (last.includes('／') && !last.includes('？') && !last.includes('?')) {
      return lines.slice(0, -1).join('\n').trim()
    }
  }
  return content.trim()
}

type FieldKey =
  | 'phase1.source'
  | 'phase1.experience'
  | 'phase1.experience_detail'
  | 'phase2.menu_category'
  | 'phase2.symptom'
  | 'phase2.home_care'
  | 'phase2.since'
  | 'phase2.timing'
  | 'phase2_5.contraindications'
  | 'phase3.expectation'
  | 'phase4.goal_timing'
  | 'phase4.goal_scene'
  | 'phase4.goal_state'
  | 'phase5.continue'
  | 'phase5.salon_value'
  | 'phase7.staff_style'
  | 'phase7_5.anxiety'

/** 先に一致させるほど優先度高い */
const RULES: { match: (q: string) => boolean; key: FieldKey }[] = [
  { match: (q) => q.includes('お知りになりましたか') || q.includes('どちらでお知り'), key: 'phase1.source' },
  { match: (q) => q.includes('通われたご経験') && q.includes('クリニック'), key: 'phase1.experience' },
  { match: (q) => q.includes('どのような施術を受けられましたか'), key: 'phase1.experience_detail' },
  { match: (q) => q.includes('お悩みでご来店'), key: 'phase2.menu_category' },
  { match: (q) => q.includes('具体的にはどんなことでお悩み'), key: 'phase2.symptom' },
  { match: (q) => q.includes('自宅での自己処理は'), key: 'phase2.home_care' },
  { match: (q) => q.includes('自宅でのスキンケアは'), key: 'phase2.home_care' },
  { match: (q) => q.includes('自宅でのボディケアは'), key: 'phase2.home_care' },
  { match: (q) => q.includes('普段の生活習慣は'), key: 'phase2.home_care' },
  { match: (q) => q.includes('普段のセルフケアは'), key: 'phase2.home_care' },
  { match: (q) => q.includes('いつ頃から気になっていますか'), key: 'phase2.since' },
  { match: (q) => q.includes('気になるタイミングはいつ'), key: 'phase2.timing' },
  { match: (q) => q.includes('施術前に確認させてください'), key: 'phase2_5.contraindications' },
  { match: (q) => q.includes('期待することは何ですか'), key: 'phase3.expectation' },
  { match: (q) => q.includes('お悩みを解決したいですか'), key: 'phase4.goal_timing' },
  { match: (q) => q.includes('場面でその変化を感じたい'), key: 'phase4.goal_scene' },
  { match: (q) => q.includes('具体的な目標数値はありますか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('どのくらいの状態を目指していますか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('理想のお肌はどんな状態ですか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('目標の体型・サイズはありますか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('どんな状態になりたいですか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('どんな変化を期待されていますか'), key: 'phase4.goal_state' },
  { match: (q) => q.includes('通い続けてくださる予定はありますか'), key: 'phase5.continue' },
  { match: (q) => q.includes('サロンとして、どんな点を大切に') || q.includes('通い続けるサロンとして'), key: 'phase5.salon_value' },
  { match: (q) => q.includes('スタッフとの関わり方はいかが'), key: 'phase7.staff_style' },
  { match: (q) => q.includes('心配なことやご不安なことはありますか'), key: 'phase7_5.anxiety' },
]

function setField(karte: CounselingKartePayload, key: FieldKey, value: string) {
  const v = value.trim()
  if (!v) return
  const [a, b] = key.split('.') as [string, string]
  if (a === 'phase1') {
    const cur = karte.phase1[b as keyof CounselingKartePayload['phase1']]
    karte.phase1[b as keyof CounselingKartePayload['phase1']] = cur ? `${cur}、${v}` : v
  } else if (a === 'phase2') {
    const cur = karte.phase2[b as keyof CounselingKartePayload['phase2']]
    karte.phase2[b as keyof CounselingKartePayload['phase2']] = cur ? `${cur}、${v}` : v
  } else if (a === 'phase2_5') {
    karte.phase2_5.contraindications = karte.phase2_5.contraindications ? `${karte.phase2_5.contraindications}、${v}` : v
  } else if (a === 'phase3') {
    karte.phase3.expectation = karte.phase3.expectation ? `${karte.phase3.expectation}、${v}` : v
  } else if (a === 'phase4') {
    const cur = karte.phase4[b as keyof CounselingKartePayload['phase4']]
    karte.phase4[b as keyof CounselingKartePayload['phase4']] = cur ? `${cur} | ${v}` : v
  } else if (a === 'phase5') {
    const cur = karte.phase5[b as keyof CounselingKartePayload['phase5']]
    karte.phase5[b as keyof CounselingKartePayload['phase5']] = cur ? `${cur}、${v}` : v
  } else if (a === 'phase7') {
    karte.phase7.staff_style = karte.phase7.staff_style ? `${karte.phase7.staff_style}、${v}` : v
  } else if (a === 'phase7_5') {
    karte.phase7_5.anxiety = karte.phase7_5.anxiety ? `${karte.phase7_5.anxiety}、${v}` : v
  }
}

/**
 * アシスタント発話ごとに直後のユーザー発話（複数あれば結合）を紐づけ、karte へ格納
 */
export function extractKarteFromMessages(messages: ChatMessage[], visitDate: string): CounselingKartePayload {
  const karte = emptyCounselingKarte(visitDate)
  let i = 0
  while (i < messages.length) {
    const m = messages[i]
    if (m.role !== 'assistant') {
      i++
      continue
    }
    const qBody = assistantQuestionBody(m.content)
    const rule = RULES.find((r) => r.match(qBody))
    i++
    const userChunks: string[] = []
    while (i < messages.length && messages[i].role === 'user') {
      userChunks.push(messages[i].content.trim())
      i++
    }
    if (rule && userChunks.length > 0) {
      setField(karte, rule.key, userChunks.join('、'))
    }
  }
  return karte
}
