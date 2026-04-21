/**
 * カウンセリングカルテ（構造化保存用）
 */
export type CounselingKartePayload = {
  date: string
  phase1: {
    source: string
    experience: string
    experience_detail: string
  }
  phase2: {
    menu_category: string
    symptom: string
    home_care: string
    since: string
    timing: string
  }
  phase2_5: {
    contraindications: string
  }
  phase3: {
    expectation: string
  }
  phase4: {
    goal_timing: string
    goal_scene: string
    goal_state: string
  }
  phase5: {
    continue: string
    salon_value: string
  }
  phase7: {
    staff_style: string
  }
  phase7_5: {
    anxiety: string
  }
}

export function emptyCounselingKarte(visitDate: string): CounselingKartePayload {
  return {
    date: visitDate,
    phase1: { source: '', experience: '', experience_detail: '' },
    phase2: { menu_category: '', symptom: '', home_care: '', since: '', timing: '' },
    phase2_5: { contraindications: '' },
    phase3: { expectation: '' },
    phase4: { goal_timing: '', goal_scene: '', goal_state: '' },
    phase5: { continue: '', salon_value: '' },
    phase7: { staff_style: '' },
    phase7_5: { anxiety: '' },
  }
}
