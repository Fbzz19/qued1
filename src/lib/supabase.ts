import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type MediaType = 'movie' | 'tv';

export interface Profile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  favourite_films: FavouriteFilm[];
  created_at: string;
  updated_at: string;
  role?: string;
  is_banned?: boolean;
  ban_reason?: string | null;
  suspended_until?: string | null;
  pro_expires_at?: string | null;
  accent_color?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  last_active_at?: string | null;
}

export interface FavouriteFilm {
  tmdb_id: number;
  title: string;
  poster_path: string;
  media_type: MediaType;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string;
  added_at: string;
}

export interface WatchedEntry {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string;
  watched_date: string;
  liked: boolean;
  runtime_minutes: number;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  rating: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  content: string;
  contains_spoilers: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface EpisodeRating {
  id: string;
  user_id: string;
  tmdb_id: number;
  season_number: number;
  episode_number: number;
  rating: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  activity_id: string | null;
  seen: boolean;
  created_at: string;
  type: string;
  actor_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  message: string | null;
}

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  like_count: number;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  seen: boolean;
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  like_count: number;
  follower_count: number;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  user_id: string | null;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  added_at: string;
}
