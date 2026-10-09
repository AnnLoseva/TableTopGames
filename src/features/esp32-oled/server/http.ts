import { NextResponse } from 'next/server'

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code: code || 'BAD_REQUEST' }, { status })
}

export function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN'
  if (message === 'UNAUTHORIZED') return jsonError('Войдите в аккаунт.', 401, message)
  if (message === 'DEVICE_UNAUTHORIZED') return jsonError('Устройство не авторизовано.', 401, message)
  console.error('ESP32 API error:', error)
  return jsonError('Сервер не смог выполнить запрос.', 500, 'INTERNAL_ERROR')
}

export async function readJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    throw new Error('INVALID_JSON')
  }
}

