"use client";

import { useState } from "react";

import { Tag } from "@/components/dashboard/Tag";
import { apiFetch } from "@/lib/api";
import { REPLY_TONE, labelOf } from "@/lib/vocab";
import type { SuggestedReply } from "@/types/dashboard";

type Props = {
  replySuggestionId: string;
  suggestedReplies: SuggestedReply[];
  approvalStatus: string;
  /** Jawaban final yang sudah dipakai (ada setelah disetujui). */
  finalReplyText?: string | null;
  hasBeenSent?: boolean;
  isStale?: boolean;
  /** Hanya yang ikut mengoperasikan chat (Superadmin) yang menyalin dan menandai terkirim. Reviewer cukup memutuskan. */
  canSend?: boolean;
  onUpdated: () => Promise<void>;
};

function meaningfulReasoning(value: string | undefined): string {
  const text = (value ?? "").trim();
  return text === "-" ? "" : text;
}

export function ReplySuggestionActions({
  replySuggestionId,
  suggestedReplies,
  approvalStatus,
  finalReplyText = null,
  hasBeenSent = false,
  isStale = false,
  canSend = false,
  onUpdated,
}: Props) {
  const [selectedText, setSelectedText] = useState(suggestedReplies[0]?.text ?? "");
  const [finalText, setFinalText] = useState(suggestedReplies[0]?.text ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isPending = approvalStatus === "pending";
  const isApproved = approvalStatus === "approved";
  const isBusy = isSubmitting || isMarkingSent;
  const readyText = (finalReplyText ?? "").trim() || finalText.trim();

  async function run(action: () => Promise<unknown>, failure: string, setBusy: (value: boolean) => void) {
    setErrorMessage("");
    setBusy(true);

    try {
      await action();
      await onUpdated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : failure);
    } finally {
      setBusy(false);
    }
  }

  function handleApprove() {
    void run(
      () =>
        apiFetch(`/reply-suggestions/${replySuggestionId}/approve`, {
          method: "POST",
          body: {
            selected_reply_text: selectedText,
            final_reply_text: finalText,
            reviewer_name: "Sales Dashboard",
          },
        }),
      "Jawaban belum bisa disimpan. Coba lagi.",
      setIsSubmitting,
    );
  }

  function handleReject() {
    void run(
      () =>
        apiFetch(`/reply-suggestions/${replySuggestionId}/reject`, {
          method: "POST",
          body: {
            reason: rejectReason.trim() || "Ditolak dari dashboard.",
            reviewer_name: "Sales Dashboard",
          },
        }),
      "Draf belum bisa ditolak. Coba lagi.",
      setIsSubmitting,
    );
  }

  function handleMarkSent() {
    void run(
      () =>
        apiFetch(`/reply-suggestions/${replySuggestionId}/mark-sent`, {
          method: "POST",
          body: { sent_by_name: "Sales Dashboard" },
        }),
      "Belum bisa menandai terkirim. Coba lagi.",
      setIsMarkingSent,
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(readyText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  if (hasBeenSent) {
    return (
      <section className="rounded-2xl border border-clara-success-line bg-clara-success-surface p-4">
        <p className="text-sm font-semibold text-clara-success">Jawaban ini sudah ditandai terkirim.</p>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          Ini catatan manual dari dashboard. Clara tidak tahu apakah pesannya benar-benar sampai atau
          sudah dibaca customer.
        </p>
        {isStale ? (
          <p role="alert" className="clara-alert clara-alert-warning mt-3">
            Customer sudah membalas lagi. Draf lama tidak cocok lagi untuk balasan berikutnya, Sales
            perlu menyusun jawaban baru.
          </p>
        ) : null}
      </section>
    );
  }

  if (!isPending && !isApproved) {
    return (
      <section className="rounded-2xl border border-clara-line bg-clara-raised p-4">
        <p className="text-sm font-semibold clara-text-primary">Draf ini sudah ditolak.</p>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          {canSend
            ? "Pakai tombol \u201cSusun jawaban baru\u201d di atas supaya Clara membuat draf yang baru."
            : "Sales perlu meminta Clara menyusun draf yang baru."}
        </p>
      </section>
    );
  }

  if (isApproved && !canSend) {
    return (
      <section className="space-y-4 rounded-2xl border border-clara-line bg-clara-raised p-5">
        <div>
          <h3 className="text-lg font-bold clara-text-primary">Jawaban sudah disetujui</h3>
          <p className="mt-1 text-sm leading-6 clara-text-secondary">
            Sekarang giliran Sales mengirimnya dari WhatsApp. Clara tidak mengirim pesan ke customer.
          </p>
        </div>
        <div>
          <p className="clara-label">Jawaban yang disetujui</p>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4 text-sm clara-text-primary [overflow-wrap:anywhere]">
            {readyText}
          </p>
        </div>
      </section>
    );
  }

  if (isApproved) {
    return (
      <section className="space-y-4 rounded-2xl border border-clara-line bg-clara-raised p-5">
        <div>
          <h3 className="text-lg font-bold clara-text-primary">Jawaban siap dikirim</h3>
          <p className="mt-1 text-sm leading-6 clara-text-secondary">
            Clara tidak mengirim pesan ke customer. Kamu yang mengirimnya dari WhatsApp.
          </p>
        </div>

        <div>
          <label htmlFor="approved-reply" className="clara-label">
            Jawaban yang akan dikirim
          </label>
          <textarea
            id="approved-reply"
            readOnly
            value={readyText}
            rows={5}
            onFocus={(event) => event.currentTarget.select()}
            className="clara-textarea mt-2"
          />
        </div>

        <ol className="space-y-1.5 text-sm clara-text-secondary">
          <li>1. Salin jawaban di atas.</li>
          <li>2. Tempel dan kirim di WhatsApp customer.</li>
          <li>3. Kembali ke sini dan tandai sudah terkirim.</li>
        </ol>

        {errorMessage ? (
          <p role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!readyText}
            className="clara-button clara-button-primary"
          >
            {copyState === "copied" ? "Tersalin" : "Salin jawaban"}
          </button>
          <button
            type="button"
            onClick={handleMarkSent}
            disabled={isBusy}
            className="clara-button clara-button-secondary"
          >
            {isMarkingSent ? "Menyimpan..." : "Tandai sudah terkirim"}
          </button>
        </div>

        <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
          {copyState === "copied" ? "Jawaban sudah disalin. Tempel di WhatsApp." : ""}
          {copyState === "failed"
            ? "Browser menolak menyalin otomatis. Klik kotak jawaban di atas, lalu tekan Ctrl+C."
            : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-clara-line bg-clara-raised p-5">
      <div>
        <h3 className="text-lg font-bold clara-text-primary">Draf jawaban dari Clara</h3>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          Pilih draf yang paling pas, ubah kalau perlu, lalu setujui supaya Sales boleh memakainya. Tolak kalau
          tidak pantas dikirim. Belum ada pesan yang terkirim ke customer.
        </p>
        {isStale ? (
          <div role="alert" className="clara-alert clara-alert-warning mt-4">
            Draf ini dibuat sebelum chat terbaru masuk. Baca pesan terakhir customer dulu sebelum
            memutuskan, mungkin Sales perlu menyusun jawaban baru.
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="clara-label mb-3">Pilihan draf</legend>
        {suggestedReplies.map((reply, index) => {
          const reasoning = meaningfulReasoning(reply.reasoning);

          return (
            <label
              key={`${reply.tone}-${index}`}
              className={`block min-h-11 cursor-pointer rounded-2xl border p-4 ${
                selectedText === reply.text
                  ? "border-clara-gold bg-clara-wash"
                  : "border-clara-line-subtle bg-clara-sunken hover:border-clara-line"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="selectedReply"
                  className="mt-1 h-4 w-4"
                  checked={selectedText === reply.text}
                  onChange={() => {
                    setSelectedText(reply.text);
                    setFinalText(reply.text);
                  }}
                />
                <div className="min-w-0">
                  <Tag tone={reply.tone === "best" ? "gold" : "neutral"}>
                    {labelOf(REPLY_TONE, reply.tone)}
                  </Tag>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm clara-text-primary [overflow-wrap:anywhere]">
                    {reply.text}
                  </p>
                  {reasoning ? (
                    <p className="mt-2 break-words text-xs clara-text-muted [overflow-wrap:anywhere]">
                      Kenapa Clara menyarankan ini: {reasoning}
                    </p>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor="finalReply" className="clara-label">
          Jawaban yang disetujui (boleh diubah)
        </label>
        <textarea
          id="finalReply"
          value={finalText}
          onChange={(event) => setFinalText(event.target.value)}
          rows={5}
          className="clara-textarea mt-2"
        />
      </div>

      {showReject ? (
        <div>
          <label htmlFor="rejectReason" className="clara-label">
            Kenapa draf ini kurang pas? (boleh dikosongkan)
          </label>
          <input
            id="rejectReason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Contoh: terlalu umum, nadanya kurang sesuai"
            className="clara-input mt-2"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="clara-alert clara-alert-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isBusy || finalText.trim().length === 0}
          className="clara-button clara-button-primary"
        >
          {isSubmitting && !showReject ? "Menyimpan..." : "Setujui jawaban ini"}
        </button>

        {showReject ? (
          <button
            type="button"
            onClick={handleReject}
            disabled={isBusy}
            className="clara-button clara-button-danger"
          >
            {isSubmitting ? "Menyimpan..." : "Tolak draf ini"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={isBusy}
            className="clara-button clara-button-ghost"
          >
            Draf ini kurang pas
          </button>
        )}
      </div>
    </section>
  );
}
