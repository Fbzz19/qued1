# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build    # TypeScript check + Vite production build (source of truth for correctness)
npm run dev      # Vite dev server (HMR on localhost:5173)
npm run lint     # ESLint
```

There are no tests. Use `npm run build` to verify type-correctness before finishing any task.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`) |
| Database + Auth | Supabase (`@supabase/supabase-js`) |
| Backend logic | Supabase Edge Functions (Deno, in `supabase/functions/`) |
| Icons | `lucide-react` |

## TypeScript requirements

This project uses `"verbatimModuleSyntax": true`. All type-only imports **must** use `import type`:

```ts
// ✅ correct
import { tmdb, posterUrl } from '../lib/tmdb';
import type { TMDBMedia } from '../lib/tmdb';

// ❌ will fail tsc
import { tmdb, TMDBMedia } from '../lib/tmdb';
```

## Architecture

### Navigation model (`src/App.tsx`)

The app has no router. Navigation is a discriminated-union state value:

```ts
type Screen =
  | { kind: 'tab';   tab: Tab }
  | { kind: 'media'; id: number; mediaType: 'movie' | 'tv'; from: Tab }
  | { kind: 'actor'; id: number; from: Tab };
```

`AppContent` switches on `screen.kind` to render the active page. Going "back" resets to `{ kind: 'tab', tab: activeTab }`. The five-tab `BottomNav` is always rendered at the bottom. The centre `+` button opens `QuickAddModal` as an overlay.

### Data flow

- **`src/lib/tmdb.ts`** — all TMDB API calls. `TMDB_API_KEY` is hardcoded (public key). Exports `posterUrl`, `backdropUrl`, `profileUrl` helpers and a `tmdb` object with named methods.
- **`src/lib/supabase.ts`** — singleton Supabase client + shared TypeScript interfaces for DB rows (`Profile`, `WatchedEntry`, `WatchlistItem`, etc.).
- **`src/context/AuthContext.tsx`** — React context wrapping Supabase Auth. Provides `user`, `profile`, `signIn`, `signUp`, `signOut`, `refreshProfile`. Profile is fetched automatically on auth state change. Use `useAuth()` hook everywhere.

### Styling

Tailwind v4 uses `@import "tailwindcss"` in `src/index.css` with a `@theme {}` block for custom design tokens (colours, keyframes). There is no `tailwind.config.js`. Custom utility classes (`.btn-gold`, `.btn-ghost`, `.poster-card`, `.shimmer`, `.gold-glow`, `.no-scrollbar`, `.animate-*`) are defined as plain CSS in `src/index.css`. Pages use inline `style={{}}` props for most layout; Tailwind utility classes are used sparingly for flex/grid helpers.

### Edge Functions (`supabase/functions/`)

Currently one function: `ai-recommender`.

- **GET** — returns `{ used, limit, remaining }` for today's usage (no body needed).
- **POST** — accepts `{ prompt: string }`, calls Claude (`claude-opus-4-5`), returns `{ recommendations, used, limit, remaining }`. Returns HTTP 429 with `{ error: "daily_limit_reached" }` when the user hits 3/day.

The function verifies the user JWT via `SUPABASE_ANON_KEY` client, then uses `SUPABASE_SERVICE_ROLE_KEY` for DB writes. `ANTHROPIC_API_KEY` is read from `Deno.env`. Never expose these in frontend code.

Deploy with the MCP tool — never use Supabase CLI:
```
mcp__supabase__deploy_edge_function({ slug: 'ai-recommender', verify_jwt: false })
```

### Database

Migrations live in Supabase (applied via `mcp__supabase__apply_migration`). Key tables:

| Table | Purpose |
|---|---|
| `profiles` | Username, bio, avatar, `favourite_films` (jsonb array) |
| `watched` | Diary entries — date, liked flag |
| `watchlist` | Saved to-watch items |
| `ratings` | Star ratings (0.5–5), unique per user+tmdb_id+media_type |
| `episode_ratings` | Per-episode ratings for TV shows |
| `reviews` | Free-text reviews |
| `follows` / `likes` / `lists` / `list_items` | Social + list features |
| `ai_recommendation_usage` | Daily AI usage counter, keyed on `(user_id, usage_date)` |

All tables have RLS enabled. Every policy checks `auth.uid()`.

Use `.maybeSingle()` (not `.single()`) for queries expected to return zero or one row.

For ratings upserts use `{ onConflict: 'user_id,tmdb_id,media_type' }`.
