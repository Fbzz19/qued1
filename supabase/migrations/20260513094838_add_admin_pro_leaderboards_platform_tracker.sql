/*
  # Admin, Pro subscriptions, platform tracking, admin actions

  ## New columns
  - profiles: +role (text, default 'user'), +pro_expires_at, +is_banned, +ban_reason,
              +suspended_until, +stripe_customer_id, +stripe_subscription_id
  - watched: +platform (text nullable)

  ## New tables
  - admin_actions: audit log of all admin actions (ban/suspend/warn/etc)
  - staff_picks: admin-curated featured reviews/films for homepage
  - film_of_week_nominations: community film nominations with votes
  - ad_slots: placeholder for ad configuration

  ## Security
  - RLS on all new tables
  - Admin tables restricted to role='admin' users via policy
*/

-- Extend profiles with role and subscription fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='pro_expires_at') THEN
    ALTER TABLE profiles ADD COLUMN pro_expires_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_banned') THEN
    ALTER TABLE profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ban_reason') THEN
    ALTER TABLE profiles ADD COLUMN ban_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='suspended_until') THEN
    ALTER TABLE profiles ADD COLUMN suspended_until timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_customer_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_subscription_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_active_at') THEN
    ALTER TABLE profiles ADD COLUMN last_active_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='accent_color') THEN
    ALTER TABLE profiles ADD COLUMN accent_color text DEFAULT '#f59e0b';
  END IF;
END $$;

-- Extend watched with platform
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='watched' AND column_name='platform') THEN
    ALTER TABLE watched ADD COLUMN platform text;
  END IF;
END $$;

-- Admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_username text NOT NULL DEFAULT '',
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL, -- 'ban','unban','suspend','unsuspend','warn','delete_review'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read admin actions"
  ON admin_actions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can insert admin actions"
  ON admin_actions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Staff picks
CREATE TABLE IF NOT EXISTS staff_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id int NOT NULL,
  media_type text NOT NULL DEFAULT 'movie',
  title text NOT NULL DEFAULT '',
  poster_path text,
  note text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active staff picks"
  ON staff_picks FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Admins can manage staff picks"
  ON staff_picks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update staff picks"
  ON staff_picks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete staff picks"
  ON staff_picks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Film of the week nominations
CREATE TABLE IF NOT EXISTS film_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id int NOT NULL,
  media_type text NOT NULL DEFAULT 'movie',
  title text NOT NULL DEFAULT '',
  poster_path text,
  vote_count int NOT NULL DEFAULT 0,
  week_start date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tmdb_id, week_start)
);
ALTER TABLE film_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read nominations"
  ON film_nominations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create nominations"
  ON film_nominations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Film nomination votes
CREATE TABLE IF NOT EXISTS film_nomination_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid NOT NULL REFERENCES film_nominations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nomination_id, user_id)
);
ALTER TABLE film_nomination_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read votes"
  ON film_nomination_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can vote"
  ON film_nomination_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unvote"
  ON film_nomination_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Anon staff picks read
CREATE POLICY "Anon can read active staff picks"
  ON staff_picks FOR SELECT TO anon USING (active = true);
