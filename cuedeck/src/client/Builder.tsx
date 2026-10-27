import { useEffect, useRef, useState } from 'react';
import { exportZip } from '../export/exportZip';
import { db, loadUrls } from '../lib/db';
import { cueStarts, partCount } from '../player/expand';
import { mountPlayer, type Player } from '../player/render';
import type { CardTemplate, Item, Show } from '../player/types';
import { sync } from './App';
import { DropZone } from './DropZone';
import { addFiles, CARDS, cardItem } from './shows';

type Url = (id: string) => string;

const KIND_NAME: Record<Item['kind'], string> = {
  image: 'Image', pdf: 'PDF', video: 'Video', audio: 'Audio', sheet: 'Sheet', html: 'HTML deck', card: 'Title card',
};

export function Builder({ id }: { id: string }) {
  const [show, setShow] = useState<Show | null>(null);
  const [url, setUrl] = useState<{ fn: Url } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    db.getShow(id).then(async s => {
      if (!s) return setMissing(true);
      setUrl({ fn: await loadUrls(s) });
      setShow(s);
      setSel(s.items[0]?.id ?? null);
    });
  }, [id]);

  async function save(next: Show) {
    setShow(next);
    setUrl({ fn: await loadUrls(next) });
    await db.putShow(next);
    sync.postMessage(next.id);
  }

  if (missing) return <main className="app-missing"><p>This show isn't on this computer.</p><a href="#/">Go to your shows</a></main>;
  if (!show || !url) return <main className="app-missing" aria-busy="true"><p>Loading…</p></main>;

  const item = show.items.find(i => i.id === sel) ?? null;
  const total = show.items.reduce((t, i) => t + (i.duration ?? 0), 0);
  const update = (patch: Partial<Item>) => item && save({ ...show, items: show.items.map(i => (i.id === item.id ? { ...i, ...patch } : i)) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= show.items.length || from === to) return;
    const items = [...show.items];
    items.splice(to, 0, items.splice(from, 1)[0]);
    save({ ...show, items });
  };

  async function add(files: File[]) {
    const { items, errors } = await addFiles(files, setBusy);
    setErrors(errors);
    if (!items.length) return;
    await save({ ...show!, items: [...show!.items, ...items] });
    setSel(items[0].id);
  }

  async function addCard(t: CardTemplate) {
    const c = cardItem(t);
    await save({ ...show!, items: [...show!.items, c] });
    setSel(c.id);
  }

  async function setLogo(f: File | undefined) {
    if (!f) return;
    save({ ...show!, brand: { ...show!.brand, logo: await db.putBlob(f) } });
  }

  async function exportShow() {
    setBusy('Packing the offline show…');
    try {
      const blob = await exportZip(show!);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${show!.title.replace(/[^\w -]+/g, '').trim() || 'show'} - Cuedeck offline.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      setErrors([`Export failed: ${(e as Error).message}`]);
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!item || !confirm(`Remove "${item.label}" from the running order?`)) return;
    const i = show!.items.indexOf(item);
    await save({ ...show!, items: show!.items.filter(x => x !== item) });
    setSel(show!.items[i + 1]?.id ?? show!.items[i - 1]?.id ?? null);
  }

  return (
    <div className="builder">
      <header className="b-bar">
        <a href="#/" className="brand" aria-label="All shows"><i className="lamp" aria-hidden="true" />Cuedeck</a>
        <input
          className="b-title" aria-label="Show name" value={show.title}
          onChange={e => save({ ...show, title: e.target.value })}
        />
        <label className="b-color" title="Brand colour for title cards">
          <input type="color" value={show.brand.color} onChange={e => save({ ...show, brand: { ...show.brand, color: e.target.value } })} />
          <span>Brand colour</span>
        </label>
        <label className="b-logo">
          {show.brand.logo ? <img src={url.fn(show.brand.logo)} alt="" /> : null}
          <span>{show.brand.logo ? 'Change logo' : 'Add logo'}</span>
          <input type="file" accept="image/*" hidden onChange={e => setLogo(e.target.files?.[0])} />
        </label>
        <button className="ghost" onClick={exportShow} disabled={!show.items.length || !!busy}>Export offline</button>
        <button
          className="go" disabled={!show.items.length}
          onClick={() => window.open(`#/present/${show.id}`, `cuedeck-present-${show.id}`)}
        >Present</button>
      </header>

      <aside className="b-sheet" aria-label="Running order">
        <ol>
          {show.items.map((it, i) => (
            <li
              key={it.id}
              className={it.id === sel ? 'cur' : ''}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/cue', String(i))}
              onDragOver={e => { if (e.dataTransfer.types.includes('text/cue')) e.preventDefault(); }}
              onDrop={e => { const from = e.dataTransfer.getData('text/cue'); if (from) { e.preventDefault(); e.stopPropagation(); move(+from, i); } }}
            >
              <button className="cue" onClick={() => setSel(it.id)} aria-current={it.id === sel}>
                <span className="q">Q{i + 1}</span>
                <Thumb item={it} show={show} url={url.fn} />
                <span className="meta">
                  <b>{it.label || 'Untitled'}</b>
                  <span>{KIND_NAME[it.kind]}{partCount(it) > 1 ? ` · ${partCount(it)} ${it.kind === 'sheet' ? 'sheets' : 'pages'}` : ''}{it.duration ? ` · ${it.duration} min` : ''}</span>
                </span>
              </button>
              <span className="order">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${it.label} up`}>↑</button>
                <button onClick={() => move(i, i + 1)} disabled={i === show.items.length - 1} aria-label={`Move ${it.label} down`}>↓</button>
              </span>
            </li>
          ))}
        </ol>
        <DropZone onFiles={add} busy={busy}>
          <b>Add files</b>
          <span>Drop here or click to choose</span>
        </DropZone>
        <label className="b-add-card">
          <span>Add a title card</span>
          <select value="" onChange={e => e.target.value && addCard(e.target.value as CardTemplate)}>
            <option value="">Choose…</option>
            {Object.entries(CARDS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
          </select>
        </label>
        {errors.length > 0 && <ul className="errors" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
        <p className="b-total">
          {show.items.length} {show.items.length === 1 ? 'cue' : 'cues'}
          {total > 0 && <> · planned {total >= 60 ? `${Math.floor(total / 60)} h ` : ''}{total % 60} min</>}
        </p>
      </aside>

      <main className="b-edit">
        {show.items.length === 0 ? (
          <div className="b-empty">
            <h2>Build your running order</h2>
            <p>Add files or a title card on the left. Each one becomes a cue you can call during the event.</p>
          </div>
        ) : (
          <>
            <Preview show={show} url={url.fn} sel={sel} onCue={setSel} />
            {item && <Fields item={item} update={update} remove={remove} />}
          </>
        )}
      </main>
    </div>
  );
}

function Thumb({ item, show, url }: { item: Item; show: Show; url: Url }) {
  if ((item.kind === 'pdf' || item.kind === 'image') && item.blobs[0]) return <img className="thumb" src={url(item.blobs[0])} alt="" />;
  if (item.kind === 'card') return <span className="thumb card" style={{ background: show.brand.color }} aria-hidden="true">{item.card?.title}</span>;
  return <span className={`thumb k-${item.kind}`} aria-hidden="true">{KIND_NAME[item.kind]}</span>;
}

/** The real player, so what you see here is exactly what the projector shows. */
function Preview({ show, url, sel, onCue }: { show: Show; url: Url; sel: string | null; onCue: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [pos, setPos] = useState({ index: 0, count: 0 });

  useEffect(() => {
    const p = mountPlayer(host.current!, show, { url });
    player.current = p;
    const off = p.onState(s => {
      setPos({ index: s.index, count: s.labels.length });
      const cur = p.slides[s.index]?.item.id;
      if (cur) onCue(cur);
    });
    return () => { off(); p.destroy(); player.current = null; };
    // Mounted once; later changes go through setShow so the player keeps its place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { player.current?.setShow(show); }, [show]);

  useEffect(() => {
    const p = player.current;
    if (!p || !sel || p.slides[p.index]?.item.id === sel) return;
    const i = show.items.findIndex(x => x.id === sel);
    p.go(cueStarts(p.slides)[i]);
  }, [sel, show]);

  return (
    <section className="b-preview" aria-label="Preview">
      <div ref={host} className="b-screen" />
      <div className="b-step">
        <button onClick={() => player.current?.prev()} aria-label="Previous slide">←</button>
        <span>Slide {pos.index + 1} of {pos.count}</span>
        <button onClick={() => player.current?.next()} aria-label="Next slide">→</button>
      </div>
    </section>
  );
}

function Fields({ item, update, remove }: { item: Item; update: (p: Partial<Item>) => void; remove: () => void }) {
  const media = item.kind === 'video' || item.kind === 'audio';
  return (
    <form className="b-fields" onSubmit={e => e.preventDefault()}>
      <label className="wide">
        <span>Cue name</span>
        <input value={item.label} onChange={e => update({ label: e.target.value })} />
      </label>
      {item.card && (
        <>
          <label>
            <span>Card style</span>
            <select value={item.card.template} onChange={e => update({ card: { ...item.card!, template: e.target.value as CardTemplate } })}>
              {Object.entries(CARDS).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span>Headline</span>
            <input value={item.card.title} onChange={e => update({ card: { ...item.card!, title: e.target.value } })} />
          </label>
          <label className="wide">
            <span>Second line</span>
            <input value={item.card.subtitle ?? ''} onChange={e => update({ card: { ...item.card!, subtitle: e.target.value } })} />
          </label>
        </>
      )}
      <label>
        <span>Speaker</span>
        <input value={item.speaker ?? ''} onChange={e => update({ speaker: e.target.value })} placeholder="Who is on stage" />
      </label>
      <label>
        <span>Planned minutes</span>
        <input
          type="number" min={0} step={1} inputMode="numeric" value={item.duration ?? ''}
          onChange={e => update({ duration: e.target.value === '' ? undefined : Math.max(0, +e.target.value) })}
        />
      </label>
      <label className="wide">
        <span>Presenter notes</span>
        <textarea rows={4} value={item.notes ?? ''} onChange={e => update({ notes: e.target.value })} placeholder="Only you see these, on the presenter screen" />
      </label>
      {media && (
        <fieldset className="wide checks">
          <legend>Playback</legend>
          <label><input type="checkbox" checked={!!item.autoplay} onChange={e => update({ autoplay: e.target.checked })} /> Play when the cue starts</label>
          <label><input type="checkbox" checked={!!item.loop} onChange={e => update({ loop: e.target.checked })} /> Loop</label>
        </fieldset>
      )}
      {item.kind === 'html' && (
        <p className="wide hint">GO and Back step through this deck's own slides. When it has no slides left, GO moves to the next cue. Use Skip to next cue to leave early.</p>
      )}
      <div className="wide actions">
        <button type="button" className="danger" onClick={remove}>Remove cue</button>
      </div>
    </form>
  );
}
