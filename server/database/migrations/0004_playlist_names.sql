CREATE INDEX playlist_owner_name ON playlist(owner_id, name);

CREATE TRIGGER playlist_unique_name_insert BEFORE INSERT ON playlist
WHEN NEW.name = '默认歌单' OR EXISTS (
  SELECT 1 FROM playlist WHERE owner_id = NEW.owner_id AND name = NEW.name
)
BEGIN
  SELECT RAISE(ABORT, 'PLAYLIST_NAME_TAKEN');
END;

CREATE TRIGGER playlist_unique_name_update BEFORE UPDATE OF owner_id, name ON playlist
WHEN (OLD.owner_id <> NEW.owner_id OR OLD.name <> NEW.name)
  AND (NEW.name = '默认歌单' OR EXISTS (
    SELECT 1 FROM playlist WHERE owner_id = NEW.owner_id AND name = NEW.name AND id <> OLD.id
  ))
BEGIN
  SELECT RAISE(ABORT, 'PLAYLIST_NAME_TAKEN');
END;
