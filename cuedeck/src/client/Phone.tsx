import { useEffect, useRef, useState } from 'react';
import { drift } from '../player/expand';
import { relay } from '../player/rooms';
import type { Command, Presence, Snap, State, Summary } from '../player/types';
import { SnapView } from './SnapView';

const fmt = (s: number) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SWIPE_PX = 50;

/** The phone remote: scan the QR on the presenter screen and run the show from anywhere in the room. */
export function Phone({ room, keyParam }: { room: string; keyParam: string }) {
  const [up, setUp] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [, tick] = useState(0);
  const net = useRef<ReturnType<typeof relay> | null>(null);
  const clock = useRef({ t0: 0, cueT0: 0, cue: -1, index: -1 });

  useEffect(() => {
    const r = relay(room, 'remote', keyParam, m => {
      if (!('type' in m)) return;
      if (m.type === 'state') setState(m);
      else if (m.type === 'summary') setSummary(m);
      else if (m.type === 'snap') setSnap(m);
      else if (m.type === 'presence') setPresence(m);
    }, setUp);
    net.current = r;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => { clearInterval(t); r.close(); };
  }, [room, keyParam]);

  const send = (c: Command) => {
    navigator.vibrate?.(12);
    net.current?.send(c);
  };

  const live = up && presence?.online !== false && !!state;
  const index = state?.index ?? -1;
  const cue = summary?.slideCues[index] ?? 0;
  const info = summary?.cues[cue - 1];
  const inner = state?.inner;

  // Running clock starts at the first cue change, like on the presenter screen.
  const c = clock.current;
  if (state && index !== c.index) {
    if (c.index !== -1 && !c.t0) c.t0 = Date.now();
    c.index = index;
  }
  if (cue - 1 !== c.cue) { c.cue = cue - 1; c.cueT0 = Date.now(); }
  const elapsed = c.t0 ? (Date.now() - c.t0) / 1000 : 0;
  const planned = summary?.cues.some(x => x.duration);
  const behind = planned && c.t0 ? Math.round(drift(summary!.cues, c.cue, elapsed / 60, (Date.now() - c.cueT0) / 60000)) : null;

  const swipe = useRef(0);

  return (
    <div className="phone">
      <header className="ph-top">
        <p className={`ph-conn${live ? ' on' : ''}`}><i />{!up ? 'Reconnecting…' : !live ? 'Waiting for the stage window' : 'Connected'}</p>
        {presence && <p className="ph-count">{presence.audience} watching</p>}
        {behind != null && <p className="rm-drift" data-level={behind >= 5 ? 'late' : behind > 0 ? 'slip' : 'ok'}>{behind === 0 ? 'On time' : behind > 0 ? `${behind} min behind` : `${-behind} min ahead`}</p>}
        <p className="ph-clock">{fmt(elapsed)}</p>
      </header>

      <div
        className="ph-screen"
        onPointerDown={e => { swipe.current = e.clientX; }}
        onPointerUp={e => {
          const dx = e.clientX - swipe.current;
          if (dx < -SWIPE_PX) send({ cmd: 'next' });
          else if (dx > SWIPE_PX) send({ cmd: 'prev' });
        }}
      >
        {snap ? <SnapView snap={snap} className="ph-view" /> : <div className="ph-view ph-empty">No slide yet</div>}
      </div>

      <section className="ph-cue" aria-live="polite">
        <p className="rm-q">{cue ? `Q${cue} of ${summary?.cues.length}` : ''}{inner ? ` · slide ${inner.index + 1} of ${inner.count}` : ''}</p>
        <h1>{inner?.labels[inner.index] || state?.labels[index] || summary?.title || 'Cuedeck remote'}</h1>
        {info?.speaker && <p className="ph-speaker">{info.speaker}</p>}
        {state && <p className="ph-next">Up next: <b>{state.labels[index + 1] ?? 'End of show'}</b></p>}
        {info?.notes && <p className="ph-notes">{info.notes}</p>}
      </section>

      {state?.media && (
        <section className={`rm-media${state.blocked && !state.playing ? ' blk' : ''}`}>
          <button className="rm-btn rm-play" onClick={() => send({ cmd: 'media' })}>{state.playing ? 'Pause' : 'Play'}</button>
          <button className="rm-btn" onClick={() => send({ cmd: 'restart' })}>Restart</button>
          <div className="rm-bar"><span style={{ width: state.duration ? `${(100 * state.time) / state.duration}%` : 0 }} /></div>
          <span className="rm-t">{fmt(state.time)} / {fmt(state.duration)}</span>
          <p className="rm-blocked">The projector blocked sound. Click Start show on the stage window, then press Play.</p>
        </section>
      )}

      {summary && (
        <details className="ph-sheet">
          <summary>Running order</summary>
          <ol>
            {summary.cues.map((x, i) => (
              <li key={i}>
                <button
                  className={i === cue - 1 ? 'cur' : i < cue - 1 ? 'done' : ''}
                  onClick={() => send({ cmd: 'go', i: summary.slideCues.indexOf(i + 1) })}
                >
                  <span className="q">Q{i + 1}</span><span className="l">{x.label}</span>{x.duration ? <span className="d">{x.duration} min</span> : null}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <nav className="ph-nav" aria-label="Show controls">
        <button className={`ph-black${state?.blackout ? ' on' : ''}`} onClick={() => send({ cmd: 'blackout' })} disabled={!live}>
          {state?.blackout ? 'Show slides' : 'Hold screen'}
        </button>
        {info?.kind === 'html' && <button className="ph-skip" onClick={() => send({ cmd: 'skip' })} disabled={!live}>Skip cue</button>}
        <button className="ph-back" onClick={() => send({ cmd: 'prev' })} disabled={!live}>Back</button>
        <button className="ph-go" onClick={() => send({ cmd: 'next' })} disabled={!live}>GO</button>
      </nav>
    </div>
  );
}
