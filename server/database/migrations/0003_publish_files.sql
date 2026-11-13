CREATE TRIGGER song_require_files BEFORE INSERT ON song
WHEN NOT EXISTS (SELECT 1 FROM library_file WHERE id = NEW.audio_id AND state = 'pending')
  OR (NEW.cover_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM library_file WHERE id = NEW.cover_id AND state = 'pending'))
BEGIN
  SELECT RAISE(ABORT, 'LIBRARY_UPLOAD_EXPIRED');
END;

CREATE TRIGGER song_publish_files AFTER INSERT ON song
BEGIN
  UPDATE library_file SET state = 'ready' WHERE id IN (NEW.audio_id, NEW.cover_id);
END;

CREATE TRIGGER song_publish_cover AFTER UPDATE OF cover_id ON song
WHEN OLD.cover_id IS NOT NEW.cover_id
BEGIN
  UPDATE library_file SET state = 'ready' WHERE id = NEW.cover_id;
END;

CREATE TRIGGER playlist_publish_cover_insert AFTER INSERT ON playlist
BEGIN
  UPDATE library_file SET state = 'ready' WHERE id = NEW.cover_id;
END;

CREATE TRIGGER playlist_publish_cover_update AFTER UPDATE OF cover_id ON playlist
WHEN OLD.cover_id IS NOT NEW.cover_id
BEGIN
  UPDATE library_file SET state = 'ready' WHERE id = NEW.cover_id;
END;

CREATE TRIGGER song_require_cover BEFORE UPDATE OF cover_id ON song
WHEN OLD.cover_id IS NOT NEW.cover_id AND NEW.cover_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM library_file WHERE id = NEW.cover_id AND state = 'pending')
BEGIN
  SELECT RAISE(ABORT, 'LIBRARY_UPLOAD_EXPIRED');
END;

CREATE TRIGGER playlist_require_cover_insert BEFORE INSERT ON playlist
WHEN NEW.cover_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM library_file WHERE id = NEW.cover_id AND state = 'pending')
BEGIN
  SELECT RAISE(ABORT, 'LIBRARY_UPLOAD_EXPIRED');
END;

CREATE TRIGGER playlist_require_cover_update BEFORE UPDATE OF cover_id ON playlist
WHEN OLD.cover_id IS NOT NEW.cover_id AND NEW.cover_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM library_file WHERE id = NEW.cover_id AND state = 'pending')
BEGIN
  SELECT RAISE(ABORT, 'LIBRARY_UPLOAD_EXPIRED');
END;
