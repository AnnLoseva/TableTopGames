import { NextResponse } from 'next/server'

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code: code || 'BAD_REQUEST' }, { status })
}

export function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN'
  if (message === 'UNAUTHORIZED') return jsonError('Sign in to your account.', 401, message)
  if (message === 'DEVICE_UNAUTHORIZED') return jsonError('The device is not authorized.', 401, message)
  if (message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('ESP32_API_HMAC_SECRET')) {
    console.error('ESP32 server configuration error:', message)
    return jsonError('The device service is not configured. Ask the administrator to check the server environment.', 503, 'SERVER_CONFIGURATION')
  }
  console.error('ESP32 API error:', error)
  return jsonError('The server could not complete the request.', 500, 'INTERNAL_ERROR')
}

export async function readJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    throw new Error('INVALID_JSON')
  }
}

