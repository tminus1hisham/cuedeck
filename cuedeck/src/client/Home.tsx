import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import type { Show } from '../player/types';
import { DropZone } from './DropZone';
import { addFiles, newShow } from './shows';

const KINDS = ['PDF', 'PowerPoint (as PDF)', 'Excel', 'CSV', 'HTML decks', 'Images', 'Video', 'Audio'];

export function Home() {
  const [shows, setShows] = useState<Show[] | null>(null);
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => { db.listShows().then(setShows); }, []);

  async function start(files: File[]) {
    const show = newShow(files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : 'Untitled show');
    const { items, errors } = await addFiles(files, setBusy);
    setErrors(errors);
    if (!items.length) return;
    show.items = items;
    await db.putShow(show);
    location.hash = `#/show/${show.id}`;
  }

  async function blank() {
    const show = newShow();
    await db.putShow(show);
    location.hash = `#/show/${show.id}`;
  }

  return (
    <div className="home">
      <header className="home-bar">
        <span className="brand"><i className="lamp" aria-hidden="true" />Cuedeck</span>
      </header>

      <section className="home-hero">
        <h1>Run the whole event from one running order.</h1>
        <p className="lede">
          Drop in the speaker's slides, the anthem, the launch video and the sponsor sheet. Cuedeck lines them up as cues,
          puts them on the projector and lets you call each one from your laptop or clicker.
        </p>
        <DropZone onFiles={start} busy={busy} big>
          <b>Drop the files for your event</b>
          <span>or click to choose them</span>
          <small>{KINDS.join(' · ')}</small>
        </DropZone>
        {errors.length > 0 && <ul className="errors" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
        <button className="link" onClick={blank}>Start with an empty running order</button>
      </section>

      {shows && shows.length > 0 && (
        <section className="home-shows" aria-labelledby="your-shows">
          <h2 id="your-shows">Your shows</h2>
          <ul>
            {shows.map(s => (
              <li key={s.id}>
                <a href={`#/show/${s.id}`}>
                  <span className="swatch" style={{ background: s.brand.color }} aria-hidden="true" />
                  <b>{s.title}</b>
                  <span>{s.items.length} {s.items.length === 1 ? 'cue' : 'cues'} · edited {new Date(s.updated).toLocaleDateString()}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="note">Shows are saved in this browser only. Export a show to move it to another computer.</p>
        </section>
      )}
    </div>
  );
}
