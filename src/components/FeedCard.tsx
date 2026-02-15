"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Share2, ExternalLink, BadgeCheck, Zap, Bookmark } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import { toggleBookmark, getBookmarkedIds } from "@/lib/engagement";

type FeedCardProps = {
  item: FeedItem;
  rank?: number;
  onShare?: (item: FeedItem) => void;
  onBookmarkChange?: (itemId: string, bookmarked: boolean) => void;
};

function sourceLabel(source: FeedItem["source"]) {
  switch (source) {
    case "defense_news":
      return "Defense News";
    case "grants":
      return "Grants.gov";
    case "contracts":
      return "SAM.gov";
    default:
      return "Source";
  }
}

function sourceHandle(source: FeedItem["source"]) {
  switch (source) {
    case "defense_news":
      return "@defense_news";
    case "grants":
      return "@grants_gov";
    case "contracts":
      return "@sam_gov";
    default:
      return "@source";
  }
}

function sourceGradient(source: FeedItem["source"]) {
  switch (source) {
    case "defense_news":
      return "from-blue-500 to-indigo-600";
    case "grants":
      return "from-emerald-500 to-green-600";
    case "contracts":
      return "from-amber-500 to-orange-600";
    default:
      return "from-zinc-500 to-zinc-600";
  }
}

function isGovSource(source: FeedItem["source"]) {
  return source === "grants" || source === "contracts";
}

export function FeedCard({ item, rank, onShare, onBookmarkChange }: FeedCardProps) {
  const [bookmarked, setBookmarked] = useState(() => getBookmarkedIds().has(item.id));

  const published =
    item.publishedAt != null
      ? formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
      : null;

  const initials = sourceLabel(item.source)
    .split(" ")
    .map((w) => w[0])
    .join("");

  const isTopSignal = rank != null && rank < 3;

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    const isNow = toggleBookmark(item.id);
    setBookmarked(isNow);
    onBookmarkChange?.(item.id, isNow);
  }

  return (
    <article className="relative px-4 py-3 transition-colors hover:bg-surface-hover feed-divider">
      {isTopSignal && (
        <div className="mb-1 flex items-center gap-1 pl-13">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-[12px] font-bold text-accent">Top Signal</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Source Avatar */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold uppercase tracking-wide text-white ${sourceGradient(item.source)}`}
        >
          {initials}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header line: source name, badge, handle, time */}
          <div className="flex items-center gap-1 text-[14px]">
            <span className="font-bold text-text-primary">
              {sourceLabel(item.source)}
            </span>
            {isGovSource(item.source) && (
              <BadgeCheck className="h-4 w-4 text-accent" />
            )}
            <span className="text-text-secondary">{sourceHandle(item.source)}</span>
            {published && (
              <>
                <span className="text-text-secondary">·</span>
                <span className="text-text-secondary">{published}</span>
              </>
            )}
          </div>

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-[15px] font-bold leading-snug text-text-primary hover:underline"
          >
            {item.title}
          </a>

          {/* Summary */}
          {item.summary && (
            <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-text-secondary">
              {item.summary}
            </p>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[12px] font-medium text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="mt-2 -ml-2 flex items-center gap-6">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onShare?.(item);
              }}
              className="group flex items-center gap-1 rounded-full p-2 transition-colors hover:bg-accent-muted"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-accent" />
            </button>

            <button
              type="button"
              onClick={handleBookmark}
              className="group flex items-center gap-1 rounded-full p-2 transition-colors hover:bg-accent-muted"
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Bookmark className={`h-4 w-4 transition-colors ${bookmarked ? "fill-accent text-accent" : "text-text-tertiary group-hover:text-accent"}`} />
            </button>

            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-1 rounded-full p-2 transition-colors hover:bg-accent-muted"
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-accent" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
