"use client";

import { usePathname } from "next/navigation";

type LayoutShellProps = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();
  const onHome = pathname === "/" || pathname === "";
  const onAccount = pathname?.startsWith("/account");
  const onSearch = pathname?.startsWith("/search");
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-white/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200 ring-1 ring-blue-500/30 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Live intake from Defense & Gov feeds
            </div>
            <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Defense & Gov signal feed
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              A Twitter-style stream of government opportunities, grants and
              defense tech news – curated around what you&apos;re actually
              building.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <nav className="flex items-center gap-2 text-[11px]">
              <a
                href="/"
                className={`rounded-full px-3 py-1.5 transition ${
                  onHome
                    ? "border border-white/10 bg-white/5 font-semibold text-zinc-50"
                    : "border border-transparent text-zinc-200 hover:border-blue-400 hover:bg-white/5 hover:text-blue-100"
                }`}
              >
                Home
              </a>
              <a
                href="/search"
                className={`rounded-full px-3 py-1.5 transition ${
                  onSearch
                    ? "border border-white/10 bg-white/5 font-semibold text-zinc-50"
                    : "border border-transparent text-zinc-200 hover:border-blue-400 hover:bg-white/5 hover:text-blue-100"
                }`}
              >
                Search
              </a>
              <a
                href="/account"
                className={`rounded-full px-3 py-1.5 transition ${
                  onAccount
                    ? "border border-white/10 bg-white/5 font-semibold text-zinc-50"
                    : "border border-transparent text-zinc-200 hover:border-blue-400 hover:bg-white/5 hover:text-blue-100"
                }`}
              >
                Account
              </a>
            </nav>
            <div className="hidden text-[11px] sm:flex sm:flex-col sm:items-end">
              <span className="font-mono uppercase tracking-wide text-zinc-500">
                Sources
              </span>
              <span>Defense News, Grants.gov, DoD (RSS)</span>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

