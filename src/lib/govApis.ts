import type { FeedItem } from "@/types/feed";

// Grants.gov API - no authentication required for search
const GRANTS_API_URL = "https://api.grants.gov/v1/api/search2";

// SAM.gov API - requires API key (set in environment variables)
const SAM_API_URL = "https://api.sam.gov/prod/opportunities/v2/search";
const SAM_API_KEY = process.env.SAM_GOV_API_KEY || "";

export type GrantsGovOpportunity = {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agency: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  docType: string;
  cfdaList: string[];
  synopsis?: {
    synopsisDesc: string;
  };
};

export type SamGovOpportunity = {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  department: string;
  subTier: string;
  postedDate: string;
  responseDeadLine: string | null;
  description: string;
  naicsCode: string;
  classificationCode: string;
  active: string;
  award: {
    amount: string;
  } | null;
};

/**
 * Fetch opportunities from Grants.gov API with multiple search strategies
 * to get comprehensive defense and dual-use opportunities
 */
export async function fetchGrantsGovOpportunities(
  limit: number = 100,
  keywords?: string
): Promise<FeedItem[]> {
  const allItems: FeedItem[] = [];

  // Define multiple search strategies to get comprehensive coverage
  const searchStrategies = [
    {
      // General recent opportunities
      oppStatuses: "posted|forecasted",
      sortBy: "openDate|desc",
      rows: limit,
      ...(keywords ? { keyword: keywords } : {}),
    },
    {
      // Defense and DoD opportunities
      oppStatuses: "posted|forecasted",
      sortBy: "openDate|desc",
      rows: 50,
      keyword: "defense DOD department",
    },
    {
      // SBIR/STTR opportunities
      oppStatuses: "posted|forecasted",
      sortBy: "openDate|desc",
      rows: 50,
      keyword: "SBIR STTR",
    },
  ];

  const results = await Promise.allSettled(
    searchStrategies.map(async (strategy) => {
      // Remove empty/undefined values - API doesn't like empty strings
      const requestBody: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(strategy)) {
        if (value !== "" && value !== null && value !== undefined) {
          requestBody[key] = value;
        }
      }

      const response = await fetch(GRANTS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Grants.gov] API error: ${response.status} - ${errorText}`);
        return [];
      }

      const data = await response.json();
      const opportunities = data.oppHits || data.data?.oppHits || [];

      return opportunities.map((opp: GrantsGovOpportunity, index: number) => ({
        id: opp.id || `grants-${opp.number}-${index}`,
        source: "grants" as const,
        title: opp.title,
        url: `https://www.grants.gov/search-results-detail/${opp.id}`,
        publishedAt: toISODate(opp.openDate) || new Date().toISOString(),
        summary: opp.synopsis?.synopsisDesc || `${opp.agency} funding opportunity. CFDA: ${opp.cfdaList.join(", ")}`,
        tags: ["grant", "funding", opp.agency?.toLowerCase() || "", ...opp.cfdaList.map((cfda: string) => `cfda-${cfda}`)].filter(Boolean),
        score: 0,
      }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      console.error("[Grants.gov] Failed to fetch opportunities:", result.reason);
    }
  }

  // Deduplicate by ID
  const uniqueItems = new Map<string, FeedItem>();
  for (const item of allItems) {
    if (!uniqueItems.has(item.id)) {
      uniqueItems.set(item.id, item);
    }
  }

  return Array.from(uniqueItems.values());
}

/**
 * Fetch opportunities from SAM.gov API with multiple search strategies
 * to get comprehensive defense and technology contract opportunities
 */
export async function fetchSamGovOpportunities(
  limit: number = 100,
  keywords?: string
): Promise<FeedItem[]> {
  if (!SAM_API_KEY) {
    console.warn("[SAM.gov] API key not configured. Skipping SAM.gov fetch.");
    return [];
  }

  const allItems: FeedItem[] = [];

  // Define multiple search strategies for comprehensive coverage
  const searchStrategies = [
    {
      // General recent opportunities
      limit: limit.toString(),
      postedFrom: getDateDaysAgo(30),
      postedTo: getCurrentDate(),
      qterms: keywords,
    },
    {
      // DoD opportunities
      limit: "50",
      postedFrom: getDateDaysAgo(45),
      postedTo: getCurrentDate(),
      qterms: "Department Defense",
    },
    {
      // SBIR/STTR opportunities
      limit: "25",
      postedFrom: getDateDaysAgo(60),
      postedTo: getCurrentDate(),
      qterms: "SBIR STTR",
    },
  ];

  const results = await Promise.allSettled(
    searchStrategies.map(async (strategy) => {
      const paramEntries: Record<string, string> = {
        api_key: SAM_API_KEY,
        limit: strategy.limit,
        postedFrom: strategy.postedFrom,
        postedTo: strategy.postedTo,
      };
      if (strategy.qterms) {
        paramEntries.qterms = strategy.qterms;
      }
      const params = new URLSearchParams(paramEntries);
      const url = `${SAM_API_URL}?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        console.warn(`[SAM.gov] API error for strategy: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const opportunities = data.opportunitiesData || [];

      return opportunities.map((opp: SamGovOpportunity, index: number) => ({
        id: opp.noticeId || `sam-${opp.solicitationNumber}-${index}`,
        source: "contracts" as const,
        title: opp.title,
        url: `https://sam.gov/opp/${opp.noticeId}/view`,
        publishedAt: toISODate(opp.postedDate) || new Date().toISOString(),
        summary: opp.description?.substring(0, 500) || `Contract opportunity from ${opp.department}`,
        tags: ["contract", "procurement", opp.department?.toLowerCase() || "", opp.classificationCode?.toLowerCase() || ""].filter(Boolean),
        score: 0,
      }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      console.error("[SAM.gov] Failed to fetch opportunities:", result.reason);
    }
  }

  // Deduplicate by ID
  const uniqueItems = new Map<string, FeedItem>();
  for (const item of allItems) {
    if (!uniqueItems.has(item.id)) {
      uniqueItems.set(item.id, item);
    }
  }

  return Array.from(uniqueItems.values());
}

/**
 * Single targeted query to Grants.gov using user preference keywords.
 * Used for live per-user fetching on feed load — much lighter than the full sync.
 */
export async function fetchGrantsForKeywords(keyword: string, limit: number = 20): Promise<FeedItem[]> {
  const requestBody = {
    oppStatuses: "posted|forecasted",
    sortBy: "openDate|desc",
    rows: limit,
    keyword,
  };

  try {
    const response = await fetch(GRANTS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`[Grants.gov] Targeted fetch error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const opportunities = data.oppHits || data.data?.oppHits || [];

    return opportunities.map((opp: GrantsGovOpportunity, index: number) => ({
      id: opp.id || `grants-${opp.number}-${index}`,
      source: "grants" as const,
      title: opp.title,
      url: `https://www.grants.gov/search-results-detail/${opp.id}`,
      publishedAt: toISODate(opp.openDate) || new Date().toISOString(),
      summary: opp.synopsis?.synopsisDesc || `${opp.agency} funding opportunity. CFDA: ${opp.cfdaList.join(", ")}`,
      tags: ["grant", "funding", opp.agency?.toLowerCase() || "", ...opp.cfdaList.map((cfda: string) => `cfda-${cfda}`)].filter(Boolean),
      score: 0,
    }));
  } catch (error) {
    console.warn("[Grants.gov] Targeted fetch failed:", error);
    return [];
  }
}

/**
 * Single targeted query to SAM.gov using user preference keywords.
 * Used for live per-user fetching on feed load — much lighter than the full sync.
 */
export async function fetchSamForKeywords(keyword: string, limit: number = 20): Promise<FeedItem[]> {
  if (!SAM_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      api_key: SAM_API_KEY,
      limit: limit.toString(),
      postedFrom: getDateDaysAgo(30),
      postedTo: getCurrentDate(),
      qterms: keyword,
    });

    const response = await fetch(`${SAM_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.warn(`[SAM.gov] Targeted fetch error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const opportunities = data.opportunitiesData || [];

    return opportunities.map((opp: SamGovOpportunity, index: number) => ({
      id: opp.noticeId || `sam-${opp.solicitationNumber}-${index}`,
      source: "contracts" as const,
      title: opp.title,
      url: `https://sam.gov/opp/${opp.noticeId}/view`,
      publishedAt: toISODate(opp.postedDate) || new Date().toISOString(),
      summary: opp.description?.substring(0, 500) || `Contract opportunity from ${opp.department}`,
      tags: ["contract", "procurement", opp.department?.toLowerCase() || "", opp.classificationCode?.toLowerCase() || ""].filter(Boolean),
      score: 0,
    }));
  } catch (error) {
    console.warn("[SAM.gov] Targeted fetch failed:", error);
    return [];
  }
}

/**
 * Parse a date string (MM/DD/YYYY or other formats) into an ISO string.
 * Returns null if parsing fails.
 */
function toISODate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  // Try direct Date parsing first (handles ISO, RFC2822, etc.)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  // Try MM/DD/YYYY explicitly
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/**
 * Helper function to get current date in MM/DD/YYYY format
 */
function getCurrentDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Helper function to get date N days ago in MM/DD/YYYY format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

