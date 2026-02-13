## Defense & Gov Signal Feed

Full‑stack Next.js app that turns defense tech news and US government funding data into a Twitter‑style feed, curated around what the user is looking for.

### Stack

- **Frontend**: Next.js (App Router, TypeScript), Tailwind CSS
- **Backend**: Next.js Route Handlers (`/api/feed`)
- **Database**: Supabase (Postgres) via `@supabase/supabase-js`
- **Data sources**:
  - Defense News RSS (defense tech & policy)
  - DoD Press Releases RSS
  - Grants.gov API (federal grant opportunities via public API)
  - SAM.gov API (federal contract opportunities - requires API key)

### How it works

- **User intent capture**:
  - For authenticated users with saved preferences: Feed auto-populates with recent signals matching their topics (limited to top 50 results)
  - For all users: Search bar allows finding specific opportunities by keywords
  - Users are encouraged to search for more specific results rather than browsing everything
- **Background ingest**:
  - `/api/sync` pulls from:
    - RSS feeds (Defense News, DoD Press Releases, Grants.gov RSS)
    - Grants.gov API (~50 recent grants with defense/SBIR focus)
    - SAM.gov API (~75 recent contracts with DoD/tech focus) if API key is configured
  - All items are normalized and upserted into Supabase table `feed_items`
  - Intentionally limited to recent, focused items - users search for specific needs
  - You can wire this to **Vercel Cron** or **Supabase scheduled functions** to run every 15-30 minutes in production
- **Feed curation**:
  - `/api/feed` reads recent items from `feed_items` instead of hitting external feeds on every request
  - Items are scored based on:
    - keyword overlap with the user query (plus stored preference topics)
    - whether the full text contains the query
    - recency (last 24h, 72h, 7d)
    - funding type match (grants get boosted for SBIR/grant queries)
  - The feed is sorted by score + time and limited to top 50 results
  - Users are encouraged to refine their search for more specific opportunities
- **Personalization & logging**:
  - The most recent query is stored in `localStorage` so the feed “remembers” what you care about.
  - The `/api/feed` endpoint also logs each query into a Supabase table `user_topics` (fire‑and‑forget), which can later power saved watchlists and analytics.

### Supabase schema

Create a Supabase project and run:

```sql
create table if not exists public.user_topics (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  created_at timestamptz not null default now()
);

alter table public.user_topics enable row level security;

create policy "allow inserts from anon" on public.user_topics
  for insert
  to anon
  with check (true);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  created_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "user can see own preferences" on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user can insert own preferences" on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user can update own preferences" on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user can delete own preferences" on public.user_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);
```

Additional store for ingested feed items:

```sql
create table if not exists public.feed_items (
  id text primary key,
  source text not null,
  title text not null,
  url text not null,
  published_at timestamptz,
  summary text,
  tags text[]
);

alter table public.feed_items enable row level security;

create policy "public read feed items" on public.feed_items
  for select
  to anon
  using (true);
```

Then set the env vars:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SAM_GOV_API_KEY` (Optional) - SAM.gov API key for contract opportunities

**Getting a SAM.gov API Key (Optional):**
1. Visit [SAM.gov](https://sam.gov)
2. Sign in or create an account
3. Navigate to **Account Details**
4. Generate an API key
5. Add it to your `.env.local` file

Without the SAM.gov API key, the system will still work but will skip fetching contract opportunities from SAM.gov.

You can copy `.env.example` to `.env.local` and fill in your values.

### Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Deploying to Vercel

1. Push this repo to GitHub.
2. Create a new Vercel project from the repo.
3. Add the Supabase env vars in **Project Settings → Environment Variables**.
4. (Optional) Add a `CRON_SECRET` env var and configure a **Vercel Cron** job to hit:

   - `GET https://your-project.vercel.app/api/sync?token=CRON_SECRET`

5. Deploy – Vercel will detect Next.js and handle the rest.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
