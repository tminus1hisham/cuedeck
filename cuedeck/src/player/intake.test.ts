import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));
vi.mock('read-excel-file/browser', () => ({ default: async () => [] }));

const { kindOf, parseCsv } = await import('./intake');
const { withBridge } = await import('./bridge');

describe('kindOf', () => {
  it.each([
    ['deck.pdf', '', 'pdf'],
    ['DAMA Kenya Launch Event Deck.html', '', 'html'],
    ['budget.xlsx', '', 'sheet'],
    ['list.csv', 'text/csv', 'sheet'],
    ['photo.jpeg', 'image/jpeg', 'image'],
    ['launch.mp4', '', 'video'],
    ['anthem.mp3', '', 'audio'],
    ['talk.pptx', '', null],
  ])('%s → %s', (name, type, kind) => {
    expect(kindOf({ name, type })).toBe(kind);
  });
});

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and newlines inside quotes', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]);
  });
  it('splits TSV', () => {
    expect(parseCsv('a\tb', '\t')).toEqual([['a', 'b']]);
  });
});

describe('withBridge', () => {
  it('puts the bridge before the deck\'s own scripts', () => {
    const out = withBridge('<html><head><script>deck()</script></head></html>');
    expect(out.indexOf('cuedeck')).toBeLessThan(out.indexOf('deck()'));
  });
  it('still works without a head tag', () => {
    expect(withBridge('<p>hi</p>').startsWith('<script>')).toBe(true);
  });
});
