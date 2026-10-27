import { useEffect, useState } from 'react';
import { relay } from '../player/rooms';
import type { Snap } from '../player/types';
import { SnapView } from './SnapView';

/** Audience follow-along: only ever the slide that is on the projector right now. */
export function Watch({ room }: { room: string }) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [up, setUp] = useState(false);

  useEffect(() => {
    const r = relay(room, 'audience', '', m => { if ('type' in m && m.type === 'snap') setSnap(m); }, setUp);
    return () => r.close();
  }, [room]);

  useEffect(() => { if (snap) document.title = `${snap.show.title} · Live`; }, [snap]);

  return (
    <div className="watch">
      <header className="w-top">
        <b>{snap?.show.title ?? 'Cuedeck'}</b>
        <span className={`w-live${up && snap ? ' on' : ''}`}>{up ? (snap ? 'Live' : 'Waiting for the show to start') : 'Reconnecting…'}</span>
      </header>
      {snap ? <SnapView snap={snap} className="w-view" /> : <div className="w-view w-empty">The slides appear here when the show starts.</div>}
      {snap?.blackout && <p className="w-note">The presenter has paused the slides.</p>}
    </div>
  );
}
