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
  {
    id: "grants-new-opportunities",
    source: "grants",
    url: "https://www.grants.gov/rss/GG_NewOppByCategory.xml",
    defaultTags: ["grant", "funding", "federal"],
  },
  {
    id: "grants-new-opportunities-agency",
    source: "grants",
    url: "https://www.grants.gov/rss/GG_NewOppByAgency.xml",
    defaultTags: ["grant", "agency", "federal"],
  },
  {
    id: "grants-modified-opportunities-agency",
    source: "grants",
    url: "https://www.grants.gov/rss/GG_OppModByAgency.xml",
    defaultTags: ["grant", "modification", "federal"],
  },
];

export type NormalizedRssItem = FeedItem;

export async function fetchAllRssItems(): Promise<FeedItem[]> {
  // Fetch RSS feeds
  const rssResults = await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);

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
    }),
  );

  const items: FeedItem[] = [];

  for (const res of rssResults) {
    if (res.status === "fulfilled") {
      items.push(...res.value);
    }
  }

  // Fetch from government APIs with focused search strategies
  // Limited to recent, relevant items - users can search for more specific results
  const [grantsItems, samItems] = await Promise.allSettled([
    fetchGrantsGovOpportunities(50), // Fetch 50 recent grants with defense/SBIR focus
    fetchSamGovOpportunities(75),    // Fetch 75 recent contracts with DoD/tech focus
  ]);

  if (grantsItems.status === "fulfilled") {
    items.push(...grantsItems.value);
    console.log(`[Feed] Fetched ${grantsItems.value.length} grants from Grants.gov`);
  }

  if (samItems.status === "fulfilled") {
    items.push(...samItems.value);
    console.log(`[Feed] Fetched ${samItems.value.length} contracts from SAM.gov`);
  }

  console.log(`[Feed] Total items fetched: ${items.length}`);
  return items.filter((item) => item.title && item.url !== "#");
}

export function scoreFeedItemsFromQuery(
  items: FeedItem[],
  query: string,
): FeedItem[] {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);

  const scored = items.map((item) => {
    const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();

    let baseScore = 1;
    if (q && text.includes(q)) baseScore = 12;

    const keywordHits = words.filter((w) => text.includes(w)).length;
    const keywordBoost = keywordHits * 4;

    // Nudge grants higher when the query is about funding/SBIR etc.
    const fundingTerms = ["grant", "sbir", "sttr", "funding", "broad agency"];
    const wantsFunding = fundingTerms.some((t) => q.includes(t));
    const fundingBoost =
      item.source === "grants" && wantsFunding ? 10 : 0;

    let recencyBoost = 0;
    if (item.publishedAt) {
      const hoursOld = differenceInHours(new Date(), new Date(item.publishedAt));
      if (hoursOld <= 24) recencyBoost = 8;
      else if (hoursOld <= 72) recencyBoost = 5;
      else if (hoursOld <= 168) recencyBoost = 2;
    }

    return {
      ...item,
      score: baseScore + keywordBoost + fundingBoost + recencyBoost,
    };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, 50); // Limit to top 50 results - users can refine search for more specific items
}

