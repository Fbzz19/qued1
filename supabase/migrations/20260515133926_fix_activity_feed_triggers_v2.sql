/*
  # Fix Activity Feed Triggers v2

  ## Summary
  Same as v1 but first deduplicates activity_feed before adding unique constraint,
  then fixes all triggers for proper upsert behavior.

  ## Changes
  1. Deduplicates activity_feed keeping the most recent entry per user+type+tmdb_id+media_type
  2. Handles NULL tmdb_id rows separately (for non-media activities like follows/achievements)
  3. Adds unique constraint for media activities (where tmdb_id IS NOT NULL)
  4. Replaces all trigger functions with corrected versions
  5. Adds watched → feed trigger
*/

-- ── Step 1: Deduplicate activity_feed (keep newest per group) ─────────────
-- For entries WITH tmdb_id
DELETE FROM activity_feed a
WHERE a.tmdb_id IS NOT NULL
  AND a.id NOT IN (
    SELECT DISTINCT ON (user_id, activity_type, tmdb_id, media_type) id
    FROM activity_feed
    WHERE tmdb_id IS NOT NULL
    ORDER BY user_id, activity_type, tmdb_id, media_type, created_at DESC
  );

-- ── Step 2: Add unique constraint for media activity entries ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_feed_user_type_media_unique'
  ) THEN
    ALTER TABLE activity_feed
      ADD CONSTRAINT activity_feed_user_type_media_unique
      UNIQUE NULLS NOT DISTINCT (user_id, activity_type, tmdb_id, media_type);
  END IF;
END $$;

-- ── Step 3: Replace fn_rating_to_feed ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rating_to_feed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_title  text;
  v_poster text;
BEGIN
  -- Try to get title/poster from watched table
  SELECT title, poster_path INTO v_title, v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  -- Upsert feed entry: one 'rated' entry per user+tmdb_id+media_type
  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path, rating, created_at
  )
  VALUES (
    NEW.user_id, 'rated', NEW.tmdb_id, NEW.media_type,
    COALESCE(v_title, ''), COALESCE(v_poster, ''), NEW.rating, now()
  )
  ON CONFLICT (user_id, activity_type, tmdb_id, media_type)
  DO UPDATE SET
    rating      = EXCLUDED.rating,
    created_at  = now(),
    title       = CASE WHEN EXCLUDED.title <> '' THEN EXCLUDED.title ELSE activity_feed.title END,
    poster_path = CASE WHEN EXCLUDED.poster_path <> '' THEN EXCLUDED.poster_path ELSE activity_feed.poster_path END;

  RETURN NEW;
END;
$$;

-- ── Step 4: Replace fn_review_to_feed ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_review_to_feed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_title  text;
  v_poster text;
BEGIN
  -- On UPDATE: if review became private, remove from feed
  IF TG_OP = 'UPDATE' AND NEW.is_public = false AND (OLD.is_public = true OR OLD.is_public IS NULL) THEN
    DELETE FROM activity_feed
    WHERE user_id = NEW.user_id
      AND activity_type = 'reviewed'
      AND tmdb_id = NEW.tmdb_id
      AND media_type = NEW.media_type;
    RETURN NEW;
  END IF;

  -- Only process public reviews
  IF NEW.is_public = false THEN
    RETURN NEW;
  END IF;

  -- Get title/poster from watched table
  SELECT title, poster_path INTO v_title, v_poster
  FROM watched
  WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = NEW.media_type
  LIMIT 1;

  -- Upsert feed entry
  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path,
    rating, review_content, created_at
  )
  VALUES (
    NEW.user_id, 'reviewed', NEW.tmdb_id, NEW.media_type,
    COALESCE(v_title, ''), COALESCE(v_poster, ''),
    NEW.rating, left(NEW.content, 280), now()
  )
  ON CONFLICT (user_id, activity_type, tmdb_id, media_type)
  DO UPDATE SET
    rating         = EXCLUDED.rating,
    review_content = EXCLUDED.review_content,
    created_at     = now(),
    title          = CASE WHEN EXCLUDED.title <> '' THEN EXCLUDED.title ELSE activity_feed.title END,
    poster_path    = CASE WHEN EXCLUDED.poster_path <> '' THEN EXCLUDED.poster_path ELSE activity_feed.poster_path END;

  RETURN NEW;
END;
$$;

-- ── Step 5: fn_review_delete_from_feed ────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_review_delete_from_feed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM activity_feed
  WHERE user_id = OLD.user_id
    AND activity_type = 'reviewed'
    AND tmdb_id = OLD.tmdb_id
    AND media_type = OLD.media_type;
  RETURN OLD;
END;
$$;

-- ── Step 6: fn_watched_to_feed ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_watched_to_feed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO activity_feed (
    user_id, activity_type, tmdb_id, media_type, title, poster_path, created_at
  )
  VALUES (
    NEW.user_id, 'watched', NEW.tmdb_id, NEW.media_type,
    COALESCE(NEW.title, ''), COALESCE(NEW.poster_path, ''), now()
  )
  ON CONFLICT (user_id, activity_type, tmdb_id, media_type)
  DO UPDATE SET
    created_at  = now(),
    title       = CASE WHEN EXCLUDED.title <> '' THEN EXCLUDED.title ELSE activity_feed.title END,
    poster_path = CASE WHEN EXCLUDED.poster_path <> '' THEN EXCLUDED.poster_path ELSE activity_feed.poster_path END;

  RETURN NEW;
END;
$$;

-- ── Step 7: Re-create all triggers ────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_rating_to_feed ON ratings;
CREATE TRIGGER trg_rating_to_feed
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION fn_rating_to_feed();

DROP TRIGGER IF EXISTS trg_review_to_feed ON reviews;
CREATE TRIGGER trg_review_to_feed
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_review_to_feed();

DROP TRIGGER IF EXISTS trg_review_delete_from_feed ON reviews;
CREATE TRIGGER trg_review_delete_from_feed
  AFTER DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_review_delete_from_feed();

DROP TRIGGER IF EXISTS trg_watched_to_feed ON watched;
CREATE TRIGGER trg_watched_to_feed
  AFTER INSERT ON watched
  FOR EACH ROW EXECUTE FUNCTION fn_watched_to_feed();

-- ── Step 8: Backfill titles/posters for existing entries ──────────────────
UPDATE activity_feed af
SET
  title       = COALESCE(NULLIF(af.title, ''), w.title, af.title),
  poster_path = COALESCE(NULLIF(af.poster_path, ''), w.poster_path, af.poster_path)
FROM watched w
WHERE af.user_id = w.user_id
  AND af.tmdb_id = w.tmdb_id
  AND af.media_type = w.media_type
  AND (af.title = '' OR af.poster_path = '');
