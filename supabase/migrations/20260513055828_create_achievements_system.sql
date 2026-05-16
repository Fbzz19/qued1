/*
  # Create Achievements System

  ## New Tables

  ### achievements
  - Master list of all possible achievements
  - id (text, primary key): unique slug like "first_watch"
  - title (text): display name
  - description (text): how to unlock
  - icon (text): emoji or icon name
  - category (text): milestones | genre | social | hidden
  - threshold (int): numeric target to unlock (e.g. 10 for "watch 10 films")

  ### user_achievements
  - Records which achievements each user has unlocked
  - user_id (uuid, FK auth.users)
  - achievement_id (text, FK achievements)
  - unlocked_at (timestamptz)
  - Unique constraint on (user_id, achievement_id)

  ## Security
  - RLS enabled on both tables
  - achievements: anyone can SELECT (read-only master list)
  - user_achievements: users can read their own, insert their own
*/

CREATE TABLE IF NOT EXISTS achievements (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL DEFAULT 'trophy',
  category    text NOT NULL DEFAULT 'milestones',
  threshold   int  NOT NULL DEFAULT 1
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- Seed achievements
INSERT INTO achievements (id, title, description, icon, category, threshold) VALUES
  -- Milestones
  ('first_watch',       'First Watch',          'Log your very first film or show',                         'film',      'milestones', 1),
  ('ten_films',         'Film Buff',            'Watch 10 films',                                           'popcorn',   'milestones', 10),
  ('fifty_films',       'Cinephile',            'Watch 50 films',                                           'clapperboard', 'milestones', 50),
  ('hundred_films',     'Century',              'Watch 100 films',                                          'hundred',   'milestones', 100),
  ('five_hundred',      'Film Obsessed',        'Watch 500 films',                                          'star',      'milestones', 500),
  ('thousand_films',    'Legendary',            'Watch 1000 films',                                         'crown',     'milestones', 1000),
  ('first_review',      'Critic',               'Write your first review',                                  'pen',       'milestones', 1),
  ('ten_reviews',       'Prolific Critic',      'Write 10 reviews',                                         'pen2',      'milestones', 10),
  ('first_rating',      'Opinion Maker',        'Rate your first film',                                     'star',      'milestones', 1),
  ('perfect_score',     'Perfection',           'Give a film or show a 5-star rating',                      'star5',     'milestones', 1),
  ('first_watchlist',   'Planner',              'Add your first film to your watchlist',                    'bookmark',  'milestones', 1),
  ('ten_watchlist',     'Big Plans',            'Have 10 items on your watchlist',                          'list',      'milestones', 10),
  ('fifty_watchlist',   'Dreamer',              'Have 50 items on your watchlist',                          'list2',     'milestones', 50),
  -- Genre
  ('horror_fan',        'Horror Fan',           'Watch 10 horror films',                                    'ghost',     'genre',      10),
  ('action_fan',        'Action Hero',          'Watch 10 action films',                                    'zap',       'genre',      10),
  ('comedy_fan',        'Funny Bone',           'Watch 10 comedy films',                                    'laugh',     'genre',      10),
  ('sci_fi_fan',        'Space Explorer',       'Watch 10 sci-fi films',                                    'rocket',    'genre',      10),
  ('drama_fan',         'Drama Queen',          'Watch 10 drama films',                                     'theater',   'genre',      10),
  ('documentary_fan',   'Truth Seeker',         'Watch 5 documentaries',                                    'camera',    'genre',      5),
  ('animation_fan',     'Cartoon Connoisseur',  'Watch 10 animated films',                                  'palette',   'genre',      10),
  -- Social
  ('first_follow',      'Social Butterfly',     'Follow your first member',                                 'users',     'social',     1),
  ('ten_followers',     'Influencer',           'Gain 10 followers',                                        'users2',    'social',     10),
  ('fifty_followers',   'Fan Club',             'Gain 50 followers',                                        'heart',     'social',     50),
  ('first_like',        'Appreciated',          'Receive your first like on a review',                      'thumbsup',  'social',     1),
  -- Hidden
  ('night_owl',         'Night Owl',            'Log a film between midnight and 4am',                      'moon',      'hidden',     1),
  ('binge_watcher',     'Binge Watcher',        'Log 5 films in a single day',                              'tv',        'hidden',     5),
  ('early_adopter',     'Early Adopter',        'Join Qued in its first year',                              'rocket2',   'hidden',     1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_achievements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text        NOT NULL REFERENCES achievements(id),
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
