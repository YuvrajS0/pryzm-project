"use client";

import { useEffect, useState } from "react";
import { LayoutShell } from "@/components/LayoutShell";
import { FeedList } from "@/components/FeedList";
import type { FeedItem } from "@/types/feed";
import { supabase } from "@/lib/supabaseClient";

export default function BookmarksPage() {
  const [bookmarkedItems, setBookmarkedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        console.debug("[Bookmarks Page] Starting bookmark load");
        const { data } = await supabase.auth.getUser();
        const user = (data as any)?.user;

        console.debug("[Bookmarks Page] User:", user?.id);

        // Start with localStorage bookmarks as fallback
        let bookmarkedIds: string[] = [];
        if (typeof window !== "undefined") {
          try {
            const stored = window.localStorage.getItem("bookmarked_items");
            console.debug("[Bookmarks Page] localStorage bookmarked_items:", stored);
            if (stored) {
              bookmarkedIds = JSON.parse(stored) as string[];
              console.debug("[Bookmarks Page] Parsed localStorage bookmarks:", bookmarkedIds.length, bookmarkedIds);
            }
          } catch (e) {
            console.error("[Bookmarks Page] Error parsing localStorage:", e);
          }
        }

        if (!user) {
          console.debug("[Bookmarks Page] User not logged in, using localStorage only");
          setIsLoggedIn(false);
          // Load from localStorage only for anonymous users
          if (bookmarkedIds.length === 0) {
            console.debug("[Bookmarks Page] No bookmarks found");
            if (!cancelled) {
              setBookmarkedItems([]);
            }
            setLoading(false);
            return;
          }
        } else {
          console.debug("[Bookmarks Page] User logged in, fetching from Supabase");
          setIsLoggedIn(true);

          // Try to fetch from Supabase for authenticated users
          const { data: bookmarks, error: bookmarkError } = await supabase
            .from("user_bookmarks")
            .select("item_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          console.debug("[Bookmarks Page] Supabase result:", { bookmarkError, bookmarksCount: bookmarks?.length });
          if (!bookmarkError && bookmarks && bookmarks.length > 0) {
            // Use Supabase bookmarks if available
            bookmarkedIds = bookmarks.map((row) => row.item_id);
            console.debug("[Bookmarks Page] Using Supabase bookmarks:", bookmarkedIds.length, bookmarkedIds);
          } else if (bookmarkError) {
            console.warn("[Bookmarks Page] Supabase error:", bookmarkError);
          } else {
            console.debug("[Bookmarks Page] No Supabase bookmarks, using localStorage fallback");
          }
          // If Supabase fails or is empty, use localStorage fallback
        }

        console.debug("[Bookmarks Page] Final bookmarkedIds:", bookmarkedIds.length, bookmarkedIds);

        if (bookmarkedIds.length === 0) {
          console.debug("[Bookmarks Page] No bookmarks to display");
          if (!cancelled) {
            setBookmarkedItems([]);
          }
          setLoading(false);
          return;
        }

        console.debug("[Bookmarks Page] Fetching feed items for URLs:", bookmarkedIds);
        
        // Check if item_ids are actual UUIDs or URLs
        const isUrlBased = bookmarkedIds.some(id => id.startsWith('http'));
        console.debug("[Bookmarks Page] URL-based bookmarks:", isUrlBased);
        
        let items;
        let itemError;

        if (isUrlBased) {
          // Try fetching by URL first
          console.debug("[Bookmarks Page] Fetching by exact URL...");
          const result = await supabase
            .from("feed_items")
            .select(
              "id, source, title, url, published_at, summary, tags",
            )
            .in("url", bookmarkedIds);
          items = result.data;
          itemError = result.error;
          console.debug("[Bookmarks Page] Exact URL result:", items?.length ?? 0);
          
          // If no results, try with normalized URLs (remove trailing slash)
          if (!items || items.length === 0) {
            console.debug("[Bookmarks Page] No exact URL matches. Trying normalized URLs...");
            const normalizedUrls = bookmarkedIds.map(url => 
              typeof url === 'string' && url.endsWith('/') ? url.slice(0, -1) : url
            );
            const result2 = await supabase
              .from("feed_items")
              .select(
                "id, source, title, url, published_at, summary, tags",
              )
              .in("url", normalizedUrls);
            items = result2.data;
            itemError = result2.error;
            console.debug("[Bookmarks Page] Normalized URL result:", items?.length ?? 0);
          }
          
          // If still no results, try to find matches by extracting domain + article ID patterns
          if (!items || items.length === 0) {
            console.debug("[Bookmarks Page] Still no matches. Trying domain/path pattern matching...");
            // Fetch all feed_items and do client-side fuzzy matching
            const { data: allItems } = await supabase
              .from("feed_items")
              .select("id, source, title, url, published_at, summary, tags");
            
            console.debug("[Bookmarks Page] Total feed_items in DB:", allItems?.length ?? 0);
            if (allItems && allItems.length > 0) {
              console.debug("[Bookmarks Page] Sample URLs from feed_items:", allItems.slice(0, 3).map(i => i.url));
            }
            
            // Try to find matches by comparing normalized domains and paths
            const matchedItems = allItems?.filter(feedItem => {
              return bookmarkedIds.some(bookmarkedUrl => {
                const bookmarkedNorm = bookmarkedUrl.toLowerCase().replace(/\/$/, '');
                const feedItemNorm = feedItem.url.toLowerCase().replace(/\/$/, '');
                // Check exact match after normalization
                if (bookmarkedNorm === feedItemNorm) return true;
                // Check if URL is contained (for cases where bookmarked URL is truncated in logs)
                if (feedItemNorm.includes(bookmarkedNorm) || bookmarkedNorm.includes(feedItemNorm)) return true;
                return false;
              });
            }) ?? [];
            
            items = matchedItems;
            console.debug("[Bookmarks Page] Pattern matched result:", items.length);
          }
        } else {
          // Fetch by ID (for properly stored feed_items.id values)
          console.debug("[Bookmarks Page] Fetching by feed_items.id...");
          const result = await supabase
            .from("feed_items")
            .select(
              "id, source, title, url, published_at, summary, tags",
            )
            .in("id", bookmarkedIds);
          items = result.data;
          itemError = result.error;
        }

        console.debug("[Bookmarks Page] Feed items result:", { itemError, itemsCount: items?.length });

        if (itemError) {
          console.error("[Bookmarks Page] Error fetching items:", itemError);
          if (!cancelled) {
            const errorMsg = typeof itemError === 'object' ? (itemError as any).message || JSON.stringify(itemError) : String(itemError);
            setError(`Failed to load bookmarked items: ${errorMsg}`);
          }
          setLoading(false);
          return;
        }

        const feedItems =
          items?.map((row) => ({
            id: row.id,
            source: row.source,
            title: row.title,
            url: row.url,
            publishedAt: row.published_at as string | null,
            summary: row.summary,
            tags: (row.tags ?? []) as string[],
            score: 0,
            isBookmarked: true,
          })) ?? [];

        console.debug("[Bookmarks Page] Mapped feed items:", feedItems.length);
        if (!cancelled) {
          setBookmarkedItems(feedItems);
        }
      } catch (err) {
        console.error("[Bookmarks Page] Unexpected error:", err);
        if (!cancelled) {
          setError("An unexpected error occurred");
        }
      } finally {
        console.debug("[Bookmarks Page] Loading complete");
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LayoutShell pageTitle="Bookmarks">
      {!supabase && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13px] text-warning">
            Supabase is not configured. Bookmarks are not available.
          </p>
        </div>
      )}

      {supabase && loading && (
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] font-bold text-text-primary">
            Loading bookmarks...
          </p>
        </div>
      )}

      {supabase && !loading && !isLoggedIn && (
        <div className="px-4 py-10 text-center">
          <p className="text-[15px] font-bold text-text-primary">
            Sign in to view bookmarks
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            <a href="/account" className="text-accent hover:underline">
              Go to Settings
            </a>{" "}
            to sign in.
          </p>
        </div>
      )}

      {supabase && !loading && isLoggedIn && error && (
        <div className="border-b border-border px-4 py-3">
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        </div>
      )}

      {supabase &&
        !loading &&
        isLoggedIn &&
        !error &&
        bookmarkedItems.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] font-bold text-text-primary">
              No bookmarks yet
            </p>
            <p className="mt-2 text-[13px] text-text-secondary">
              Bookmark interesting items from your feed to see them here.
            </p>
          </div>
        )}

      {bookmarkedItems.length > 0 && (
        <FeedList items={bookmarkedItems} query="bookmarks" />
      )}
    </LayoutShell>
  );
}
