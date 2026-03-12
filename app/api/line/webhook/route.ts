import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { recalcCustomerAfterCancel } from '@/lib/recalc-customer'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const salonId = getSalonIdFromCookie()

// LINE署名検証
function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyMessage(replyToken: string, text: string, accessToken: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
  })
}

async function replyFlex(replyToken: string, flex: object, accessToken: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'flex', altText: '予約キャンセル確認', contents: flex }]
    })
  })
}

function buildCancelConfirmFlex(reservation: { reservation_date: string; start_time: string; end_time?: string; menu?: string; staff_name?: string; id: string }) {
  const date = reservation.reservation_date
  const start = reservation.start_time?.slice(0, 5) ?? ''
  const end = reservation.end_time?.slice(0, 5) ?? ''
  const menu = reservation.menu || 'メニュー未定'
  const staff = reservation.staff_name || '未定'
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '以下の予約をキャンセルしますか？',
          weight: 'bold',
          size: 'md',
        },
        { type: 'separator' },
        { type: 'text', text: `📅 ${date} ${start}〜${end}`, size: 'sm', margin: 'md' },
        { type: 'text', text: `💆 ${menu}`, size: 'sm' },
        { type: 'text', text: `担当：${staff}`, size: 'sm' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'button',
        action: {
          type: 'postback',
          label: 'キャンセルする',
          data: `action=cancel&reservation_id=${reservation.id}`,
        },
        style: 'primary',
        color: '#E03E52',
      }],
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-line-signature') || ''
    const body = JSON.parse(rawBody)

    // LINEの検証リクエスト（eventsが空配列）の場合は即200を返す
    if (!body.events || body.events.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // サロンのシークレットを取得
    const supabase = getSupabaseAdmin()
    const { data: salon } = await supabase
      .from('salons')
      .select('line_channel_access_token, line_channel_secret, name')
      .eq('id', salonId)
      .single()

    if (!salon?.line_channel_secret) {
      return NextResponse.json({ error: 'LINE設定なし' }, { status: 400 })
    }

    const accessToken = salon.line_channel_access_token || ''

    // 署名検証
    if (!verifySignature(rawBody, signature, salon.line_channel_secret)) {
      return NextResponse.json({ error: '署名検証失敗' }, { status: 401 })
    }

    const events = body.events || []

    for (const event of events) {
      const lineUserId = event.source?.userId
      if (!lineUserId) continue

      switch (event.type) {
        case 'follow': {
          // 友達追加イベント
          await supabase.from('unmatched_line_users').upsert({
            line_user_id: lineUserId,
            followed_at: new Date().toISOString(),
            salon_id: salonId,
          }, { onConflict: 'line_user_id' })

          // 歓迎メッセージを送信
          if (accessToken) {
            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                to: lineUserId,
                messages: [{
                  type: 'text',
                  text: 'ご登録ありがとうございます✨\n\nこちらのLINEでは\n📅 ご予約の確認・受付\n💆 来店前のカウンセリング\n🎁 お得な情報のお届け\n\nができます。\n\n「予約確認」と送っていただくと、次回のご予約をお知らせします😊'
                }]
              })
            })
          }
          break
        }

        case 'unfollow': {
          // ブロックイベント
          await supabase
            .from('customers')
            .update({ line_status: 'blocked' })
            .eq('line_user_id', lineUserId)
            .eq('salon_id', salonId)
          break
        }

        case 'postback': {
          const data = event.postback?.data || ''
          const replyToken = event.replyToken
          if (data.startsWith('action=cancel&reservation_id=')) {
            const reservationId = data.replace('action=cancel&reservation_id=', '')
            const { data: reservation } = await supabase
              .from('reservations')
              .select('*')
              .eq('id', reservationId)
              .eq('salon_id', salonId)
              .single()

            if (reservation) {
              await supabase
                .from('reservations')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', reservationId)

              const customerId = reservation.customer_id
              if (customerId) {
                await recalcCustomerAfterCancel(customerId)
              }

              await replyMessage(replyToken, 'ご予約をキャンセルしました。\nまたのご来店をお待ちしております🌸', accessToken)
            }
          }
          break
        }

        case 'message': {
          if (event.message?.type !== 'text') break
          const text = event.message.text.trim()
          const replyToken = event.replyToken

          // 顧客を検索
          const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('line_user_id', lineUserId)
            .eq('salon_id', salonId)
            .single()

          // inboundメッセージをline_messagesテーブルに保存
          await supabase.from('line_messages').insert({
            salon_id: salonId,
            customer_id: customer?.id || null,
            line_user_id: lineUserId,
            direction: 'inbound',
            message: text,
            is_read: false,
            sent_at: new Date().toISOString(),
          })

          // 「キャンセル」コマンド
          if (text === 'キャンセル') {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toISOString().slice(0, 10)

            const customerId = customer?.id
            let nextReservation = null
            if (customerId) {
              const { data: reservations } = await supabase
                .from('reservations')
                .select('*')
                .eq('customer_id', customerId)
                .eq('salon_id', salonId)
                .eq('status', 'confirmed')
                .gte('reservation_date', tomorrowStr)
                .order('reservation_date', { ascending: true })
                .order('start_time', { ascending: true })
                .limit(1)
              nextReservation = reservations?.[0] ?? null
            }

            if (!nextReservation) {
              await replyMessage(replyToken, 'キャンセル可能な予約はございません', accessToken)
              break
            }

            await replyFlex(replyToken, buildCancelConfirmFlex(nextReservation), accessToken)
            break
          }

          // 「予約確認」コマンド
          if (text === '予約確認') {
            if (!customer) {
              await replyMessage(replyToken, 'お客様情報が見つかりませんでした。\nスタッフにLINE連携をお申し出ください😊', accessToken)
              break
            }

            const todayStr = new Date().toISOString().slice(0, 10)
            const { data: reservations } = await supabase
              .from('reservations')
              .select('*')
              .eq('customer_id', customer.id)
              .eq('salon_id', salonId)
              .in('status', ['confirmed', 'rescheduled'])
              .gte('reservation_date', todayStr)
              .order('reservation_date', { ascending: true })
              .order('start_time', { ascending: true })
              .limit(1)

            const nextRes = reservations?.[0]
            if (!nextRes) {
              await replyMessage(replyToken, `${customer.name}様、現在ご予約はございません。\n\n「予約したい」と送っていただくとご予約を承ります😊`, accessToken)
              break
            }

            const date = nextRes.reservation_date
            const start = nextRes.start_time?.slice(0, 5) ?? ''
            const end = nextRes.end_time?.slice(0, 5) ?? ''
            const menu = nextRes.menu || 'メニュー未定'
            const staff = nextRes.staff_name || '未定'

            const msg = `📅 次のご予約\n日付：${date} 時間：${start}〜${end}\nメニュー：${menu} 担当：${staff}\n変更・キャンセルは「キャンセル」と送信してください`
            await replyMessage(replyToken, msg, accessToken)
            break
          }

          // プレカウンセリング中の場合は既存の処理へ
          const { data: session } = await supabase
            .from('counseling_sessions')
            .select('*')
            .eq('line_user_id', lineUserId)
            .eq('status', 'active')
            .single()

          if (!session) break

          const userMessage = text
          const history = session.conversation_history || []
          history.push({ role: 'user', content: userMessage })

          // AIで次の質問を生成（スタッフとして）
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            system: `あなたは${salon.name}のスタッフです。
お客様のご来店前にLINEでプレカウンセリングを行っています。
以下のルールを必ず守ってください：
- AIであることは絶対に明かさない
- サロンのスタッフとして自然に会話する
- 温かく丁寧な言葉遣い（敬語）
- 絵文字を適度に使い親しみやすく
- 質問は一度に1つだけ
- 全質問が終わったら「ありがとうございます！当日お会いできるのを楽しみにしております😊」で締める

【収集する情報（8問以内）】
1. これまでのお手入れ履歴（ホームケア・エステ・クリニック・なし）
2. 現在のお悩み（予約メニューに関連して）
3. 理想の状態
4. 今回の来店で望むこと（効果重視・根本解決・リラックス）
5. 接客で望むこと（ゆっくりしたい・悩みを聞いてほしい・効果重視）
6. 肌の最近の調子
7. アレルギー・敏感肌の有無
8. スタッフへの一言（任意）

すでに収集した情報：${JSON.stringify(session.collected_data || {})}
予約メニュー：${session.menu || ''}
お客様のお名前：${session.customer_name || ''}様

全質問が完了したらJSONを含めてください：
COUNSELING_COMPLETE:{"collected_data": {...}}`,
            messages: history.map((h: { role: string; content: string }) => ({
              role: h.role as 'user' | 'assistant',
              content: h.content,
            })),
          })

          const aiReply = response.content[0].type === 'text' ? response.content[0].text : ''

          // カウンセリング完了チェック
          let replyText = aiReply
          let isComplete = false
          let collectedData = session.collected_data || {}

          if (aiReply.includes('COUNSELING_COMPLETE:')) {
            const jsonMatch = aiReply.match(/COUNSELING_COMPLETE:(\{[\s\S]*\})/)
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1])
                collectedData = { ...collectedData, ...parsed.collected_data }
                isComplete = true
                replyText = aiReply.replace(/COUNSELING_COMPLETE:[\s\S]*/, '').trim()
              } catch { }
            }
          }

          history.push({ role: 'assistant', content: replyText })

          // セッション更新
          await supabase
            .from('counseling_sessions')
            .update({
              conversation_history: history,
              collected_data: collectedData,
              status: isComplete ? 'completed' : 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)

          // カウンセリング完了時にカルテに保存
          if (isComplete && session.customer_id) {
            await supabase
              .from('customers')
              .update({ concerns: JSON.stringify(collectedData) })
              .eq('id', session.customer_id)
          }

          await replyMessage(replyToken, replyText, accessToken)

          // outboundメッセージをline_messagesに保存（カウンセリング応答）
          await supabase.from('line_messages').insert({
            salon_id: salonId,
            customer_id: customer?.id || null,
            line_user_id: lineUserId,
            direction: 'outbound',
            message: replyText,
            auto_type: 'precounseling',
            is_read: true,
            sent_at: new Date().toISOString(),
          })
          break
        }

        default:
          break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Webhook処理失敗' }, { status: 500 })
  }
}
