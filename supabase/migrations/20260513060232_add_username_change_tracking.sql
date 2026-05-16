/*
  # Add Username Change Tracking

  ## Changes
  - Add `username_changed_at` column to profiles table
  - This tracks when the user last changed their username
  - Used to enforce once-per-week rate limiting on username changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username_changed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username_changed_at timestamptz;
  END IF;
END $$;
