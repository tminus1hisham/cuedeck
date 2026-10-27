import '../player/player.css';
import { mountRemote } from '../player/remote';
import { mountStage } from '../player/stage';
import type { Show } from '../player/types';

declare global {
  interface Window { CUEDECK?: { show: Show; files: Record<string, string> }; CUEDECK_MODE?: 'stage' | 'remote' }
}

const data = window.CUEDECK;
if (!data) {
  document.body.textContent = 'This is the Cuedeck offline player template. Export a show from Cuedeck to use it.';
} else {
  const url = (id: string) => data.files[id] ?? '';
  document.title = `${data.show.title} · ${window.CUEDECK_MODE === 'remote' ? 'Remote' : 'Stage'}`;
  if (window.CUEDECK_MODE === 'remote') mountRemote(document.body, data.show, { url, stageUrl: 'show.html' });
  else mountStage(document.body, data.show, { url });
}
