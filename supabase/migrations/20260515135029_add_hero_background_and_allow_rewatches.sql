/*
  # Add Hero Background + Allow Rewatches

  ## Summary
  
  1. Adds `hero_background` JSONB column to `profiles` to store a user's custom
     homepage hero background (tmdb_id, media_type, title, backdrop_path, poster_path).
     Only the owning user ever reads/writes their own hero_background — it is never
     shared publicly, keeping the experience personal.

  2. Drops the UNIQUE constraint on `watched (user_id, tmdb_id, media_type)`.
     This allows a user to log the same film/show multiple times as separate diary
     entries (rewatches). All existing data is preserved. There is no destructive
     operation — we are only removing the constraint, not touching any rows.
     
     A `year` column is also added to `watched` (nullable) so exports/imports
     continue to work correctly.

  ## Tables Modified
  - `profiles` — new nullable `hero_background jsonb` column
  - `watched`  — UNIQUE constraint removed; `year` column added if missing

  ## Security
  - RLS is already enabled on `profiles`; existing policies cover the new column.
  - The hero_background is only readable/writable by the owning user (auth.uid() = id).
  - No new public data exposure.
*/

-- Add hero background to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hero_background'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hero_background jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add year column to watched if missing (used by export)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watched' AND column_name = 'year'
  ) THEN
    ALTER TABLE watched ADD COLUMN year integer DEFAULT NULL;
  END IF;
END $$;

-- Drop the unique constraint on watched so rewatches are allowed
ALTER TABLE watched DROP CONSTRAINT IF EXISTS watched_user_id_tmdb_id_media_type_key;
