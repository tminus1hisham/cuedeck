import { devices, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { twoPagePdf } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', '.e2e-in');
const NOTES = 'Thank the sponsors first';

test('phone remote and audience link run over the relay', async ({ browser }) => {
  mkdirSync(fixtures, { recursive: true });
  writeFileSync(join(fixtures, 'Keynote.pdf'), twoPagePdf());
  writeFileSync(join(fixtures, 'Budget.csv'), 'Item,Amount\nVenue,120000\n');

  // ---- laptop: build the show, open presenter and stage
  const laptop = await browser.newContext();
  const page = await laptop.newPage();
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([join(fixtures, 'Keynote.pdf'), join(fixtures, 'Budget.csv')]);
  await expect(page).toHaveURL(/#\/show\//);
  const id = page.url().split('/').pop()!;
  await page.getByLabel('Presenter notes').fill(NOTES);

  const presenter = await laptop.newPage();
  await presenter.goto(`/#/present/${id}`);
  const stage = await laptop.newPage();
  await stage.goto(`/#/stage/${id}`);
  await stage.getByRole('button', { name: /Start show/ }).click();

  await presenter.getByRole('button', { name: /Phone & audience/ }).click();
  const phoneUrl = await presenter.getByLabel('Phone remote link').inputValue();
  const audienceUrl = await presenter.getByLabel('Audience link').inputValue();
  expect(phoneUrl).toMatch(/#\/remote\/[A-HJ-NP-Z2-9]{8}\/[\w-]{20,}$/);
  expect(audienceUrl).toMatch(/#\/watch\/[A-HJ-NP-Z2-9]{8}$/);
  await expect(presenter.locator('.sh-qr svg')).toBeVisible();

  // ---- phone: its own browser, shares nothing with the laptop but the relay
  const phoneCtx = await browser.newContext({ ...devices['Pixel 7'] });
  const phone = await phoneCtx.newPage();
  await phone.goto(phoneUrl);
  await expect(phone.locator('.ph-conn')).toHaveText('Connected');
  await expect(phone.locator('.ph-cue h1')).toHaveText('Keynote (1)');
  await expect(phone.locator('.ph-notes')).toHaveText(NOTES);
  await expect(phone.locator('.ph-view img')).toHaveAttribute('src', /^data:image\/jpeg/);

  // ---- audience: no key, records every frame it receives
  const viewerCtx = await browser.newContext({ ...devices['Pixel 7'] });
  const viewer = await viewerCtx.newPage();
  const frames: string[] = [];
  viewer.on('websocket', ws => { if (ws.url().includes('/api/room/')) ws.on('framereceived', f => frames.push(String(f.payload))); });
  await viewer.goto(audienceUrl);
  await expect(viewer.locator('.w-live')).toHaveText('Live');
  await expect(viewer.locator('.w-view img')).toHaveAttribute('alt', 'Keynote (1)');
  await expect(presenter.locator('.sh-status')).toHaveText('Live: 1 phone connected, 1 watching.');

  // GO on the phone moves the projector, the presenter and the audience.
  await phone.getByRole('button', { name: 'GO' }).click();
  await expect(stage.locator('.cd-slide img')).toHaveAttribute('alt', 'Keynote (2)');
  await expect(presenter.locator('.rm-cue h2')).toHaveText('Keynote (2)');
  await expect(viewer.locator('.w-view img')).toHaveAttribute('alt', 'Keynote (2)');
  await phone.getByRole('button', { name: 'GO' }).click();
  await expect(viewer.locator('.w-view td').first()).toHaveText('Venue');
  await expect(phone.locator('.ph-next b')).toHaveText('End of show');

  await phone.getByRole('button', { name: 'Hold screen' }).click();
  await expect(stage.locator('.cd-hold')).toBeVisible();
  await expect(viewer.locator('.w-note')).toBeVisible();
  await phone.getByRole('button', { name: 'Show slides' }).click();
  await expect(stage.locator('.cd-hold')).toHaveCount(0);

  // Jump from the phone's running order.
  await phone.getByText('Running order').click();
  await phone.locator('.ph-sheet button', { hasText: 'Keynote' }).click();
  await expect(stage.locator('.cd-slide img')).toHaveAttribute('alt', 'Keynote (1)');

  // The audience only ever got slide snapshots: no notes, no running order, no state.
  expect(frames.length).toBeGreaterThan(0);
  for (const f of frames) {
    expect(f).not.toContain(NOTES);
    expect(JSON.parse(f).type).toBe('snap');
  }

  // A reloaded stage window rejoins the same room; the phone keeps working without rescanning.
  await stage.reload();
  await stage.getByRole('button', { name: /Start show/ }).click();
  await expect(phone.locator('.ph-conn')).toHaveText('Connected');
  await phone.getByRole('button', { name: 'GO' }).click();
  await expect(stage.locator('.cd-slide img')).toHaveAttribute('alt', 'Keynote (2)');

  // A phone with the wrong key is refused and can't control anything.
  const intruder = await (await browser.newContext()).newPage();
  await intruder.goto(phoneUrl.replace(/\/[\w-]+$/, '/wrongwrongwrongwrongwrong'));
  await expect(intruder.locator('.ph-conn')).toHaveText('Reconnecting…');
  await expect(intruder.getByRole('button', { name: 'GO' })).toBeDisabled();

  // "Make new links" cuts off the old phone.
  await presenter.getByRole('button', { name: 'Make new links' }).click();
  await expect(phone.locator('.ph-conn')).not.toHaveText('Connected');
});
