# Yuvraj-Pryzm — High-Level Design Document

## 1. System Overview

Yuvraj-Pryzm is a full-stack Next.js application that aggregates defense technology news, federal grants, and US government contract opportunities into a Twitter/X-style personalized feed. Users select topics of interest and the system curates a ranked "For You" feed alongside a chronological "Latest" feed.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Vercel (Hosting)                            │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
│  │   Next.js Frontend   │   │   Next.js API Routes (Serverless)│   │
│  │   (Client-rendered)  │──▶│   /api/feed, /api/sync,          │   │
│  │                      │   │   /api/engage, /api/bookmarks,   │   │
│  │                      │   │   /api/trending                  │   │
│  └──────────────────────┘   └──────────┬───────────────────────┘   │
│                                        │                           │
│  ┌─────────────────────────────────────┘                           │
│  │  Vercel Cron (daily 08:00 UTC)                                  │
│  │  → GET /api/sync                                                │
│  └─────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Supabase  │  │ RSS Feeds  │  │  Gov APIs  │
   │ PostgreSQL │  │ (Defense)  │  │ Grants.gov │
   │  + Auth    │  │            │  │  SAM.gov   │
   └────────────┘  └────────────┘  └────────────┘
```

## 2. Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Framework    | Next.js 16 (App Router, TypeScript)     |
| Styling      | Tailwind CSS v4 (dark theme, X-like UI) |
| Database     | Supabase PostgreSQL                     |
| Auth         | Supabase Auth (email/password)          |
| RSS Parsing  | rss-parser                              |
| Validation   | Zod                                     |
| Icons        | lucide-react                            |
| Deployment   | Vercel + Vercel Crons                   |

## 3. Architectural Components

### 3.1 Frontend Layer

All pages are client-rendered (`"use client"`) — the app is essentially a client-side SPA hosted on Next.js infrastructure.

| Route               | File                           | Purpose                                     |
| -------------------- | ------------------------------ | -------------------------------------------- |
| `/`                  | `src/app/page.tsx`             | Home — "For You" (ranked) and "Latest" tabs  |
| `/search`            | `src/app/search/page.tsx`      | Full-text search with source/time/sort filters |
| `/account`           | `src/app/account/page.tsx`     | Auth form + topic preferences management     |
| `/bookmarks`         | `src/app/bookmarks/page.tsx`   | Saved items                                  |

### 3.2 Component Architecture

```
RootLayout (layout.tsx)
  └── Providers (ToastProvider)
        └── LayoutShell (3-column responsive layout)
              ├── Left sidebar: navigation (desktop)
              ├── Main content area (600px max)
              │     ├── FeedList → FeedCard[]
              │     ├── SearchBar + SearchFilters (search page)
              │     └── AuthPreferencesPanel (account page)
              ├── Right sidebar: HomeSidebar (xl screens)
              └── BottomNav (mobile)

OnboardingFlow — full-screen modal on first login
```

**Key components:**

| Component              | Role                                         |
| ---------------------- | -------------------------------------------- |
| `LayoutShell`          | Page shell with left nav, main column, right sidebar, mobile bottom nav |
| `FeedList`             | Renders list of `FeedCard` components        |
| `FeedCard`             | Single feed item — title, source badge, tags, bookmark/share actions, "Top Signal" indicator |
| `HomeSidebar`          | Displays user's saved topics and data sources |
| `SearchBar`            | Text input for search queries                |
| `SearchFilters`        | Sort, time range, and source filter pills    |
| `AuthPreferencesPanel` | Login/signup form and topic CRUD             |
| `OnboardingFlow`       | First-login modal for selecting 3-5 topics   |
| `Toast`                | Notification system (React Context)          |

### 3.3 API Layer (Serverless Route Handlers)

| Endpoint           | Method | Auth               | Purpose                                                |
| ------------------ | ------ | ------------------ | ------------------------------------------------------ |
| `/api/feed`        | POST   | Optional (userId)  | Scores and returns feed items for a query               |
| `/api/sync`        | GET    | Bearer CRON_SECRET | Fetches from all data sources, upserts to DB           |
| `/api/engage`      | POST   | None               | Logs user actions (clicks, shares, bookmarks)          |
| `/api/bookmarks`   | GET    | Supabase Auth      | Returns authenticated user's bookmarked item IDs       |
| `/api/trending`    | GET    | None               | Returns top tags across items (15-min in-memory cache) |

### 3.4 Business Logic Layer

Located in `src/lib/`:

```
rss.ts          ── RSS fetching + scoring engine
feedStore.ts    ── DB sync, item caching, upsert coordination
govApis.ts      ── Grants.gov & SAM.gov API clients
supabaseClient.ts ── Supabase client singleton
engagement.ts   ── Client-side analytics (session tracking, event dispatch)
bookmarks.ts    ── Bookmark CRUD utilities
```

### 3.5 Data Sources

| Source                  | Type     | Auth           | Items       |
| ----------------------- | -------- | -------------- | ----------- |
| Defense News (4 feeds)  | RSS      | None           | News articles |
| DoD Press Releases      | RSS      | None           | Press releases |
| Grants.gov              | REST API | None (public)  | Federal grants |
| SAM.gov                 | REST API | API key (optional) | Contract opportunities |

### 3.6 Database Layer (Supabase PostgreSQL)

| Table               | Key Columns                                        | Purpose                          |
| ------------------- | -------------------------------------------------- | -------------------------------- |
| `feed_items`        | id, source, title, url, published_at, summary, tags | Cached aggregated content        |
| `user_preferences`  | user_id, topic                                     | User's selected interest topics  |
| `user_bookmarks`    | user_id, item_id                                   | Bookmarked feed items            |
| `user_topics`       | user_id, query, created_at                         | Search history (last 10)         |
| `user_settings`     | user_id, relevance_weight, muted_terms, source_weights | Per-user scoring config     |
| `user_engagements`  | item_id, action, session_id, user_id, metadata     | Click/share/bookmark event log   |

Row Level Security is enabled on `user_bookmarks` — users can only access their own rows.

## 4. Data Flow

### 4.1 Ingestion Pipeline

```
Vercel Cron (daily 08:00 UTC)
  │
  ▼
GET /api/sync (Bearer CRON_SECRET)
  │
  ├── fetchAllRssItems()
  │     ├── 5 RSS feeds via rss-parser
  │     ├── Grants.gov POST search2 (3 strategies: general, DoD, SBIR/STTR)
  │     └── SAM.gov GET opportunities (3 strategies, 1s delay between)
  │
  ├── Normalize all to FeedItem type
  ├── Deduplicate by ID
  │
  └── supabase.from("feed_items").upsert(rows, { onConflict: "id" })
```

An on-demand sync is triggered if the `feed_items` table is empty or query results are weak (score <= 5).

### 4.2 Feed Request Flow

```
Client: POST /api/feed { query, userId? }
  │
  ├── Load up to 1000 items from feed_items
  ├── Load user context: preferences, search history, settings
  │
  ├── scoreFeedItemsFromQuery()  ──────────────────────┐
  │     Score each item against query + user context    │
  │                                                     │
  │     Scoring signals:                                │
  │       Text relevance ............ 0-100 pts         │
  │       Preference boost ......... 0-50 pts           │
  │       Tag matching ............. 0-20 pts           │
  │       Search history boost ..... 0-15 pts           │
  │       Source affinity .......... 0-15 pts           │
  │       Recency bonus ........... 0-20 pts            │
  │       Muted term penalty ...... -50 pts             │
  │                                                     │
  │     Final = weighted blend of relevance + recency   │
  │                                                     │
  ├── mixSourcesInFeed() ── interleave sources randomly │
  │                                                     │
  └── Response:                                         │
        for_you: top 50 scored items                    │
        latest:  all items sorted by date               │
```

### 4.3 Client Rendering

```
Page mount
  ├── supabase.auth.getUser()
  ├── Fetch user_preferences
  ├── If no preferences → show OnboardingFlow modal
  ├── POST /api/feed { query: topics.join(" ") }
  └── Render FeedList with for_you / latest tabs

Client-side filtering:
  └── Latest tab → filter by source (all / defense_news / grants / contracts)
```

## 5. Authentication & Authorization

- **Provider:** Supabase Auth (email/password)
- **Client:** `@supabase/supabase-js` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Degraded mode:** App functions without Supabase configured — auth, bookmarks, and personalized feeds are disabled
- **API auth:** `/api/sync` validates `Bearer CRON_SECRET`; `/api/bookmarks` checks `supabase.auth.getUser()` server-side; other routes are public
- **RLS:** Row Level Security on `user_bookmarks` (users can only read/write their own rows)

## 6. State Management

No external state library. All state is managed via:

- **`useState` / `useEffect`** — per-component local state
- **`useMemo`** — derived/filtered lists
- **React Context** — `ToastProvider` for notifications
- **`localStorage`** — session ID, bookmarks (offline), search history, onboarding flag

## 7. Styling & Design System

- **Tailwind CSS v4** with custom theme tokens in `globals.css`
- **Dark-only theme** (no light mode toggle)
- **X/Twitter-inspired design language**: rounded pills, 600px max-width feed column, three-column desktop layout
- **Key color tokens**: `--accent: #1d9bf0` (interactive blue), `--background: #000000`, `--surface: #16181c`

## 8. Deployment

```
GitHub repo
  └── Vercel auto-deploy on push
        ├── Serverless functions (API routes)
        ├── Static client bundles
        ├── Vercel Cron: daily /api/sync at 08:00 UTC
        └── Environment variables:
              NEXT_PUBLIC_SUPABASE_URL
              NEXT_PUBLIC_SUPABASE_ANON_KEY
              SAM_GOV_API_KEY (optional)
              CRON_SECRET
```

## 9. Environment Variables

| Variable                        | Scope          | Required | Purpose                        |
| ------------------------------- | -------------- | -------- | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Client+Server  | Yes      | Supabase project URL           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client+Server  | Yes      | Supabase anonymous key         |
| `SAM_GOV_API_KEY`               | Server only    | No       | SAM.gov contract data          |
| `CRON_SECRET`                   | Server only    | Yes      | Authenticates cron sync calls  |
