const store = new Map()
const TTL = 30_000 // 30s

export async function cached(key, fn) {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < TTL) return hit.value

  const value = await fn()
  store.set(key, { at: now, value })
  return value
}

export function invalidate(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}