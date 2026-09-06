const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('')
}

export function generatePollSlug(): string {
  return randomString(8)
}

export function generateOptionId(): string {
  return randomString(6)
}
