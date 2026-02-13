import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error: authError } = await supabase.auth.getUser();
    const user = (data as any)?.user;

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get bookmarked item IDs for the user
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from("user_bookmarks")
      .select("item_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bookmarkError) {
      console.error("[Bookmarks API] Error fetching bookmarks:", bookmarkError);
      return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
    }

    const bookmarkedIds = bookmarks?.map((row) => row.item_id) ?? [];

    return NextResponse.json({ bookmarks: bookmarkedIds });
  } catch (error) {
    console.error("[Bookmarks API] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
