import { describe, expect, it } from 'vitest';
import { route } from './route';

describe('route', () => {
  it('sends snapshots to phones and the audience, and keeps the latest', () => {
    expect(route('stage', { type: 'snap' })).toEqual({ to: ['remote', 'audience'], keep: 'snap' });
  });
  it('keeps notes and slide state away from the audience', () => {
    expect(route('stage', { type: 'summary' })?.to).toEqual(['remote']);
    expect(route('stage', { type: 'state' })?.to).toEqual(['remote']);
  });
  it('passes phone commands to the stage only', () => {
    expect(route('remote', { cmd: 'next' })).toEqual({ to: ['stage'] });
    expect(route('remote', { cmd: 'go', i: 3 })).toEqual({ to: ['stage'] });
  });
  it('drops anything else', () => {
    expect(route('remote', { cmd: 'relay', room: 'x', key: 'y' })).toBeNull();
    expect(route('remote', { type: 'snap' })).toBeNull();
    expect(route('audience', { cmd: 'next' })).toBeNull();
    expect(route('audience', { type: 'snap' })).toBeNull();
    expect(route('stage', { cmd: 'next' })).toBeNull();
    expect(route('stage', null)).toBeNull();
  });
});
