// Same-origin image proxy so the palette extractor (see
// src/features/votes/lib/paletteFromImage.ts) can read pixels from poll
// background images even when the source host sends no CORS headers
// (common for hotlinked images — Pinterest, most personal blogs, etc.), by
// re-fetching the bytes server-side and serving them from our own origin.
//
// Purely decorative feature, but this endpoint fetches an arbitrary
// user-supplied URL server-side, which is an SSRF surface: it guards against
// that by only allowing http/https on default ports, resolving the hostname
// (and every redirect hop) and rejecting private/loopback/link-local/reserved
// IPs, capping response size, and requiring an image/* content type.
import { promises as dns } from 'node:dns'
import net from 'node:net'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set(['', '80', '443'])
const MAX_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8000
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function ipv4ToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function isPrivateIPv4(ip: string): boolean {
  const long = ipv4ToLong(ip)
  const ranges: [string, number][] = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ]
  return ranges.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (long & mask) === (ipv4ToLong(base) & mask)
  })
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (/^fe[89ab]/.test(normalized)) return true // fe80::/10 link-local
  if (/^f[cd]/.test(normalized)) return true // fc00::/7 unique local
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    if (net.isIPv4(mapped)) return isPrivateIPv4(mapped)
  }
  return false
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip)
  if (net.isIPv6(ip)) return isPrivateIPv6(ip)
  return true
}

async function assertUrlIsSafe(url: URL): Promise<void> {
  if (!ALLOWED_PROTOCOLS.has(url.protocol) || !ALLOWED_PORTS.has(url.port)) {
    throw new Error('unsupported url')
  }
  const { address } = await dns.lookup(url.hostname)
  if (isBlockedIp(address)) {
    throw new Error('blocked host')
  }
}

async function fetchImageFollowingSafeRedirects(initialUrl: URL, signal: AbortSignal): Promise<Response> {
  let currentUrl = initialUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertUrlIsSafe(currentUrl)
    const response = await fetch(currentUrl.toString(), {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'TableTopGamesVotesImageProxy/1.0' },
    })

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('redirect without location')
      currentUrl = new URL(location, currentUrl)
      continue
    }

    return response
  }
  throw new Error('too many redirects')
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('url')
  if (!target) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstream = await fetchImageFollowingSafeRedirects(parsed, controller.signal)

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'not an image' }, { status: 415 })
    }

    const reader = upstream.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_BYTES) {
        return NextResponse.json({ error: 'image too large' }, { status: 413 })
      }
      chunks.push(value)
    }

    return new NextResponse(new Blob(chunks as BlobPart[], { type: contentType }), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
