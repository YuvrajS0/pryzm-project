"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

type SearchBarProps = {
  initialQuery?: string;
  onSearch: (query: string) => void;
  loading?: boolean;
};

export function SearchBar({ initialQuery, onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState(initialQuery ?? "");

  useEffect(() => {
    if (initialQuery != null) {
      setValue(initialQuery);
    }
  }, [initialQuery]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }

  function handleClear() {
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
    >
      <Search className="h-5 w-5 shrink-0 text-text-secondary" />
      <input
        type="text"
        placeholder="Search signals..."
        className="flex-1 border-none bg-transparent text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      {value && !loading && (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full p-1 transition-colors hover:bg-surface-hover"
          aria-label="Clear search"
        >
          <X className="h-4 w-4 text-text-secondary" />
        </button>
      )}
      {loading && (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}
    </form>
  );
}
