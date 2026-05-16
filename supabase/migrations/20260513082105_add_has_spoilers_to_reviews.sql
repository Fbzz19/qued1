/*
  # Add has_spoilers column to reviews

  1. Changes
    - `reviews` table: adds `has_spoilers` boolean column (default false)
      - Flags whether a review was auto-detected or user-confirmed to contain spoilers
      - Used by the frontend to render a blur overlay on spoiler reviews

  2. Notes
    - Safe additive migration — no existing data is affected
    - Default false means all existing reviews are treated as spoiler-free
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'has_spoilers'
  ) THEN
    ALTER TABLE reviews ADD COLUMN has_spoilers boolean DEFAULT false NOT NULL;
  END IF;
END $$;
