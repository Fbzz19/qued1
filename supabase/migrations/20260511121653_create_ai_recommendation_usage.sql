/*
  # AI Recommendation Usage Tracking

  1. New Tables
    - `ai_recommendation_usage` — tracks daily recommendation usage per user
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `usage_date` (date) — the calendar date of usage
      - `count` (integer) — number of recommendations requested that day
      - unique constraint on (user_id, usage_date)

  2. Security
    - RLS enabled
    - Users can only read/write their own usage records
*/

CREATE TABLE IF NOT EXISTS ai_recommendation_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

ALTER TABLE ai_recommendation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON ai_recommendation_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON ai_recommendation_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON ai_recommendation_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
