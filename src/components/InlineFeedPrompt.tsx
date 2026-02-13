"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";

type InlineFeedPromptProps = {
  variant: "feedback";
  onFeedbackPositive?: () => void;
  onFeedbackNegative?: () => void;
};

export function InlineFeedPrompt({
  variant,
  onFeedbackPositive,
  onFeedbackNegative,
}: InlineFeedPromptProps) {

  if (variant === "feedback") {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex-1">
          <p className="text-[14px] text-text-secondary">
            How relevant were the last signals?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFeedbackPositive}
            className="rounded-full p-2 transition-colors hover:bg-success/10"
            aria-label="Relevant"
          >
            <ThumbsUp className="h-4 w-4 text-text-tertiary hover:text-success" />
          </button>
          <button
            type="button"
            onClick={onFeedbackNegative}
            className="rounded-full p-2 transition-colors hover:bg-danger/10"
            aria-label="Not relevant"
          >
            <ThumbsDown className="h-4 w-4 text-text-tertiary hover:text-danger" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
