import { DurableObject } from 'cloudflare:workers';
import { ROLES, route, type Role } from './route';

/** Rooms nobody has used for a day are wiped. */
const IDLE_MS = 24 * 60 * 60 * 1000;
/** DO storage values max out at 2 MB; snapshots are well under this. */
const MAX_MSG = 1_900_000;

/**
 * One live show. A dumb relay between the stage window, phone remotes and the audience,
 * using hibernatable WebSockets so an idle room costs nothing. Shows themselves never reach the server:
 * the stage sends only the slide on screen.
 */
export class Room extends DurableObject {
  /** Last stage state, in memory only: it changes several times a second, so storing it would burn writes. */
  private state: string | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const role = url.searchParams.get('role') as Role;
    const key = url.searchParams.get('key') ?? '';
    if (!ROLES.includes(role)) return new Response('Unknown role', { status: 400 });

    if (role !== 'audience') {
      const owner = await this.ctx.storage.get<string>('key');
      // The first stage to connect claims the room with its secret key. Codes are random, so nobody can claim one first.
      if (!owner) {
        if (role !== 'stage' || key.length < 20) return new Response('No such show', { status: 403 });
        await this.ctx.storage.put('key', key);
      } else if (owner !== key) {
        return new Response('Wrong key', { status: 403 });
      }
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role });

    if (role !== 'stage') {
      const [summary, snap] = await Promise.all([this.ctx.storage.get<string>('summary'), this.ctx.storage.get<string>('snap')]);
      if (snap) server.send(snap);
      if (role === 'remote') {
        if (summary) server.send(summary);
        if (this.state) server.send(this.state);
        else this.sendTo('stage', JSON.stringify({ cmd: 'hello' }));
      }
    }
    this.presence();
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let msg: unknown;
    try { msg = JSON.parse(raw); } catch { return; }
    const from = roleOf(ws);
    const r = route(from, msg);
    if (!r) return;
    if (r.keep) await this.ctx.storage.put(r.keep, raw);
    else if (from === 'stage') this.state = raw;
    for (const to of r.to) this.sendTo(to, raw);
  }

  async webSocketClose(ws: WebSocket) {
    this.presence(ws);
  }

  async alarm() {
    if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    else await this.ctx.storage.deleteAll();
  }

  private sockets(role: Role, except?: WebSocket) {
    return this.ctx.getWebSockets().filter(s => s !== except && roleOf(s) === role);
  }

  private sendTo(role: Role, raw: string, except?: WebSocket) {
    for (const s of this.sockets(role, except)) {
      try { s.send(raw); } catch { /* closing socket; webSocketClose cleans up */ }
    }
  }

  /** Tells the stage and phones how many phones and viewers are connected. */
  private presence(leaving?: WebSocket) {
    const p = JSON.stringify({
      type: 'presence',
      remotes: this.sockets('remote', leaving).length,
      audience: this.sockets('audience', leaving).length,
      online: this.sockets('stage', leaving).length > 0,
    });
    this.sendTo('stage', p, leaving);
    this.sendTo('remote', p, leaving);
  }
}

const roleOf = (ws: WebSocket) => (ws.deserializeAttachment() as { role: Role }).role;
