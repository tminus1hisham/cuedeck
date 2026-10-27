import { connect } from './channel';
import { mountPlayer, type PlayerOpts } from './render';
import type { Command, Show } from './types';

/** Shared key map for stage and presenter: arrows, space, page keys and presentation clickers. */
export function keyToCommand(e: KeyboardEvent, last: number): Command | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) return { cmd: 'next' };
  if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) return { cmd: 'prev' };
  if (k === 'Home') return { cmd: 'go', i: 0 };
  if (k === 'End') return { cmd: 'go', i: last };
  if (k === 'p' || k === 'P') return { cmd: 'media' };
  if (k === 'b' || k === 'B' || k === '.') return { cmd: 'blackout' };
  return null;
}

/** The projector window. It owns the real media elements and is the source of truth for state. */
export function mountStage(root: HTMLElement, show: Show, opts: PlayerOpts) {
  root.classList.add('cd-stage-view');
  const host = document.createElement('div');
  host.className = 'cd-stage-host';
  const gate = document.createElement('button');
  gate.className = 'cd-gate';
  gate.innerHTML = '<b>Start show</b><span>Goes full screen and turns on sound</span>';
  root.replaceChildren(host, gate);

  const player = mountPlayer(host, show, opts);
  const link = connect(show.id, m => {
    if (!('cmd' in m)) return;
    if (m.cmd === 'hello') return link.send(player.state());
    run(m);
  });
  player.onState(s => link.send(s));

  function run(c: Command) {
    if (c.cmd === 'go') player.go(c.i);
    else if (c.cmd !== 'hello') player[c.cmd]();
  }

  gate.addEventListener('click', () => {
    const d = document.documentElement;
    (d.requestFullscreen?.() ?? Promise.resolve()).catch(() => {});
    gate.remove();
    player.start();
  });

  const onKey = (e: KeyboardEvent) => {
    if (gate.isConnected) return;
    const c = keyToCommand(e, player.slides.length - 1);
    if (!c) return;
    e.preventDefault();
    run(c);
  };
  addEventListener('keydown', onKey);

  return {
    player,
    setShow: player.setShow,
    destroy() { removeEventListener('keydown', onKey); link.close(); player.destroy(); },
  };
}
