// Выдаёт краткоживущие TURN-креды Cloudflare для голосового чата.
// Без TURN прямое P2P-соединение часто невозможно (VPN, CGNAT у РФ-провайдеров).
// Секреты живут только на сервере (Vercel env): CLOUDFLARE_TURN_KEY_ID,
// CLOUDFLARE_TURN_KEY_API_TOKEN. Если они не заданы, клиент работает как раньше
// (только STUN).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TURN_CREDENTIAL_TTL_SECONDS = 24 * 60 * 60

export async function POST() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const apiToken = process.env.CLOUDFLARE_TURN_KEY_API_TOKEN

  if (!keyId || !apiToken) {
    return NextResponse.json({ iceServers: null, reason: 'turn-not-configured' })
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      console.error('Cloudflare TURN error:', response.status, await response.text())
      return NextResponse.json({ iceServers: null, reason: 'turn-request-failed' }, { status: 502 })
    }

    const data = await response.json() as { iceServers?: unknown }
    // Cloudflare отвечает либо { iceServers: {urls, username, credential} },
    // либо { iceServers: [...] } — отдаём как есть, клиент понимает оба формата.
    return NextResponse.json({ iceServers: data.iceServers ?? null })
  } catch (error) {
    console.error('Cloudflare TURN request failed:', error)
    return NextResponse.json({ iceServers: null, reason: 'turn-unreachable' }, { status: 502 })
  }
}
