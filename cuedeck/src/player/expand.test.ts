import { describe, expect, it } from 'vitest';
import { cueStarts, drift, expand } from './expand';
import type { Item, Show } from './types';

const item = (p: Partial<Item>): Item => ({ id: Math.random().toString(36), kind: 'card', label: 'x', blobs: [], ...p });
const show = (items: Item[]): Show => ({ id: 's', title: 't', brand: { color: '#000' }, items, updated: 0 });

describe('expand', () => {
  it('gives one slide per pdf page and sheet, one per other item', () => {
    const s = show([
      item({ kind: 'card', label: 'Welcome' }),
      item({ kind: 'pdf', label: 'Keynote', blobs: ['a', 'b', 'c'] }),
      item({ kind: 'sheet', label: 'Budget', sheets: [{ name: 'Q1', rows: [] }, { name: 'Q2', rows: [] }] }),
      item({ kind: 'video', label: 'Launch', blobs: ['v'] }),
    ]);
    const slides = expand(s);
    expect(slides.map(x => x.label)).toEqual([
      'Welcome', 'Keynote (1)', 'Keynote (2)', 'Keynote (3)', 'Budget (Q1)', 'Budget (Q2)', 'Launch',
    ]);
    expect(slides.map(x => x.cue)).toEqual([1, 2, 2, 2, 3, 3, 4]);
    expect(cueStarts(slides)).toEqual([0, 1, 4, 6]);
  });

  it('keeps a pdf with no pages as one slide so the cue is never lost', () => {
    expect(expand(show([item({ kind: 'pdf', blobs: [] })]))).toHaveLength(1);
  });
});

describe('drift', () => {
  const s = show([item({ duration: 5 }), item({ duration: 10 }), item({ duration: 5 })]);
  it('is zero when each cue starts on plan', () => {
    expect(drift(s, 1, 5, 0)).toBe(0);
  });
  it('is positive when a cue starts late', () => {
    expect(drift(s, 1, 9, 0)).toBe(4);
  });
  it('counts an overrun of the current cue straight away', () => {
    expect(drift(s, 1, 17, 12)).toBe(2);
  });
  it('is negative when ahead', () => {
    expect(drift(s, 2, 12, 0)).toBe(-3);
  });
});
