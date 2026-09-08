import { get, put } from '@vercel/blob'
import { RELAY_RECORD_PATH, isRelayRecord, type RelayRecord } from './relayProtocol.js'

export function relayStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

export async function loadRelayRecord(): Promise<RelayRecord | null> {
  const result = await get(RELAY_RECORD_PATH, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) return null
  const raw = await new Response(result.stream).text()
  const parsed = JSON.parse(raw) as unknown
  if (!isRelayRecord(parsed)) throw new Error('Blob relay record is invalid.')
  return parsed
}

export async function saveRelayRecord(record: RelayRecord): Promise<void> {
  await put(RELAY_RECORD_PATH, JSON.stringify(record), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  })
}
