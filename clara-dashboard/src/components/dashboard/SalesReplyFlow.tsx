"use client";

import Link from "next/link";
import { useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { BUYING_INTENT, REPLY_TONE, SENTIMENT, STAGE, labelOf } from "@/lib/vocab";
import type {
  DashboardAIExtractionSummary,
  DashboardReplySuggestionSummary,
  DashboardSentMessageSummary,
} from "@/types/dashboard";

type Stage = "read" | "draft" | "choose" | "send" | "sent";
type Busy = "read" | "draft" | "use" | "sent" | "reject" | null;

type Props = {
  conversationId: string;
  extraction: DashboardAIExtractionSummary | null;
  suggestion: DashboardReplySuggestionSummary | null;
  sentMessages: DashboardSentMessageSummary[];
  /** Jawaban terbaru sudah ditandai terkirim. */
  hasBeenSent: boolean;
  /** Ada pesan customer yang lebih baru dari bacaan Clara. */
  analysisStale: boolean;
  /** Ada pesan customer yang lebih baru dari draft jawaban. */
  suggestionStale: boolean;
  latestCustomerMessage: { text: string; senderName: string; timestamp: string } | null;
  continuationHref: string;
  /** Jalan pintas ke web chat asli (WhatsApp Web, dll) untuk mengirim jawabannya. */
  openChat?: { label: string; href: string } | null;
  isExperimental: boolean;
  /** Dipasang di bawah isi chat: tanpa kutipan pesan terakhir dan bacaan Clara dilipat. */
  compact?: boolean;
  onUpdated: () => Promise<void>;
};

function pickStage(props: Pick<Props, "extraction" | "suggestion" | "hasBeenSent" | "analysisStale" | "suggestionStale">): Stage {
  const { extraction, suggestion, hasBeenSent, analysisStale, suggestionStale } = props;

  if (!extraction || analysisStale) {
    return "read";
  }

  if (suggestion && hasBeenSent && !suggestionStale) {
    return "sent";
  }

  if (!suggestion || suggestionStale || suggestion.approval_status === "rejected") {
    return "draft";
  }

  return suggestion.approval_status === "approved" ? "send" : "choose";
}

function meaningfulReasoning(value: string | undefined): string {
  const text = (value ?? "").trim();
  return text === "-" ? "" : text;
}

/**
 * Panel balas untuk Sales. Hanya satu langkah yang tampil pada satu waktu, sesuai kondisi chat:
 * baca chat, pilih jawaban, salin, lalu tandai terkirim. Komponen ini harus diberi `key` berdasarkan
 * id draft supaya pilihan dan teks yang diubah ikut reset saat draft baru muncul.
 */
export function SalesReplyFlow({
  conversationId,
  extraction,
  suggestion,
  sentMessages,
  hasBeenSent,
  analysisStale,
  suggestionStale,
  latestCustomerMessage,
  continuationHref,
  openChat = null,
  isExperimental,
  compact = false,
  onUpdated,
}: Props) {
  const stage = pickStage({ extraction, suggestion, hasBeenSent, analysisStale, suggestionStale });
  const replies = suggestion?.suggested_replies ?? [];
  const initialReply = replies.find((reply) => reply.tone === "best") ?? replies[0];

  const [selectedText, setSelectedText] = useState(initialReply?.text ?? "");
  const [finalText, setFinalText] = useState(initialReply?.text ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusy = busy !== null;
  const readyText = (suggestion?.final_reply_text ?? "").trim() || finalText.trim();

  async function post(path: string, body?: unknown) {
    await apiFetch(path, { method: "POST", body });
  }

  async function run(kind: Exclude<Busy, null>, failure: string, action: () => Promise<void>) {
    setErrorMessage("");
    setBusy(kind);

    try {
      await action();
      await onUpdated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : failure);
      // Langkah yang sudah berhasil tetap tersimpan, jadi layar perlu menampilkan keadaan terbaru.
      await onUpdated().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  const readAndDraft = () =>
    run("read", "Clara belum bisa membaca chat ini. Coba lagi.", async () => {
      await post(`/conversations/${conversationId}/analyze`);
      await post(`/conversations/${conversationId}/reply-suggestions`);
    });

  const draftOnly = () =>
    run("draft", "Clara belum bisa menyusun jawaban. Coba lagi.", async () => {
      await post(`/conversations/${conversationId}/reply-suggestions`);
    });

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  // Salin dulu, baru simpan. Browser hanya mengizinkan menyalin tepat setelah klik.
  async function submitReply() {
    await copyText(finalText);
    await run("use", "Jawaban belum bisa disimpan. Coba lagi.", async () => {
      if (!suggestion) {
        return;
      }

      await post(`/reply-suggestions/${suggestion.id}/approve`, {
        selected_reply_text: selectedText,
        final_reply_text: finalText,
        reviewer_name: "Sales Dashboard",
      });
    });
  }

  const markSent = () =>
    run("sent", "Belum bisa menandai terkirim. Coba lagi.", async () => {
      if (!suggestion) {
        return;
      }

      await post(`/reply-suggestions/${suggestion.id}/mark-sent`, { sent_by_name: "Sales Dashboard" });
    });

  const rejectAndRedraft = () =>
    run("reject", "Draft belum bisa diganti. Coba lagi.", async () => {
      if (!suggestion) {
        return;
      }

      await post(`/reply-suggestions/${suggestion.id}/reject`, {
        reason: rejectReason.trim() || "Ditolak dari dashboard.",
        reviewer_name: "Sales Dashboard",
      });
      await post(`/conversations/${conversationId}/reply-suggestions`);
    });

  const status =
    busy === "read"
      ? "Clara sedang membaca chat, lalu menyusun jawaban."
      : busy === "draft" || busy === "reject"
        ? "Clara sedang menyusun jawaban."
        : "";

  return (
    <section data-onboarding-id="sales-conversation-workspace" aria-label="Balas customer" className="min-w-0 space-y-4">
      {latestCustomerMessage && !compact ? (
        <article className="rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4">
          <p className="text-xs font-semibold clara-text-muted">Pesan terakhir customer</p>
          <p className="mt-1.5 break-words whitespace-pre-wrap text-base leading-7 clara-text-primary [overflow-wrap:anywhere]">
            {latestCustomerMessage.text}
          </p>
          <p className="mt-1.5 text-xs clara-text-muted">{formatDateTime(latestCustomerMessage.timestamp)}</p>
        </article>
      ) : null}

      <div data-onboarding-id="sales-conversation-reply-actions" className="clara-card space-y-4 p-5">
        {stage === "read" ? (
          <>
            <div>
              <h2 className="text-lg font-bold clara-text-primary">
                {extraction ? "Ada pesan baru sejak Clara terakhir membaca" : "Clara belum membaca chat ini"}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Clara akan membaca chat ini lalu menyusun jawaban. Kamu yang memilih dan mengirimnya.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void readAndDraft()}
              disabled={isBusy}
              className="clara-button clara-button-primary w-full justify-center sm:w-auto"
            >
              {busy === "read" ? "Clara sedang bekerja..." : extraction ? "Baca ulang dan susun jawaban" : "Baca dan susun jawaban"}
            </button>
          </>
        ) : null}

        {stage === "draft" ? (
          <>
            <div>
              <h2 className="text-lg font-bold clara-text-primary">
                {hasBeenSent ? "Customer membalas lagi" : "Chat sudah dibaca, jawabannya belum ada"}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                {hasBeenSent
                  ? "Jawaban lama sudah tidak cocok. Minta Clara menyusun jawaban yang baru."
                  : suggestion
                    ? "Draft sebelumnya sudah tidak dipakai. Minta Clara menyusun jawaban yang baru."
                    : "Tinggal minta Clara menyusun jawaban untuk customer ini."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void draftOnly()}
              disabled={isBusy}
              className="clara-button clara-button-primary w-full justify-center sm:w-auto"
            >
              {busy === "draft" ? "Menyusun jawaban..." : "Susun jawaban"}
            </button>
          </>
        ) : null}

        {stage === "choose" ? (
          <>
            <div>
              <h2 className="text-lg font-bold clara-text-primary">Pilih jawaban untuk customer</h2>
              {compact ? null : (
                <p className="mt-1 text-sm leading-6 clara-text-secondary">
                  Pilih satu, ubah kalau perlu. Belum ada pesan yang terkirim ke customer.
                </p>
              )}
            </div>

            {suggestion?.action_mode === "escalate_to_human" ? (
              <p role="alert" className="clara-alert clara-alert-warning">
                Topik ini sensitif. Sebaiknya tanya manager dulu sebelum mengirim jawaban.
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="sr-only">Pilihan jawaban dari Clara</legend>
              {replies.map((reply, index) => {
                const reasoning = meaningfulReasoning(reply.reasoning);
                const checked = selectedText === reply.text;

                return (
                  <label
                    key={`${reply.tone}-${index}`}
                    className={`block min-h-11 cursor-pointer rounded-2xl border p-3 ${
                      checked
                        ? "border-clara-gold bg-clara-wash"
                        : "border-clara-line-subtle bg-clara-sunken hover:border-clara-line"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="selectedReply"
                        className="mt-1 h-4 w-4 shrink-0"
                        checked={checked}
                        onChange={() => {
                          setSelectedText(reply.text);
                          setFinalText(reply.text);
                        }}
                      />
                      <div className="min-w-0">
                        <Tag tone={reply.tone === "best" ? "gold" : "neutral"}>{labelOf(REPLY_TONE, reply.tone)}</Tag>
                        <p
                          className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 clara-text-primary [overflow-wrap:anywhere] ${
                            compact ? "line-clamp-2 @3xl:line-clamp-none" : ""
                          }`}
                        >
                          {reply.text}
                        </p>
                        {checked && reasoning && !compact ? (
                          <p className="mt-2 break-words text-xs leading-5 clara-text-muted [overflow-wrap:anywhere]">
                            Alasan Clara: {reasoning}
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
                Jawaban yang akan kamu kirim (boleh diubah)
              </label>
              <textarea
                id="finalReply"
                value={finalText}
                onChange={(event) => setFinalText(event.target.value)}
                rows={compact ? 4 : 5}
                className="clara-textarea mt-2"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void submitReply()}
                disabled={isBusy || finalText.trim().length === 0}
                className="clara-button clara-button-primary justify-center"
              >
                {busy === "use" ? "Menyalin..." : "Salin jawaban ini"}
              </button>
              {showReject ? null : (
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  disabled={isBusy}
                  className="clara-button clara-button-ghost justify-center"
                >
                  Jawabannya kurang pas
                </button>
              )}
            </div>

            {showReject ? (
              <div className="space-y-2 rounded-2xl border border-clara-line-subtle p-3">
                <label htmlFor="rejectReason" className="clara-label">
                  Apa yang kurang pas? (boleh dikosongkan)
                </label>
                <input
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Contoh: terlalu umum, nadanya kurang sesuai"
                  className="clara-input"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void rejectAndRedraft()}
                    disabled={isBusy}
                    className="clara-button clara-button-secondary justify-center"
                  >
                    {busy === "reject" ? "Menyusun jawaban baru..." : "Susun jawaban baru"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    disabled={isBusy}
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {stage === "send" ? (
          <>
            <div>
              <h2 className="text-lg font-bold clara-text-primary">
                {copyState === "copied" ? "Jawaban sudah disalin" : "Jawaban siap dikirim"}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Halaman ini tidak mengirim pesan. Buka web chat customer (WhatsApp Web, Instagram, atau TikTok), kirim
                jawaban ini lewat sana dengan Clara Extension, lalu kembali ke sini dan klik{" "}
                <span className="font-semibold clara-text-primary">Sudah saya kirim</span>.
              </p>
            </div>

            <div>
              <label htmlFor="approved-reply" className="clara-label">
                Jawaban yang dikirim
              </label>
              <textarea
                id="approved-reply"
                readOnly
                value={readyText}
                rows={compact ? 3 : 5}
                onFocus={(event) => event.currentTarget.select()}
                className="clara-textarea mt-2"
              />
            </div>

            {openChat ? (
              <a
                href={openChat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="clara-button clara-button-primary w-full justify-center"
              >
                {openChat.label} (tab baru)
              </a>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void copyText(readyText)}
                disabled={!readyText}
                className="clara-button clara-button-secondary justify-center"
              >
                {copyState === "copied" ? "Tersalin" : "Salin lagi"}
              </button>
              <button
                type="button"
                onClick={() => void markSent()}
                disabled={isBusy}
                className={`clara-button justify-center ${openChat ? "clara-button-secondary" : "clara-button-primary"}`}
              >
                {busy === "sent" ? "Menyimpan..." : "Sudah saya kirim"}
              </button>
            </div>

            {copyState === "failed" ? (
              <p role="status" className="text-sm clara-text-secondary">
                Browser menolak menyalin otomatis. Klik kotak jawaban di atas, lalu tekan Ctrl+C.
              </p>
            ) : null}
          </>
        ) : null}

        {stage === "sent" ? (
          <>
            <div>
              <h2 className="text-lg font-bold text-clara-success">Sudah kamu balas</h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Tunggu customer menjawab. Ini catatan manual dari dashboard, Clara tidak tahu apakah pesannya sudah
                dibaca.
              </p>
            </div>
            <p className="text-sm leading-6 clara-text-secondary">
              Kalau customer sudah membalas di WhatsApp, masukkan chat barunya supaya Clara ikut membaca.
            </p>
            <Link href={continuationHref} className="clara-button clara-button-secondary w-full justify-center sm:w-auto">
              Tambah chat lanjutan
            </Link>
          </>
        ) : null}

        <p role="status" aria-live="polite" className="min-h-0 text-sm clara-text-secondary">
          {status}
        </p>

        {errorMessage ? (
          <p role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {extraction && !analysisStale ? (
        <ClaraReading extraction={extraction} isExperimental={isExperimental} collapsible={compact} />
      ) : null}

      {extraction && (stage === "choose" || stage === "send" || stage === "sent") ? (
        <details className="group rounded-2xl border border-clara-line-subtle p-4">
          <summary className="clara-disclosure">
            Opsi lain
          </summary>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void readAndDraft()}
              disabled={isBusy}
              className="clara-button clara-button-secondary justify-center"
            >
              {busy === "read" ? "Clara sedang bekerja..." : "Baca ulang chat dan susun jawaban baru"}
            </button>
          </div>
        </details>
      ) : null}

      {sentMessages.length > 0 ? (
        <details className="rounded-2xl border border-clara-line-subtle p-4">
          <summary className="clara-disclosure">
            Riwayat balasan terkirim ({sentMessages.length})
          </summary>
          <p className="mt-1 text-xs leading-5 clara-text-muted">
            Catatan manual dari dashboard, bukan bukti pesan sampai ke customer.
          </p>
          <ul className="mt-3 space-y-2">
            {sentMessages.map((sentMessage) => (
              <li
                key={sentMessage.id}
                className="rounded-xl border border-clara-success-line bg-clara-success-surface p-3 text-sm text-clara-success"
              >
                <p className="text-xs">
                  {sentMessage.sent_by_name} · {formatDateTime(sentMessage.sent_at)}
                </p>
                <p className="mt-1 break-words whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                  {sentMessage.message_text}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function ClaraReading({
  extraction,
  isExperimental,
  collapsible,
}: {
  extraction: DashboardAIExtractionSummary;
  isExperimental: boolean;
  collapsible: boolean;
}) {
  const content = (
    <>
      {extraction.customer_summary ? (
        <p className="mt-2 text-sm leading-6 clara-text-primary">{extraction.customer_summary}</p>
      ) : null}

      <p className="mt-3 rounded-xl bg-clara-wash p-3 text-sm leading-6 clara-text-primary">
        <span className="font-semibold">Langkah berikutnya: </span>
        {extraction.next_best_action}
      </p>

      <details className="mt-3">
        <summary className="clara-disclosure">Lihat detail bacaan Clara</summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Tahap customer">
            <ValueTag table={STAGE} value={extraction.pipeline_stage} />
          </Item>
          <Item label="Minat beli">
            <ValueTag table={BUYING_INTENT} value={extraction.buying_intent} />
          </Item>
          <Item label="Suasana hati customer">
            <ValueTag table={SENTIMENT} value={extraction.sentiment} />
          </Item>
          <Item label="Keyakinan Clara">
            <span className="text-sm clara-text-primary">{(extraction.confidence_score * 100).toFixed(0)}%</span>
          </Item>
          <div className="col-span-2">
            <dt className="text-xs clara-text-muted">Hal yang membuat customer ragu</dt>
            <dd className="mt-1.5 flex flex-wrap gap-2">
              {extraction.main_objections.length > 0 ? (
                extraction.main_objections.map((objection) => <Tag key={objection}>{objection}</Tag>)
              ) : (
                <span className="text-sm clara-text-secondary">Tidak ada yang menonjol.</span>
              )}
            </dd>
          </div>
        </dl>
      </details>

      {isExperimental ? (
        <p className="mt-3 text-xs leading-5 clara-text-muted">
          Channel ini masih eksperimental. Baca ulang konteks chat sebelum memakai jawaban apa adanya.
        </p>
      ) : null}
    </>
  );

  if (collapsible) {
    return (
      <details data-onboarding-id="sales-conversation-ai-summary" className="rounded-2xl border border-clara-line-subtle p-4">
        <summary className="clara-disclosure">Yang Clara baca dari chat ini</summary>
        {content}
      </details>
    );
  }

  return (
    <section data-onboarding-id="sales-conversation-ai-summary" className="clara-card p-5">
      <h3 className="text-base font-bold clara-text-primary">Yang Clara baca dari chat ini</h3>
      {content}
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
