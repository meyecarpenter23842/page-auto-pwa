export const RELAY_PAIRING_STORAGE_KEY = 'page-auto:relay-pairing:v1'

export interface RelayPairing {
  version: 1
  deviceId: string
  token: string
}

const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,96}$/

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return atob(padded)
}

export function parseRelayPairing(input: string): RelayPairing {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Mã ghép đang trống.')

  let code = trimmed
  try {
    const url = new URL(trimmed)
    code = url.searchParams.get('pair')?.trim() || ''
  } catch {
    // Plain pairing code.
  }
  if (!code) throw new Error('Link ghép không có mã pair.')

  let payload: unknown
  try {
    payload = JSON.parse(decodeBase64Url(code)) as unknown
  } catch {
    throw new Error('Mã ghép không hợp lệ.')
  }
  if (!payload || typeof payload !== 'object') throw new Error('Mã ghép không hợp lệ.')
  const candidate = payload as { v?: unknown; d?: unknown; t?: unknown }
  if (candidate.v !== 1 || typeof candidate.d !== 'string' || !DEVICE_ID_PATTERN.test(candidate.d)) {
    throw new Error('Mã ghép không đúng phiên bản thiết bị.')
  }
  if (typeof candidate.t !== 'string' || !TOKEN_PATTERN.test(candidate.t)) {
    throw new Error('Token ghép không hợp lệ.')
  }
  return { version: 1, deviceId: candidate.d, token: candidate.t }
}

export function loadRelayPairing(): RelayPairing | null {
  try {
    const raw = window.localStorage.getItem(RELAY_PAIRING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RelayPairing
    if (parsed.version !== 1 || !DEVICE_ID_PATTERN.test(parsed.deviceId) || !TOKEN_PATTERN.test(parsed.token)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveRelayPairing(pairing: RelayPairing): void {
  window.localStorage.setItem(RELAY_PAIRING_STORAGE_KEY, JSON.stringify(pairing))
}

export function clearRelayPairing(): void {
  window.localStorage.removeItem(RELAY_PAIRING_STORAGE_KEY)
}

export function consumePairingFromLocation(): RelayPairing | null {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('pair')
  if (!code) return null
  try {
    const pairing = parseRelayPairing(code)
    saveRelayPairing(pairing)
    url.searchParams.delete('pair')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return pairing
  } catch {
    url.searchParams.delete('pair')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return null
  }
}
