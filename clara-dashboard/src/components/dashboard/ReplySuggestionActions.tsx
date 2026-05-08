"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { SuggestedReply } from "@/types/dashboard";

type Props = {
  replySuggestionId: string;
  suggestedReplies: SuggestedReply[];
  approvalStatus: string;
};

export function ReplySuggestionActions({
  replySuggestionId,
  suggestedReplies,
  approvalStatus,
}: Props) {
  const router = useRouter();
  const [selectedText, setSelectedText] = useState(
    suggestedReplies[0]?.text ?? ""
  );
  const [finalText, setFinalText] = useState(suggestedReplies[0]?.text ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isPending = approvalStatus === "pending";

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

      router.refresh();
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

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to reject reply."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isPending) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">
          Suggestion status: {approvalStatus}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">
          Review Draft Balasan
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Pilih salah satu draft, edit kalau perlu, lalu approve atau reject.
        </p>
      </div>

      <div className="space-y-3">
        {suggestedReplies.map((reply, index) => (
          <label
            key={`${reply.tone}-${index}`}
            className="block cursor-pointer rounded-xl border border-slate-200 p-4 hover:border-slate-300"
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
          className="text-sm font-semibold text-slate-900"
        >
          Final reply
        </label>
        <textarea
          id="finalReply"
          value={finalText}
          onChange={(event) => setFinalText(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div>
        <label
          htmlFor="rejectReason"
          className="text-sm font-semibold text-slate-900"
        >
          Reject reason
        </label>
        <input
          id="rejectReason"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Contoh: Draft terlalu umum / kurang sesuai tone brand"
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isSubmitting || finalText.trim().length === 0}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve Reply
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={isSubmitting}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
