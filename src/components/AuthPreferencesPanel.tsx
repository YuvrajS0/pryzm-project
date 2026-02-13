"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Preference = {
  id: string;
  topic: string;
};

type AuthPreferencesPanelProps = {
  onPreferencesChange: (topics: string[]) => void;
};

type AuthMode = "sign_in" | "sign_up";

const SUGGESTED_TOPICS = [
  "Autonomous Systems",
  "SBIR/STTR",
  "Cyber Defense",
  "Space & Satellites",
  "Counter-UAS",
  "Directed Energy",
  "AI/ML",
  "Electronic Warfare",
  "Hypersonics",
  "Naval Systems",
  "Grants & Funding",
  "JADC2",
];

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

  async function addTopic(topic: string) {
    if (!supabase || !user) return;
    const trimmed = topic.trim();
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

  async function handleAddPreference(e: React.FormEvent) {
    e.preventDefault();
    await addTopic(newPref);
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

  // NOT CONFIGURED
  if (!supabase) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-[13px] text-warning">
        Supabase is not configured. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable login and preferences.
      </div>
    );
  }

  // NOT LOGGED IN
  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-text-secondary">
          Sign in to save preference topics that personalize your feed.
        </p>
        <form onSubmit={handleAuthSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {authError && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center rounded-full bg-accent py-2.5 text-[14px] font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
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
          className="w-full text-center text-[13px] text-text-secondary hover:text-accent"
        >
          {authMode === "sign_in"
            ? "No account yet? Create one."
            : "Already have an account? Sign in."}
        </button>
      </div>
    );
  }

  // LOGGED IN
  const existingTopics = new Set(preferences.map((p) => p.topic.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-text-secondary">
          These topics personalize your home feed.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text-secondary transition-colors hover:border-danger hover:text-danger"
        >
          Sign out
        </button>
      </div>

      {/* Add topic */}
      <form
        onSubmit={handleAddPreference}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Add a topic (e.g. AFWERX SBIR, C-UAS, hypersonics)"
          value={newPref}
          onChange={(e) => setNewPref(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={prefsLoading}
          className="rounded-full bg-accent px-4 py-2 text-[14px] font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {prefsError && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {prefsError}
        </p>
      )}

      {/* Current preferences */}
      <div className="flex flex-wrap gap-2">
        {preferences.length === 0 && !prefsLoading && (
          <span className="text-[13px] text-text-tertiary">
            No preferences yet. Add 2-5 topics you deeply care about.
          </span>
        )}
        {preferences.map((pref) => (
          <div
            key={pref.id}
            className="group inline-flex items-center gap-1.5 rounded-full bg-accent-muted px-3 py-1.5 text-[13px] font-medium text-accent"
          >
            <button
              type="button"
              onClick={() => void handleEditPreference(pref)}
              className="max-w-[160px] truncate text-left"
              title="Click to rename"
            >
              {pref.topic}
            </button>
            <button
              type="button"
              onClick={() => void handleRemovePreference(pref.id)}
              className="text-text-tertiary transition-colors hover:text-danger"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {prefsLoading && (
          <span className="text-[13px] text-text-secondary">Syncing...</span>
        )}
      </div>

      {/* Suggested topics */}
      {preferences.length < 8 && (
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-text-tertiary">
            Suggested topics
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TOPICS.filter(
              (t) => !existingTopics.has(t.toLowerCase()),
            ).map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => void addTopic(topic)}
                disabled={prefsLoading}
                className="rounded-full border border-border px-3 py-1.5 text-[13px] text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
              >
                + {topic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
