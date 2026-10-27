import { zip, type Zippable } from 'fflate';
import { db } from '../lib/db';
import type { Show } from '../player/types';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/aac': 'aac',
  'text/html': 'html',
};

const README = `Cuedeck offline show

1. Unzip this folder. Keep show.html, remote.html and the media folder together.
2. Open remote.html in Chrome or Edge on your laptop.
3. Click "Open stage window", drag it onto the projector, then click "Start show".
4. Run the show from remote.html with your keyboard, mouse or clicker.

No internet needed.
`;

/** One ZIP that runs the show from a local folder, for venues with bad Wi-Fi. */
export async function exportZip(show: Show): Promise<Blob> {
  const template = await fetch(`${import.meta.env.BASE_URL}offline.html`).then(r => {
    if (!r.ok) throw new Error('Offline player is missing. Run "npm run build:offline".');
    return r.text();
  });
  const files: Record<string, string> = {};
  const out: Zippable = {};
  const ids = [...new Set([...show.items.flatMap(i => i.blobs), ...(show.brand.logo ? [show.brand.logo] : [])])];
  for (const id of ids) {
    const blob = await db.getBlob(id);
    if (!blob) continue;
    const path = `media/${id}.${EXT[blob.type] ?? 'bin'}`;
    files[id] = path;
    // Media is already compressed; storing it as-is keeps the export fast.
    out[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  const data = JSON.stringify({ show, files }).replace(/</g, '\\u003c');
  const page = (mode: string) => new TextEncoder().encode(
    template.replace('<!--CUEDECK-->', () => `<script>window.CUEDECK=${data};window.CUEDECK_MODE='${mode}'</script>`),
  );
  out['show.html'] = page('stage');
  out['remote.html'] = page('remote');
  out['README.txt'] = new TextEncoder().encode(README);
  return new Promise((res, rej) => zip(out, (err, bytes) => (err ? rej(err) : res(new Blob([bytes as BlobPart], { type: 'application/zip' })))));
}
