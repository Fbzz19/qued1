/*
  # Create Activity Feed System

  ## New Tables

  ### activity_feed
  - Stores activity events for following users' feeds
  - user_id: the user who performed the action
  - activity_type: watched | watchlisted | reviewed | achievement | followed
  - tmdb_id, media_type, title, poster_path: media context (nullable for social activities)
  - achievement_id: for achievement activities
  - target_user_id: for follow activities
  - rating: star rating if included
  - created_at: timestamp for chronological ordering

  ## Security
  - RLS enabled
  - Users can insert their own activities
  - Users can read activities from people they follow + their own
  - Users can delete their own activities
*/

CREATE TABLE IF NOT EXISTS activity_feed (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type  text        NOT NULL,
  tmdb_id        int,
  media_type     text,
  title          text,
  poster_path    text,
  achievement_id text,
  target_user_id uuid,
  rating         numeric(3,1),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_feed_user_id_idx ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx ON activity_feed(created_at DESC);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read followed activity"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = activity_feed.user_id
    )
  );

CREATE POLICY "Users can delete own activity"
  ON activity_feed FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
