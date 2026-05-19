"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { SuggestedReply } from "@/types/dashboard";

type Props = {
  replySuggestionId: string;
  suggestedReplies: SuggestedReply[];
  approvalStatus: string;
  hasBeenSent?: boolean;
  onUpdated: () => Promise<void>;
};

export function ReplySuggestionActions({
  replySuggestionId,
  suggestedReplies,
  approvalStatus,
  hasBeenSent = false,
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
      <div className="clara-alert rounded-[24px] border border-green-200 bg-green-50/92 p-4">
        <p className="text-sm font-semibold text-green-800">
          Reply sudah ditandai terkirim.
        </p>
        <p className="mt-1 text-sm text-green-700">
          Untuk MVP ini, status terkirim masih simulasi manual. Nanti bisa
          diganti ke WhatsApp Cloud API.
        </p>
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
          <p className="clara-kicker">Reply Approved</p>
          <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
            Reply Approved
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Balasan sudah approved. Setelah sales mengirimnya ke WhatsApp,
            tandai sebagai sent.
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
          {isMarkingSent ? "Marking..." : "Mark as Sent"}
        </button>
      </div>
    );
  }

  return (
    <div className="clara-card space-y-5 rounded-[30px] p-5">
      <div>
        <p className="clara-kicker">Reply Review</p>
        <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
          Review Draft Balasan
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Pilih salah satu draft, edit kalau perlu, lalu approve atau reject.
        </p>
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
          Final reply
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
          Reject reason
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
          Approve Reply
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={isSubmitting}
          className="clara-button clara-button-ghost"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
