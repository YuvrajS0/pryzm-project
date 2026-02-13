import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreFeedItemsFromQuery } from "@/lib/rss";
import { supabase } from "@/lib/supabaseClient";
import { getRecentFeedItemsFromStore, syncFeedItems } from "@/lib/feedStore";

const bodySchema = z.object({
  query: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { query } = bodySchema.parse(json);

    // Prefer using the cached store when available, fall back to live fetch
    // (e.g. when Supabase isn't configured).
    if (supabase) {
      let [storedItems] = await Promise.all([
        getRecentFeedItemsFromStore(),
        (async () => {
          try {
            await supabase.from("user_topics").insert({
              query,
              created_at: new Date().toISOString(),
            });
          } catch (error) {
            console.warn("[Supabase] Failed to log user topic", error);
          }
        })(),
      ]);

      // If there are no items yet (fresh project), run an initial sync
      // so the very first request seeds the cache.
      if (storedItems.length === 0) {
        try {
          await syncFeedItems();
          storedItems = await getRecentFeedItemsFromStore();
        } catch (error) {
          console.warn("[Feed] Initial sync failed", error);
        }
      }

      let scored = scoreFeedItemsFromQuery(storedItems, query);

      // If we got almost no matches (e.g. cold cache or very new topic),
      // run a fresh sync once to try to find closer items.
      const top = scored[0];
      const weakResults = !top || top.score <= 5;
      if (weakResults) {
        try {
          await syncFeedItems();
          const refreshed = await getRecentFeedItemsFromStore();
          const rescored = scoreFeedItemsFromQuery(refreshed, query);
          if (rescored.length > 0 && (!top || rescored[0].score > top.score)) {
            scored = rescored;
          }
        } catch (error) {
          console.warn("[Feed] Refresh sync failed", error);
        }
      }

      return NextResponse.json({ items: scored });
    }

    // If Supabase is not configured, just return an empty list instead of
    // hammering external feeds on every request.
    return NextResponse.json({ items: [] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to build feed" },
      { status: 400 },
    );
  }
}

