export type FeedSource = "defense_news" | "grants" | "contracts" | "other";

export type FeedItem = {
  id: string;
  source: FeedSource;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
  tags: string[];
  // Simple relevance score calculated on the backend
  score: number;
  isBookmarked?: boolean;
};

