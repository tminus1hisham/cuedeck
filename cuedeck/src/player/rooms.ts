import type { Msg } from './channel';
import type { Presence, Snap, Summary } from './types';

export type RelayMsg = Msg | Summary | Snap | Presence;
export type Role = 'stage' | 'remote' | 'audience';
export interface RoomInfo { room: string; key: string }

/** No I, O, 0 or 1, so codes read out loud or typed from a screen don't get mixed up. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function newRoom(): RoomInfo {
  const room = [...random(8)].map(b => ALPHABET[b % 32]).join('');
  const key = btoa(String.fromCharCode(...random(18))).replace(/\+/g, '-').replace(/\//g, '_');
  return { room, key };
}

/** The room a show uses, kept in this browser so a reloaded stage window rejoins the same phones. */
export const savedRoom = (showId: string): RoomInfo | null => {
  try { return JSON.parse(localStorage.getItem(`cuedeck-room:${showId}`) ?? 'null'); } catch { return null; }
};
export const saveRoom = (showId: string, r: RoomInfo) => {
  try { localStorage.setItem(`cuedeck-room:${showId}`, JSON.stringify(r)); } catch { /* private mode: room lasts this session only */ }
};

/** Phones and the audience can only reach the relay when the app is served over http(s). */
export const online = () => location.protocol === 'https:' || location.protocol === 'http:';

export const links = (r: RoomInfo) => {
  const base = `${location.origin}${location.pathname}`;
  return { phone: `${base}#/remote/${r.room}/${r.key}`, audience: `${base}#/watch/${r.room}` };
};

/** WebSocket to the room's relay, reconnecting with backoff until closed. */
export function relay(room: string, role: Role, key: string, onMessage: (m: RelayMsg) => void, onStatus?: (up: boolean) => void) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room/${room}?role=${role}&key=${encodeURIComponent(key)}`;
  let ws: WebSocket;
  let closed = false;
  let delay = 1000;
  let timer: ReturnType<typeof setTimeout>;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { delay = 1000; onStatus?.(true); };
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
    ws.onclose = () => {
      onStatus?.(false);
      if (!closed) timer = setTimeout(open, (delay = Math.min(delay * 2, 10_000)));
    };
  };
  open();
  return {
    send(m: RelayMsg) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); },
    close() { closed = true; clearTimeout(timer); ws.close(); },
  };
}
