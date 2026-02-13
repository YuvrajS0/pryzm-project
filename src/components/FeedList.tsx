"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import type { FeedItem } from "@/types/feed";

type FeedListProps = {
  items: FeedItem[];
  query: string;
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

export function FeedList({ items, query }: FeedListProps) {
  const grouped = useMemo(() => {
    const top = items.slice(0, 10);
    const rest = items.slice(10);
    return { top, rest };
  }, [items]);

  if (!items.length) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        No signals yet. Try a more general phrase like{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          dual-use AI
        </span>
        ,{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          EW
        </span>{" "}
        or{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-100">
          autonomy
        </span>
        .
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Top signals for “{query}”
        </h2>
        <div className="space-y-3">
          {grouped.top.map((item) => (
            <Card key={item.id} item={item} highlight />
          ))}
        </div>
      </section>

      {grouped.rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            More to scan
          </h2>
          <div className="space-y-2.5">
            {grouped.rest.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type CardProps = {
  item: FeedItem;
  highlight?: boolean;
};

function Card({ item, highlight }: CardProps) {
  const published =
    item.publishedAt != null
      ? formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
      : "Unknown";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={`block rounded-2xl border px-4 py-3.5 transition hover:border-blue-500 hover:bg-blue-50/60 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/5 ${
        highlight
          ? "border-blue-100 bg-blue-50/40 shadow-sm dark:border-blue-900/60 dark:bg-blue-900/20"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm flex items-center justify-center">
          {sourceLabel(item.source)
            .split(" ")
            .map((w) => w[0])
            .join("")}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="font-medium text-blue-700 dark:text-blue-300">
              {sourceLabel(item.source)}
            </span>
            <span>•</span>
            <span>{published}</span>
            {item.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <h3 className="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {item.title}
          </h3>
          {item.summary && (
            <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.summary}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

