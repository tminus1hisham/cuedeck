import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { twoPagePdf } from './fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const DAMA = join(here, '..', '..');
const deck = join(DAMA, 'DAMA Kenya Launch Event Deck.html');
const video = join(DAMA, 'DAMA_Kenya_Launch_SunoSong_Merged.mp4');
const scratch = join(here, '..', '.e2e');

const csv = Buffer.from('Item,Amount\nVenue,"120,000"\nSound,45000\n');

async function stageAndRemote(stage: Page, remote: Page, base: string, remoteUrl: string) {
  await remote.goto(remoteUrl);
  await stage.goto(base);
  await stage.getByRole('button', { name: /Start show/ }).click();
  await expect(remote.locator('.rm-conn span')).toHaveText('Stage connected');
}

test.skip(!existsSync(deck) || !existsSync(video), 'needs the DAMA launch files next to the project');

test('build a show from mixed files, run it from the presenter, export it offline', async ({ page, context }) => {
  const fixtures = join(scratch, '..', '.e2e-in');
  mkdirSync(fixtures, { recursive: true });
  const made = ([['Keynote.pdf', twoPagePdf()], ['Budget.csv', csv], ['Talk.pptx', Buffer.from('x')]] as const).map(([n, b]) => {
    writeFileSync(join(fixtures, n), b);
    return join(fixtures, n);
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([...made, video, deck]);
  await expect(page).toHaveURL(/#\/show\//, { timeout: 60_000 });
  const id = page.url().split('/').pop()!;

  // The pptx is refused with a fix-it message; the rest land as cues in drop order.
  const cues = page.locator('.b-sheet li .meta b');
  await expect(cues).toHaveText(['Keynote', 'Budget', 'DAMA_Kenya_Launch_SunoSong_Merged', 'DAMA Kenya Launch Event Deck']);
  await page.locator('.b-add-card select').selectOption('thanks');
  await expect(cues).toHaveCount(5);
  await page.getByLabel('Planned minutes').fill('3');

  // ---- live: stage + presenter in the same browser
  const stage = await context.newPage();
  const remote = await context.newPage();
  await stageAndRemote(stage, remote, `/#/stage/${id}`, `/#/present/${id}`);
  await expect(remote.locator('.rm-cue h2')).toHaveText('Keynote (1)');
  await remote.getByRole('button', { name: 'GO' }).click();
  await expect(stage.locator('.cd-slide img')).toHaveAttribute('alt', 'Keynote (2)');
  await expect(remote.locator('.rm-next b')).toHaveText('Budget');

  await remote.getByRole('button', { name: 'GO' }).click();
  await expect(stage.locator('.cd-sheet td').first()).toHaveText('Venue');

  // Video cue autoplays after "Start show" and reports back to the presenter.
  await remote.locator('.rm-sheet button', { hasText: 'DAMA_Kenya' }).click();
  await expect(remote.locator('.rm-media')).toBeVisible();
  await expect(remote.locator('.rm-play')).toHaveText('Pause', { timeout: 15_000 });
  await remote.locator('.rm-play').click();
  await expect(remote.locator('.rm-play')).toHaveText('Play');

  // The real DAMA deck runs sandboxed; the bridge reports its own slides and GO steps through them.
  await remote.locator('.rm-sheet button', { hasText: 'Launch Event Deck' }).click();
  await expect(remote.locator('.rm-q')).toContainText('slide 1 of 13', { timeout: 30_000 });
  await expect(remote.locator('.rm-cue h2')).toHaveText('Welcome');
  await remote.getByRole('button', { name: 'GO' }).click();
  await expect(remote.locator('.rm-cue h2')).toHaveText('MC Welcome');
  await expect(remote.getByRole('button', { name: 'Skip to next cue' })).toBeVisible();
  await remote.getByRole('button', { name: 'Skip to next cue' }).click();
  await expect(stage.locator('.cd-title')).toHaveText('Thank you');

  await remote.getByRole('button', { name: 'Hold screen' }).click();
  await expect(stage.locator('.cd-hold')).toBeVisible();
  await expect(remote.locator('.rm-drift')).toBeVisible();

  // Editing the show while live updates the presenter without a reload.
  await page.getByLabel('Presenter notes').fill('Thank the sponsors');
  await expect(remote.locator('.rm-notes')).toHaveText('Thank the sponsors');

  // ---- offline export, run from file:// with no server
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export offline' }).click()]);
  const files = unzipSync(readFileSync(await download.path()));
  expect(Object.keys(files)).toEqual(expect.arrayContaining(['show.html', 'remote.html', 'README.txt']));
  expect(Object.keys(files).filter(f => f.startsWith('media/'))).toHaveLength(4); // 2 pdf pages, video, deck

  rmSync(scratch, { recursive: true, force: true });
  for (const [name, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(scratch, name)), { recursive: true });
    writeFileSync(join(scratch, name), bytes);
  }
  const offStage = await context.newPage();
  const offRemote = await context.newPage();
  await stageAndRemote(offStage, offRemote, pathToFileURL(join(scratch, 'show.html')).href, pathToFileURL(join(scratch, 'remote.html')).href);
  await offRemote.getByRole('button', { name: 'GO' }).click();
  await expect(offStage.locator('.cd-slide img')).toHaveAttribute('alt', 'Keynote (2)');
});
