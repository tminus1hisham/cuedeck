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

**Bad Wi-Fi at the venue?** Click **Export offline**. You get a ZIP with `show.html`, `remote.html` and the media. Unzip it and open `remote.html` in Chrome or Edge; it works with no internet.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (vitest)
npm run test:e2e # end-to-end, uses installed Chrome; needs the DAMA sample files one folder up
npm run build    # static site in dist/
```

Everything currently runs in the browser: shows are saved in IndexedDB and nothing is uploaded. `dist/` can be hosted on any static host, for example Cloudflare's free static assets.

### How it fits together

- `src/player/`: plain-DOM code shared by the app and the offline export.
  - `render.ts`: the one slide player used by the stage, previews and builder.
  - `stage.ts`: the projector window.
  - `remote.ts`: the presenter screen.
  - `intake.ts`: turns files into cues.
  - `bridge.ts`: the script injected into HTML decks.
- `src/client/`: the React builder and home page.
- `src/export/`: the offline player, built as a single file into `public/offline.html`.

Uploaded HTML runs in an `allow-scripts` sandbox without `allow-same-origin`, so it gets an opaque origin and can only talk to Cuedeck through `postMessage`.

## Roadmap

- Phone remote over the internet (QR pairing), via a Cloudflare Worker and Durable Object
- Audience follow-along link
- Saving shows to the cloud (D1 + R2) with private owner links
- Automatic PowerPoint and Word conversion via self-hosted [Gotenberg](https://gotenberg.dev)

## License

MIT
