"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LayoutShell } from "@/components/LayoutShell";
import { AuthPreferencesPanel } from "@/components/AuthPreferencesPanel";
import { supabase } from "@/lib/supabaseClient";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadingUser(false);
      return;
    }

    let active = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      setLoadingUser(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSendReset() {
    if (!supabase || !user?.email) return;
    setResetStatus("Sending password reset email…");
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: origin ? `${origin}/account` : undefined,
      });
      if (error) throw error;
      setResetStatus("Password reset email sent. Check your inbox.");
    } catch (error) {
      console.error(error);
      setResetStatus("Could not send reset email. Try again later.");
    }
  }

  return (
    <LayoutShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-50">
            Account & preference settings
          </h2>
          <p className="text-[11px] text-zinc-300">
            Manage your login details and the preference topics that drive your feed. Your
            home feed is primarily ranked using these saved preferences; the search bar
            just lets you steer them in the moment.
          </p>
          {!supabase && (
            <p className="text-[11px] text-yellow-200">
              Supabase is not configured. Add your Supabase URL and anon key to enable
              account details.
            </p>
          )}
          {supabase && loadingUser && (
            <p className="text-[11px] text-zinc-400">Loading account details…</p>
          )}
          {supabase && !loadingUser && !user && (
            <p className="text-[11px] text-zinc-300">
              You&apos;re not signed in. Go back to the home page and use the right-hand
              panel to sign in or create an account.
            </p>
          )}
          {user && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-black/30 p-3 text-[11px] text-zinc-200">
              <p>
                <span className="text-zinc-400">Email:</span>{" "}
                <span className="font-medium text-zinc-50">{user.email}</span>
              </p>
              {user.last_sign_in_at && (
                <p className="text-zinc-400">
                  Last sign-in:{" "}
                  <span className="text-zinc-200">
                    {new Date(user.last_sign_in_at).toLocaleString()}
                  </span>
                </p>
              )}
              <button
                type="button"
                onClick={handleSendReset}
                className="mt-1 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-100 hover:border-blue-400 hover:text-blue-100"
              >
                Send password reset email
              </button>
              {resetStatus && (
                <p className="mt-1 text-[11px] text-zinc-300">{resetStatus}</p>
              )}
            </div>
          )}
        </section>
        <AuthPreferencesPanel onPreferencesChange={() => {}} />
      </div>
    </LayoutShell>
  );
}

