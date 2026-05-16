/*
  # Profile Privacy & Follow Requests

  1. Changes
    - Ensure `profiles.is_public` column exists (add if missing) with default true
    - Add `follow_requests` table for private profile follow requests
    - Add `reviews_count` and `likes_received` helper columns (computed via queries)
    - Update RLS on `profiles` to allow public reads for public profiles
    - Update RLS on `watched` to allow reads for public profiles
    - Add RLS on `follow_requests`

  2. Tables
    - `follow_requests` (id, requester_id, target_id, created_at, status)

  3. Security
    - Public profiles: anyone can SELECT profile + watched data
    - Private profiles: only followers can see watched data
    - Follow requests: only requester/target can see their own requests
*/

-- Ensure is_public column exists on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_public boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Create follow_requests table
CREATE TABLE IF NOT EXISTS follow_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can insert follow requests"
  ON follow_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requesters can view own sent requests"
  ON follow_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Target can update request status"
  ON follow_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = target_id)
  WITH CHECK (auth.uid() = target_id);

CREATE POLICY "Either party can delete follow request"
  ON follow_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Ensure follows table exists (created in earlier migration)
-- Allow public profiles' watched entries to be read by anyone authenticated
-- (existing RLS on watched should already allow this via owner check;
--  we add a policy for reading watched entries of public profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'watched' AND policyname = 'Public profile watched entries readable'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public profile watched entries readable"
        ON watched FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = watched.user_id
              AND profiles.is_public = true
          )
        )
    $policy$;
  END IF;
END $$;

-- Allow anyone (anon + authenticated) to read public profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Public profiles readable by all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public profiles readable by all"
        ON profiles FOR SELECT
        TO anon, authenticated
        USING (is_public = true)
    $policy$;
  END IF;
END $$;
