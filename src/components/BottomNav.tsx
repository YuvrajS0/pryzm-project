"use client";

import { usePathname } from "next/navigation";
import { Home, Search, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/account", icon: User, label: "Account" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname?.startsWith(href);
          return (
            <a
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-3 transition-colors"
              aria-label={label}
            >
              <Icon
                className={`h-6 w-6 ${
                  isActive
                    ? "text-accent"
                    : "text-text-secondary"
                }`}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={`text-[10px] ${
                  isActive
                    ? "font-semibold text-accent"
                    : "text-text-secondary"
                }`}
              >
                {label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
