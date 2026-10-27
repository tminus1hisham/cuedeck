import { snapItem } from './expand';
import type { Inner, Show, Slide, Snap } from './types';

const AUDIENCE_WIDTH = 1280;
const LOGO_SIZE = 400;
const cache = new Map<string, string>();

/** Re-encodes an image small enough to send to every phone: JPEG for pages, PNG for logos (keeps transparency). */
async function shrink(src: string, max: number, type: 'image/jpeg' | 'image/png'): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const s = Math.min(1, max / Math.max(img.naturalWidth, type === 'image/png' ? img.naturalHeight : 0));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.8);
}

async function dataUrl(id: string, url: (id: string) => string, max: number, type: 'image/jpeg' | 'image/png') {
  const k = `${id}:${max}`;
  if (!cache.has(k)) cache.set(k, await shrink(url(id), max, type).catch(() => ''));
  return cache.get(k)!;
}

/** Everything a phone or viewer needs to draw the slide on screen, and nothing more. */
export async function snapshot(show: Show, slide: Slide | undefined, index: number, blackout: boolean, inner: Inner | null | undefined, url: (id: string) => string): Promise<Snap> {
  const urls: Record<string, string> = {};
  const items = [];
  if (slide) {
    const { item, blobs } = snapItem(slide, inner?.labels[inner.index]);
    for (const id of blobs) urls[id] = await dataUrl(id, url, AUDIENCE_WIDTH, 'image/jpeg');
    items.push(item);
  }
  const logo = show.brand.logo;
  if (logo) urls[logo] = await dataUrl(logo, url, LOGO_SIZE, 'image/png');
  return { type: 'snap', index, blackout, show: { id: show.id, title: show.title, brand: show.brand, items, updated: 0 }, urls };
}
