import { NextResponse } from 'next/server'
import type { PostgrestError } from '@supabase/supabase-js'

export function postgrestErrorFields(err: PostgrestError) {
  return {
    message: err.message,
    code: err.code,
    details: err.details ?? null,
    hint: err.hint ?? null,
  }
}

export function logPostgrestError(tag: string, err: PostgrestError, extra?: Record<string, unknown>) {
  console.error(tag, {
    ...postgrestErrorFields(err),
    ...extra,
  })
}

function serializeException(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack ?? null }
  }
  return { string: String(err) }
}

/** 500 用: クライアント・Vercel 双方で原因追跡しやすい JSON */
export function jsonErrorWithDetails(
  status: number,
  message: string,
  options: {
    supabase?: PostgrestError | null
    caught?: unknown
    debug?: Record<string, unknown>
  } = {},
) {
  const body: Record<string, unknown> = { error: message }
  if (options.supabase) body.supabase = postgrestErrorFields(options.supabase)
  const debug: Record<string, unknown> = { ...(options.debug ?? {}) }
  if (options.caught !== undefined) debug.exception = serializeException(options.caught)
  if (Object.keys(debug).length > 0) body.debug = debug
  return NextResponse.json(body, { status })
}
