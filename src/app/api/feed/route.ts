import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreFeedItemsFromQuery, fetchDefenseNewsForTopics } from "@/lib/rss";
import type { UserScoringContext } from "@/lib/rss";
import type { FeedItem } from "@/types/feed";
import { supabase } from "@/lib/supabaseClient";
import { getRecentFeedItemsFromStore, syncFeedItems, fetchLiveItemsForPreferences } from "@/lib/feedStore";

/**
 * Mix feed sources throughout the feed while maintaining chronological order within each source
 * This spreads out different sources rather than clustering them together
 */
function mixSourcesInFeed(items: FeedItem[]): FeedItem[] {
  // Group items by source
  const bySource: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const source = item.source;
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(item);
  }

  const result: FeedItem[] = [];
  const sources = Object.keys(bySource);
  const indices: Record<string, number> = {};

  // Initialize indices
  for (const source of sources) {
    indices[source] = 0;
  }

  // Pick items by randomly cycling through sources
  while (result.length < items.length) {
    // Get available sources (that still have items)
    const available = sources.filter((s) => indices[s] < bySource[s].length);
    if (available.length === 0) break;

    // Randomly pick a source from available
    const source = available[Math.floor(Math.random() * available.length)];
    result.push(bySource[source][indices[source]]);
    indices[source]++;
  }

  return result;
}

const bodySchema = z.object({
  query: z.string().min(1).max(256),
  userId: z.string().optional(),
});

async function loadUserContext(
  userId: string,
): Promise<UserScoringContext> {
  if (!supabase) return {};

  const prefsResult = await supabase
    .from("user_preferences")
    .select("topic")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const preferences =
    prefsResult.data
      ? prefsResult.data.map((r: { topic: string }) => r.topic)
      : [];

  return { preferences };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { query, userId } = bodySchema.parse(json);

    console.log("[/api/feed] Request: query =", query, "userId =", userId);

    if (supabase) {
      let storedItems = await getRecentFeedItemsFromStore();

      console.log("[/api/feed] Stored items from DB:", storedItems.length);

      // If there are no items yet (fresh project), run an initial sync
      if (storedItems.length === 0) {
        console.log("[/api/feed] No items in DB, syncing...");
        try {
          await syncFeedItems();
          storedItems = await getRecentFeedItemsFromStore();
          console.log("[/api/feed] After sync, got", storedItems.length, "items");
        } catch (error) {
          console.warn("[Feed] Initial sync failed", error);
        }
      }

      // Load user context for personalized scoring
      const userContext = userId ? await loadUserContext(userId) : undefined;

      // Fetch live targeted items in parallel using the user's saved topics.
      // - Gov items (Grants/SAM): merged into storedItems → appear in both For You and Latest
      // - Defense news items (Google News RSS): used for scoring only → For You only,
      //   since they carry Google News redirect URLs rather than direct article links.
      const [liveGovItems, liveDefenseItems] = await Promise.all([
        userContext?.preferences?.length
          ? fetchLiveItemsForPreferences(userContext.preferences)
          : Promise.resolve([]),
        userContext?.preferences?.length
          ? fetchDefenseNewsForTopics(userContext.preferences)
          : Promise.resolve([]),
      ]);

      if (liveGovItems.length > 0) {
        const existingIds = new Set(storedItems.map((i) => i.id));
        const newGovItems = liveGovItems.filter((i) => !existingIds.has(i.id));
        storedItems = [...newGovItems, ...storedItems];
        console.log(`[/api/feed] Added ${newGovItems.length} live gov items`);
      }

      // forYouPool includes defense news targeted items on top of storedItems
      const forYouPool = liveDefenseItems.length > 0
        ? [...liveDefenseItems, ...storedItems]
        : storedItems;
      console.log(`[/api/feed] Added ${liveDefenseItems.length} live defense news items for scoring`);

      let scored = scoreFeedItemsFromQuery(forYouPool, query, userContext);
      console.log("[/api/feed] After scoring, got", scored.length, "items");

      // If we got almost no matches, run a fresh sync
      const top = scored[0];
      const weakResults = !top || top.score <= 5;
      if (weakResults) {
        console.log("[/api/feed] Weak results, syncing...");
        try {
          await syncFeedItems();
          const refreshed = await getRecentFeedItemsFromStore();
          const rescored = scoreFeedItemsFromQuery(
            refreshed,
            query,
            userContext,
          );
          if (
            rescored.length > 0 &&
            (!top || rescored[0].score > top.score)
          ) {
            scored = rescored;
            console.log("[/api/feed] After resync, got", scored.length, "items");
          }
        } catch (error) {
          console.warn("[Feed] Refresh sync failed", error);
        }
      }

      console.log("[/api/feed] Returning", scored.length, "for_you items and", storedItems.length, "latest items");

      // Return both scored (for relevance) and latest (by date) items
      // For "For You": return top 50 scored items
      // For "Latest": return all items sorted by recency with sources mixed throughout
      const latestSorted = [...storedItems].sort((a, b) => {
        const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bDate - aDate; // newest first
      });

      return NextResponse.json({
        for_you: mixSourcesInFeed(scored.slice(0, 50)),
        latest: latestSorted,
      });
    }

    return NextResponse.json({ for_you: [], latest: [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to build feed" },
      { status: 400 },
    );
  }
}
