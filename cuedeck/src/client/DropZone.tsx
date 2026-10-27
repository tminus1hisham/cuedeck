import { useRef, useState, type ReactNode } from 'react';

export function DropZone({ onFiles, busy, big, children }: { onFiles: (f: File[]) => void; busy: string; big?: boolean; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => { if (list?.length && !busy) onFiles([...list]); };

  return (
    <div
      className={`drop${big ? ' big' : ''}${over ? ' over' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
    >
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy} aria-describedby="drop-status">
        {busy ? <b>Working…</b> : children}
      </button>
      <p id="drop-status" className="drop-status" aria-live="polite">{busy}</p>
      <input ref={input} type="file" multiple hidden onChange={e => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
