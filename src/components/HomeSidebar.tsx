"use client";

import type { FeedItem } from "@/types/feed";

type HomeSidebarProps = {
  items: FeedItem[];
  preferences: string[];
  isLoggedIn: boolean;
};

export function HomeSidebar({ items, preferences, isLoggedIn }: HomeSidebarProps) {

  return (
    <div className="space-y-4">
      {/* Your Topics */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-lg font-bold text-text-primary">Your Topics</h3>
        {isLoggedIn && preferences.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {preferences.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-accent-muted px-3 py-1 text-[13px] font-medium text-accent"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-text-secondary">
            {isLoggedIn ? (
              <p>
                No topics yet.{" "}
                <a href="/account" className="text-accent hover:underline">
                  Add preferences
                </a>{" "}
                to personalize your feed.
              </p>
            ) : (
              <p>
                <a href="/account" className="text-accent hover:underline">
                  Sign in
                </a>{" "}
                to personalize your feed with saved topics.
              </p>
            )}
          </div>
        )}
      </div>



      {/* Sources */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-lg font-bold text-text-primary">Sources</h3>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-text-secondary">Defense News & DoD</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-text-secondary">Grants.gov</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-text-secondary">SAM.gov</span>
          </div>
        </div>
      </div>
    </div>
  );
}
