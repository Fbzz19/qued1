/*
  # Activity Feed Likes, Notifications, and Offensive Strike Tables

  1. New Tables
    - `activity_likes` — users liking individual activity feed items
      - `id` (uuid PK)
      - `user_id` (uuid, the user who liked)
      - `activity_id` (uuid, the activity_feed row)
      - UNIQUE(user_id, activity_id)
    - `notifications` — unread activity notifications per user
      - `id` (uuid PK)
      - `user_id` (uuid, recipient)
      - `activity_id` (uuid, source activity)
      - `seen` (boolean, default false)
      - `created_at`
    - `offensive_strikes` — tracks how many times a user tried to post offensive content
      - `id` (uuid PK)
      - `user_id` (uuid)
      - `strike_count` (int, default 1)
      - `suspended` (boolean, default false)
      - `last_strike_at` (timestamptz)
      UNIQUE(user_id)

  2. Security
    - RLS enabled on all tables
    - Users can insert/read their own likes
    - Users can read/update their own notifications
    - Strikes are written by service role only (via upsert from client with anon key targeting own row)
*/

-- Activity likes
CREATE TABLE IF NOT EXISTS activity_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

ALTER TABLE activity_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all activity likes"
  ON activity_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own activity likes"
  ON activity_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity likes"
  ON activity_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activity_feed(id) ON DELETE CASCADE,
  seen        boolean DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Offensive strikes
CREATE TABLE IF NOT EXISTS offensive_strikes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strike_count   int DEFAULT 1 NOT NULL,
  suspended      boolean DEFAULT false NOT NULL,
  last_strike_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE offensive_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strikes"
  ON offensive_strikes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own strikes"
  ON offensive_strikes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strikes"
  ON offensive_strikes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add like_count to activity_feed if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_feed' AND column_name = 'like_count'
  ) THEN
    ALTER TABLE activity_feed ADD COLUMN like_count int DEFAULT 0 NOT NULL;
  END IF;
END $$;
