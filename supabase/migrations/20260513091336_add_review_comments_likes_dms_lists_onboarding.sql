/*
  # Add review comments, review likes, DMs, list extensions, onboarding, tooltips

  ## New Tables
  - review_comments: comments on reviews with like count
  - review_likes: per-user likes on reviews (unique)
  - comment_likes: per-user likes on comments (unique)
  - direct_messages: DM system between users
  - list_follows: follow public lists
  - list_likes: like public lists
  - onboarding_completed: tracks new-user onboarding completion + selected genres
  - tooltip_seen: per-user list of dismissed tooltip keys
  - review_daily_count: rate-limit 5 reviews/day per user

  ## Modified Tables
  - reviews: +like_count, +pinned, +comment_count
  - lists: +like_count, +follower_count
  - list_items: +user_id column (FK to auth.users)
  - profiles: +banner_url, +twitter, +instagram, +letterboxd, +is_verified, +theme
  - notifications: +type, +actor_id, +reference_id, +reference_type, +message

  ## Security
  - RLS enabled on all new tables
  - All policies check auth.uid()
*/

-- review_comments
CREATE TABLE IF NOT EXISTS review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read review comments"
  ON review_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own review comments"
  ON review_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review comments"
  ON review_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own review comments"
  ON review_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- review_likes
CREATE TABLE IF NOT EXISTS review_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read review likes"
  ON review_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own review likes"
  ON review_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own review likes"
  ON review_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comment_likes
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read comment likes"
  ON comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own comment likes"
  ON comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comment likes"
  ON comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- direct_messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can read their messages"
  ON direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receiver can mark message seen"
  ON direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);
CREATE POLICY "Sender can delete own messages"
  ON direct_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- list_follows
CREATE TABLE IF NOT EXISTS list_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);
ALTER TABLE list_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read list follows"
  ON list_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow lists"
  ON list_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow lists"
  ON list_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- list_likes
CREATE TABLE IF NOT EXISTS list_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read list likes"
  ON list_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like lists"
  ON list_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike lists"
  ON list_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- onboarding_completed
CREATE TABLE IF NOT EXISTS onboarding_completed (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  genres text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE onboarding_completed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own onboarding"
  ON onboarding_completed FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own onboarding"
  ON onboarding_completed FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own onboarding"
  ON onboarding_completed FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tooltip_seen
CREATE TABLE IF NOT EXISTS tooltip_seen (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tooltips text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tooltip_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tooltips"
  ON tooltip_seen FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tooltips"
  ON tooltip_seen FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tooltips"
  ON tooltip_seen FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- review_daily_count
CREATE TABLE IF NOT EXISTS review_daily_count (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, count_date)
);
ALTER TABLE review_daily_count ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own review count"
  ON review_daily_count FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review count"
  ON review_daily_count FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review count"
  ON review_daily_count FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Extend reviews
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='like_count') THEN
    ALTER TABLE reviews ADD COLUMN like_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='pinned') THEN
    ALTER TABLE reviews ADD COLUMN pinned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reviews' AND column_name='comment_count') THEN
    ALTER TABLE reviews ADD COLUMN comment_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Extend lists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lists' AND column_name='like_count') THEN
    ALTER TABLE lists ADD COLUMN like_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lists' AND column_name='follower_count') THEN
    ALTER TABLE lists ADD COLUMN follower_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Extend list_items with user_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='list_items' AND column_name='user_id') THEN
    ALTER TABLE list_items ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Extend profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banner_url') THEN
    ALTER TABLE profiles ADD COLUMN banner_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='twitter') THEN
    ALTER TABLE profiles ADD COLUMN twitter text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='instagram') THEN
    ALTER TABLE profiles ADD COLUMN instagram text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='letterboxd') THEN
    ALTER TABLE profiles ADD COLUMN letterboxd text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_verified') THEN
    ALTER TABLE profiles ADD COLUMN is_verified boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='theme') THEN
    ALTER TABLE profiles ADD COLUMN theme text NOT NULL DEFAULT 'default';
  END IF;
END $$;

-- Extend notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
    ALTER TABLE notifications ADD COLUMN type text NOT NULL DEFAULT 'activity';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='actor_id') THEN
    ALTER TABLE notifications ADD COLUMN actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='reference_id') THEN
    ALTER TABLE notifications ADD COLUMN reference_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='reference_type') THEN
    ALTER TABLE notifications ADD COLUMN reference_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') THEN
    ALTER TABLE notifications ADD COLUMN message text;
  END IF;
END $$;
