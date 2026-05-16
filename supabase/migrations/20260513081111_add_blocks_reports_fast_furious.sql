/*
  # Add Blocks, Reports, and Fast & Furious franchise data

  1. New Tables
    - `blocked_users` — tracks which users have blocked which other users
      - `id` (uuid, primary key)
      - `blocker_id` (uuid, references auth.users)
      - `blocked_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
    - `reports` — user-submitted reports on content/profiles
      - `id` (uuid, primary key)
      - `reporter_id` (uuid, references auth.users)
      - `reported_user_id` (uuid, references auth.users, nullable)
      - `reason` (text) — e.g. "offensive_content", "spam", "spoilers", "fake_account", "other"
      - `content_type` (text) — e.g. "profile", "review", "activity"
      - `content_id` (text, nullable) — ID of reported content
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
    - `flagged_accounts` — accounts auto-flagged after 10 reports
      - `user_id` (uuid, primary key, references auth.users)
      - `report_count` (int)
      - `flagged_at` (timestamptz)
      - `reviewed` (boolean)

  2. Security
    - RLS enabled on all tables
    - Users can manage their own blocks
    - Users can create reports, cannot read others' reports
    - flagged_accounts is service-role only (no user read)
*/

CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  content_type text NOT NULL DEFAULT 'profile',
  content_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS flagged_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  report_count int NOT NULL DEFAULT 0,
  flagged_at timestamptz DEFAULT now(),
  reviewed boolean NOT NULL DEFAULT false
);

ALTER TABLE flagged_accounts ENABLE ROW LEVEL SECURITY;
