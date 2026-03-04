/**
 * カルテ写真のローカル保存（IndexedDB）
 * 画像データはPCのブラウザに保存し、Supabaseにはキーのみ保存して軽量化
 */
const DB_NAME = 'sola_chart_images'
const STORE_NAME = 'photos'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })
}

export async function saveImage(key: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ key, blob, createdAt: Date.now() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getImage(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      db.close()
      const row = req.result
      if (!row?.blob) return resolve(null)
      const url = URL.createObjectURL(row.blob)
      resolve(url)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function getImageAsDataUrl(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      db.close()
      const row = req.result
      if (!row?.blob) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(row.blob)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deleteImage(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 施術記録用の画像キーを生成 */
export function createImageKey(customerId: string, visitId: string, index: number): string {
  return `visit-${customerId}-${visitId}-${index}-${Date.now()}`
}

/** IndexedDBのローカルキーかどうか（URLやdata:はfalse） */
export function isLocalImageKey(str: string): boolean {
  return typeof str === 'string' && str.startsWith('visit-') && !str.startsWith('http')
}
