import { supabase } from "@/lib/supabaseClient";
import type { FeedItem } from "@/types/feed";
import { fetchAllRssItems } from "@/lib/rss";

export async function syncFeedItems() {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const items = await fetchAllRssItems();

  if (!items.length) return;

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

  const { error } = await supabase.from("feed_items").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }
}

export async function getRecentFeedItemsFromStore(): Promise<FeedItem[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("feed_items")
    .select("id, source, title, url, published_at, summary, tags")
    .order("published_at", { ascending: false })
    .limit(500);

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

