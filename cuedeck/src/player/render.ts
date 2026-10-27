import { expand } from './expand';
import type { Inner, Item, Show, Slide, State } from './types';

export interface PlayerOpts {
  url: (blobId: string) => string;
  /** Previews: no sound, and HTML decks show a placeholder instead of loading a second copy. */
  preview?: boolean;
}

export type Player = ReturnType<typeof mountPlayer>;

const W = 1920, H = 1080;
const MAX_ROWS = 18, MAX_COLS = 10;

/** The parts of an item that change what is on screen. */
const visual = ({ notes, duration, autoplay, ...rest }: Item, s: Show) => JSON.stringify([rest, s.brand]);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Renders one show into `host` on a fixed 1920x1080 stage scaled to fit. Shared by every view. */
export function mountPlayer(host: HTMLElement, show: Show, opts: PlayerOpts) {
  host.classList.add('cd-player');
  const stage = el('div', 'cd-stage');
  const hold = el('div', 'cd-hold');
  host.replaceChildren(stage);

  const fit = () => {
    const s = Math.min(host.clientWidth / W, host.clientHeight / H) || 0;
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);

  let slides: Slide[] = [];
  let index = -1;
  let inner: Inner | null = null;
  let pendingLast = false;
  let blackout = false;
  let blocked = false;
  let started = false;
  let media: HTMLMediaElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  const listeners = new Set<(s: State) => void>();

  const state = (): State => ({
    type: 'state',
    index,
    labels: slides.map(s => s.label),
    media: media ? (media.tagName === 'VIDEO' ? 'video' : 'audio') : '',
    playing: !!media && !media.paused,
    time: media?.currentTime ?? 0,
    duration: media?.duration || 0,
    blocked,
    blackout,
    started,
    inner,
  });
  const emit = () => { const s = state(); listeners.forEach(f => f(s)); };

  const play = () => {
    if (!media) return;
    media.play().then(() => { blocked = false; emit(); }, () => { blocked = true; emit(); });
  };

  function setHold() {
    hold.replaceChildren();
    if (show.brand.logo) { const img = el('img'); img.src = opts.url(show.brand.logo); img.alt = ''; hold.append(img); }
    else hold.append(el('span', '', show.title));
    hold.style.setProperty('--brand', show.brand.color);
  }

  function build(slide: Slide): HTMLElement {
    const { item, part } = slide;
    const box = el('div', `cd-slide cd-${item.kind}`);
    box.style.setProperty('--brand', show.brand.color);
    switch (item.kind) {
      case 'image':
      case 'pdf': {
        const img = el('img', 'cd-fill');
        img.alt = slide.label;
        if (item.blobs[part]) img.src = opts.url(item.blobs[part]);
        box.append(img);
        break;
      }
      case 'video': {
        const v = el('video', 'cd-fill');
        v.playsInline = true;
        media = v;
        box.append(v);
        break;
      }
      case 'audio': {
        box.append(el('p', 'cd-kicker', item.speaker || 'Now playing'), el('h1', 'cd-title', item.label));
        const a = el('audio');
        media = a;
        box.append(a);
        break;
      }
      case 'sheet':
        box.append(sheet(item, part));
        break;
      case 'card':
        box.append(card(item));
        break;
      case 'html':
        if (opts.preview) {
          box.classList.add('cd-card');
          box.append(el('p', 'cd-kicker', 'HTML deck'), el('h1', 'cd-title', inner?.labels[inner.index] || item.label));
        } else {
          frame = el('iframe', 'cd-fill');
          // No allow-same-origin: the deck gets an opaque origin and cannot touch Cuedeck.
          frame.setAttribute('sandbox', 'allow-scripts allow-popups');
          frame.setAttribute('allow', 'autoplay; fullscreen');
          frame.title = item.label;
          frame.src = opts.url(item.blobs[0]);
          frame.addEventListener('load', () => frame?.contentWindow?.postMessage({ cuedeck: 'hello' }, '*'));
          box.append(frame);
        }
        break;
    }
    if (media) {
      media.src = opts.url(item.blobs[0]);
      media.preload = 'auto';
      media.loop = !!item.loop;
      media.muted = !!opts.preview;
      for (const t of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata']) media.addEventListener(t, emit);
    }
    return box;
  }

  function sheet(item: Item, part: number) {
    const s = item.sheets?.[part];
    const wrap = el('div', 'cd-sheet');
    wrap.append(el('h2', 'cd-sheet-title', s ? `${item.label} · ${s.name}` : item.label));
    const rows = s?.rows ?? [];
    const table = el('table');
    rows.slice(0, MAX_ROWS).forEach((r, ri) => {
      const tr = el('tr');
      r.slice(0, MAX_COLS).forEach(c => tr.append(el(ri === 0 ? 'th' : 'td', '', c)));
      table.append(tr);
    });
    wrap.append(table);
    if (rows.length > MAX_ROWS) wrap.append(el('p', 'cd-more', `Showing ${MAX_ROWS} of ${rows.length} rows`));
    return wrap;
  }

  function card(item: Item) {
    const c = item.card ?? { template: 'welcome', title: item.label };
    const wrap = el('div', `cd-card cd-t-${c.template}`);
    if (show.brand.logo) { const img = el('img', 'cd-logo'); img.src = opts.url(show.brand.logo); img.alt = ''; wrap.append(img); }
    const kicker = { welcome: 'Welcome to', speaker: 'Please welcome', break: 'We are on a break', thanks: '', plain: '' }[c.template];
    if (kicker) wrap.append(el('p', 'cd-kicker', kicker));
    wrap.append(el('h1', 'cd-title', c.title || item.label));
    if (c.subtitle) wrap.append(el('p', 'cd-sub', c.subtitle));
    return wrap;
  }

  function render(i: number, fromEnd = false) {
    if (!slides.length) { stage.replaceChildren(el('div', 'cd-slide cd-empty', 'Add a file to start')); index = -1; emit(); return; }
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === index && stage.firstChild) return;
    media?.pause();
    media = null;
    frame = null;
    inner = null;
    blocked = false;
    index = i;
    pendingLast = fromEnd && slides[i].item.kind === 'html';
    const box = build(slides[i]);
    stage.replaceChildren(box);
    if (blackout) stage.append(hold);
    if (media && slides[i].item.autoplay && !opts.preview && started) play();
    emit();
  }

  const post = (cuedeck: string) => frame?.contentWindow?.postMessage({ cuedeck }, '*');
  const onMessage = (e: MessageEvent) => {
    if (!frame || e.source !== frame.contentWindow || e.data?.cuedeck !== 'inner') return;
    inner = e.data.inner;
    if (pendingLast && inner) { pendingLast = false; post('last'); }
    emit();
  };
  window.addEventListener('message', onMessage);

  const isHtml = () => slides[index]?.item.kind === 'html' && !opts.preview;

  const api = {
    get index() { return index; },
    get slides() { return slides; },
    state,
    onState(f: (s: State) => void) { listeners.add(f); return () => listeners.delete(f); },
    setShow(next: Show) {
      const key = (s?: Slide) => s && visual(s.item, show) + s.part;
      const before = key(slides[index]);
      show = next;
      slides = expand(show);
      setHold();
      // Editing notes or timings mid-show must not restart the video on screen.
      if (before && key(slides[index]) === before) return emit();
      const keep = index;
      index = -1;
      render(keep < 0 ? 0 : keep);
    },
    go(i: number) { render(i); },
    next() {
      if (isHtml() && (!inner || inner.index < inner.count - 1)) return post('next');
      render(index + 1);
    },
    prev() {
      if (isHtml() && (!inner || inner.index > 0)) return post('prev');
      render(index - 1, true);
    },
    /** Leave the current cue even if an HTML deck still has slides left. */
    skip() { render(index + 1); },
    media() { if (!media) return; media.paused ? play() : media.pause(); },
    restart() { if (!media) return; media.currentTime = 0; play(); },
    blackout() {
      blackout = !blackout;
      if (blackout) stage.append(hold); else hold.remove();
      emit();
    },
    /** Called from the "Start show" click so audio may play from then on. */
    start() {
      started = true;
      if (media && slides[index]?.item.autoplay) play(); else emit();
    },
    /** Previews mirror the stage instead of being driven directly. */
    follow(s: State) {
      if (s.index !== index) render(s.index);
      if (s.blackout !== blackout) api.blackout();
      if (inner?.index !== s.inner?.index && slides[index]?.item.kind === 'html') {
        inner = s.inner ?? null;
        const t = stage.querySelector('.cd-title');
        if (t) t.textContent = inner?.labels[inner.index] || slides[index].item.label;
      }
      if (media && s.media) {
        if (Math.abs(media.currentTime - s.time) > 1.5) media.currentTime = s.time;
        if (s.playing && media.paused) media.play().catch(() => {});
        else if (!s.playing && !media.paused) media.pause();
      }
    },
    destroy() {
      media?.pause();
      ro.disconnect();
      window.removeEventListener('message', onMessage);
      listeners.clear();
      host.replaceChildren();
    },
  };
  api.setShow(show);
  return api;
}
