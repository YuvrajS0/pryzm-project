import { supabase } from "@/lib/supabaseClient";
import type { FeedItem } from "@/types/feed";
import { fetchAllRssItems } from "@/lib/rss";
import { fetchGrantsForKeywords, fetchSamForKeywords } from "@/lib/govApis";

export async function syncFeedItems() {
  if (!supabase) {
    console.error("[syncFeedItems] Supabase not configured");
    throw new Error("Supabase is not configured");
  }

  console.log("[syncFeedItems] Starting sync...");
  const items = await fetchAllRssItems();
  console.log("[syncFeedItems] Fetched", items.length, "items");

  if (!items.length) {
    console.warn("[syncFeedItems] No items to sync");
    return;
  }

  // De-duplicate by id to avoid ON CONFLICT hitting the same row twice
  const byId = new Map<string, FeedItem>();
  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  const rows = Array.from(byId.values()).map((item) => ({
    id: item.id,
    source: item.source,
    title: item.title,
    url: item.url,
    published_at: item.publishedAt,
    summary: item.summary,
    tags: item.tags,
  }));

  console.log("[syncFeedItems] Upserting", rows.length, "rows to feed_items");
  const { error } = await supabase.from("feed_items").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    console.error("[syncFeedItems] Upsert error:", error);
    throw error;
  }
  
  console.log("[syncFeedItems] Sync complete");
}

/**
 * Fetch live targeted items from Grants.gov and SAM.gov using the user's
 * saved topics. Called on every feed load to surface fresh, preference-matched
 * content that may not yet be in the daily sync.
 */
export async function fetchLiveItemsForPreferences(topics: string[]): Promise<FeedItem[]> {
  if (!topics.length) return [];

  // Use up to 5 topics joined as a single keyword query
  const keyword = topics.slice(0, 5).join(" ");

  const [grantsResult, samResult] = await Promise.allSettled([
    fetchGrantsForKeywords(keyword, 20),
    fetchSamForKeywords(keyword, 20),
  ]);

  const items: FeedItem[] = [];
  if (grantsResult.status === "fulfilled") items.push(...grantsResult.value);
  if (samResult.status === "fulfilled") items.push(...samResult.value);

  // Upsert fresh items into DB in the background so they're available next time
  if (supabase && items.length > 0) {
    const rows = items.map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      url: item.url,
      published_at: item.publishedAt,
      summary: item.summary,
      tags: item.tags,
    }));
    supabase
      .from("feed_items")
      .upsert(rows, { onConflict: "id" })
      .then(({ error }) => {
        if (error) console.warn("[fetchLiveItemsForPreferences] Upsert failed:", error);
      });
  }

  return items;
}

export async function getRecentFeedItemsFromStore(): Promise<FeedItem[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("feed_items")
    .select("id, source, title, url, published_at, summary, tags")
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  return (
    data?.map((row) => ({
      id: row.id as string,
      source: row.source,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at as string | null,
      summary: row.summary,
      tags: (row.tags ?? []) as string[],
      score: 0,
    })) ?? []
  );
}

