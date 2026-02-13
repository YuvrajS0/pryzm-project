"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { SearchBar } from "@/components/SearchBar";
import { FeedList } from "@/components/FeedList";
import { SearchFilters } from "@/components/SearchFilters";
import type { SortMode, TimeRange } from "@/components/SearchFilters";
import type { FeedItem, FeedSource } from "@/types/feed";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [sort, setSort] = useState<SortMode>("relevance");
  const [timeRange, setTimeRange] = useState<TimeRange>("any");
  const [sourceFilter, setSourceFilter] = useState<FeedSource | "all">("all");

  useEffect(() => {
    const last = window.localStorage.getItem("last_search_query");
    if (last) {
      setQuery(last);
    }
  }, []);

  useEffect(() => {
    const effectiveQuery = query.trim();
    if (!effectiveQuery) return;

    let cancelled = false;

    async function fetchFeed() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: effectiveQuery }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch feed");
        }

        const data = (await res.json()) as { for_you: FeedItem[]; latest: FeedItem[] };
        if (!cancelled) {
          setItems(data.for_you);
        }

        if (!cancelled) {
          window.localStorage.setItem("last_search_query", effectiveQuery);
          // Save to recent searches
          try {
            const stored = window.localStorage.getItem("recent_searches");
            const recent: string[] = stored ? JSON.parse(stored) : [];
            const deduped = [effectiveQuery, ...recent.filter((s) => s !== effectiveQuery)].slice(0, 10);
            window.localStorage.setItem("recent_searches", JSON.stringify(deduped));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("We couldn't search the feed right now. Try again in a moment.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchFeed();

    return () => {
      cancelled = true;
    };
  }, [query]);

  function handleSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setQuery(trimmed);
  }

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    let result = items;

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter((item) => item.source === sourceFilter);
    }

    // Time range filter
    if (timeRange !== "any") {
      const now = Date.now();
      const cutoff = {
        "24h": now - 24 * 60 * 60 * 1000,
        week: now - 7 * 24 * 60 * 60 * 1000,
        month: now - 30 * 24 * 60 * 60 * 1000,
      }[timeRange];

      result = result.filter((item) => {
        if (!item.publishedAt) return false;
        return new Date(item.publishedAt).getTime() >= cutoff;
      });
    }

    // Sort
    if (sort === "newest") {
      result = [...result].sort((a, b) => {
        const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bDate - aDate;
      });
    }

    return result;
  }, [items, sort, timeRange, sourceFilter]);

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("recent_searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const searchSidebar = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-lg font-bold text-text-primary">Search Tips</h3>
        <ul className="space-y-2 text-[13px] text-text-secondary">
          <li>Combine keywords for better results</li>
          <li>Try source-specific terms like &quot;SBIR&quot; or &quot;BAA&quot;</li>
          <li>Use domain terms: &quot;autonomous&quot;, &quot;cyber&quot;, &quot;hypersonics&quot;</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-lg font-bold text-text-primary">Suggested</h3>
        <div className="flex flex-wrap gap-2">
          {[
            "SBIR opportunities",
            "autonomous systems",
            "cyber defense",
            "space ISR",
            "directed energy",
            "counter-UAS",
          ].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => handleSearch(term)}
              className="rounded-full border border-border px-3 py-1 text-[13px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <LayoutShell pageTitle="Search" sidebar={searchSidebar}>
      {/* Search bar */}
      <div className="border-b border-border px-4 py-3">
        <SearchBar
          initialQuery={query}
          onSearch={handleSearch}
          loading={loading}
        />
      </div>

      {/* Discovery: recent searches (shown when no query) */}
      {!query && (
        <div className="divide-y divide-border">
          {recentSearches.length > 0 && (
            <div className="px-4 py-4">
              <h3 className="mb-3 text-[15px] font-bold text-text-primary">
                Recent Searches
              </h3>
              <div className="space-y-1">
                {recentSearches.slice(0, 5).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSearch(term)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[14px] text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    <span className="text-text-tertiary">&#128336;</span>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!recentSearches.length && (
            <div className="px-4 py-10 text-center">
              <p className="text-[15px] font-bold text-text-primary">
                Explore signals
              </p>
              <p className="mt-2 text-[13px] text-text-secondary">
                Search across Defense News, Grants.gov, SAM.gov and more.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filters (shown when there's a query) */}
      {query && (
        <SearchFilters
          sort={sort}
          onSortChange={setSort}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
        />
      )}

      {/* Error */}
      {error && (
        <div className="border-b border-border px-4 py-3">
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        </div>
      )}

      {/* Result count */}
      {!loading && query && filteredItems.length > 0 && (
        <div className="border-b border-border px-4 py-2 text-[13px] text-text-secondary">
          {filteredItems.length} signal{filteredItems.length !== 1 ? "s" : ""} for &quot;{query}&quot;
        </div>
      )}

      {/* Feed results */}
      <FeedList items={filteredItems} query={query} />
    </LayoutShell>
  );
}
