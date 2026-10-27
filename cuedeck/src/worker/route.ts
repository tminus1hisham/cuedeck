export type Role = 'stage' | 'remote' | 'audience';
export const ROLES: Role[] = ['stage', 'remote', 'audience'];

const COMMANDS = new Set(['next', 'prev', 'go', 'media', 'restart', 'blackout', 'skip', 'hello']);

/**
 * Who may send what to whom. The relay keeps no show logic; this table is the whole policy:
 * - only the stage publishes; the audience gets nothing but the current slide snapshot
 * - phones (key holders) send commands to the stage, never to each other or the audience
 * `keep` says whether the relay stores the latest copy for people who join later.
 */
export function route(from: Role, msg: unknown): { to: Role[]; keep?: 'summary' | 'snap' } | null {
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as { type?: unknown; cmd?: unknown };
  if (from === 'stage') {
    if (m.type === 'snap') return { to: ['remote', 'audience'], keep: 'snap' };
    if (m.type === 'summary') return { to: ['remote'], keep: 'summary' };
    if (m.type === 'state') return { to: ['remote'] };
    return null;
  }
  if (from === 'remote' && typeof m.cmd === 'string' && COMMANDS.has(m.cmd)) return { to: ['stage'] };
  return null;
}
