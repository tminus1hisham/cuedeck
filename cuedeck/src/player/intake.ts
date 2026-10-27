import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import readXlsxFile from 'read-excel-file/browser';
import { withBridge } from './bridge';
import type { Item, Kind } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Shown to the user as-is, so it says what to do next. */
export class IntakeError extends Error {}

const CONVERT = /\.(pptx?|key|odp|docx?|odt|rtf|pages|xls|ods|numbers)$/i;
const PAGE_WIDTH = 1920;

export function kindOf(file: { name: string; type: string }): Kind | null {
  const n = file.name.toLowerCase(), t = file.type;
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (/\.html?$/.test(n) || t === 'text/html') return 'html';
  if (/\.(xlsx|xlsm|csv|tsv)$/.test(n)) return 'sheet';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(n)) return 'video';
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(n)) return 'audio';
  return null;
}

/** Turns one dropped file into a cue. Pages are rendered up front so every view, offline too, only needs images. */
export async function intake(file: File, put: (b: Blob) => Promise<string>, progress: (msg: string) => void): Promise<Item> {
  const kind = kindOf(file);
  if (!kind) {
    if (CONVERT.test(file.name)) {
      throw new IntakeError(`${file.name}: open it in PowerPoint, Word or Excel, choose Save as PDF (or .xlsx for spreadsheets), then drop that file here.`);
    }
    throw new IntakeError(`${file.name}: this file type can't be shown. Use PDF, images, video, audio, Excel, CSV or HTML.`);
  }
  const item: Item = {
    id: crypto.randomUUID(),
    kind,
    label: file.name.replace(/\.[^.]+$/, ''),
    blobs: [],
    autoplay: kind === 'video' || kind === 'audio',
  };

  if (kind === 'pdf') item.blobs = await pdfPages(file, put, progress);
  else if (kind === 'sheet') item.sheets = await sheets(file);
  else if (kind === 'html') item.blobs = [await put(new Blob([withBridge(await file.text())], { type: 'text/html' }))];
  else item.blobs = [await put(file)];
  return item;
}

async function pdfPages(file: File, put: (b: Blob) => Promise<string>, progress: (msg: string) => void) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const ids: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progress(`${file.name}: page ${n} of ${doc.numPages}`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('render failed'))), 'image/jpeg', 0.9));
    ids.push(await put(blob));
    page.cleanup();
  }
  await task.destroy();
  return ids;
}

const cell = (v: unknown) => v == null ? '' : v instanceof Date ? v.toLocaleDateString() : String(v);

async function sheets(file: File) {
  if (/\.(csv|tsv)$/i.test(file.name)) {
    return [{ name: file.name.replace(/\.[^.]+$/, ''), rows: parseCsv(await file.text(), file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',') }];
  }
  const all = await readXlsxFile(file);
  return all.map(s => ({ name: s.sheet, rows: s.data.map(r => r.map(cell)) }));
}

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"' && f === '') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
