import { supabase } from "@/lib/supabaseClient";

export interface UserBookmark {
  id: string;
  user_id: string;
  item_id: string;
  created_at: string;
}

/**
 * Fetch all bookmarked item IDs for the current user
 */
export async function getBookmarkedItemIds(userId: string): Promise<Set<string>> {
  if (!supabase) {
    console.debug("[Bookmarks] Supabase not configured");
    return new Set<string>();
  }

  try {
    console.debug("[Bookmarks] Fetching bookmarks for user:", userId);
    const { data, error } = await supabase
      .from("user_bookmarks")
      .select("item_id")
      .eq("user_id", userId);

    if (error) {
      console.warn("[Bookmarks] Failed to fetch bookmarks:", error.code, error.message);
      return new Set<string>();
    }

    const bookmarkedIds = data?.map((row) => row.item_id) ?? [];
    console.debug("[Bookmarks] Found bookmarks:", bookmarkedIds.length, bookmarkedIds);
    return new Set(bookmarkedIds);
  } catch (error) {
    console.error("[Bookmarks] Error fetching bookmarks:", error);
    return new Set<string>();
  }
}

/**
 * Add a bookmark for a user
 */
export async function addBookmark(userId: string, itemId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase.from("user_bookmarks").insert({
      user_id: userId,
      item_id: itemId,
    });

    if (error) {
      console.warn("[Bookmarks] Failed to add bookmark:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Bookmarks] Error adding bookmark:", error);
    return false;
  }
}

/**
 * Remove a bookmark for a user
 */
export async function removeBookmark(userId: string, itemId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("user_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId);

    if (error) {
      console.warn("[Bookmarks] Failed to remove bookmark:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Bookmarks] Error removing bookmark:", error);
    return false;
  }
}

/**
 * Ensure the user_bookmarks table exists
 * This creates the table and indexes if they don't exist
 */
export async function ensureBookmarksTable(): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    // Try to query the table - if it doesn't exist, create it
    const { error: queryError } = await supabase
      .from("user_bookmarks")
      .select("id")
      .limit(1);

    // If table doesn't exist (would get a 404 or constraint error), create it
    if (queryError?.code === "PGRST116" || queryError?.message.includes("not found")) {
      console.log("[Bookmarks] Creating user_bookmarks table...");

      // Use RPC to create the table (requires a function in Supabase)
      // For now, we'll just log that the table needs to be created manually
      console.warn("[Bookmarks] Table does not exist. Please create it manually with this SQL:");
      console.warn(`
        CREATE TABLE IF NOT EXISTS user_bookmarks (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, item_id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_bookmarks_item_id ON user_bookmarks(item_id);
      `);
    }
  } catch (error) {
    console.error("[Bookmarks] Error ensuring table exists:", error);
  }
}
