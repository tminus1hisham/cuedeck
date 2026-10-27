import type { Show } from '../player/types';

/** Local-only storage: shows as JSON, uploaded files and rendered pages as blobs. */
const open = (() => {
  let p: Promise<IDBDatabase> | null = null;
  return () => p ??= new Promise((res, rej) => {
    const r = indexedDB.open('cuedeck', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('shows'); r.result.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
})();

async function tx<T>(store: 'shows' | 'blobs', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export const db = {
  listShows: () => tx<Show[]>('shows', 'readonly', s => s.getAll() as IDBRequest<Show[]>)
    .then(all => all.sort((a, b) => b.updated - a.updated)),
  getShow: (id: string) => tx<Show | undefined>('shows', 'readonly', s => s.get(id)),
  putShow: (show: Show) => tx('shows', 'readwrite', s => s.put({ ...show, updated: Date.now() }, show.id)),
  deleteShow: async (show: Show) => {
    const ids = [...show.items.flatMap(i => i.blobs), ...(show.brand.logo ? [show.brand.logo] : [])];
    await Promise.all(ids.map(id => tx('blobs', 'readwrite', s => s.delete(id))));
    await tx('shows', 'readwrite', s => s.delete(show.id));
  },
  putBlob: async (b: Blob) => { const id = crypto.randomUUID(); await tx('blobs', 'readwrite', s => s.put(b, id)); return id; },
  getBlob: (id: string) => tx<Blob | undefined>('blobs', 'readonly', s => s.get(id)),
};

const urls = new Map<string, string>();
/** Object URLs for blobs, loaded once and kept for the life of the tab. */
export async function loadUrls(show: Show): Promise<(id: string) => string> {
  const ids = [...show.items.flatMap(i => i.blobs), ...(show.brand.logo ? [show.brand.logo] : [])];
  await Promise.all(ids.filter(id => !urls.has(id)).map(async id => {
    const b = await db.getBlob(id);
    if (b) urls.set(id, URL.createObjectURL(b));
  }));
  return id => urls.get(id) ?? '';
}
