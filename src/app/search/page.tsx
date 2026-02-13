"use client";

import { useEffect, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { SearchBar } from "@/components/SearchBar";
import { FeedList } from "@/components/FeedList";
import type { FeedItem } from "@/types/feed";

export default function SearchPage() {
  const [query, setQuery] = useState("dual-use autonomy");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

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

        const data = (await res.json()) as { items: FeedItem[] };
        if (!cancelled) {
          setItems(data.items);
        }

        if (!cancelled) {
          window.localStorage.setItem("last_search_query", effectiveQuery);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("We couldn’t search the feed right now. Try again in a moment.");
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

  const filteredItems = items.filter((item) => {
    if (!item.publishedAt) return true;
    const itemDate = new Date(item.publishedAt);
    if (fromDate) {
      const from = new Date(fromDate);
      if (itemDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      if (itemDate > new Date(to.getTime() + 24 * 60 * 60 * 1000)) return false;
    }
    return true;
  });

  return (
    <LayoutShell>
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-5">
          <SearchBar
            initialQuery={query}
            onSearch={handleSearch}
            loading={loading}
          />
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3 text-[11px] text-zinc-300">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-400">From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-400">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="mt-4 rounded-full border border-white/15 px-3 py-1 text-[11px] text-zinc-300 hover:border-blue-400 hover:text-blue-100"
              >
                Clear date filter
              </button>
            )}
          </div>
          <FeedList items={filteredItems} query={query} />
        </section>

        <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-200">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Search across all signals
          </h2>
          <p className="text-xs text-zinc-300">
            This view ignores your long-lived preference topics and lets you ad‑hoc search
            across everything we&apos;ve ingested from Defense News, DoD and federal
            grants.
          </p>
        </aside>
      </div>
    </LayoutShell>
  );
}

