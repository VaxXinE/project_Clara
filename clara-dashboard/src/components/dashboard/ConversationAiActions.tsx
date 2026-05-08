"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";

type Props = {
  conversationId: string;
  hasAiExtraction: boolean;
  hasReplySuggestion: boolean;
};

export function ConversationAiActions({
  conversationId,
  hasAiExtraction,
  hasReplySuggestion,
}: Props) {
  const router = useRouter();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAnalyze() {
    setErrorMessage("");
    setIsAnalyzing(true);

    try {
      await apiFetch(`/conversations/${conversationId}/analyze`, {
        method: "POST",
      });

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Analyze failed."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGenerateReply() {
    setErrorMessage("");
    setIsGeneratingReply(true);

    try {
      await apiFetch(`/conversations/${conversationId}/reply-suggestions`, {
        method: "POST",
      });

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Generate reply failed."
      );
    } finally {
      setIsGeneratingReply(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">AI Actions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Jalankan analysis dan generate draft balasan langsung dari dashboard.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing
            ? "Analyzing..."
            : hasAiExtraction
              ? "Run AI Analysis Again"
              : "Analyze Conversation"}
        </button>

        <button
          type="button"
          onClick={handleGenerateReply}
          disabled={isGeneratingReply || !hasAiExtraction}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGeneratingReply
            ? "Generating..."
            : hasReplySuggestion
              ? "Generate New Reply Suggestion"
              : "Generate Reply Suggestion"}
        </button>

        {!hasAiExtraction && (
          <p className="text-xs text-slate-500">
            Jalankan AI analysis dulu sebelum generate reply suggestion.
          </p>
        )}
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}