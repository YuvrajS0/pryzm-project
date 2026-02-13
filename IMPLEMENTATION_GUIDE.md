# Feature Implementation: Bookmarking & X Source

## Summary of Changes

This implementation adds two major features to the Pryzm application:

### 1. Bookmarking Feature
- **Persistent Storage**: Bookmarks are now saved to Supabase for authenticated users
- **Fallback Support**: Anonymous users' bookmarks are stored in localStorage
- **UI Integration**: The FeedCard component displays bookmark status with visual feedback
- **Dedicated View**: New `/bookmarks` page to view all bookmarked items
- **Engagement Tracking**: Bookmark actions are tracked for analytics

### 2. X (Twitter) as a News Source
- **Government News Integration**: Fetches government-related tweets using Nitter RSS feeds
- **Search Terms**: Searches for topics like "defense department contract", "federal grant opportunity", etc.
- **Source Styling**: X tweets are displayed with distinct visual styling (dark gray gradient)
- **Feed Integration**: X tweets are included in the main feed alongside defense news and grants

## Files Created/Modified

### New Files:
1. **`src/lib/bookmarks.ts`** - Bookmark management functions for Supabase
2. **`src/app/api/bookmarks/route.ts`** - API endpoint to fetch user bookmarks
3. **`src/app/bookmarks/page.tsx`** - Bookmarks page UI
4. **`src/app/account/bookmarks/page.tsx`** - Alternative bookmarks page (for account section)
5. **`supabase/migrations/001_create_bookmarks_table.sql`** - Database migration

### Modified Files:
1. **`src/types/feed.ts`** - Added "x" to FeedSource type
2. **`src/app/api/engage/route.ts`** - Fixed Zod schema
3. **`src/components/FeedCard.tsx`** - Added X source styling and labels
4. **`src/components/FeedList.tsx`** - Integrated Supabase bookmarks and user auth
5. **`src/lib/govApis.ts`** - Added fetchXGovTweets function for Twitter data
6. **`src/lib/rss.ts`** - Integrated X tweets into feed fetch pipeline

## Setup Instructions

### 1. Create the Bookmarks Table in Supabase

Run the migration SQL in your Supabase database:

```sql
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_item_id ON user_bookmarks(item_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_created_at ON user_bookmarks(created_at DESC);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
  ON user_bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
  ON user_bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON user_bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_bookmarks TO authenticated;
```

Alternatively, navigate to the SQL editor in your Supabase dashboard and paste the migration file:
`supabase/migrations/001_create_bookmarks_table.sql`

### 2. Verify API Configuration

Ensure your `.env.local` has the required Supabase configuration:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Test the Features

#### Bookmarking:
1. Navigate to the home feed
2. Click the bookmark icon on any feed item
3. You should see a toast notification confirming the bookmark
4. Go to `/bookmarks` to view all your saved items
5. Log in to ensure bookmarks persist across sessions

#### X Source:
1. Navigate to the home feed
2. Look for items with the "X" source label (dark gray avatar)
3. These are government-related tweets fetched from X
4. They appear alongside defense news and grant opportunities

## Key Features

### Bookmark Functionality:
- ✅ Add/remove bookmarks with one click
- ✅ Bookmarks persist in Supabase when logged in
- ✅ Falls back to localStorage for anonymous users
- ✅ Visual feedback with bookmark icons and toasts
- ✅ Dedicated bookmarks view at `/bookmarks`
- ✅ Engagement tracking (bookmark/unbookmark actions)

### X Source Integration:
- ✅ Searches for government-related tweets
- ✅ Uses Nitter RSS feed (no authentication required)
- ✅ Searches for: defense contracts, federal grants, DOD procurement, government innovation, SBIR programs
- ✅ Fetches up to 30 tweets per sync
- ✅ Distinctive styling with "X" source label
- ✅ Social media engagement signals

## Technical Details

### Bookmarks Implementation:
- Uses Supabase Auth to identify users
- Stores bookmarks with unique constraint (user_id, item_id)
- Row Level Security (RLS) policies ensure users only see their own bookmarks
- Gracefully handles offline scenarios with localStorage fallback

### X Source Implementation:
- Uses Nitter.net (open-source Twitter frontend)
- Provides RSS feeds without requiring Twitter API authentication
- Parses XML response to extract tweet metadata
- Includes relevant tags for content discovery
- Error handling for network failures

## Usage Examples

### For Users:
1. **Bookmarking Items**: Click the bookmark icon on any feed item
2. **Viewing Bookmarks**: Navigate to `/bookmarks` or click "Bookmarks" in the sidebar
3. **Finding Government News on X**: Filter or search for X tweets about government topics

### For Developers:
```typescript
// Fetch user's bookmarks
import { getBookmarkedItemIds } from "@/lib/bookmarks";
const bookmarks = await getBookmarkedItemIds(userId);

// Add a bookmark
import { addBookmark } from "@/lib/bookmarks";
await addBookmark(userId, itemId);

// Remove a bookmark
import { removeBookmark } from "@/lib/bookmarks";
await removeBookmark(userId, itemId);

// Fetch X tweets
import { fetchXGovTweets } from "@/lib/govApis";
const tweets = await fetchXGovTweets(50);
```

## Future Enhancements

1. **Export Bookmarks**: Allow users to export their bookmarks as CSV/JSON
2. **Bookmark Collections**: Organize bookmarks into custom folders/tags
3. **Share Bookmarks**: Share bookmark collections with teammates
4. **Official X API**: Integrate with official Twitter API for more features
5. **Email Digests**: Send email digests of bookmarked items
6. **Bookmark Sync**: Sync bookmarks across devices

## Troubleshooting

### Bookmarks not saving:
- Check if Supabase is configured correctly
- Verify user is logged in (check browser console for auth errors)
- Ensure bookmarks table exists in Supabase
- Check Supabase RLS policies aren't blocking operations

### X tweets not appearing:
- Verify internet connection
- Check if nitter.net is accessible
- Look for console errors related to X fetch failures
- X fetch has error logging - check browser console for details

### Performance issues:
- X fetch is limited to 30 tweets by default - adjust in `rss.ts` if needed
- Bookmarks are loaded on demand - consider caching bookmark list
- Nitter RSS is rate-limited - add delays if fetching too frequently
