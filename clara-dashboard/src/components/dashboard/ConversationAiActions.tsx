"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";

type Props = {
  conversationId: string;
  hasAiExtraction: boolean;
  hasReplySuggestion: boolean;
  analysisNeedsRefresh?: boolean;
  replyNeedsRefresh?: boolean;
  onUpdated: () => Promise<void>;
};

export function ConversationAiActions({
  conversationId,
  hasAiExtraction,
  hasReplySuggestion,
  analysisNeedsRefresh = false,
  replyNeedsRefresh = false,
  onUpdated,
}: Props) {
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

      await onUpdated();
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

      await onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Generate reply failed."
      );
    } finally {
      setIsGeneratingReply(false);
    }
  }

  return (
    <div className="clara-card rounded-[30px] p-5">
      <p className="clara-kicker">AI Actions</p>
      <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
        Jalankan analisis dan draft
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Jalankan analysis dan generate draft balasan langsung dari dashboard.
      </p>

      {analysisNeedsRefresh || replyNeedsRefresh ? (
        <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {analysisNeedsRefresh
            ? "Ada pesan customer baru sejak analisis terakhir. Jalankan ulang AI analysis dulu."
            : "Draft lama sudah tertinggal dari chat terbaru. Generate ulang reply suggestion setelah baca konteks baru."}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="clara-button clara-button-primary"
        >
          {isAnalyzing
            ? "Analyzing..."
            : analysisNeedsRefresh
              ? "Analyze Ulang karena Ada Chat Baru"
              : hasAiExtraction
                ? "Run AI Analysis Again"
              : "Analyze Conversation"}
        </button>

        <button
          type="button"
          onClick={handleGenerateReply}
          disabled={isGeneratingReply || !hasAiExtraction}
          className="clara-button clara-button-ghost"
        >
          {isGeneratingReply
            ? "Generating..."
            : replyNeedsRefresh
              ? "Generate Draft Ulang"
              : hasReplySuggestion
                ? "Generate New Reply Suggestion"
              : "Generate Reply Suggestion"}
        </button>

        {!hasAiExtraction && (
          <p className="clara-helper">
            Jalankan AI analysis dulu sebelum generate reply suggestion.
          </p>
        )}
      </div>

      {errorMessage && (
        <p className="clara-alert clara-alert-danger mt-4">{errorMessage}</p>
      )}
    </div>
  );
}
