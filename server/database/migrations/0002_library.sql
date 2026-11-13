CREATE TABLE library_file (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('audio/mpeg', 'image/jpeg', 'image/png', 'image/webp')),
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'delete')),
  created_at INTEGER NOT NULL,
  quota_bytes INTEGER NOT NULL,
  UNIQUE (owner_id, id)
);
CREATE INDEX library_file_owner ON library_file(owner_id);
CREATE INDEX library_file_cleanup ON library_file(state, created_at);

CREATE TRIGGER library_file_quota BEFORE INSERT ON library_file
WHEN NEW.bytes + (
  SELECT COALESCE(SUM(bytes), 0) FROM library_file WHERE owner_id = NEW.owner_id
) > NEW.quota_bytes
BEGIN
  SELECT RAISE(ABORT, 'LIBRARY_QUOTA_EXCEEDED');
END;

CREATE TABLE song (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  year INTEGER,
  lyricist TEXT,
  composer TEXT,
  description TEXT,
  duration REAL,
  audio_id TEXT NOT NULL UNIQUE,
  cover_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, audio_id) REFERENCES library_file(owner_id, id),
  FOREIGN KEY (owner_id, cover_id) REFERENCES library_file(owner_id, id)
);
CREATE INDEX song_owner_created ON song(owner_id, created_at DESC, id DESC);

CREATE TABLE playlist (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, cover_id) REFERENCES library_file(owner_id, id)
);
CREATE INDEX playlist_owner_created ON playlist(owner_id, created_at DESC, id DESC);

CREATE TABLE playlist_song (
  owner_id TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  PRIMARY KEY (playlist_id, song_id),
  FOREIGN KEY (owner_id, playlist_id) REFERENCES playlist(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, song_id) REFERENCES song(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX playlist_song_memberships ON playlist_song(song_id, playlist_id);

CREATE TRIGGER song_delete_files AFTER DELETE ON song
BEGIN
  UPDATE library_file SET state = 'delete' WHERE id IN (OLD.audio_id, OLD.cover_id);
END;

CREATE TRIGGER song_replace_cover AFTER UPDATE OF cover_id ON song
WHEN OLD.cover_id IS NOT NEW.cover_id
BEGIN
  UPDATE library_file SET state = 'delete' WHERE id = OLD.cover_id;
END;

CREATE TRIGGER playlist_delete_cover AFTER DELETE ON playlist
BEGIN
  UPDATE library_file SET state = 'delete' WHERE id = OLD.cover_id;
END;

CREATE TRIGGER playlist_replace_cover AFTER UPDATE OF cover_id ON playlist
WHEN OLD.cover_id IS NOT NEW.cover_id
BEGIN
  UPDATE library_file SET state = 'delete' WHERE id = OLD.cover_id;
END;
