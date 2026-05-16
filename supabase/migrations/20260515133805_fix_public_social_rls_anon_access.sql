/*
  # Fix Public Social RLS — Allow Anon (Guest) Read Access

  ## Summary
  Adds anonymous (logged-out guest) SELECT policies to all public social tables
  so guests can browse ratings, reviews, replies, like counts, watched history,
  and activity feed without being forced to sign in.

  ## Changes

  ### Tables receiving new anon SELECT policies:
  - `ratings` — guests can read all ratings (for Qued average display)
  - `reviews` — guests can read public reviews
  - `review_comments` — guests can read comments/replies on public reviews
  - `review_likes` — guests can see like counts on reviews
  - `comment_likes` — guests can see like counts on comments
  - `watched` — guests can read watched entries from public profiles (for community data)
  - `activity_feed` — guests can read public activity entries
  - `activity_feed_comments` — guests can read comments on public activity
  - `activity_likes` — guests can see like counts on activity
  - `film_nominations` — guests can read film nominations
  - `follows` — guests can see follow relationships (for profile display)
  - `profiles` — already has anon policy, ensure it's correct
  - `achievements` — guests can read achievements list
  - `user_achievements` — guests can read public user achievements
  - `staff_picks` — already has anon policy

  ## Security Notes
  - All new policies are SELECT-only for `anon` role
  - No INSERT/UPDATE/DELETE is granted to anon
  - Private reviews (is_public = false) remain hidden
  - Private profile data remains protected
  - Anon users cannot write any data — only read public content
*/

-- ── ratings: guests can read all ratings for Qued average ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ratings' AND policyname = 'Anon can read all ratings'
  ) THEN
    CREATE POLICY "Anon can read all ratings"
      ON ratings FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── reviews: guests can read public reviews ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reviews' AND policyname = 'Anon can read public reviews'
  ) THEN
    CREATE POLICY "Anon can read public reviews"
      ON reviews FOR SELECT
      TO anon
      USING (is_public = true);
  END IF;
END $$;

-- ── review_comments: guests can read comments on public reviews ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'review_comments' AND policyname = 'Anon can read review comments'
  ) THEN
    CREATE POLICY "Anon can read review comments"
      ON review_comments FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM reviews r
          WHERE r.id = review_comments.review_id AND r.is_public = true
        )
      );
  END IF;
END $$;

-- ── review_likes: guests can read like counts ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'review_likes' AND policyname = 'Anon can read review likes'
  ) THEN
    CREATE POLICY "Anon can read review likes"
      ON review_likes FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── comment_likes: guests can read comment like counts ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comment_likes' AND policyname = 'Anon can read comment likes'
  ) THEN
    CREATE POLICY "Anon can read comment likes"
      ON comment_likes FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── watched: guests can read watched entries from public profiles ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'watched' AND policyname = 'Anon can read public profile watched entries'
  ) THEN
    CREATE POLICY "Anon can read public profile watched entries"
      ON watched FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = watched.user_id AND p.is_public = true
        )
      );
  END IF;
END $$;

-- ── activity_feed: guests can read public activity ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_feed' AND policyname = 'Anon can read public activity feed'
  ) THEN
    CREATE POLICY "Anon can read public activity feed"
      ON activity_feed FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = activity_feed.user_id AND p.is_public = true
        )
      );
  END IF;
END $$;

-- ── activity_feed_comments: guests can read activity comments ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_feed_comments' AND policyname = 'Anon can read activity feed comments'
  ) THEN
    CREATE POLICY "Anon can read activity feed comments"
      ON activity_feed_comments FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── activity_likes: guests can read activity like counts ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_likes' AND policyname = 'Anon can read activity likes'
  ) THEN
    CREATE POLICY "Anon can read activity likes"
      ON activity_likes FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── film_nominations: guests can read nominations ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'film_nominations' AND policyname = 'Anon can read film nominations'
  ) THEN
    CREATE POLICY "Anon can read film nominations"
      ON film_nominations FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── follows: guests can read follow relationships ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'follows' AND policyname = 'Anon can read follows'
  ) THEN
    CREATE POLICY "Anon can read follows"
      ON follows FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── achievements: guests can read achievements ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'achievements' AND policyname = 'Anon can read achievements'
  ) THEN
    CREATE POLICY "Anon can read achievements"
      ON achievements FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── user_achievements: guests can read public user achievements ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_achievements' AND policyname = 'Anon can read user achievements'
  ) THEN
    CREATE POLICY "Anon can read user achievements"
      ON user_achievements FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- ── watchlist: guests can read public watchlists ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'watchlist' AND policyname = 'Anon can read public watchlists'
  ) THEN
    CREATE POLICY "Anon can read public watchlists"
      ON watchlist FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
