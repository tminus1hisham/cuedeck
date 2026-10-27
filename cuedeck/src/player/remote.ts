import { connect } from './channel';
import { drift } from './expand';
import { mountPlayer, type PlayerOpts } from './render';
import { keyToCommand } from './stage';
import type { Command, Show, State } from './types';

const fmt = (s: number) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const TEMPLATE = `
<header class="rm-top">
  <h1 class="rm-show"></h1>
  <p class="rm-conn"><i></i><span>Waiting for the stage window</span></p>
  <p class="rm-drift" hidden></p>
  <span class="rm-share"></span>
  <p class="rm-clock" title="Time since the first cue change">0:00</p>
  <button class="rm-btn" data-act="reset">Reset clock</button>
  <button class="rm-btn" data-act="open">Open stage window</button>
</header>
<ol class="rm-setup">
  <li>Click <b>Open stage window</b> and drag it onto the projector screen.</li>
  <li>On the projector, click <b>Start show</b>. That one click goes full screen and turns on sound.</li>
  <li>Come back here. Your keyboard, clicker or mouse on this window now runs the show.</li>
</ol>
<main class="rm-main">
  <section class="rm-live">
    <div class="rm-screens">
      <figure class="rm-now"><div class="rm-view"></div><figcaption>On the projector</figcaption></figure>
      <figure class="rm-next"><div class="rm-view"></div><figcaption>Up next: <b></b></figcaption></figure>
    </div>
    <div class="rm-cue">
      <p class="rm-q"></p>
      <h2></h2>
      <p class="rm-speaker"></p>
      <p class="rm-notes"></p>
    </div>
    <div class="rm-media" hidden>
      <button class="rm-btn rm-play" data-act="media">Play</button>
      <button class="rm-btn" data-act="restart">Restart</button>
      <div class="rm-bar"><span></span></div>
      <span class="rm-t">0:00 / 0:00</span>
      <p class="rm-blocked">The browser blocked sound. Click <b>Start show</b> on the projector, then press Play here.</p>
    </div>
    <div class="rm-nav">
      <button data-act="prev" class="rm-back">Back</button>
      <button data-act="next" class="rm-go">GO</button>
      <button data-act="blackout" class="rm-black">Hold screen</button>
      <button data-act="skip" class="rm-skip" hidden>Skip to next cue</button>
    </div>
  </section>
  <nav class="rm-sheet" aria-label="Running order"></nav>
</main>
<footer class="rm-keys">Keys: → Space PgDn go · ← PgUp back · Home/End first/last · P play/pause · B hold screen. Presentation clickers work too.</footer>`;

/** Presenter view: drives the stage window, with previews, notes, timer and running-order clock. */
export function mountRemote(root: HTMLElement, show: Show, opts: PlayerOpts & { stageUrl: string }) {
  root.classList.add('cd-remote');
  root.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;

  const now = mountPlayer($('.rm-now .rm-view'), show, { ...opts, preview: true });
  const next = mountPlayer($('.rm-next .rm-view'), show, { ...opts, preview: true });
  let st: State | null = null, lastSeen = 0, t0 = 0, cueT0 = 0, cue = -1, sheetKey = '';

  const send = (c: Command) => link.send(c);
  const link = connect(show.id, m => {
    if (!('type' in m) || m.type !== 'state') return;
    if (st && m.index !== st.index && !t0) t0 = Date.now();
    st = m;
    lastSeen = Date.now();
    render();
  });

  function setShow(s: Show) {
    show = s;
    now.setShow(s);
    next.setShow(s);
    sheetKey = '';
    $('.rm-show').textContent = s.title;
    if (st) render();
  }

  function render() {
    if (!st) return;
    root.classList.add('on');
    $('.rm-conn span').textContent = 'Stage connected';
    const slides = now.slides;
    const slide = slides[st.index];
    if (!slide) return;
    now.follow(st);
    next.go(Math.min(st.index + 1, slides.length - 1));
    const nextLabel = st.index + 1 < slides.length ? slides[st.index + 1].label : 'End of show';
    $('.rm-next b').textContent = nextLabel;
    $('.rm-next').classList.toggle('end', st.index + 1 >= slides.length);

    if (slide.cue - 1 !== cue) { cue = slide.cue - 1; cueT0 = Date.now(); }
    const inner = st.inner;
    $('.rm-q').textContent = `Q${slide.cue} of ${show.items.length}` + (inner ? ` · slide ${inner.index + 1} of ${inner.count}` : '');
    $('.rm-cue h2').textContent = inner?.labels[inner.index] || slide.label;
    $('.rm-speaker').textContent = slide.item.speaker || '';
    $('.rm-notes').textContent = slide.item.notes || '';

    const key = show.items.map(i => i.id + i.label + i.duration).join('|');
    if (key !== sheetKey) {
      sheetKey = key;
      const starts = new Map<number, number>();
      slides.forEach((s, i) => { if (s.part === 0) starts.set(s.cue, i); });
      $('.rm-sheet').replaceChildren(...show.items.map((it, i) => {
        const b = document.createElement('button');
        const q = document.createElement('span'); q.className = 'q'; q.textContent = `Q${i + 1}`;
        const l = document.createElement('span'); l.className = 'l'; l.textContent = it.label;
        const d = document.createElement('span'); d.className = 'd'; d.textContent = it.duration ? `${it.duration} min` : '';
        b.append(q, l, d);
        b.onclick = () => send({ cmd: 'go', i: starts.get(i + 1)! });
        return b;
      }));
    }
    [...$('.rm-sheet').children].forEach((b, i) => {
      b.classList.toggle('cur', i === cue);
      b.classList.toggle('done', i < cue);
    });
    $('.rm-sheet').children[cue]?.scrollIntoView({ block: 'nearest' });

    const m = $('.rm-media');
    m.hidden = !st.media;
    $('.rm-play').textContent = st.playing ? 'Pause' : 'Play';
    m.classList.toggle('blk', !!st.blocked && !st.playing);
    $('.rm-t').textContent = `${fmt(st.time)} / ${fmt(st.duration)}`;
    $<HTMLSpanElement>('.rm-bar span').style.width = st.duration ? `${(100 * st.time) / st.duration}%` : '0';
    $('.rm-black').classList.toggle('on', st.blackout);
    $('.rm-black').textContent = st.blackout ? 'Show slides' : 'Hold screen';
    $('.rm-skip').hidden = slide.item.kind !== 'html';
  }

  function tick() {
    send({ cmd: 'hello' });
    if (lastSeen && Date.now() - lastSeen > 5000) {
      root.classList.remove('on');
      $('.rm-conn span').textContent = 'Stage window not responding';
    }
    const elapsed = t0 ? (Date.now() - t0) / 1000 : 0;
    $('.rm-clock').textContent = fmt(elapsed);
    const planned = show.items.some(i => i.duration);
    const d = $('.rm-drift');
    d.hidden = !planned || !t0 || cue < 0;
    if (!d.hidden) {
      const min = Math.round(drift(show.items, cue, elapsed / 60, (Date.now() - cueT0) / 60000));
      d.textContent = min === 0 ? 'On time' : min > 0 ? `${min} min behind` : `${-min} min ahead`;
      d.dataset.level = min >= 5 ? 'late' : min > 0 ? 'slip' : 'ok';
    }
  }

  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    // Drop focus so Space and Enter always mean "go", never "press that button again".
    b.blur();
    const act = b.dataset.act;
    if (act === 'reset') { t0 = Date.now(); cueT0 = Date.now(); }
    else if (act === 'open') window.open(opts.stageUrl, `cuedeck-stage-${show.id}`, 'popup,width=1280,height=760');
    else if (act) send({ cmd: act } as Command);
  });
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select')) return;
    const c = keyToCommand(e, now.slides.length - 1);
    if (!c) return;
    e.preventDefault();
    send(c);
  };
  addEventListener('keydown', onKey);
  const timer = setInterval(tick, 1000);
  setShow(show);
  tick();

  return {
    setShow,
    destroy() { clearInterval(timer); removeEventListener('keydown', onKey); link.close(); now.destroy(); next.destroy(); },
  };
}
