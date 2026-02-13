"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Preference = {
  id: string;
  topic: string;
};

type AuthPreferencesPanelProps = {
  onPreferencesChange: (topics: string[]) => void;
};

type AuthMode = "sign_in" | "sign_up";

export function AuthPreferencesPanel({
  onPreferencesChange,
}: AuthPreferencesPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [newPref, setNewPref] = useState("");

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
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

  useEffect(() => {
    if (!supabase || !user) {
      setPreferences([]);
      onPreferencesChange([]);
      return;
    }

    let cancelled = false;

    async function loadPreferences() {
      setPrefsLoading(true);
      setPrefsError(null);
      try {
        const { data, error } = await supabase!
          .from("user_preferences")
          .select("id, topic")
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const prefs =
          data?.map((row) => ({ id: row.id as string, topic: row.topic })) ??
          [];
        setPreferences(prefs);
        onPreferencesChange(prefs.map((p) => p.topic));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPrefsError("Could not load your preferences.");
        }
      } finally {
        if (!cancelled) {
          setPrefsLoading(false);
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [user, onPreferencesChange]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error(error);
      setAuthError("Authentication failed. Check your credentials and try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPreferences([]);
    onPreferencesChange([]);
  }

  async function handleAddPreference(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;

    const trimmed = newPref.trim();
    if (!trimmed) return;

    setPrefsLoading(true);
    setPrefsError(null);

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .insert({
          topic: trimmed,
          user_id: user.id,
        })
        .select("id, topic")
        .single();

      if (error) throw error;

      const next = [...preferences, { id: data.id as string, topic: data.topic }];
      setPreferences(next);
      onPreferencesChange(next.map((p) => p.topic));
      setNewPref("");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Unknown Supabase error";
      setPrefsError(`Could not add that preference: ${message}`);
    } finally {
      setPrefsLoading(false);
    }
  }

  async function handleRemovePreference(id: string) {
    if (!supabase || !user) return;

    setPrefsLoading(true);
    setPrefsError(null);

    try {
      const { error } = await supabase
        .from("user_preferences")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      const next = preferences.filter((p) => p.id !== id);
      setPreferences(next);
      onPreferencesChange(next.map((p) => p.topic));
    } catch (error) {
      console.error(error);
      setPrefsError("Could not remove that preference.");
    } finally {
      setPrefsLoading(false);
    }
  }

  async function handleEditPreference(pref: Preference) {
    if (!supabase || !user) return;
    const updated = window.prompt("Update preference topic", pref.topic);
    if (updated == null) return;
    const trimmed = updated.trim();
    if (!trimmed || trimmed === pref.topic) return;

    setPrefsLoading(true);
    setPrefsError(null);

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .update({ topic: trimmed })
        .eq("id", pref.id)
        .eq("user_id", user.id)
        .select("id, topic")
        .single();

      if (error) throw error;

      const next = preferences.map((p) =>
        p.id === pref.id ? { id: data.id as string, topic: data.topic } : p,
      );
      setPreferences(next);
      onPreferencesChange(next.map((p) => p.topic));
    } catch (error) {
      console.error(error);
      setPrefsError("Could not update that preference.");
    } finally {
      setPrefsLoading(false);
    }
  }

  if (!supabase) {
    return (
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-[11px] text-yellow-50">
        Supabase is not configured. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable login and preferences.
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Log in to save preferences
        </p>
        <p className="text-[11px] text-zinc-300">
          Create a lightweight account so we can remember the topics you care about and use
          them to bias your feed.
        </p>
        <form onSubmit={handleAuthSubmit} className="space-y-2.5 text-[11px]">
          <div className="space-y-1.5">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {authError && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-100">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-500"
          >
            {authLoading
              ? "Working..."
              : authMode === "sign_in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() =>
            setAuthMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))
          }
          className="w-full text-center text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          {authMode === "sign_in"
            ? "No account yet? Create one."
            : "Already have an account? Sign in."}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Your preference topics
          </p>
          <p className="text-[11px] text-zinc-300">
            We blend these terms into your search so your feed leans toward what you
            repeatedly track.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={handleAddPreference}
        className="flex items-center gap-2 text-[11px]"
      >
        <input
          type="text"
          placeholder="Add a topic (e.g. AFWERX SBIR, C-UAS, hypersonics)"
          value={newPref}
          onChange={(e) => setNewPref(e.target.value)}
          className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={prefsLoading}
          className="rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-500"
        >
          Add
        </button>
      </form>

      {prefsError && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-100">
          {prefsError}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {preferences.length === 0 && !prefsLoading && (
          <span className="text-[11px] text-zinc-400">
            No preferences yet. Add 2–5 topics you deeply care about.
          </span>
        )}
        {preferences.map((pref) => (
          <div
            key={pref.id}
            className="group inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-50 hover:bg-white/20"
          >
            <button
              type="button"
              onClick={() => void handleEditPreference(pref)}
              className="max-w-[140px] truncate text-left"
              title="Click to rename this preference"
            >
              {pref.topic}
            </button>
            <button
              type="button"
              onClick={() => void handleRemovePreference(pref.id)}
              className="text-[10px] text-zinc-400 hover:text-red-300"
              title="Remove this preference"
            >
              ✕
            </button>
          </div>
        ))}
        {prefsLoading && (
          <span className="text-[11px] text-zinc-400">Syncing preferences…</span>
        )}
      </div>
    </div>
  );
}

