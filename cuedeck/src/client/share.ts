import { renderSVG } from 'uqr';
import { connect } from '../player/channel';
import { links, newRoom, saveRoom, savedRoom, type RoomInfo } from '../player/rooms';

const TEMPLATE = `
<button class="rm-btn sh-open"><span>Phone &amp; audience</span><small class="sh-count" hidden></small></button>
<dialog class="sh-dialog" aria-labelledby="sh-title">
  <form method="dialog" class="sh-close"><button aria-label="Close">×</button></form>
  <h2 id="sh-title">Run the show from your phone</h2>
  <div class="sh-qr" role="img" aria-label="QR code for the phone remote"></div>
  <p>Scan with your phone's camera. Anyone with this code can control the show, so keep it off the projector.</p>
  <p class="sh-row"><input class="sh-phone" readonly aria-label="Phone remote link"><button class="rm-btn" data-copy=".sh-phone">Copy</button></p>
  <h3>Audience link</h3>
  <p>Viewers follow along on their own phones. They see only the slide on screen, never your notes or what's next.</p>
  <p class="sh-row"><input class="sh-audience" readonly aria-label="Audience link"><button class="rm-btn" data-copy=".sh-audience">Copy</button></p>
  <p class="sh-status" aria-live="polite">Connecting…</p>
  <button class="rm-btn sh-reset">Make new links</button>
  <p class="sh-hint">New links disconnect every phone and viewer using the old ones.</p>
</dialog>`;

/** Presenter-screen panel that opens the relay and hands out the phone and audience links. */
export function mountShare(slot: HTMLElement, showId: string) {
  slot.innerHTML = TEMPLATE;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => slot.querySelector(s) as T;
  const dialog = $<HTMLDialogElement>('.sh-dialog');
  let room: RoomInfo | null = savedRoom(showId);

  const link = connect(showId, m => {
    if (!('type' in m) || m.type !== 'presence') return;
    const phones = `${m.remotes} ${m.remotes === 1 ? 'phone' : 'phones'}`;
    $('.sh-count').hidden = false;
    $('.sh-count').textContent = `${phones} · ${m.audience} watching`;
    $('.sh-status').textContent = `Live: ${phones} connected, ${m.audience} watching.`;
  });

  function use(r: RoomInfo) {
    room = r;
    saveRoom(showId, r);
    link.send({ cmd: 'relay', ...r });
    const l = links(r);
    $('.sh-qr').innerHTML = renderSVG(l.phone, { border: 2, pixelSize: 6 });
    $<HTMLInputElement>('.sh-phone').value = l.phone;
    $<HTMLInputElement>('.sh-audience').value = l.audience;
    $('.sh-status').textContent = 'Waiting for the stage window. Open it and click Start show.';
  }

  // A stage window opened before the room existed learns about it here.
  if (room) use(room);

  slot.addEventListener('click', async e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    // Stop the presenter's own click handler and key focus rules from treating these as show commands.
    e.stopPropagation();
    if (b.classList.contains('sh-open')) { if (!room) use(newRoom()); dialog.showModal(); }
    else if (b.classList.contains('sh-reset')) use(newRoom());
    else if (b.dataset.copy) {
      const input = $<HTMLInputElement>(b.dataset.copy);
      input.select();
      await navigator.clipboard?.writeText(input.value).catch(() => {});
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = 'Copy'), 1500);
    } else if (b.closest('.sh-close')) dialog.close();
  });
  // Keys typed in the dialog must not run the show behind it.
  dialog.addEventListener('keydown', e => e.stopPropagation());

  return { destroy: () => link.close() };
}
