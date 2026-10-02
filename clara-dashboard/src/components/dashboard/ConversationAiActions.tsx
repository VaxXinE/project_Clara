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

/** Dua langkah Clara: baca chat, lalu susun jawaban. Tombol utama selalu langkah yang sedang dibutuhkan. */
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
  // Kalau draft yang ada masih relevan, aksi utama di layar adalah memakainya, bukan menyusun ulang.
  const shouldPrioritizeGeneration =
    !shouldPrioritizeAnalysis && (!hasReplySuggestion || replyNeedsRefresh);

  async function run(path: string, failure: string, setBusy: (value: boolean) => void) {
    setErrorMessage("");
    setBusy(true);

    try {
      await apiFetch(path, { method: "POST" });
      await onUpdated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const status = isAnalyzing
    ? "Clara sedang membaca percakapan ini."
    : isGeneratingReply
      ? "Clara sedang menyusun jawaban."
      : "";

  return (
    <section aria-labelledby="clara-actions-title" className="rounded-2xl border border-clara-line bg-clara-raised p-4">
      <h2 id="clara-actions-title" className="text-base font-bold clara-text-primary">
        {hasAiExtraction ? "Perlu jawaban yang berbeda?" : "Minta Clara membantu"}
      </h2>
      <p className="mt-1 text-sm leading-6 clara-text-secondary">
        {analysisNeedsRefresh
          ? "Ada pesan customer baru sejak Clara terakhir membaca. Baca ulang dulu sebelum menyusun jawaban."
          : replyNeedsRefresh
            ? "Draft lama sudah tertinggal dari chat terbaru. Susun ulang jawabannya."
            : hasAiExtraction
              ? "Saran Clara boleh kamu ubah. Susun ulang kalau draft yang ada belum cocok."
              : "Clara perlu membaca percakapan ini dulu, baru bisa menyusun jawaban."}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            void run(
              `/conversations/${conversationId}/analyze`,
              "Clara belum bisa membaca percakapan ini. Coba lagi.",
              setIsAnalyzing,
            )
          }
          disabled={isBusy}
          className={`clara-button ${shouldPrioritizeAnalysis ? "clara-button-primary" : "clara-button-secondary"}`}
        >
          {isAnalyzing
            ? "Membaca..."
            : analysisNeedsRefresh
              ? "Baca ulang (ada chat baru)"
              : hasAiExtraction
                ? "Baca ulang percakapan"
                : "Baca percakapan ini"}
        </button>

        <button
          type="button"
          onClick={() =>
            void run(
              `/conversations/${conversationId}/reply-suggestions`,
              "Clara belum bisa menyusun jawaban. Coba lagi.",
              setIsGeneratingReply,
            )
          }
          disabled={isBusy || !hasAiExtraction}
          className={`clara-button ${shouldPrioritizeGeneration ? "clara-button-primary" : "clara-button-secondary"}`}
        >
          {isGeneratingReply
            ? "Menyusun..."
            : replyNeedsRefresh
              ? "Susun ulang jawaban"
              : hasReplySuggestion
                ? "Susun jawaban baru"
                : "Susun jawaban"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm clara-text-secondary">
        {status}
      </p>

      {errorMessage ? (
        <p role="alert" className="clara-alert clara-alert-danger mt-2">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
