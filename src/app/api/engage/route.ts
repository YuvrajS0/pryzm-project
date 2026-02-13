import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

const bodySchema = z.object({
  itemId: z.string().min(1),
  action: z.enum(["click", "bookmark", "unbookmark", "share", "dwell"]),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { itemId, action, sessionId, userId, metadata } =
      bodySchema.parse(json);

    if (supabase) {
      // Fire-and-forget insert
      supabase
        .from("user_engagements")
        .insert({
          item_id: itemId,
          action,
          session_id: sessionId ?? null,
          user_id: userId ?? null,
          metadata: metadata ?? {},
        })
        .then(({ error }) => {
          if (error) {
            console.warn("[Engage] Failed to insert engagement", error.message);
          }
        });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
