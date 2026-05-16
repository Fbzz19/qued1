/*
  # Add Continue Watching and Recently Viewed tables

  ## New Tables

  ### `continue_watching`
  Tracks paused/in-progress films and TV shows per user.
  - `id` (uuid, pk)
  - `user_id` (uuid, fk → auth.users)
  - `tmdb_id` (int) — TMDB ID
  - `media_type` ('movie' | 'tv')
  - `title` (text) — cached title
  - `poster_path` (text) — cached poster
  - `season_number` (int, nullable) — for TV shows
  - `episode_number` (int, nullable) — for TV shows
  - `episode_name` (text, nullable) — for TV shows
  - `progress_pct` (int, default 0) — 0–100 progress indicator
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - Unique on (user_id, tmdb_id, media_type) — one entry per title per user

  ### `recently_viewed`
  Tracks the last N media detail pages a user visited.
  - `id` (uuid, pk)
  - `user_id` (uuid, fk → auth.users)
  - `tmdb_id` (int)
  - `media_type` ('movie' | 'tv')
  - `title` (text)
  - `poster_path` (text)
  - `viewed_at` (timestamptz, default now())
  - Unique on (user_id, tmdb_id, media_type)

  ## Security
  Both tables have RLS enabled. Users can only access their own rows.
*/

-- Continue Watching
CREATE TABLE IF NOT EXISTS continue_watching (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id       integer NOT NULL,
  media_type    text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title         text NOT NULL DEFAULT '',
  poster_path   text,
  season_number  integer,
  episode_number integer,
  episode_name   text,
  progress_pct  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);

ALTER TABLE continue_watching ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own continue_watching"
  ON continue_watching FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own continue_watching"
  ON continue_watching FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own continue_watching"
  ON continue_watching FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own continue_watching"
  ON continue_watching FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS continue_watching_user_updated
  ON continue_watching (user_id, updated_at DESC);

-- Recently Viewed
CREATE TABLE IF NOT EXISTS recently_viewed (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id     integer NOT NULL,
  media_type  text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title       text NOT NULL DEFAULT '',
  poster_path text,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);

ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own recently_viewed"
  ON recently_viewed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recently_viewed"
  ON recently_viewed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recently_viewed"
  ON recently_viewed FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recently_viewed"
  ON recently_viewed FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS recently_viewed_user_viewed
  ON recently_viewed (user_id, viewed_at DESC);
