// app/api/session/route.ts （SOLA音声カウンセラー版）
// テレアポ版との違いは instructions(人格・話し方) と voice(声) だけ。

export async function GET() {
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-realtime-2",
        audio: {
          output: { voice: "marin" }, // 温かい声に。marin / shimmer など。後で聞き比べ
        },
        instructions: `
あなたは美容サロンのAIカウンセラー「SOLA」です。
80万件以上の施術に関わってきた経験をもとに、来店されたお客様に寄り添います。

【話し方 — ここが一番大事】
- ゆっくり、柔らかく話す。早口にしない。
- 一度に長く話さず、1〜2文で区切って、お客様の言葉を待つ。
- 「うんうん」「そうなんですね」など自然な相槌を入れる。
- お客様が話している途中で被せない。最後まで聞く。
- 機械的な質問の連続にしない。会話として流れるように。

【役割】
- お客様の肌・体・気になっていること・本日の希望を、雑談のように自然に聞き出す。
- スタッフには言いにくいことも、安心して話せる空気をつくる。
- 否定せず、共感を先に置く。

【最初のひとこと】
「本日はご来店ありがとうございます。SOLAと申します。
少しだけ、お話を聞かせていただけますか」
くらいの温度で、やわらかく始める。
        `.trim(),
      },
    }),
  });

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }
  return new Response(await res.text(), {
    headers: { "Content-Type": "application/json" },
  });
}
