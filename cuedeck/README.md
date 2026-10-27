# Cuedeck

Drop in any mix of files, arrange them into one running order, and run the event from a presenter screen.

Built for event organisers and MCs. A typical launch needs the speaker's slides, the national anthem, a launch video, a sponsor spreadsheet and a few title cards, all in one sequence. Cuedeck turns each file into a **cue** (Q1, Q2…), shows it on the projector, and lets you call each one from your laptop, keyboard or presentation clicker.

## What it takes

| File | Becomes |
|---|---|
| PDF | one slide per page |
| PowerPoint, Keynote, Word | save as PDF first (automatic conversion is planned) |
| Excel (.xlsx), CSV | one slide per sheet |
| HTML decks | runs as-is in a sandbox; GO and Back step through the deck's own slides |
| Images | one slide each |
| Video, audio | plays on the cue, with play, pause and restart from the presenter screen |
| Title cards | Welcome, Speaker intro, Break, Thank you, in your brand colour and logo |

## Running a show

1. Drop your files on the home page and put the cues in order.
2. Click **Present**. The presenter screen opens.
3. Click **Open stage window**, drag it onto the projector, and click **Start show** (full screen, sound on).
4. Run the show with **GO**, the arrow keys, Space or a clicker. Press **B** to put up the hold screen.

The presenter screen shows the live slide, what's up next, your notes, and a running-order clock. If you set planned minutes on cues, it tells you when you are running behind.

**Run it from your phone.** On the presenter screen, click **Phone & audience** and scan the QR code. Your phone gets GO and Back (or swipe), the slide on screen, your notes, the timer and the running order. Several phones can connect at once, for example the MC and the tech desk. **Make new links** disconnects every old phone.

**Let the audience follow along.** Share the audience link from the same panel. Viewers see only the slide that is on the projector right now, never your notes or what's next. Videos and HTML decks show as a title card naming what's on screen.

Your files never leave the laptop. The stage window sends phones and viewers a small picture of the current slide through a relay, and the relay keeps only that latest picture.

**Bad Wi-Fi at the venue?** Click **Export offline**. You get a ZIP with `show.html`, `remote.html` and the media. Unzip it and open `remote.html` in Chrome or Edge; it works with no internet.

## Development

```sh
npm install
npm run dev      # app and relay together at http://localhost:5173 (no Cloudflare account needed)
npm test         # unit tests (vitest)
npm run test:e2e # end-to-end in installed Chrome; the phase 1 test needs the DAMA sample files one folder up
npm run build    # static app in dist/client, relay Worker in dist/cuedeck
npm run deploy   # build and deploy to your Cloudflare account (Workers Free plan is enough)
```

Shows are saved in the browser (IndexedDB). The only server part is a small relay: a Cloudflare Worker plus one Durable Object per live show (`src/worker`). It forwards phone commands to the stage and slide snapshots to phones and viewers. It stores nothing but the latest snapshot and a running-order summary, and wipes a room after a day of no use.

To test the phone remote on a real phone during development, run `npx vite --host` and open the presenter screen using your laptop's network address (not `localhost`), so the QR code points somewhere your phone can reach.

### How it fits together

- `src/player/`: plain-DOM code shared by the app and the offline export.
  - `render.ts`: the one slide player used by the stage, previews and builder.
  - `stage.ts`: the projector window.
  - `remote.ts`: the presenter screen.
  - `intake.ts`: turns files into cues.
  - `bridge.ts`: the script injected into HTML decks.
  - `snapshot.ts`: the current slide, cut down for phones and viewers.
  - `rooms.ts`: room codes, links and the reconnecting WebSocket.
- `src/client/`: the React builder, home page, phone remote (`Phone.tsx`) and audience view (`Watch.tsx`).
- `src/worker/`: the relay. `route.ts` holds the whole routing policy: who may send what to whom.
- `src/export/`: the offline player, built as a single file into `public/offline.html`.

Uploaded HTML runs in an `allow-scripts` sandbox without `allow-same-origin`, so it gets an opaque origin and can only talk to Cuedeck through `postMessage`.

## Roadmap

- Automatic PowerPoint and Word conversion via self-hosted [Gotenberg](https://gotenberg.dev)
- Title-card templates and brand kit polish
- Saving shows to the cloud (D1 + R2) with private owner links, so a show opens on any computer

## License

MIT
