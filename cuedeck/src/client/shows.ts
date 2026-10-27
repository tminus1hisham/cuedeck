import { db } from '../lib/db';
import type { CardTemplate, Item, Show } from '../player/types';

export const newShow = (title = 'Untitled show'): Show => ({
  id: crypto.randomUUID(),
  title,
  brand: { color: '#2b2a8c' },
  items: [],
  updated: Date.now(),
});

export const CARDS: Record<CardTemplate, { name: string; title: string; subtitle?: string }> = {
  welcome: { name: 'Welcome', title: 'Event name', subtitle: 'Date · Venue' },
  speaker: { name: 'Speaker intro', title: 'Speaker name', subtitle: 'Role, organisation' },
  break: { name: 'Break', title: 'Break', subtitle: 'We resume at 11:30' },
  thanks: { name: 'Thank you', title: 'Thank you' },
  plain: { name: 'Title only', title: 'Title' },
};

export const cardItem = (template: CardTemplate): Item => {
  const c = CARDS[template];
  return { id: crypto.randomUUID(), kind: 'card', label: c.name, blobs: [], card: { template, title: c.title, subtitle: c.subtitle } };
};

/** Adds each file as a cue, in drop order. Files that fail come back as messages; the rest still land. */
export async function addFiles(files: File[], progress: (msg: string) => void) {
  // pdf.js and the Excel reader are most of the bundle; load them only once files arrive.
  const { intake, IntakeError } = await import('../player/intake');
  const items: Item[] = [];
  const errors: string[] = [];
  for (const f of files) {
    progress(`Adding ${f.name}`);
    try {
      items.push(await intake(f, db.putBlob, progress));
    } catch (e) {
      errors.push(e instanceof IntakeError ? e.message : `${f.name}: couldn't read this file (${(e as Error).message}).`);
    }
  }
  progress('');
  return { items, errors };
}
