import { connect } from './channel';
import { summarize } from './expand';
import { mountPlayer, type PlayerOpts } from './render';
import { online, relay, savedRoom, type RelayMsg } from './rooms';
import { snapshot } from './snapshot';
import type { Command, Show, State } from './types';

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

const PLAYER_CMDS = new Set(['next', 'prev', 'media', 'restart', 'blackout', 'skip']);
/** Progress-bar updates go to phones at most once a second; real changes go at once. */
const STATE_EVERY_MS = 1000;

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
    if (m.cmd === 'relay') return openRelay(m.room, m.key);
    run(m);
  });

  // ---- relay to phones and the audience (online only)
  let net: ReturnType<typeof relay> | null = null;
  let netRoom = '';
  let lastSent = 0, lastKey = '', snapKey = '', snapSeq = 0;

  function openRelay(room: string, key: string) {
    if (!online() || room === netRoom) return;
    net?.close();
    netRoom = room;
    net = relay(room, 'stage', key, onRelay, up => { if (up) publish(true); });
  }
  function onRelay(m: RelayMsg) {
    if ('type' in m && m.type === 'presence') return link.send(m);
    if ('cmd' in m) run(m);
  }
  const sendSnap = async (s: State) => {
    const seq = ++snapSeq;
    const snap = await snapshot(show, player.slides[s.index], s.index, s.blackout, s.inner, opts.url);
    if (seq === snapSeq) net?.send(snap);
  };
  /** Sends what changed. `all` resends everything, for a fresh connection. */
  function publish(all = false, s: State = player.state()) {
    if (!net) return;
    const key = `${s.index}|${s.blackout}|${s.inner?.index}|${s.playing}|${s.media}|${s.started}|${s.blocked}`;
    const now = Date.now();
    if (all || key !== lastKey || now - lastSent >= STATE_EVERY_MS) {
      net.send(s);
      lastSent = now;
    }
    lastKey = key;
    const sk = `${s.index}|${s.blackout}|${s.inner?.index}`;
    if (all) net.send(summarize(show, player.slides));
    if (all || sk !== snapKey) { snapKey = sk; sendSnap(s); }
  }

  player.onState(s => { link.send(s); publish(false, s); });

  function run(c: Command) {
    if (c.cmd === 'hello') {
      link.send(player.state());
      if (net) { net.send(player.state()); net.send(summarize(show, player.slides)); }
    } else if (c.cmd === 'go') {
      if (Number.isInteger(c.i)) player.go(c.i);
    } else if (PLAYER_CMDS.has(c.cmd)) {
      player[c.cmd as 'next']();
    }
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

  const saved = online() ? savedRoom(show.id) : null;
  if (saved) openRelay(saved.room, saved.key);

  return {
    player,
    setShow(next: Show) {
      show = next;
      player.setShow(next);
      if (net) { net.send(summarize(show, player.slides)); snapKey = ''; publish(); }
    },
    destroy() { removeEventListener('keydown', onKey); link.close(); net?.close(); player.destroy(); },
  };
}
