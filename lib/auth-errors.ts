/** Supabase Auth の英語メッセージを画面用に変換 */
export function formatSignInError(err: { message: string }): string {
  const m = err.message.toLowerCase()
  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid_grant') ||
    m.includes('invalid email or password')
  ) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }
  if (m.includes('email not confirmed')) {
    return 'メールアドレスの確認が完了していません。受信トレイのリンクから認証してからログインしてください。'
  }
  if (
    m.includes('too many requests') ||
    m.includes('rate limit') ||
    m.includes('email rate limit')
  ) {
    return '短時間に試行が多すぎます。数分〜1時間ほど待ってから再度ログインしてください。'
  }
  return err.message
}

export function formatSignUpError(err: { message: string }): string {
  const m = err.message.toLowerCase()
  if (
    m.includes('already registered') ||
    m.includes('user already') ||
    m.includes('already been registered')
  ) {
    return 'このメールアドレスは既に登録されています。ログインしてください。'
  }
  /** Supabase: 同一メール・IP への signUp / 確認メール送信の上限 */
  if (
    m.includes('email rate limit exceeded') ||
    m.includes('rate limit exceeded') ||
    m.includes('over_email_send_rate_limit') ||
    m.includes('too many requests')
  ) {
    return '登録・確認メールの送信が一時的に制限されています。しばらく（目安: 1時間）待ってから再度お試しください。既にアカウントをお持ちの場合はログインしてください。'
  }
  if (m.includes('password')) {
    return err.message
  }
  return err.message
}
