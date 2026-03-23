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
  if (m.includes('too many requests')) {
    return '試行回数が多すぎます。しばらくしてから再度お試しください。'
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
  if (m.includes('password')) {
    return err.message
  }
  return err.message
}
