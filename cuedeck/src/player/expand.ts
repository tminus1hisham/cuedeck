import type { Item, Show, Slide } from './types';

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
export function drift(show: Show, cueIndex: number, elapsedMin: number, inCueMin: number): number {
  const plannedStart = show.items.slice(0, cueIndex).reduce((t, it) => t + (it.duration ?? 0), 0);
  const cue = show.items[cueIndex]?.duration ?? 0;
  // Overrunning the current cue counts as soon as it happens, not only when the next cue starts.
  const overrun = cue ? Math.max(0, inCueMin - cue) : 0;
  return elapsedMin - inCueMin - plannedStart + overrun;
}
