"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type SearchBarProps = {
  initialQuery?: string;
  onSearch: (query: string) => void;
  loading?: boolean;
};

export function SearchBar({ initialQuery, onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState(initialQuery ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm ring-1 ring-transparent transition-all focus-within:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <Search className="h-5 w-5 text-zinc-400" />
      <input
        type="text"
        placeholder="What are you tracking? e.g. autonomous drones, SBIR, cyber, space ISR..."
        className="flex-1 border-none bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-50"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  );
}

