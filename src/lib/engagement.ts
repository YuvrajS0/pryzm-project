function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("pryzm_session_id");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("pryzm_session_id", id);
  }
  return id;
}

function fireEngagement(
  itemId: string,
  action: string,
  metadata?: Record<string, unknown>,
) {
  const sessionId = getSessionId();
  fetch("/api/engage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, action, sessionId, metadata }),
  }).catch(() => {
    // fire-and-forget
  });
}

export function trackClick(itemId: string) {
  fireEngagement(itemId, "click");
}

export function trackBookmark(itemId: string, bookmarked: boolean) {
  fireEngagement(itemId, bookmarked ? "bookmark" : "unbookmark");
}

export function trackShare(itemId: string) {
  fireEngagement(itemId, "share");
}

export function getBookmarkedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem("bookmarked_items");
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleBookmark(itemId: string): boolean {
  const ids = getBookmarkedIds();
  const isNowBookmarked = !ids.has(itemId);
  if (isNowBookmarked) {
    ids.add(itemId);
  } else {
    ids.delete(itemId);
  }
  try {
    window.localStorage.setItem(
      "bookmarked_items",
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // ignore
  }
  trackBookmark(itemId, isNowBookmarked);
  return isNowBookmarked;
}
