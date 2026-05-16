/*
  # Activity Feed Comments + Auto-Feed Triggers

  ## Summary
  This migration does three things:

  1. **New Table: `activity_feed_comments`**
     - Stores replies/comments on activity feed posts
     - Fields: id, activity_id (FK to activity_feed), user_id, content, created_at, like_count
     - RLS: authenticated users can read all comments, insert their own, delete their own

  2. **DB Triggers: Auto-insert activity on rating/review**
     - `trg_rating_to_feed`: fires AFTER INSERT OR UPDATE on `ratings`
       - Inserts/upserts a `rated` activity_feed row
     - `trg_review_to_feed`: fires AFTER INSERT on `reviews`
       - Inserts a `reviewed` activity_feed row (only for public reviews)

  3. **Add `review_content` column to `activity_feed`**
     - Stores a preview of the review text (first 280 chars) for display in the feed
*/

-- Add review_content preview to activity_feed if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_feed' AND column_name = 'review_content'
  ) THEN
    ALTER TABLE activity_feed ADD COLUMN review_content text;
  END IF;
END $$;

-- Create activity_feed_comments table
CREATE TABLE IF NOT EXISTS activity_feed_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  like_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read feed comments"
  ON activity_feed_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON activity_feed_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON activity_feed_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_comments_activity_id
  ON activity_feed_comments(activity_id);

-- Function: upsert activity_feed row when a rating is added/updated
CREATE OR REPLACE FUNCTION fn_rating_to_feed()
RETURNS trigger AS $$
DECLARE
  v_poster text;
BEGIN
  -- Look up poster_path from watched table for this tmdb_id
  SELECT poster_path INTO v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path, rating, created_at
  )
  VALUES (
    NEW.user_id, 'rated', NEW.tmdb_id, NEW.media_type, NEW.title,
    COALESCE(v_poster, NEW.poster_path), NEW.rating, now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger for ratings
DROP TRIGGER IF EXISTS trg_rating_to_feed ON ratings;
CREATE TRIGGER trg_rating_to_feed
  AFTER INSERT OR UPDATE OF rating ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION fn_rating_to_feed();

-- Function: insert activity_feed row when a review is submitted
CREATE OR REPLACE FUNCTION fn_review_to_feed()
RETURNS trigger AS $$
DECLARE
  v_poster text;
BEGIN
  -- Only for public reviews
  IF NEW.is_public = false THEN
    RETURN NEW;
  END IF;

  SELECT poster_path INTO v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path,
    rating, review_content, created_at
  )
  VALUES (
    NEW.user_id, 'reviewed', NEW.tmdb_id, NEW.media_type, NEW.title,
    v_poster, NEW.rating,
    left(NEW.content, 280), now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger for reviews
DROP TRIGGER IF EXISTS trg_review_to_feed ON reviews;
CREATE TRIGGER trg_review_to_feed
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION fn_review_to_feed();
