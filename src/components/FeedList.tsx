"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedItem } from "@/types/feed";
import { FeedCard } from "./FeedCard";
import { useToast } from "./Toast";
import { trackShare, trackClick } from "@/lib/engagement";

type FeedListProps = {
  items: FeedItem[];
  query: string;
  showRank?: boolean;
};

export function FeedList({ items, showRank = false }: FeedListProps) {
  const { showToast } = useToast();

  const handleShare = useCallback(
    (item: FeedItem) => {
      trackShare(item.id);
      navigator.clipboard.writeText(item.url).then(
        () =>
          Promise.resolve().then(() => {
            showToast("Link copied");
          }),
        () =>
          Promise.resolve().then(() => {
            showToast("Could not copy link");
          }),
      );
    },
    [showToast],
  );



  if (!items.length) {
    return null;
  }

  // Build the feed with inline prompts inserted at intervals
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    elements.push(
      <FeedCard
        key={item.id}
        item={item}
        rank={showRank ? i : undefined}
        onShare={handleShare}
      />,
    );

  }

  return (
    <div
      onClick={(e) => {
        // Track clicks on feed card links
        const target = e.target as HTMLElement;
        const link = target.closest("a[target='_blank']");
        if (link) {
          const card = link.closest("article");
          const itemId = card?.querySelector("[data-item-id]")?.getAttribute("data-item-id");
          if (itemId) trackClick(itemId);
        }
      }}
    >
      {elements}
    </div>
  );
}
