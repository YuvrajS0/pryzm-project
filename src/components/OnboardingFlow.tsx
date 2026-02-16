"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const TOPIC_OPTIONS = [
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
  "Logistics & Supply Chain",
  "Grants & Funding",
  "JADC2",
  "Quantum Technology",
  "Biodefense",
];

type OnboardingFlowProps = {
  userId: string;
  onComplete: () => void;
};

export function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  }

  async function handleFinish() {
    if (!supabase || selectedTopics.size === 0) {
      handleDismiss();
      return;
    }

    setSaving(true);
    try {
      const rows = Array.from(selectedTopics).map((topic) => ({
        topic,
        user_id: userId,
      }));
      await supabase.from("user_preferences").insert(rows);
    } catch (error) {
      console.error("[Onboarding] Failed to save preferences", error);
    } finally {
      setSaving(false);
      handleDismiss();
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem("onboarding_completed", "true");
    } catch {
      // ignore
    }
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-border bg-background p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-text-primary">
                Welcome to Yuvraj-Pryzm
              </h2>
            </div>
            <p className="text-[15px] text-text-secondary">
              Select 3-5 topics you care about. We&apos;ll use these to curate
              your feed.
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((topic) => {
                const selected = selectedTopics.has(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
                      selected
                        ? "bg-accent text-white"
                        : "border border-border text-text-secondary hover:border-accent hover:text-accent"
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-tertiary">
                {selectedTopics.size} selected
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={selectedTopics.size === 0}
                className="rounded-full bg-accent px-6 py-2.5 text-[15px] font-bold text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-text-primary">
              You&apos;re all set
            </h2>
            <p className="text-[15px] text-text-secondary">
              Your feed will now be personalized around{" "}
              <span className="font-medium text-text-primary">
                {Array.from(selectedTopics).join(", ")}
              </span>
              . You can always adjust these in Settings.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="w-full rounded-full bg-accent py-3 text-[15px] font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Start browsing"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
