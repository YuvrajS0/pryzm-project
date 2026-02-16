"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { FeedList } from "@/components/FeedList";
import { HomeSidebar } from "@/components/HomeSidebar";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import type { FeedItem, FeedSource } from "@/types/feed";
import { supabase } from "@/lib/supabaseClient";

type FeedTab = "for_you" | "latest";

const SOURCE_FILTERS: { value: FeedSource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "defense_news", label: "Defense" },
  { value: "grants", label: "Grants" },
  { value: "contracts", label: "SAM.gov" },
];

export default function Home() {
  const [forYouItems, setForYouItems] = useState<FeedItem[]>([]);
  const [latestItems, setLatestItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>("for_you");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [latestSourceFilter, setLatestSourceFilter] = useState<FeedSource | "all">("all");

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

      setIsLoggedIn(true);
      setUserId(user.id);

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

      setPreferences(topics);

      if (
        topics.length === 0 &&
        !window.localStorage.getItem("onboarding_completed")
      ) {
        setShowOnboarding(true);
        setHasLoadedPreferences(true);
        return;
      }

      if (topics.length > 0) {
        await loadFeedFromPreferences(topics);
      }

      setHasLoadedPreferences(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadFeedFromPreferences(topics: string[]) {
    const query = topics.join(" ");
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

      const data = (await res.json()) as { for_you: FeedItem[]; latest: FeedItem[] };
      setForYouItems(data.for_you);
      setLatestItems(data.latest);
    } catch (err) {
      console.error(err);
      setError("We couldn't curate your feed right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const filteredLatestItems = useMemo(() => {
    if (latestSourceFilter === "all") return latestItems;
    return latestItems.filter((item) => item.source === latestSourceFilter);
  }, [latestItems, latestSourceFilter]);

  const displayItems =
    activeTab === "for_you" ? forYouItems : filteredLatestItems;

  return (
    <>
    {showOnboarding && userId && (
      <OnboardingFlow
        userId={userId}
        onComplete={() => {
          setShowOnboarding(false);
          // Reload the page to pick up new preferences
          window.location.reload();
        }}
      />
    )}
    <LayoutShell
      pageTitle="Home"
      sidebar={
        <HomeSidebar
          items={forYouItems}
          preferences={preferences}
          isLoggedIn={isLoggedIn}
        />
      }
    >
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("for_you")}
          className={`flex-1 py-3 text-center text-[14px] font-medium transition-colors ${
            activeTab === "for_you"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-secondary hover:bg-surface-hover"
          }`}
        >
          For you
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("latest")}
          className={`flex-1 py-3 text-center text-[14px] font-medium transition-colors ${
            activeTab === "latest"
              ? "border-b-2 border-accent text-text-primary"
              : "text-text-secondary hover:bg-surface-hover"
          }`}
        >
          Latest
        </button>
      </div>

      {/* Source filter for Latest tab */}
      {activeTab === "latest" && latestItems.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2">
          {SOURCE_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLatestSourceFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                latestSourceFilter === opt.value
                  ? "bg-accent text-white"
                  : "border border-border text-text-secondary hover:border-accent hover:text-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-b border-border px-4 py-3">
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        </div>
      )}

      {/* Empty state for no preferences */}
      {!loading && hasLoadedPreferences && forYouItems.length === 0 && latestItems.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] font-bold text-text-primary">
            Welcome to Yuvraj-Pryzm
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            <a href="/account" className="text-accent hover:underline">
              Set your preferences
            </a>{" "}
            to start curating your feed.
          </p>
        </div>
      )}

      {/* Feed */}
      <FeedList items={displayItems} query="" showRank={activeTab === "for_you"} />
    </LayoutShell>
    </>
  );
}
