/*
  # Add unique constraints needed for Letterboxd import upserts

  ## Problem
  The Letterboxd import uses upsert with onConflict clauses, but the
  watched and reviews tables lacked the required unique constraints,
  causing every upsert to fail with a constraint-not-found error.

  ## Changes

  ### watched
  - Add unique constraint on (user_id, tmdb_id, media_type) so that
    re-importing the same film is idempotent rather than creating duplicates.
    (A user can only have one canonical "watched" record per film/show.)

  ### reviews
  - Add unique constraint on (user_id, tmdb_id, media_type) so that
    re-importing a review updates the existing one instead of failing.

  ### ratings (already has the constraint — no change needed)
  ### watchlist (already has the constraint — no change needed)
*/

-- watched: one record per user+title combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'watched'
      AND constraint_name = 'watched_user_id_tmdb_id_media_type_key'
  ) THEN
    ALTER TABLE public.watched
      ADD CONSTRAINT watched_user_id_tmdb_id_media_type_key
      UNIQUE (user_id, tmdb_id, media_type);
  END IF;
END $$;

-- reviews: one review per user+title combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND constraint_name = 'reviews_user_id_tmdb_id_media_type_key'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_user_id_tmdb_id_media_type_key
      UNIQUE (user_id, tmdb_id, media_type);
  END IF;
END $$;
