import Parser from "rss-parser";
import { differenceInHours } from "date-fns";
import type { FeedItem, FeedSource } from "@/types/feed";
import { fetchGrantsGovOpportunities, fetchSamGovOpportunities } from "./govApis";

const parser = new Parser();

export type RssSourceConfig = {
  id: string;
  source: FeedSource;
  url: string;
  defaultTags: string[];
};

// Curated sources focused on defense tech, DoD and federal grants.
export const RSS_SOURCES: RssSourceConfig[] = [
  {
    id: "defense-news-home",
    source: "defense_news",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    defaultTags: ["defense", "industry", "policy"],
  },
  {
    id: "defense-news-space",
    source: "defense_news",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/space/?outputType=xml",
    defaultTags: ["space", "satellites", "domain-awareness"],
  },
  {
    id: "defense-news-unmanned",
    source: "defense_news",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/unmanned/?outputType=xml",
    defaultTags: ["drones", "autonomy", "unmanned"],
  },
  {
    id: "defense-news-industry",
    source: "defense_news",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/industry/?outputType=xml",
    defaultTags: ["industry", "contracts", "acquisition"],
  },
  {
    id: "dod-releases",
    source: "defense_news",
    url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1",
    defaultTags: ["dod", "press-release", "policy"],
  },
];

export type NormalizedRssItem = FeedItem;

export async function fetchAllRssItems(): Promise<FeedItem[]> {
  // Fetch RSS feeds
  console.log("[fetchAllRssItems] Starting fetch from", RSS_SOURCES.length, "sources");
  const rssResults = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        console.log("[fetchAllRssItems]", source.id, "returned", feed.items?.length ?? 0, "items");
        return (feed.items ?? []).map<FeedItem>((item, index) => {
          const title = item.title ?? "Untitled";
          const link = item.link ?? "#";
          const pubDate = item.pubDate ? new Date(item.pubDate) : null;
          const summary =
            (item.contentSnippet || item.content || item["content:encoded"]) ??
            null;

          return {
            id:
              (item.guid as string | undefined) ??
              `${source.id}-${link}-${index}`,
            source: source.source,
            title,
            url: link,
            publishedAt: pubDate ? pubDate.toISOString() : null,
            summary,
            tags: source.defaultTags,
            score: 0, // score is applied at read time
          };
        });
      } catch (error) {
        console.error("[fetchAllRssItems] Error fetching", source.id, ":", error);
        throw error;
      }
    }),
  );

  const items: FeedItem[] = [];

  for (const res of rssResults) {
    if (res.status === "fulfilled") {
      console.log("[fetchAllRssItems] RSS source returned", res.value.length, "items");
      items.push(...res.value);
    } else {
      console.error("[fetchAllRssItems] RSS source failed:", res.reason);
    }
  }

  console.log("[fetchAllRssItems] Total items from RSS sources:", items.length);

  // Fetch from government APIs with focused search strategies
  // Limited to recent, relevant items - users can search for more specific results
  console.log("[fetchAllRssItems] Fetching from government APIs...");
  const [grantsItems, samItems] = await Promise.allSettled([
    fetchGrantsGovOpportunities(50), // Fetch 50 recent grants with defense/SBIR focus
    fetchSamGovOpportunities(75),    // Fetch 75 recent contracts with DoD/tech focus
  ]);

  if (grantsItems.status === "fulfilled") {
    items.push(...grantsItems.value);
    console.log(`[Feed] Fetched ${grantsItems.value.length} grants from Grants.gov`);
  } else {
    console.error("[Feed] Grants.gov failed:", grantsItems.reason);
  }

  if (samItems.status === "fulfilled") {
    items.push(...samItems.value);
    console.log(`[Feed] Fetched ${samItems.value.length} contracts from SAM.gov`);
  } else {
    console.error("[Feed] SAM.gov failed:", samItems.reason);
  }

  console.log(`[Feed] Total items after gov APIs: ${items.length}`);
  return items.filter((item) => item.title && item.url !== "#");
}

/**
 * Fetch Defense News articles targeted to the user's preference topics via
 * Google News RSS search (scoped to defensenews.com). Returns items for the
 * "For You" scoring pool only — NOT stored in the DB or shown in Latest,
 * since links are Google News redirect URLs rather than direct article URLs.
 */
export async function fetchDefenseNewsForTopics(topics: string[]): Promise<FeedItem[]> {
  if (!topics.length) return [];

  const results = await Promise.allSettled(
    topics.slice(0, 5).map(async (topic) => {
      const q = encodeURIComponent(`${topic} site:defensenews.com`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const feed = await parser.parseURL(url);
        return (feed.items ?? []).slice(0, 8).map<FeedItem>((item, index) => {
          const title = (item.title ?? "Untitled").replace(/ - Defense News$/, "");
          const link = item.link ?? "#";
          const pubDate = item.pubDate ? new Date(item.pubDate) : null;
          const guid = (item.guid as string | undefined) ?? `${topic}-${index}`;
          return {
            id: `gnews-${guid}`,
            source: "defense_news" as const,
            title,
            url: link,
            publishedAt: pubDate ? pubDate.toISOString() : null,
            summary: null,
            // Tag with the preference topic so scoring gives a strong boost
            tags: ["defense", "defense-news", topic.toLowerCase()],
            score: 0,
          };
        });
      } catch {
        return [];
      }
    }),
  );

  const items: FeedItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
  }

  // Deduplicate by ID across topics
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export type UserScoringContext = {
  preferences?: string[];
  recentSearches?: string[];
  mutedTerms?: string[];
  sourceWeights?: Record<string, number>;
  relevanceWeight?: number; // 0-100, default 60
};

export function scoreFeedItemsFromQuery(
  items: FeedItem[],
  query: string,
  userContext?: UserScoringContext,
): FeedItem[] {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const ctx = userContext ?? {};
  const relevanceWeight = (ctx.relevanceWeight ?? 60) / 100;

  const scored = items.map((item) => {
    const text = `${item.title} ${item.summary ?? ""} ${item.tags.join(" ")}`.toLowerCase();

    // Mute penalty — bury items matching muted terms
    if (ctx.mutedTerms?.some((term) => text.includes(term.toLowerCase()))) {
      return { ...item, score: -50 };
    }

    // Text relevance (0-100) - much stronger scoring
    let textRelevance = 0;
    if (q) {
      // Exact phrase match in title is strongest
      if (item.title.toLowerCase().includes(q)) {
        textRelevance = 100;
      }
      // Title word matches
      else if (item.title.toLowerCase().split(/\s+/).some((t) => words.includes(t))) {
        textRelevance = 80;
      }
      // All query words found
      else if (words.length > 0 && words.every((w) => text.includes(w))) {
        textRelevance = 70;
      }
      // Multiple word matches
      else {
        const matchCount = words.filter((w) => text.includes(w)).length;
        textRelevance = Math.min((matchCount / Math.max(words.length, 1)) * 50, 50);
      }
    }

    // Preference boost (0-50) - much higher
    let preferenceBoost = 0;
    if (ctx.preferences?.length) {
      const prefText = ctx.preferences.join(" ").toLowerCase();
      const prefWords = prefText.split(/\s+/).filter(Boolean);
      
      // Strong boost if preferences found in title
      const titleMatches = prefWords.filter((w) =>
        item.title.toLowerCase().includes(w),
      ).length;
      if (titleMatches > 0) {
        preferenceBoost = Math.min(titleMatches * 15, 40);
      } else {
        // Weaker boost if found elsewhere
        const contentMatches = prefWords.filter((w) => text.includes(w)).length;
        preferenceBoost = Math.min(contentMatches * 3, 20);
      }
    }

    // Search history boost (0-15)
    let searchHistoryBoost = 0;
    if (ctx.recentSearches?.length) {
      for (let i = 0; i < Math.min(ctx.recentSearches.length, 3); i++) {
        const searchTerms = ctx.recentSearches[i].toLowerCase().split(/\s+/);
        const matches = searchTerms.filter((w) => text.includes(w)).length;
        if (matches > 0) {
          searchHistoryBoost = Math.max(searchHistoryBoost, 15 - i * 3);
        }
      }
    }

    // Tags match boost (0-20)
    let tagsBoost = 0;
    if (item.tags.length > 0 && ctx.preferences?.length) {
      const prefText = ctx.preferences.join(" ").toLowerCase();
      const matchingTags = item.tags.filter((tag) =>
        prefText.includes(tag.toLowerCase()),
      ).length;
      tagsBoost = Math.min(matchingTags * 4, 20);
    }

    // Source affinity boost (0-15)
    const sourceWeight = ctx.sourceWeights?.[item.source] ?? 1;
    const sourceAffinityBoost = Math.min((sourceWeight - 1) * 15, 15);

    // Recency boost (0-20)
    let recencyBoost = 0;
    if (item.publishedAt) {
      const hoursOld = differenceInHours(new Date(), new Date(item.publishedAt));
      if (hoursOld <= 24) recencyBoost = 20;
      else if (hoursOld <= 72) recencyBoost = 12;
      else if (hoursOld <= 168) recencyBoost = 5;
    }

    // Combine all scores
    const relevanceScore =
      textRelevance + preferenceBoost + searchHistoryBoost + tagsBoost + sourceAffinityBoost;
    const finalScore =
      relevanceWeight * (relevanceScore / 2) +
      (1 - relevanceWeight) * (recencyBoost * 5);

    return {
      ...item,
      score: Math.round(finalScore * 10) / 10,
    };
  });

  return scored
    .filter((item) => item.score > -10)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 50);
}

