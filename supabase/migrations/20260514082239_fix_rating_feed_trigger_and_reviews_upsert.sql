/*
  # Fix fn_rating_to_feed trigger and reviews table

  ## Problems Fixed

  ### 1. fn_rating_to_feed references non-existent columns
  The trigger function references NEW.title and NEW.poster_path but the ratings table
  only has: id, user_id, tmdb_id, media_type, rating, created_at, updated_at.
  This caused every rating INSERT/UPDATE/UPSERT to fail with "column does not exist".
  Fix: look up title and poster_path from the watched table (same as fn_review_to_feed does
  for poster), and use a fallback empty string when not found.

  ### 2. fn_review_to_feed references NEW.title but reviews table has no title column
  Reviews table also has no title column. Same fix: look up from watched table.

  ### 3. reviews table needs upsert support
  The reviews table has UNIQUE(user_id, tmdb_id, media_type). The frontend
  uses insert for new reviews and update for existing ones. This is correct,
  but adding a title column is not needed — just fixing the trigger is enough.

  ## Security
  - Functions remain SECURITY INVOKER with fixed search_path
  - activity_feed INSERT policy: the trigger runs in the context of the calling user,
    so auth.uid() = user_id will match correctly for authenticated inserts
*/

-- Fix fn_rating_to_feed: look up title and poster from watched table
CREATE OR REPLACE FUNCTION public.fn_rating_to_feed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_title      text;
  v_poster     text;
BEGIN
  -- Look up title and poster_path from watched table for this tmdb_id/user
  SELECT title, poster_path INTO v_title, v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  -- Only create feed entry if we have a title (user has this in their watched list)
  IF v_title IS NOT NULL THEN
    INSERT INTO activity_feed (
      user_id, activity_type, tmdb_id, media_type, title, poster_path, rating, created_at
    )
    VALUES (
      NEW.user_id, 'rated', NEW.tmdb_id, NEW.media_type,
      v_title, COALESCE(v_poster, ''), NEW.rating, now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix fn_review_to_feed: reviews table also has no title column, look up from watched
CREATE OR REPLACE FUNCTION public.fn_review_to_feed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_title  text;
  v_poster text;
BEGIN
  -- Only for public reviews
  IF NEW.is_public = false THEN
    RETURN NEW;
  END IF;

  SELECT title, poster_path INTO v_title, v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  -- Insert feed entry; if no watched entry exists use empty strings as fallback
  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path,
    rating, review_content, created_at
  )
  VALUES (
    NEW.user_id, 'reviewed', NEW.tmdb_id, NEW.media_type,
    COALESCE(v_title, ''), COALESCE(v_poster, ''),
    NEW.rating, left(NEW.content, 280), now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Grant execute to authenticated so trigger can fire correctly
GRANT EXECUTE ON FUNCTION public.fn_rating_to_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_review_to_feed() TO authenticated;
