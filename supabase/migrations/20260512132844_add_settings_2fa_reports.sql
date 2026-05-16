/*
  # Add user settings, 2FA verification codes, and user reports

  1. New Tables
    - `user_settings` — per-user preferences (content filters, language, 2FA enabled, watch time breakdown)
    - `verification_codes` — ephemeral 2FA codes (6-digit, expires 10 min)
    - `user_reports` — reports submitted by one user against another

  2. Changes to existing tables
    - Add `tv_watch_mins` column to `profiles` (separate TV watch time from films)

  3. Security
    - RLS enabled on all new tables
    - Users can only read/write their own settings and verification codes
    - Reports: authenticated users can insert; only service role can read
*/

-- user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_films   boolean NOT NULL DEFAULT true,
  show_tv      boolean NOT NULL DEFAULT true,
  language     text NOT NULL DEFAULT 'en',
  two_fa_enabled boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- verification_codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own codes"
  ON verification_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own codes"
  ON verification_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own codes"
  ON verification_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_reports
CREATE TABLE IF NOT EXISTS user_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_username text,
  reported_username text,
  reason           text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report"
  ON user_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

-- notification_emails table for QuedAI launch waitlist
CREATE TABLE IF NOT EXISTS notification_emails (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON notification_emails FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
