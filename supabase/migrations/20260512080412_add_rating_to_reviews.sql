/*
  # Add rating column to reviews table

  Combines rating and review into a single record so they can be submitted together.
  Rating is optional (nullable) — users can write a review without a star rating.

  1. Changes
    - Add nullable `rating` column (0.5–5) to `reviews` table
    - Add index on (tmdb_id, media_type) for fast lookup on film detail pages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'rating'
  ) THEN
    ALTER TABLE reviews ADD COLUMN rating numeric CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reviews_tmdb_idx ON reviews (tmdb_id, media_type);
