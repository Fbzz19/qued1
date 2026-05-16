/*
  # Add Follow Requests System

  ## Summary
  Adds a follow_requests table for private profiles, so users can request to follow
  someone with a private account. The owner gets a notification they can accept or decline.

  ## New Tables
  - `follow_requests`
    - `id` (uuid, primary key)
    - `requester_id` (uuid) - who is requesting
    - `target_id` (uuid) - who owns the private profile
    - `status` (text) - 'pending' | 'accepted' | 'declined'
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled with restrictive policies
*/

CREATE TABLE IF NOT EXISTS follow_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_requests_insert"
  ON follow_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "follow_requests_select"
  ON follow_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "follow_requests_update"
  ON follow_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = target_id)
  WITH CHECK (auth.uid() = target_id);

CREATE POLICY "follow_requests_delete"
  ON follow_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id);
