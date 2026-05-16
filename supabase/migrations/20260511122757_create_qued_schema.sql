/*
  # Qued — Full Schema

  Creates all tables needed for the Qued film & TV tracking app:
  profiles, watchlist, watched, ratings, reviews, episode_ratings,
  likes, follows, lists, list_items, ai_recommendation_usage.

  All tables have RLS enabled with per-user access policies.
*/

-- ── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       text UNIQUE NOT NULL,
  bio            text        DEFAULT '',
  avatar_url     text        DEFAULT '',
  favourite_films jsonb      DEFAULT '[]',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── Watchlist ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id    integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  title      text NOT NULL,
  poster_path text DEFAULT '',
  added_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_select" ON watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "watchlist_insert" ON watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_delete" ON watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Watched ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watched (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id     integer NOT NULL,
  media_type  text NOT NULL CHECK (media_type IN ('movie','tv')),
  title       text NOT NULL,
  poster_path text DEFAULT '',
  watched_date date NOT NULL,
  liked       boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE watched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watched_select" ON watched FOR SELECT TO authenticated USING (true);
CREATE POLICY "watched_insert" ON watched FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watched_update" ON watched FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watched_delete" ON watched FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Ratings ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id    integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  rating     numeric(3,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select" ON ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings_insert" ON ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_update" ON ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_delete" ON ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id           integer NOT NULL,
  media_type        text NOT NULL CHECK (media_type IN ('movie','tv')),
  content           text NOT NULL,
  contains_spoilers boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Episode Ratings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS episode_ratings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id        integer NOT NULL,
  season_number  integer NOT NULL,
  episode_number integer NOT NULL,
  rating         numeric(3,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, tmdb_id, season_number, episode_number)
);
ALTER TABLE episode_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_ratings_select" ON episode_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ep_ratings_insert" ON episode_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ep_ratings_update" ON episode_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ep_ratings_delete" ON episode_ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Likes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  watched_id uuid NOT NULL REFERENCES watched(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, watched_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Follows ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ── Lists ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  is_public   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lists_select" ON lists FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "lists_insert" ON lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lists_update" ON lists FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lists_delete" ON lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── List Items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS list_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  tmdb_id     integer NOT NULL,
  media_type  text NOT NULL CHECK (media_type IN ('movie','tv')),
  title       text NOT NULL,
  poster_path text DEFAULT '',
  added_at    timestamptz DEFAULT now(),
  UNIQUE (list_id, tmdb_id, media_type)
);
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_items_select" ON list_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND (lists.is_public = true OR lists.user_id = auth.uid())));
CREATE POLICY "list_items_insert" ON list_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));
CREATE POLICY "list_items_delete" ON list_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

-- ── AI Recommendation Usage ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_recommendation_usage (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count      integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, usage_date)
);
ALTER TABLE ai_recommendation_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_select" ON ai_recommendation_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_usage_insert" ON ai_recommendation_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_usage_update" ON ai_recommendation_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
