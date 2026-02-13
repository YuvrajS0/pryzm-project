"use client";

import { useEffect, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { SearchBar } from "@/components/SearchBar";
import { FeedList } from "@/components/FeedList";
import type { FeedItem } from "@/types/feed";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [baseQuery, setBaseQuery] = useState("");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  // If the user has saved preferences, build the feed query from those topics
  // and automatically populate the feed
  useEffect(() => {
    if (!supabase) {
      setHasLoadedPreferences(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user || cancelled) {
        setHasLoadedPreferences(true);
        return;
      }

      const { data: prefs, error } = await supabase
        .from("user_preferences")
        .select("topic")
        .order("created_at", { ascending: true });

      if (error || cancelled) {
        setHasLoadedPreferences(true);
        return;
      }

      const topics =
        prefs?.map((row: { topic: string }) => row.topic.trim()).filter(Boolean) ?? [];

      if (topics.length > 0) {
        const query = topics.join(" ");
        setBaseQuery(query);

        // Auto-fetch feed based on user preferences
        setLoading(true);
        setError(null);

        try {
          const res = await fetch("/api/feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });

          if (!res.ok) {
            throw new Error("Failed to fetch feed");
          }

          const data = (await res.json()) as { items: FeedItem[] };
          if (!cancelled) {
            setItems(data.items);
          }
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setError("We couldn't curate your feed right now. Try again in a moment.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
            setHasLoadedPreferences(true);
          }
        }
      } else {
        setHasLoadedPreferences(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  async function handleSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setBaseQuery(trimmed);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch feed");
      }

      const data = (await res.json()) as { items: FeedItem[] };
      setItems(data.items);
      window.localStorage.setItem("last_query", trimmed);
    } catch (err) {
      console.error(err);
      setError("We couldn't curate your feed right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
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
      // include items on the 'to' date
      if (itemDate > new Date(to.getTime() + 24 * 60 * 60 * 1000)) return false;
    }
    return true;
  });

  return (
    <LayoutShell>
      <div className="max-w-5xl mx-auto">
        <section className="space-y-5">
          <SearchBar
            initialQuery={baseQuery}
            onSearch={handleSearch}
            loading={loading || !hasLoadedPreferences}
          />
          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          )}
          {!loading && hasLoadedPreferences && items.length > 0 && baseQuery && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-blue-100">
              <p className="font-medium mb-1">Showing recent signals based on your preferences</p>
              <p className="text-blue-200/80">
                Use the search bar above to find more specific opportunities or different topics
              </p>
            </div>
          )}
          {!loading && hasLoadedPreferences && items.length === 0 && !baseQuery && (
            <div className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-4 py-3 text-xs text-zinc-300">
              <p className="font-medium mb-1">No feed preferences set</p>
              <p className="text-zinc-400">
                Search for topics above or visit your{" "}
                <a href="/account" className="text-blue-400 hover:text-blue-300 underline">
                  account page
                </a>{" "}
                to set long-term preferences
              </p>
            </div>
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
          <FeedList items={filteredItems} query={baseQuery} />
        </section>
      </div>
    </LayoutShell>
  );
}

