import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staff_id')
    const month = searchParams.get('month')

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('staff_monthly')
      .select('*')
      .eq('salon_id', salonId)
      .order('month', { ascending: false })

    if (staffId) query = query.eq('staff_id', staffId)
    if (month) query = query.eq('month', month)

    const { data, error } = await query
    if (error) throw error

    const list = (data || []).map((d: {
      staff_id: string
      month: string
      personal_goal: string
      monthly_kpi: { sales: number; visits: number; avgPrice: number }
      important_tasks: string[]
      growth_goals: string[]
      must_do: string
    }) => ({
      staffId: d.staff_id,
      month: d.month,
      personalGoal: d.personal_goal || '',
      monthlyKpi: d.monthly_kpi || { sales: 0, visits: 0, avgPrice: 0 },
      importantTasks: (d.important_tasks || ['', '', '']).slice(0, 3) as [string, string, string],
      growthGoals: (d.growth_goals || ['', '', '']).slice(0, 3) as [string, string, string],
      mustDo: d.must_do || '',
    }))

    return NextResponse.json({ data: list })
  } catch (e) {
    console.error('スタッフ月次取得エラー:', e)
    return NextResponse.json({ error: 'スタッフ月次データの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { staffId, month, personalGoal, monthlyKpi, importantTasks, growthGoals, mustDo } = body
    if (!staffId || !month) {
      return NextResponse.json({ error: 'staffId と month は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('staff_monthly').upsert(
      {
        salon_id: salonId,
        staff_id: staffId,
        month,
        personal_goal: personalGoal ?? '',
        monthly_kpi: monthlyKpi ?? { sales: 0, visits: 0, avgPrice: 0 },
        important_tasks: importantTasks ?? ['', '', ''],
        growth_goals: growthGoals ?? ['', '', ''],
        must_do: mustDo ?? '',
      },
      { onConflict: 'staff_id,month' }
    )
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('スタッフ月次保存エラー:', e)
    return NextResponse.json({ error: 'スタッフ月次データの保存に失敗しました' }, { status: 500 })
  }
}
