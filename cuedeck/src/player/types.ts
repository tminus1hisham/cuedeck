export type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'sheet' | 'html' | 'card';

export type CardTemplate = 'welcome' | 'speaker' | 'break' | 'thanks' | 'plain';

export interface Item {
  id: string;
  kind: Kind;
  label: string;
  speaker?: string;
  notes?: string;
  /** Planned length in minutes, for the running-order clock. */
  duration?: number;
  /** Blob ids: one per page for pdf/image, a single file for video/audio/html. */
  blobs: string[];
  sheets?: { name: string; rows: string[][] }[];
  card?: { template: CardTemplate; title: string; subtitle?: string };
  autoplay?: boolean;
  loop?: boolean;
}

export interface Show {
  id: string;
  title: string;
  brand: { color: string; logo?: string };
  items: Item[];
  updated: number;
}

export interface Slide {
  item: Item;
  /** Cue number of the item, 1-based. */
  cue: number;
  /** Page or sheet index inside the item. */
  part: number;
  label: string;
}

export interface Inner { index: number; count: number; labels: string[] }

/** Broadcast by the stage after every change. Same shape the DAMA remote used, plus show fields. */
export interface State {
  type: 'state';
  index: number;
  labels: string[];
  media: '' | 'video' | 'audio';
  playing: boolean;
  time: number;
  duration: number;
  blocked?: boolean;
  blackout: boolean;
  started: boolean;
  inner?: Inner | null;
}

export type Command =
  | { cmd: 'next' | 'prev' | 'media' | 'restart' | 'blackout' | 'skip' | 'hello' }
  | { cmd: 'go'; i: number }
  /** Presenter → stage, same laptop only: open the relay for phones and the audience. */
  | { cmd: 'relay'; room: string; key: string };

/** What the phone remote needs to know about the show. Never sent to the audience. */
export interface Summary {
  type: 'summary';
  title: string;
  cues: { label: string; speaker?: string; notes?: string; duration?: number; kind: Kind }[];
  /** Cue number (1-based) of each slide. */
  slideCues: number[];
}

/** The slide on screen, self-contained, for phones and the audience. Holds no notes and nothing ahead. */
export interface Snap {
  type: 'snap';
  index: number;
  blackout: boolean;
  show: Show;
  urls: Record<string, string>;
}

/** Relay → stage and phones. */
export interface Presence { type: 'presence'; remotes: number; audience: number; online?: boolean }
