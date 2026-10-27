import type { Item, Kind, Show, Slide, Summary } from './types';

export function partCount(item: Item): number {
  if (item.kind === 'pdf' || item.kind === 'image') return Math.max(1, item.blobs.length);
  if (item.kind === 'sheet') return Math.max(1, item.sheets?.length ?? 0);
  return 1;
}

/** Flatten the running order into the slides the stage steps through. */
export function expand(show: Show): Slide[] {
  return show.items.flatMap((item, i) => {
    const n = partCount(item);
    return Array.from({ length: n }, (_, part) => ({
      item,
      cue: i + 1,
      part,
      label: n > 1 ? `${item.label} (${item.kind === 'sheet' ? item.sheets![part].name : part + 1})` : item.label,
    }));
  });
}

/** Index of the first slide of each cue. */
export function cueStarts(slides: Slide[]): number[] {
  const starts: number[] = [];
  slides.forEach((s, i) => { if (s.part === 0) starts.push(i); });
  return starts;
}

/**
 * Minutes behind (+) or ahead (-) of the planned running order.
 * Planned start of a cue = sum of earlier cues' durations. Cues without a duration count as 0.
 */
export function drift(cues: { duration?: number }[], cueIndex: number, elapsedMin: number, inCueMin: number): number {
  const plannedStart = cues.slice(0, cueIndex).reduce((t, it) => t + (it.duration ?? 0), 0);
  const cue = cues[cueIndex]?.duration ?? 0;
  // Overrunning the current cue counts as soon as it happens, not only when the next cue starts.
  const overrun = cue ? Math.max(0, inCueMin - cue) : 0;
  return elapsedMin - inCueMin - plannedStart + overrun;
}

export function summarize(show: Show, slides: Slide[]): Summary {
  return {
    type: 'summary',
    title: show.title,
    cues: show.items.map(({ label, speaker, notes, duration, kind }) => ({ label, speaker, notes, duration, kind })),
    slideCues: slides.map(s => s.cue),
  };
}

const ON_SCREEN: Partial<Record<Kind, string>> = { video: 'Video playing on the main screen', audio: 'Playing now' };

/**
 * The one item the audience may see right now, cut down to the current page or sheet, without notes.
 * Media and HTML decks can't be copied to phones, so they become a title card naming what's on screen.
 * Returns the item and the blob ids it still needs.
 */
export function snapItem(slide: Slide, innerLabel?: string): { item: Item; blobs: string[] } {
  const { item, part } = slide;
  const base = { id: item.id, label: slide.label, speaker: item.speaker, blobs: [] as string[] };
  if (item.kind === 'pdf' || item.kind === 'image') {
    const blobs = item.blobs[part] ? [item.blobs[part]] : [];
    return { item: { ...base, kind: item.kind, blobs }, blobs };
  }
  if (item.kind === 'sheet') return { item: { ...base, kind: 'sheet', sheets: item.sheets?.slice(part, part + 1) }, blobs: [] };
  if (item.kind === 'card') return { item: { ...base, kind: 'card', card: item.card }, blobs: [] };
  return {
    item: { ...base, kind: 'card', card: { template: 'plain', title: innerLabel || item.label, subtitle: ON_SCREEN[item.kind] } },
    blobs: [],
  };
}
