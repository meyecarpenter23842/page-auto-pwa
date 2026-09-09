import { get, put } from '@vercel/blob'
import { getVercelOidcToken } from '@vercel/oidc'
import {
  RELAY_COMMAND_RECORD_PATH,
  RELAY_RECORD_PATH,
  isRelayCommandRecord,
  isRelayRecord,
  type RelayCommandRecord,
  type RelayRecord
} from './relayProtocol.js'

type BlobAuthOptions = {
  token?: string
  oidcToken?: string
  storeId?: string
}

function blobAuthOptions(): BlobAuthOptions {
  const storeId = process.env.PAGE_AUTO_RELAY_BLOB_STORE_ID?.trim()
  const oidcToken = getVercelOidcToken()
  if (oidcToken && storeId) return { oidcToken, storeId }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  return token ? { token } : {}
}

export function relayStorageConfigured(): boolean {
  const auth = blobAuthOptions()
  return Boolean(auth.token || (auth.oidcToken && auth.storeId))
}

export async function loadRelayRecord(): Promise<RelayRecord | null> {
  const result = await get(RELAY_RECORD_PATH, {
    ...blobAuthOptions(),
    access: 'private',
    useCache: false
  })
  if (!result || result.statusCode !== 200) return null
  const raw = await new Response(result.stream).text()
  const parsed = JSON.parse(raw) as unknown
  if (!isRelayRecord(parsed)) throw new Error('Blob relay record is invalid.')
  return parsed
}

export async function saveRelayRecord(record: RelayRecord): Promise<void> {
  await put(RELAY_RECORD_PATH, JSON.stringify(record), {
    ...blobAuthOptions(),
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  })
}

export async function loadRelayCommandRecord(): Promise<RelayCommandRecord | null> {
  const result = await get(RELAY_COMMAND_RECORD_PATH, {
    ...blobAuthOptions(),
    access: 'private',
    useCache: false
  })
  if (!result || result.statusCode !== 200) return null
  const raw = await new Response(result.stream).text()
  const parsed = JSON.parse(raw) as unknown
  if (!isRelayCommandRecord(parsed)) throw new Error('Blob relay command record is invalid.')
  return parsed
}

export async function saveRelayCommandRecord(record: RelayCommandRecord): Promise<void> {
  await put(RELAY_COMMAND_RECORD_PATH, JSON.stringify(record), {
    ...blobAuthOptions(),
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  })
}
