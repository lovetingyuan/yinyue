export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  lyricist: string | null;
  composer: string | null;
  description: string | null;
  duration: number | null;
  coverId: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  coverId: string | null;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number | null;
  url: string;
  coverUrl: string | null;
}

export interface MediaAuthorization {
  tracks: Track[];
  covers: Record<string, string>;
}

export type PlaybackMode = "sequential" | "loop" | "shuffle";

export interface PlaybackSnapshot {
  ids: string[];
  order: string[];
  id: string;
  position: number;
  mode: PlaybackMode;
  volume: number;
}
