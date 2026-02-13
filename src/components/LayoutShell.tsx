"use client";

import { usePathname } from "next/navigation";
import { Home, Search, User, Zap } from "lucide-react";
import { BottomNav } from "./BottomNav";

type LayoutShellProps = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  pageTitle?: string;
};

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/account", icon: User, label: "Account" },
] as const;

export function LayoutShell({ children, sidebar, pageTitle }: LayoutShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex max-w-[1280px] justify-center">
        {/* Left Sidebar — hidden below lg */}
        <aside className="sticky top-0 hidden h-screen w-[275px] shrink-0 flex-col justify-between border-r border-border px-3 py-4 lg:flex">
          <div className="space-y-2">
            {/* Brand */}
            <a
              href="/"
              className="mb-4 flex items-center gap-2 rounded-full px-3 py-3 transition-colors hover:bg-surface-hover"
            >
              <Zap className="h-7 w-7 text-accent" />
              <span className="text-xl font-bold tracking-tight">Pryzm</span>
            </a>

            {/* Nav Links */}
            <nav className="space-y-1">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const isActive =
                  href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(href);
                return (
                  <a
                    key={href}
                    href={href}
                    className={`flex items-center gap-4 rounded-full px-4 py-3 text-[15px] transition-colors hover:bg-surface-hover ${
                      isActive ? "font-bold text-text-primary" : "text-text-primary"
                    }`}
                  >
                    <Icon
                      className="h-6 w-6"
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    <span>{label}</span>
                  </a>
                );
              })}
            </nav>
          </div>


        </aside>

        {/* Main Feed Column */}
        <main className="min-h-screen w-full max-w-[600px] flex-1 border-r border-border pb-20 lg:pb-0">
          {/* Sticky page title bar */}
          {pageTitle && (
            <div className="sticky top-0 z-40 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
              <h1 className="text-xl font-bold">{pageTitle}</h1>
            </div>
          )}

          {children}
        </main>

        {/* Right Sidebar — hidden below xl */}
        {sidebar && (
          <aside className="sticky top-0 hidden h-screen w-[350px] shrink-0 overflow-y-auto p-4 xl:block">
            {sidebar}
          </aside>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
