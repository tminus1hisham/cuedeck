import type { Command, State } from './types';

export type Msg = Command | State;

/**
 * Same-laptop link between stage and presenter windows. Works from a local folder too,
 * which is what the offline export relies on.
 * ponytail: same-browser only; the phone remote swaps this for a WebSocket to a Durable Object.
 */
export function connect(showId: string, onMessage: (m: Msg) => void) {
  const bc = new BroadcastChannel(`cuedeck:${showId}`);
  bc.onmessage = e => onMessage(e.data as Msg);
  return {
    send: (m: Msg) => bc.postMessage(m),
    close: () => bc.close(),
  };
}
