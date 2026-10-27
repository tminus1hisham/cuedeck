import { useEffect, useRef } from 'react';
import { mountPlayer, type Player } from '../player/render';
import type { Snap } from '../player/types';

/** Draws a relay snapshot with the same player the projector uses. */
export function SnapView({ snap, className }: { snap: Snap; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const urls = useRef(snap.urls);

  useEffect(() => {
    urls.current = snap.urls;
    const p = (player.current ??= mountPlayer(host.current!, snap.show, { url: id => urls.current[id] ?? '', preview: true }));
    p.setShow(snap.show);
    if (p.state().blackout !== snap.blackout) p.blackout();
  }, [snap]);

  useEffect(() => () => { player.current?.destroy(); player.current = null; }, []);

  return <div ref={host} className={className} />;
}
