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
  const isBusy = isAnalyzing || isGeneratingReply;
  const shouldPrioritizeAnalysis = !hasAiExtraction || analysisNeedsRefresh;

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
    <section className="clara-card p-5" aria-labelledby="clara-actions-title">
      <p className="clara-kicker">Aksi Clara</p>
      <h2
        id="clara-actions-title"
        className="mt-2 text-xl font-bold tracking-[-0.03em] clara-text-primary"
      >
        Siapkan konteks dan jawaban
      </h2>
      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        Hasil AI adalah saran. Baca konteks terbaru dan review jawaban sebelum
        menyetujuinya.
      </p>

      {analysisNeedsRefresh || replyNeedsRefresh ? (
        <div role="alert" className="clara-alert clara-alert-warning mt-4">
          {analysisNeedsRefresh
            ? "Ada pesan customer baru sejak analisis terakhir. Jalankan ulang AI analysis dulu."
            : "Draft lama sudah tertinggal dari chat terbaru. Generate ulang reply suggestion setelah baca konteks baru."}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isBusy}
          className={`clara-button ${
            shouldPrioritizeAnalysis
              ? "clara-button-primary"
              : "clara-button-ghost"
          }`}
        >
          {isAnalyzing
            ? "Menganalisis..."
            : analysisNeedsRefresh
              ? "Analisis Ulang karena Ada Chat Baru"
              : hasAiExtraction
                ? "Jalankan Analisis Lagi"
              : "Analisis Percakapan"}
        </button>

        <button
          type="button"
          onClick={handleGenerateReply}
          disabled={isBusy || !hasAiExtraction}
          className={`clara-button ${
            shouldPrioritizeAnalysis
              ? "clara-button-ghost"
              : "clara-button-primary"
          }`}
        >
          {isGeneratingReply
            ? "Membuat jawaban..."
            : replyNeedsRefresh
              ? "Buat Ulang Jawaban"
              : hasReplySuggestion
                ? "Buat Jawaban Baru"
              : "Buat Jawaban Terbaik"}
        </button>

        {!hasAiExtraction && (
          <p className="clara-helper">
            Jalankan analisis dulu sebelum membuat jawaban terbaik.
          </p>
        )}

        {isBusy ? (
          <p role="status" aria-live="polite" className="clara-helper">
            {isAnalyzing
              ? "Clara sedang menganalisis percakapan."
              : "Clara sedang membuat draft jawaban."}
          </p>
        ) : null}
      </div>

      {errorMessage && (
        <p role="alert" className="clara-alert clara-alert-danger mt-4">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
