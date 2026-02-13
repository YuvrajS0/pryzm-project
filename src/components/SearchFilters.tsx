"use client";

import type { FeedSource } from "@/types/feed";

type SortMode = "relevance" | "newest";
type TimeRange = "any" | "24h" | "week" | "month";

type SearchFiltersProps = {
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  sourceFilter: FeedSource | "all";
  onSourceFilterChange: (source: FeedSource | "all") => void;
};

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
];

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "24h", label: "24h" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const SOURCE_OPTIONS: { value: FeedSource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "defense_news", label: "Defense" },
  { value: "grants", label: "Grants" },
  { value: "contracts", label: "SAM.gov" },
];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "border border-border text-text-secondary hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

export function SearchFilters({
  sort,
  onSortChange,
  timeRange,
  onTimeRangeChange,
  sourceFilter,
  onSourceFilterChange,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {/* Sort */}
      <div className="flex items-center gap-1">
        {SORT_OPTIONS.map((opt) => (
          <Pill
            key={opt.value}
            active={sort === opt.value}
            onClick={() => onSortChange(opt.value)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>

      <span className="h-4 w-px bg-border" />

      {/* Time range */}
      <div className="flex items-center gap-1">
        {TIME_OPTIONS.map((opt) => (
          <Pill
            key={opt.value}
            active={timeRange === opt.value}
            onClick={() => onTimeRangeChange(opt.value)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>

      <span className="h-4 w-px bg-border" />

      {/* Source */}
      <div className="flex items-center gap-1">
        {SOURCE_OPTIONS.map((opt) => (
          <Pill
            key={opt.value}
            active={sourceFilter === opt.value}
            onClick={() => onSourceFilterChange(opt.value)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}

export type { SortMode, TimeRange };
