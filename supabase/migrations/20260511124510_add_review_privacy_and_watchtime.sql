/*
  # Add review privacy toggle and watch time tracking

  1. Changes
    - `reviews`: add `is_public` boolean column (default true = public)
    - `watched`: add `runtime_minutes` column for tracking watch time per entry
  
  2. Security
    - Update RLS on reviews: hidden reviews only visible to owner
*/

-- Add is_public to reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_public boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add runtime_minutes to watched
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watched' AND column_name = 'runtime_minutes'
  ) THEN
    ALTER TABLE watched ADD COLUMN runtime_minutes integer DEFAULT 0;
  END IF;
END $$;

-- Drop and recreate the reviews SELECT policy to respect privacy
DROP POLICY IF EXISTS "reviews_select" ON reviews;

CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = user_id);
