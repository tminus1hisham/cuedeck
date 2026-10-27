export { Room } from './room';

interface Env { ROOM: DurableObjectNamespace }

/** Matches the room codes made in src/player/rooms.ts. */
const ROOM = /^\/api\/room\/([A-HJ-NP-Z2-9]{8})$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const m = new URL(req.url).pathname.match(ROOM);
    if (!m) return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  },
} satisfies ExportedHandler<Env>;
