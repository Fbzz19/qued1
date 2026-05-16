const TMDB_API_KEY = '561cfec28927b6575f26079bed25fadf';
const BASE_URL = 'https://api.themoviedb.org/3';

export const posterUrl   = (path: string | null, size = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
export const backdropUrl = (path: string | null, size = 'w1280') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
export const profileUrl  = (path: string | null, size = 'w185') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

// In-memory cache: key → { data, expiresAt }
const _cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();
  const cached = _cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const res = await fetch(cacheKey);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  const data = await res.json();
  _cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
  return data as T;
}

export interface TMDBMedia {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  media_type?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
  seasons?: TMDBSeason[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  combined_credits?: {
    cast: (TMDBMedia & { character: string; media_type: string })[];
  };
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  vote_average: number;
  runtime: number | null;
}

export interface TMDBSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  episodes: TMDBEpisode[];
}

export interface TMDBGenre { id: number; name: string; }

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchRegion {
  link?: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
}

export const tmdb = {
  trending: (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') =>
    tmdbFetch<{ results: TMDBMedia[] }>(`/trending/${mediaType}/${timeWindow}`),

  search: (query: string, page = '1') =>
    tmdbFetch<{ results: TMDBMedia[]; total_pages: number; total_results: number }>(
      '/search/multi', { query, page }
    ),

  movieDetails: (id: number) => tmdbFetch<TMDBMedia>(`/movie/${id}`),
  tvDetails:    (id: number) => tmdbFetch<TMDBMedia>(`/tv/${id}`),

  movieCredits: (id: number) => tmdbFetch<TMDBCredits>(`/movie/${id}/credits`),
  tvCredits:    (id: number) => tmdbFetch<TMDBCredits>(`/tv/${id}/credits`),

  personDetails: (id: number) =>
    tmdbFetch<TMDBPerson>(`/person/${id}`, { append_to_response: 'combined_credits' }),

  seasonDetails: (tvId: number, seasonNumber: number) =>
    tmdbFetch<TMDBSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`),

  popular:  (mediaType: 'movie' | 'tv', page = '1') => tmdbFetch<{ results: TMDBMedia[] }>(`/${mediaType}/popular`, { page }),
  topRated: (mediaType: 'movie' | 'tv', page = '1') => tmdbFetch<{ results: TMDBMedia[] }>(`/${mediaType}/top_rated`, { page }),
  upcoming: (page = '1')                             => tmdbFetch<{ results: TMDBMedia[] }>('/movie/upcoming', { page }),

  genres: (mediaType: 'movie' | 'tv') =>
    tmdbFetch<{ genres: TMDBGenre[] }>(`/genre/${mediaType}/list`),

  discover: (mediaType: 'movie' | 'tv', params: Record<string, string>) =>
    tmdbFetch<{ results: TMDBMedia[]; total_pages: number }>(`/discover/${mediaType}`, params),

  byDecade: (mediaType: 'movie' | 'tv', decade: number, page = 1) =>
    tmdbFetch<{ results: TMDBMedia[] }>(`/discover/${mediaType}`, {
      [mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte']: `${decade}-01-01`,
      [mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte']: `${decade + 9}-12-31`,
      sort_by: 'popularity.desc',
      page: String(page),
    }),

  watchProviders: (mediaType: 'movie' | 'tv', id: number) =>
    tmdbFetch<{ results: Record<string, TMDBWatchRegion> }>(`/${mediaType}/${id}/watch/providers`),

  trendingMovies: (page = '1') =>
    tmdbFetch<{ results: TMDBMedia[] }>('/trending/movie/week', { page }),

  trendingTV: (page = '1') =>
    tmdbFetch<{ results: TMDBMedia[] }>('/trending/tv/week', { page }),

  upcomingMovies: (page = '1') =>
    tmdbFetch<{ results: TMDBMedia[] }>('/movie/upcoming', { page }),

  videos: (mediaType: 'movie' | 'tv', id: number) =>
    tmdbFetch<{ results: TMDBVideo[] }>(`/${mediaType}/${id}/videos`),

  nowPlaying: (page = '1') =>
    tmdbFetch<{ results: TMDBMedia[] }>('/movie/now_playing', { page }),

  similar: (mediaType: 'movie' | 'tv', id: number) =>
    tmdbFetch<{ results: TMDBMedia[] }>(`/${mediaType}/${id}/similar`),

  recommendations: (mediaType: 'movie' | 'tv', id: number) =>
    tmdbFetch<{ results: TMDBMedia[] }>(`/${mediaType}/${id}/recommendations`),
};
