import { describe, expect, it } from 'vitest';
import { cueStarts, drift, expand, snapItem, summarize } from './expand';
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

describe('snapItem', () => {
  it('keeps only the current pdf page and drops notes', () => {
    const slides = expand(show([item({ kind: 'pdf', label: 'Keynote', blobs: ['p1', 'p2'], notes: 'secret', speaker: 'Dr X' })]));
    const { item: it, blobs } = snapItem(slides[1]);
    expect(blobs).toEqual(['p2']);
    expect(it).toMatchObject({ kind: 'pdf', blobs: ['p2'], label: 'Keynote (2)', speaker: 'Dr X' });
    expect(it.notes).toBeUndefined();
  });
  it('keeps only the current sheet', () => {
    const slides = expand(show([item({ kind: 'sheet', sheets: [{ name: 'A', rows: [['1']] }, { name: 'B', rows: [['2']] }] })]));
    expect(snapItem(slides[1]).item.sheets).toEqual([{ name: 'B', rows: [['2']] }]);
  });
  it('turns video and html decks into a title card naming what is on screen', () => {
    const [v] = expand(show([item({ kind: 'video', label: 'Launch film', blobs: ['v'] })]));
    expect(snapItem(v)).toEqual({ item: expect.objectContaining({ kind: 'card', blobs: [], card: { template: 'plain', title: 'Launch film', subtitle: 'Video playing on the main screen' } }), blobs: [] });
    const [h] = expand(show([item({ kind: 'html', label: 'Deck', blobs: ['h'] })]));
    expect(snapItem(h, 'MC Welcome').item.card?.title).toBe('MC Welcome');
  });
});

describe('summarize', () => {
  it('maps each slide to its cue and carries notes for the phone', () => {
    const s = show([item({ label: 'A', notes: 'n' }), item({ kind: 'pdf', label: 'B', blobs: ['1', '2'] })]);
    const sum = summarize(s, expand(s));
    expect(sum.slideCues).toEqual([1, 2, 2]);
    expect(sum.cues[0]).toMatchObject({ label: 'A', notes: 'n' });
  });
});

describe('drift', () => {
  const s = [item({ duration: 5 }), item({ duration: 10 }), item({ duration: 5 })];
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
