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
      <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(24,17,12,0.98)_100%)] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-semibold text-[#fff0c9]">
          Jawaban ini sudah ditandai terkirim.
        </p>
        <p className="mt-1 text-sm leading-6 text-[#d6bb84]">
          Untuk MVP ini, status terkirim masih simulasi manual. Nanti bisa
          diganti ke WhatsApp Cloud API.
        </p>
        {isStale ? (
          <p className="mt-3 rounded-[18px] border border-amber-200/50 bg-amber-100/10 px-3 py-2 text-sm text-[#fff0c9]">
            Customer sudah membalas lagi setelah pesan terkirim. Draft lama ini
            sebaiknya tidak dipakai sebagai patokan balasan berikutnya.
          </p>
        ) : null}
      </div>
    );
  }

  if (!isPending && !isApproved) {
    return (
      <div className="clara-card-soft rounded-[24px] p-4">
        <p className="text-sm font-medium text-slate-700">
          Suggestion status: {approvalStatus}
        </p>
      </div>
    );
  }

  if (isApproved) {
    return (
      <div className="clara-card space-y-4 rounded-[30px] p-5">
        <div>
          <p className="clara-kicker">Jawaban siap kirim</p>
          <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
            Jawaban sudah siap dipakai
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Jawaban ini sudah final. Setelah benar-benar dikirim ke WhatsApp, tandai sebagai terkirim.
          </p>
        </div>

        {errorMessage && (
          <p className="clara-alert clara-alert-danger">{errorMessage}</p>
        )}

        <button
          type="button"
          onClick={handleMarkSent}
          disabled={isMarkingSent}
          className="clara-button clara-button-success"
        >
          {isMarkingSent ? "Menandai..." : "Tandai Sudah Terkirim"}
        </button>
      </div>
    );
  }

  return (
    <div className="clara-card space-y-5 rounded-[30px] p-5">
      <div>
        <p className="clara-kicker">Jawaban Clara</p>
        <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
          Pilih jawaban yang paling pas
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Pilih jawaban yang paling cocok, edit kalau perlu, lalu simpan sebagai jawaban final.
        </p>
        {isStale ? (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Draft ini dibuat sebelum chat terbaru masuk. Baca pesan terakhir
            customer dulu, lalu pertimbangkan generate ulang sebelum approve.
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {suggestedReplies.map((reply, index) => (
          <label
            key={`${reply.tone}-${index}`}
            className="clara-card-soft block cursor-pointer rounded-[24px] p-4 hover:border-[rgba(141,103,55,0.24)]"
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
              <div>
                <p className="text-sm font-semibold capitalize text-slate-900">
                  {reply.tone}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {reply.text}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Reasoning: {reply.reasoning}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>

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
        <p className="clara-alert clara-alert-danger">{errorMessage}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isSubmitting || finalText.trim().length === 0}
          className="clara-button clara-button-primary"
        >
          Pilih Jawaban Ini
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={isSubmitting}
          className="clara-button clara-button-ghost"
        >
          Jangan Pakai
        </button>
      </div>
    </div>
  );
}
