import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

let cachedResult: { tags: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  // Return cached result if fresh
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ tags: cachedResult.tags });
  }

  if (!supabase) {
    return NextResponse.json({ tags: [] });
  }

  try {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from("feed_items")
      .select("tags")
      .gte("published_at", sevenDaysAgo)
      .limit(300);

    if (error) throw error;

    // Aggregate tag frequency
    const tagCounts = new Map<string, number>();
    for (const row of data ?? []) {
      const tags = (row.tags ?? []) as string[];
      for (const tag of tags) {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    cachedResult = { tags: topTags, timestamp: Date.now() };

    return NextResponse.json({ tags: topTags });
  } catch (error) {
    console.error("[Trending]", error);
    return NextResponse.json({ tags: [] });
  }
}
