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
    setResetStatus("Sending password reset email...");
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
    <LayoutShell pageTitle="Settings">
      <div className="divide-y divide-border">
        {/* Profile Section */}
        <section className="px-4 py-5">
          <h2 className="text-[15px] font-bold text-text-primary">Profile</h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            Manage your account and the preferences that drive your feed.
          </p>

          {!supabase && (
            <p className="mt-3 text-[13px] text-warning">
              Supabase is not configured. Add your Supabase URL and anon key to
              enable account features.
            </p>
          )}

          {supabase && loadingUser && (
            <p className="mt-3 text-[13px] text-text-secondary">
              Loading account details...
            </p>
          )}

          {supabase && !loadingUser && !user && (
            <p className="mt-3 text-[13px] text-text-secondary">
              You&apos;re not signed in. Use the panel below to sign in or
              create an account.
            </p>
          )}

          {user && (
            <div className="mt-4 space-y-3">
              {/* Avatar + email */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                  {user.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-text-primary">
                    {user.email}
                  </p>
                  {user.last_sign_in_at && (
                    <p className="text-[13px] text-text-secondary">
                      Last sign-in:{" "}
                      {new Date(user.last_sign_in_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendReset}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                Send password reset email
              </button>
              {resetStatus && (
                <p className="text-[13px] text-text-secondary">{resetStatus}</p>
              )}
            </div>
          )}
        </section>

        {/* Preferences Section */}
        <section className="px-4 py-5">
          <h2 className="mb-3 text-[15px] font-bold text-text-primary">
            Topics & Preferences
          </h2>
          <AuthPreferencesPanel onPreferencesChange={() => {}} />
        </section>
      </div>
    </LayoutShell>
  );
}
