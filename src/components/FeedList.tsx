"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedItem } from "@/types/feed";
import { FeedCard } from "./FeedCard";
import { InlineFeedPrompt } from "./InlineFeedPrompt";
import { useToast } from "./Toast";
import { trackShare, trackClick } from "@/lib/engagement";

type FeedListProps = {
  items: FeedItem[];
  query: string;
};

export function FeedList({ items }: FeedListProps) {
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
        rank={i}
        onShare={handleShare}
      />,
    );

    // Track clicks when card links are clicked (via delegation)
    // Insert inline prompts at position 20
    if (i === 19) {
      elements.push(
        <InlineFeedPrompt
          key="prompt-feedback"
          variant="feedback"
          onFeedbackPositive={() => showToast("Thanks for the feedback!")}
          onFeedbackNegative={() => showToast("We'll adjust your feed")}
        />,
      );
    }
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
