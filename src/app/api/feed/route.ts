import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreFeedItemsFromQuery } from "@/lib/rss";
import type { UserScoringContext } from "@/lib/rss";
import type { FeedItem } from "@/types/feed";
import { supabase } from "@/lib/supabaseClient";
import { getRecentFeedItemsFromStore, syncFeedItems } from "@/lib/feedStore";

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

  const [prefsResult, topicsResult, settingsResult] = await Promise.allSettled([
    supabase
      .from("user_preferences")
      .select("topic")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_topics")
      .select("query")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_settings")
      .select("relevance_weight, muted_terms, source_weights")
      .eq("user_id", userId)
      .single(),
  ]);

  const preferences =
    prefsResult.status === "fulfilled" && prefsResult.value.data
      ? prefsResult.value.data.map((r: { topic: string }) => r.topic)
      : [];

  const recentSearches =
    topicsResult.status === "fulfilled" && topicsResult.value.data
      ? topicsResult.value.data.map((r: { query: string }) => r.query)
      : [];

  let relevanceWeight = 60;
  let mutedTerms: string[] = [];
  let sourceWeights: Record<string, number> = {};

  if (settingsResult.status === "fulfilled" && settingsResult.value.data) {
    const s = settingsResult.value.data;
    relevanceWeight = (s.relevance_weight as number) ?? 60;
    mutedTerms = (s.muted_terms as string[]) ?? [];
    sourceWeights = (s.source_weights as Record<string, number>) ?? {};
  }

  return {
    preferences,
    recentSearches,
    relevanceWeight,
    mutedTerms,
    sourceWeights,
  };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { query, userId } = bodySchema.parse(json);

    console.log("[/api/feed] Request: query =", query, "userId =", userId);

    if (supabase) {
      let [storedItems] = await Promise.all([
        getRecentFeedItemsFromStore(),
        (async () => {
          try {
            await supabase.from("user_topics").insert({
              query,
              user_id: userId ?? null,
              created_at: new Date().toISOString(),
            });
          } catch (error) {
            console.warn("[Supabase] Failed to log user topic", error);
          }
        })(),
      ]);

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

      let scored = scoreFeedItemsFromQuery(storedItems, query, userContext);
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
