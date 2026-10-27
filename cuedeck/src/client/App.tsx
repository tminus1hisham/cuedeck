import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { db, loadUrls } from '../lib/db';
import { mountRemote } from '../player/remote';
import { mountStage } from '../player/stage';
import type { Show } from '../player/types';
import { Builder } from './Builder';
import { Home } from './Home';
import { Phone } from './Phone';
import { mountShare } from './share';
import { Watch } from './Watch';
import { online } from '../player/rooms';

const subscribe = (f: () => void) => { addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); };
const useHash = () => useSyncExternalStore(subscribe, () => location.hash);

/** Tells open stage and presenter windows that the builder saved a change. */
export const sync = new BroadcastChannel('cuedeck-sync');

export function App() {
  const [, page, id, key] = useHash().match(/^#\/(show|stage|present|remote|watch)\/([\w-]+)(?:\/([\w-]+))?/) ?? [];
  if (page === 'remote' && key) return <Phone key={id} room={id} keyParam={key} />;
  if (page === 'watch') return <Watch key={id} room={id} />;
  if (page === 'show') return <Builder key={id} id={id} />;
  if (page === 'stage' || page === 'present') return <Live key={page + id} id={id} mode={page} />;
  return <Home />;
}

/** Stage and presenter are plain-DOM views shared with the offline export; React only mounts them. */
function Live({ id, mode }: { id: string; mode: 'stage' | 'present' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let view: { setShow(s: Show): void; destroy(): void } | null = null;
    let share: { destroy(): void } | null = null;
    let dead = false;
    const load = async () => {
      const show = await db.getShow(id);
      if (dead) return;
      if (!show) return setMissing(true);
      const url = await loadUrls(show);
      if (dead) return;
      document.title = `${show.title} · ${mode === 'stage' ? 'Stage' : 'Presenter'}`;
      if (view) return view.setShow(show);
      view = mode === 'stage'
        ? mountStage(ref.current!, show, { url })
        : mountRemote(ref.current!, show, { url, stageUrl: `#/stage/${id}` });
      const slot = ref.current!.querySelector<HTMLElement>('.rm-share');
      if (slot && online()) share = mountShare(slot, id);
    };
    const onSync = (e: MessageEvent) => { if (e.data === id) load(); };
    sync.addEventListener('message', onSync);
    load();
    return () => { dead = true; sync.removeEventListener('message', onSync); share?.destroy(); view?.destroy(); };
  }, [id, mode]);

  if (missing) return <main className="app-missing"><p>This show isn't on this computer.</p><a href="#/">Go to your shows</a></main>;
  return <div ref={ref} className="live-root" />;
}
