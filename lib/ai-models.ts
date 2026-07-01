/**
 * Claude モデルID 一元管理
 *
 * SOLA は各 API ルートでモデルIDを直書きしていたため、モデル廃止時に一斉に 404 で
 * 停止する事故があった（例: claude-sonnet-4-20250514 の廃止）。
 * モデルの改版・廃止・移行時は「このファイルだけ」を変更すればよいように集約する。
 *
 * 有効なモデルIDは Anthropic の Models API / 公式ドキュメントで確認すること。
 */
export const CLAUDE_MODELS = {
  /** 汎用（LEO経営相談・経営アドバイス・AI日報・レビュー生成・メニュー/HP取込 等） */
  sonnet: 'claude-sonnet-5',

  /**
   * カウンセリングの「SOLA人格」専用。
   * 文体・トーンの検証が済むまで現行の 4.6 を維持する。
   * 検証後に Sonnet 5 へ寄せる場合は下記の値を CLAUDE_MODELS.sonnet と同じにする。
   */
  sonnetCounseling: 'claude-sonnet-4-6',

  /** 軽量・高速・低コスト（感動体験の提案生成・SNS生成 等） */
  haiku: 'claude-haiku-4-5-20251001',

  /** 画像・ビジョン系（商品画像の取り込み 等） */
  opus: 'claude-opus-4-5',
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]
