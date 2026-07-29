"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { SuggestedReply } from "@/types/dashboard";

type Props = {
  replySuggestionId: string;
  suggestedReplies: SuggestedReply[];
  approvalStatus: string;
  hasBeenSent?: boolean;
  isStale?: boolean;
  onUpdated: () => Promise<void>;
};

export function ReplySuggestionActions({
  replySuggestionId,
  suggestedReplies,
  approvalStatus,
  hasBeenSent = false,
  isStale = false,
  onUpdated,
}: Props) {
  const [selectedText, setSelectedText] = useState(
    suggestedReplies[0]?.text ?? ""
  );
  const [finalText, setFinalText] = useState(suggestedReplies[0]?.text ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isPending = approvalStatus === "pending";
  const isApproved = approvalStatus === "approved";
  const isBusy = isSubmitting || isMarkingSent;

  async function handleApprove() {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await apiFetch(`/reply-suggestions/${replySuggestionId}/approve`, {
        method: "POST",
        body: {
          selected_reply_text: selectedText,
          final_reply_text: finalText,
          reviewer_name: "Sales Dashboard",
        },
      });

      await onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to approve reply."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await apiFetch(`/reply-suggestions/${replySuggestionId}/reject`, {
        method: "POST",
        body: {
          reason: rejectReason || "Rejected from dashboard.",
          reviewer_name: "Sales Dashboard",
        },
      });

      await onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to reject reply."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkSent() {
    setErrorMessage("");
    setIsMarkingSent(true);

    try {
      await apiFetch(`/reply-suggestions/${replySuggestionId}/mark-sent`, {
        method: "POST",
        body: {
          sent_by_name: "Sales Dashboard",
        },
      });

      await onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to mark as sent."
      );
    } finally {
      setIsMarkingSent(false);
    }
  }

  if (hasBeenSent) {
    return (
      <section className="clara-card-outline p-4">
        <p className="text-sm font-semibold clara-text-primary">
          Jawaban ini sudah ditandai terkirim.
        </p>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          Ini catatan manual dari dashboard, bukan konfirmasi delivery atau
          read receipt dari provider.
        </p>
        {isStale ? (
          <p role="alert" className="clara-alert clara-alert-warning mt-3">
            Customer sudah membalas lagi setelah pesan terkirim. Draft lama ini
            sebaiknya tidak dipakai sebagai patokan balasan berikutnya.
          </p>
        ) : null}
      </section>
    );
  }

  if (!isPending && !isApproved) {
    return (
      <div className="clara-card-soft p-4">
        <p className="text-sm font-medium clara-text-secondary">
          Suggestion status: {approvalStatus}
        </p>
      </div>
    );
  }

  if (isApproved) {
    return (
      <section className="clara-card space-y-4 p-5">
        <div>
          <p className="clara-kicker">Jawaban siap kirim</p>
          <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
            Jawaban sudah siap dipakai
          </h3>
          <p className="mt-2 text-sm leading-6 clara-text-secondary">
            Approval belum berarti pesan terkirim. Setelah benar-benar dikirim
            melalui channel asal, catat statusnya secara manual.
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleMarkSent}
          disabled={isBusy}
          className="clara-button clara-button-success"
        >
          {isMarkingSent ? "Menandai..." : "Tandai Sudah Terkirim"}
        </button>
      </section>
    );
  }

  return (
    <section className="clara-card space-y-5 p-5">
      <div>
        <p className="clara-kicker">Jawaban Clara</p>
        <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
          Pilih jawaban yang paling pas
        </h3>
        <p className="mt-2 text-sm leading-6 clara-text-secondary">
          Pilih draft, edit bila perlu, lalu setujui secara eksplisit. Approval
          tidak mengirim pesan ke customer.
        </p>
        {isStale ? (
          <div role="alert" className="clara-alert clara-alert-warning mt-4">
            Draft ini dibuat sebelum chat terbaru masuk. Baca pesan terakhir
            customer dulu, lalu pertimbangkan generate ulang sebelum approve.
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="clara-label mb-3">Pilihan draft jawaban</legend>
        {suggestedReplies.map((reply, index) => (
          <label
            key={`${reply.tone}-${index}`}
            className="clara-card-soft block cursor-pointer p-4 hover:border-[rgba(141,103,55,0.24)]"
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="selectedReply"
                className="mt-1"
                checked={selectedText === reply.text}
                onChange={() => {
                  setSelectedText(reply.text);
                  setFinalText(reply.text);
                }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize clara-text-primary">
                  {reply.tone}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm clara-text-secondary [overflow-wrap:anywhere]">
                  {reply.text}
                </p>
                <p className="mt-2 break-words text-xs clara-text-muted [overflow-wrap:anywhere]">
                  Alasan saran: {reply.reasoning}
                </p>
              </div>
            </div>
          </label>
        ))}
      </fieldset>

      <div>
        <label
          htmlFor="finalReply"
          className="clara-label"
        >
          Jawaban final
        </label>
        <textarea
          id="finalReply"
          value={finalText}
          onChange={(event) => setFinalText(event.target.value)}
          rows={5}
          className="clara-textarea mt-2"
        />
      </div>

      <div>
        <label
          htmlFor="rejectReason"
          className="clara-label"
        >
          Alasan tidak dipakai
        </label>
        <input
          id="rejectReason"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Contoh: Draft terlalu umum / kurang sesuai tone brand"
          className="clara-input mt-2"
        />
      </div>

      {errorMessage && (
        <p role="alert" className="clara-alert clara-alert-danger">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isBusy || finalText.trim().length === 0}
          className="clara-button clara-button-primary"
        >
          Setujui Jawaban Final
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={isBusy}
          className="clara-button clara-button-ghost"
        >
          Tolak Draft
        </button>
      </div>
    </section>
  );
}
