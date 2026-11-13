import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const files = sqliteTable("library_file", {
  id: text().primaryKey().notNull(),
  ownerId: text("owner_id").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer().notNull(),
  state: text({ enum: ["pending", "ready", "delete"] }).notNull(),
  createdAt: integer("created_at").notNull(),
  quotaBytes: integer("quota_bytes").notNull(),
});

export const songs = sqliteTable("song", {
  id: text().primaryKey().notNull(),
  ownerId: text("owner_id").notNull(),
  title: text().notNull(),
  artist: text().notNull(),
  album: text(),
  year: integer(),
  lyricist: text(),
  composer: text(),
  description: text(),
  duration: real(),
  audioId: text("audio_id").notNull(),
  coverId: text("cover_id"),
  createdAt: integer("created_at").notNull(),
});

export const playlists = sqliteTable("playlist", {
  id: text().primaryKey().notNull(),
  ownerId: text("owner_id").notNull(),
  name: text().notNull(),
  coverId: text("cover_id"),
  createdAt: integer("created_at").notNull(),
});

export const memberships = sqliteTable("playlist_song", {
  ownerId: text("owner_id").notNull(),
  playlistId: text("playlist_id").notNull(),
  songId: text("song_id").notNull(),
});
