"use client";

import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { FormEvent, Fragment, useEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/dashboard/ChatAvatar";
import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { ClaraReading } from "@/components/dashboard/SalesReplyFlow";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import {
  buildContinuationHref,
  hasFreshCustomerReply,
  isAnalysisStale,
  isReplySuggestionStale,
  isSalesConversationMessage,
} from "@/lib/conversation";
import {
  formatChannelLabel,
  formatClock,
  formatDateTime,
  formatDayHeading,
  formatProviderLabel,
  formatRelativeTime,
  inferProviderFromSource,
  isExperimentalChannel,
  localDayKey,
} from "@/lib/format";
import { STAGE, TEMPERATURE } from "@/lib/vocab";
import type {
  ChatReviewerCandidateItem,
  CurrentUser,
  SalesConversationDetail,
} from "@/types/dashboard";

type Panel = "reply" | "feedback" | "knowledge" | "sent";

const REVIEW_STATUS_OPTIONS = [
  "draft",
  "in_review",
  "needs_rework",
  "coaching_done",
  "escalated",
] as const;
const REVIEW_LABEL_OPTIONS = [
  "berhasil",
  "gagal",
  "unik",
  "perlu_eskalasi",
] as const;
const KNOWLEDGE_STATUS_OPTIONS = ["draft", "pending_approval"] as const;

const REVIEW_STATUS_TEXT: Record<string, string> = {
  draft: "Konsep",
  in_review: "Sedang ditinjau",
  needs_rework: "Perlu diperbaiki Sales",
  coaching_done: "Sudah dibimbing",
  escalated: "Dieskalasi",
};

const REVIEW_LABEL_TEXT: Record<string, string> = {
  berhasil: "Berhasil",
  gagal: "Gagal",
  unik: "Kasus unik",
  perlu_eskalasi: "Perlu eskalasi",
};

const NOTE_TYPE_TEXT: Record<string, string> = {
  manager_note: "Catatan manager",
  system: "Sistem",
  system_note: "Sistem",
};

const KNOWLEDGE_STATUS_TEXT: Record<string, string> = {
  draft: "Konsep",
  pending_approval: "Menunggu persetujuan superadmin",
  approved: "Disetujui",
  rejected: "Ditolak",
  published: "Sudah terbit",
};

function humanize(value: string): string {
  const text = value.replaceAll("_", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "-";
}

const textOf = (table: Record<string, string>, value: string) =>
  table[value] ?? humanize(value);

export type ReviewerWorkspaceProps = {
  currentUser: CurrentUser | null;
  detail: SalesConversationDetail;
  backHref: string;
  backLabel: string;
  uploadBanner: { tone: "success" | "neutral"; text: string } | null;
  /** Superadmin ikut mengoperasikan chat, jadi tombol baca ulang dan susun jawaban tetap ada untuknya. */
  canOperate: boolean;
  canManage: boolean;
  canReviewProposal: boolean;
  reviewerCandidates: ChatReviewerCandidateItem[];
  reviewErrorMessage: string;
  reviewSuccessMessage: string;
  isSavingReviewCase: boolean;
  isAddingReviewNote: boolean;
  isPrefillingReviewCase: boolean;
  reviewStatusInput: string;
  reviewLabelInput: string;
  reviewerUserInput: string;
  reviewSummaryInput: string;
  coachingFocusInput: string;
  recommendedActionInput: string;
  reviewNoteInput: string;
  reviewSuggestionHint: string;
  knowledgeProposalTitleInput: string;
  knowledgeProposalCategoryInput: string;
  knowledgeProposalContentInput: string;
  knowledgeProposalSourceTypeInput: string;
  knowledgeProposalRationaleInput: string;
  knowledgeProposalStatusInput: string;
  knowledgeProposalDecisionNoteInput: string;
  knowledgeProposalErrorMessage: string;
  knowledgeProposalSuccessMessage: string;
  isSavingKnowledgeProposal: boolean;
  isReviewingKnowledgeProposal: boolean;
  onReviewStatusChange: (value: string) => void;
  onReviewLabelChange: (value: string) => void;
  onReviewerUserChange: (value: string) => void;
  onReviewSummaryChange: (value: string) => void;
  onCoachingFocusChange: (value: string) => void;
  onRecommendedActionChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onKnowledgeProposalTitleChange: (value: string) => void;
  onKnowledgeProposalCategoryChange: (value: string) => void;
  onKnowledgeProposalContentChange: (value: string) => void;
  onKnowledgeProposalRationaleChange: (value: string) => void;
  onKnowledgeProposalStatusChange: (value: string) => void;
  onKnowledgeProposalDecisionNoteChange: (value: string) => void;
  onPrefillReviewCase: () => Promise<void>;
  onSaveReviewCase: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddReviewNote: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveKnowledgeProposal: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReviewKnowledgeProposal: (status: "approved" | "rejected") => Promise<void>;
  onUpdated: () => Promise<void>;
};

/** Satu kalimat: apa yang perlu dilakukan reviewer di chat ini, dari kondisi chat. */
function describeNextStep(
  detail: SalesConversationDetail,
  canManage: boolean,
): { title: string; body: string; cta?: { label: string; panel: Panel } } {
  const suggestion = detail.latest_reply_suggestion;
  const reviewCase = detail.chat_review_case;
  const hasBeenSent = Boolean(
    suggestion &&
    detail.sent_messages.some(
      (sent) => sent.reply_suggestion_id === suggestion.id,
    ),
  );
  const stale = isReplySuggestionStale(detail);

  if (
    suggestion &&
    !hasBeenSent &&
    !stale &&
    suggestion.approval_status === "pending" &&
    ["human_approval_required", "escalate_to_human"].includes(
      suggestion.action_mode,
    )
  ) {
    return {
      title:
        suggestion.action_mode === "escalate_to_human"
          ? "Topiknya sensitif, Sales butuh keputusanmu"
          : "Sales menunggu persetujuanmu",
      body: "Baca chat di sebelah kiri, lalu setujui atau tolak draf jawabannya sebelum dikirim.",
      cta: { label: "Lihat draf jawaban", panel: "reply" },
    };
  }

  if (hasFreshCustomerReply(detail)) {
    return {
      title: "Customer menunggu jawaban baru",
      body: "Customer membalas lagi setelah jawaban terakhir Sales, dan belum ada jawaban baru. Kalau sudah lama, ingatkan Sales.",
      cta: canManage
        ? { label: "Beri masukan ke Sales", panel: "feedback" }
        : undefined,
    };
  }

  if (reviewCase?.status === "needs_rework") {
    return {
      title: "Masukan sudah diberikan, menunggu perbaikan Sales",
      body: "Kamu sudah menandai kasus ini perlu diperbaiki. Pantau apakah Sales sudah menindaklanjuti.",
      cta: { label: "Lihat masukan", panel: "feedback" },
    };
  }

  if (hasBeenSent && !reviewCase && canManage) {
    return {
      title: "Jawaban Sales sudah terkirim",
      body: "Baca isi chat. Kalau ada yang bisa diperbaiki, beri masukan supaya Sales belajar dari kasus ini.",
      cta: { label: "Beri masukan", panel: "feedback" },
    };
  }

  return {
    title: "Tidak ada yang perlu kamu putuskan di chat ini",
    body: "Jawaban sudah ditangani. Kamu tetap bisa memberi masukan ke Sales kapan saja.",
    cta: canManage ? { label: "Beri masukan", panel: "feedback" } : undefined,
  };
}

/**
 * Halaman tinjau chat untuk Manager, Head, dan Superadmin: isi chat di kiri, keputusan di kanan.
 * Semua istilah memakai bahasa biasa, dan tombol milik Sales (baca ulang, susun jawaban) tidak ditampilkan.
 */
export function ReviewerWorkspace(props: ReviewerWorkspaceProps) {
  const {
    detail,
    backHref,
    backLabel,
    uploadBanner,
    canOperate,
    canManage,
    canReviewProposal,
    onUpdated,
  } = props;
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const freshCustomerReply = hasFreshCustomerReply(detail);
  const provider = inferProviderFromSource(detail.source);
  const channelLabel = formatChannelLabel(detail.source_channel);
  const showReading = Boolean(extraction) && !analysisStale;
  const nextStep = describeNextStep(detail, canManage);
  const [panel, setPanel] = useState<Panel>("reply");

  return (
    <div className="space-y-4">
      <header className="clara-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-clara-line hover:bg-clara-sunken"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" />
          </Link>
          <ChatAvatar title={detail.title} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-lg font-bold clara-text-primary">
              {detail.title}
            </h1>
            <p className="text-xs clara-text-muted">
              {provider === "manual" || provider === "unknown"
                ? channelLabel
                : `${channelLabel} · ${formatProviderLabel(provider)}`}{" "}
              · Aktivitas terakhir {formatRelativeTime(detail.last_message_at)}
            </p>
          </div>
          {canOperate ? (
            <Link
              href={buildContinuationHref(detail)}
              className="clara-button clara-button-secondary"
            >
              Tambah chat lanjutan
            </Link>
          ) : null}
        </div>

        {showReading && extraction ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <ValueTag table={TEMPERATURE} value={extraction.lead_temperature} />
            <ValueTag table={STAGE} value={extraction.pipeline_stage} />
            {extraction.risk_level !== "low" ? (
              <Tag tone={extraction.risk_level === "high" ? "danger" : "warn"}>
                {extraction.risk_level === "high"
                  ? "Risiko tinggi"
                  : "Risiko sedang"}
              </Tag>
            ) : null}
            {isExperimentalChannel(detail.source_channel) ? (
              <Tag tone="warn">Eksperimental</Tag>
            ) : null}
          </div>
        ) : null}

        {uploadBanner ? (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 ${uploadBanner.tone === "success" ? "clara-alert clara-alert-success" : "clara-alert clara-alert-info"}`}
          >
            {uploadBanner.text}
          </p>
        ) : null}

        {freshCustomerReply || analysisStale || suggestionStale ? (
          <p role="status" className="clara-alert clara-alert-warning mt-3">
            {freshCustomerReply
              ? "Customer membalas lagi setelah jawaban terakhir Sales."
              : "Ada pesan baru yang belum dibaca Clara, jadi ringkasan di kanan bisa sudah tertinggal."}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)] xl:items-start">
        <ChatColumn detail={detail} />

        <div className="min-w-0 space-y-4">
          <section
            aria-labelledby="review-next-step"
            className="clara-card p-5"
          >
            <p className="text-sm font-semibold text-clara-gold">
              Yang perlu kamu lakukan
            </p>
            <h2
              id="review-next-step"
              className="mt-1 text-lg font-bold clara-text-primary"
            >
              {nextStep.title}
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              {nextStep.body}
            </p>
            {nextStep.cta ? (
              <button
                type="button"
                onClick={() => setPanel(nextStep.cta?.panel ?? "reply")}
                className="clara-button clara-button-primary mt-4"
              >
                {nextStep.cta.label}
              </button>
            ) : null}
          </section>

          <div
            role="group"
            aria-label="Bagian kerja"
            className="flex flex-wrap gap-2"
          >
            {(
              [
                ["reply", "Jawaban Sales"],
                ["feedback", "Masukan untuk Sales"],
                ["knowledge", "Usulan knowledge"],
                ["sent", `Riwayat kirim (${detail.sent_messages.length})`],
              ] as Array<[Panel, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPanel(value)}
                aria-pressed={panel === value}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                  panel === value
                    ? "border-clara-gold bg-clara-gold text-clara-deep"
                    : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {panel === "reply" ? (
            <div className="space-y-4">
              {canOperate ? (
                <ConversationAiActions
                  conversationId={detail.conversation_id}
                  hasAiExtraction={Boolean(extraction)}
                  hasReplySuggestion={Boolean(suggestion)}
                  analysisNeedsRefresh={analysisStale}
                  replyNeedsRefresh={suggestionStale}
                  onUpdated={onUpdated}
                />
              ) : null}

              {suggestion ? (
                <ReplySuggestionActions
                  replySuggestionId={suggestion.id}
                  suggestedReplies={suggestion.suggested_replies}
                  approvalStatus={suggestion.approval_status}
                  hasBeenSent={detail.sent_messages.some(
                    (sent) => sent.reply_suggestion_id === suggestion.id,
                  )}
                  isStale={suggestionStale}
                  onUpdated={onUpdated}
                />
              ) : (
                <section className="rounded-2xl border border-dashed border-clara-line p-5">
                  <h2 className="text-base font-semibold clara-text-primary">
                    Sales belum menyusun jawaban
                  </h2>
                  <p className="mt-1 text-sm leading-6 clara-text-secondary">
                    Belum ada draf jawaban untuk chat ini. Kalau chat ini sudah
                    lama menunggu, ingatkan Sales.
                  </p>
                </section>
              )}

              {extraction ? (
                <ClaraReading
                  extraction={extraction}
                  isExperimental={isExperimentalChannel(detail.source_channel)}
                  collapsible={false}
                />
              ) : (
                <section className="rounded-2xl border border-dashed border-clara-line p-5 text-sm clara-text-secondary">
                  Clara belum membaca chat ini.
                </section>
              )}
            </div>
          ) : null}

          {panel === "feedback" ? <FeedbackPanel {...props} /> : null}
          {panel === "knowledge" ? (
            <KnowledgePanel {...props} canReviewProposal={canReviewProposal} />
          ) : null}

          {panel === "sent" ? (
            <section className="clara-card p-5">
              <h2 className="text-lg font-bold clara-text-primary">
                Balasan yang sudah ditandai terkirim
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Ini catatan manual dari dashboard, bukan bukti pesan sampai atau
                sudah dibaca customer.
              </p>
              {detail.sent_messages.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {detail.sent_messages.map((sent) => (
                    <li
                      key={sent.id}
                      className="rounded-2xl border border-clara-success-line bg-clara-success-surface p-4 text-sm text-clara-success"
                    >
                      <p className="font-semibold">
                        Dikirim oleh {sent.sent_by_name}
                      </p>
                      <p className="mt-1 text-xs">
                        {formatDateTime(sent.sent_at)}
                      </p>
                      <p className="mt-3 break-words whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                        {sent.message_text}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm clara-text-secondary">
                  Belum ada balasan yang ditandai terkirim.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const RECENT_MESSAGE_COUNT = 40;

/** Isi chat untuk dibaca reviewer: urut dari lama ke baru, dikelompokkan per tanggal, langsung ke pesan terbaru. */
function ChatColumn({ detail }: { detail: SalesConversationDetail }) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const messages = showAll
    ? detail.messages
    : detail.messages.slice(-RECENT_MESSAGE_COUNT);
  const hiddenCount = detail.messages.length - messages.length;

  useEffect(() => {
    if (!showAll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [detail.conversation_id, detail.messages.length, showAll]);

  return (
    <section
      aria-labelledby="review-chat-title"
      data-onboarding-id="sales-conversation-timeline"
      className="clara-card flex min-w-0 flex-col overflow-hidden xl:sticky xl:top-20 xl:h-[calc(100dvh-14rem)] xl:min-h-[28rem]"
    >
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-clara-line-subtle px-4 py-3">
        <h2
          id="review-chat-title"
          className="text-base font-bold clara-text-primary"
        >
          Isi chat
        </h2>
        <p className="text-xs clara-text-muted">
          {detail.messages.length} pesan
        </p>
      </div>

      <ol
        ref={listRef}
        aria-label="Pesan percakapan"
        className="clara-scrollbar max-h-[70vh] min-h-[16rem] flex-1 space-y-3 overflow-y-auto bg-clara-sunken p-3 sm:p-4 xl:max-h-none"
      >
        {hiddenCount > 0 ? (
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="clara-button clara-button-ghost"
            >
              Tampilkan {hiddenCount} pesan lama
            </button>
          </li>
        ) : null}

        {messages.length === 0 ? (
          <li className="clara-empty-state text-sm">
            Belum ada pesan pada percakapan ini.
          </li>
        ) : null}

        {messages.map((message, index) => {
          const isSales = isSalesConversationMessage(message);
          const startsNewDay =
            index === 0 ||
            localDayKey(messages[index - 1].message_timestamp) !==
              localDayKey(message.message_timestamp);

          return (
            <Fragment key={message.id}>
              {startsNewDay ? (
                <li
                  className="flex justify-center"
                  aria-label={formatDayHeading(message.message_timestamp)}
                >
                  <span className="rounded-full border border-clara-line-subtle bg-clara-surface px-3 py-1 text-xs font-semibold clara-text-secondary">
                    {formatDayHeading(message.message_timestamp)}
                  </span>
                </li>
              ) : null}
              <li
                className={`flex min-w-0 ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[88%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[78%] ${
                    isSales
                      ? "rounded-tr-sm border-[var(--color-border-strong)] bg-[var(--color-warning-surface)]"
                      : "rounded-tl-sm border-[var(--color-border-default)] bg-[var(--color-surface-base)]"
                  }`}
                >
                  <p className="mb-0.5 text-xs font-semibold clara-text-secondary">
                    {isSales ? `Sales · ${message.sender_name}` : "Customer"}
                  </p>
                  {message.reply_context_text ? (
                    <blockquote className="mb-2 min-w-0 rounded-lg border-l-4 border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs leading-5 clara-text-secondary">
                      <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {message.reply_context_text}
                      </p>
                    </blockquote>
                  ) : null}
                  <p className="break-words whitespace-pre-wrap text-[15px] leading-6 clara-text-primary [overflow-wrap:anywhere]">
                    {message.message_text}
                  </p>
                  <p className="mt-1 text-right text-xs clara-text-muted">
                    {formatClock(message.message_timestamp)}
                  </p>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-clara-sunken p-3">
      <p className="text-xs clara-text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 clara-text-primary">
        {value}
      </p>
    </div>
  );
}

function FeedbackPanel(props: ReviewerWorkspaceProps) {
  const { detail, canManage, reviewerCandidates } = props;
  const reviewCase = detail.chat_review_case;

  return (
    <section className="clara-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold clara-text-primary">
            Masukan untuk Sales
          </h2>
          <p className="mt-1 text-sm leading-6 clara-text-secondary">
            Catat apa yang sudah bagus dan apa yang perlu diperbaiki dari
            balasan Sales di chat ini.
          </p>
        </div>
        {reviewCase ? (
          <Tag tone="info">
            {textOf(REVIEW_STATUS_TEXT, reviewCase.status)} ·{" "}
            {textOf(REVIEW_LABEL_TEXT, reviewCase.review_label)}
          </Tag>
        ) : (
          <Tag tone="neutral">Belum ada masukan</Tag>
        )}
      </div>

      {props.reviewSuccessMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="clara-alert clara-alert-success mt-4"
        >
          {props.reviewSuccessMessage}
        </p>
      ) : null}
      {props.reviewErrorMessage ? (
        <p role="alert" className="clara-alert clara-alert-danger mt-4">
          {props.reviewErrorMessage}
        </p>
      ) : null}
      {props.reviewSuggestionHint ? (
        <p role="status" className="clara-alert clara-alert-info mt-4">
          Saran Clara, belum disimpan: {props.reviewSuggestionHint}
        </p>
      ) : null}

      {canManage ? (
        <form onSubmit={props.onSaveReviewCase} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status penanganan">
              <select
                value={props.reviewStatusInput}
                onChange={(event) =>
                  props.onReviewStatusChange(event.target.value)
                }
                className="clara-select"
              >
                {REVIEW_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {textOf(REVIEW_STATUS_TEXT, option)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Penilaian">
              <select
                value={props.reviewLabelInput}
                onChange={(event) =>
                  props.onReviewLabelChange(event.target.value)
                }
                className="clara-select"
              >
                {REVIEW_LABEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {textOf(REVIEW_LABEL_TEXT, option)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Peninjau">
            <select
              value={props.reviewerUserInput}
              onChange={(event) =>
                props.onReviewerUserChange(event.target.value)
              }
              className="clara-select"
            >
              <option value="">Belum ditunjuk</option>
              {reviewerCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.role}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Ringkasan kasus">
            <textarea
              value={props.reviewSummaryInput}
              onChange={(event) =>
                props.onReviewSummaryChange(event.target.value)
              }
              rows={3}
              className="clara-textarea"
              placeholder="Tulis singkat apa yang terjadi di chat ini dan kenapa perlu diberi masukan."
            />
          </Field>

          <Field label="Yang perlu diperbaiki Sales">
            <textarea
              value={props.coachingFocusInput}
              onChange={(event) =>
                props.onCoachingFocusChange(event.target.value)
              }
              rows={3}
              className="clara-textarea"
              placeholder="Contoh: cara menjawab keberatan soal legalitas, nada saat closing, atau langkah berikutnya."
            />
          </Field>

          <Field label="Yang sebaiknya dilakukan Sales">
            <textarea
              value={props.recommendedActionInput}
              onChange={(event) =>
                props.onRecommendedActionChange(event.target.value)
              }
              rows={3}
              className="clara-textarea"
              placeholder="Jelaskan langkah yang harus Sales lakukan setelah membaca masukan ini."
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void props.onPrefillReviewCase()}
              disabled={props.isPrefillingReviewCase}
              className="clara-button clara-button-secondary"
            >
              {props.isPrefillingReviewCase
                ? "Clara sedang mengisi..."
                : "Isi otomatis dengan Clara"}
            </button>
            <button
              type="submit"
              disabled={props.isSavingReviewCase}
              className="clara-button clara-button-primary"
            >
              {props.isSavingReviewCase ? "Menyimpan..." : "Simpan masukan"}
            </button>
          </div>
        </form>
      ) : reviewCase ? (
        <div className="mt-5 space-y-2">
          <ReadOnlyRow
            label="Peninjau"
            value={reviewCase.reviewer_user_name ?? "Belum ditunjuk"}
          />
          <ReadOnlyRow
            label="Ringkasan kasus"
            value={reviewCase.review_summary ?? "-"}
          />
          <ReadOnlyRow
            label="Yang perlu diperbaiki Sales"
            value={reviewCase.coaching_focus ?? "-"}
          />
          <ReadOnlyRow
            label="Yang sebaiknya dilakukan Sales"
            value={reviewCase.recommended_action ?? "-"}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-clara-line p-4 text-sm clara-text-secondary">
          Belum ada masukan untuk percakapan ini.
        </p>
      )}

      {reviewCase ? (
        <div className="mt-6 space-y-4 border-t border-clara-line-subtle pt-5">
          <h3 className="text-base font-bold clara-text-primary">
            Catatan lanjutan
          </h3>

          {canManage ? (
            <form onSubmit={props.onAddReviewNote} className="space-y-3">
              <label htmlFor="manager-note" className="clara-label">
                Tulis catatan
              </label>
              <textarea
                id="manager-note"
                value={props.reviewNoteInput}
                onChange={(event) =>
                  props.onReviewNoteChange(event.target.value)
                }
                rows={3}
                className="clara-textarea"
                placeholder="Tulis arahan, permintaan perbaikan, atau alasan eskalasi."
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={props.isAddingReviewNote}
                  className="clara-button clara-button-secondary"
                >
                  {props.isAddingReviewNote ? "Menyimpan..." : "Tambah catatan"}
                </button>
              </div>
            </form>
          ) : null}

          {reviewCase.notes.length > 0 ? (
            <ul className="space-y-3">
              {reviewCase.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-2xl border border-clara-line bg-clara-raised p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs clara-text-muted">
                    <span className="font-semibold clara-text-secondary">
                      {note.author_user_name ?? "Sistem"}
                    </span>
                    <span>{formatDateTime(note.created_at)}</span>
                    <Tag>{textOf(NOTE_TYPE_TEXT, note.note_type)}</Tag>
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 clara-text-secondary [overflow-wrap:anywhere]">
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-clara-line p-4 text-sm clara-text-muted">
              Belum ada catatan lanjutan.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function KnowledgePanel(props: ReviewerWorkspaceProps) {
  const { detail, canManage, canReviewProposal } = props;
  const reviewCase = detail.chat_review_case;
  const proposal = detail.knowledge_update_proposal;
  const cannotSave =
    props.isSavingKnowledgeProposal ||
    props.knowledgeProposalTitleInput.trim().length === 0 ||
    props.knowledgeProposalCategoryInput.trim().length === 0 ||
    props.knowledgeProposalContentInput.trim().length === 0 ||
    props.knowledgeProposalSourceTypeInput.trim().length === 0;

  return (
    <section className="clara-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold clara-text-primary">
            Usulan jawaban resmi
          </h2>
          <p className="mt-1 text-sm leading-6 clara-text-secondary">
            Kalau dari kasus ini ada jawaban yang sebaiknya dipakai semua Sales,
            usulkan jadi knowledge resmi. Superadmin yang memutuskan apakah
            usulan ini diterbitkan.
          </p>
        </div>
        {proposal ? (
          <Tag tone="info">
            {textOf(KNOWLEDGE_STATUS_TEXT, proposal.status)}
          </Tag>
        ) : (
          <Tag tone="neutral">Belum ada usulan</Tag>
        )}
      </div>

      {!reviewCase ? (
        <p className="mt-5 rounded-2xl border border-dashed border-clara-line p-4 text-sm leading-6 clara-text-secondary">
          Simpan dulu masukan untuk Sales di tab &ldquo;Masukan untuk
          Sales&rdquo;. Usulan knowledge selalu terkait ke kasus yang sudah
          dinilai, supaya jelas asal-usulnya.
        </p>
      ) : (
        <>
          {props.knowledgeProposalSuccessMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="clara-alert clara-alert-success mt-4"
            >
              {props.knowledgeProposalSuccessMessage}
            </p>
          ) : null}
          {props.knowledgeProposalErrorMessage ? (
            <p role="alert" className="clara-alert clara-alert-danger mt-4">
              {props.knowledgeProposalErrorMessage}
            </p>
          ) : null}

          {canManage ? (
            <form
              onSubmit={props.onSaveKnowledgeProposal}
              className="mt-5 space-y-4"
            >
              <Field label="Judul usulan">
                <input
                  value={props.knowledgeProposalTitleInput}
                  onChange={(event) =>
                    props.onKnowledgeProposalTitleChange(event.target.value)
                  }
                  className="clara-input"
                  placeholder="Contoh: Cara menjawab keraguan soal legalitas"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kategori">
                  <input
                    value={props.knowledgeProposalCategoryInput}
                    onChange={(event) =>
                      props.onKnowledgeProposalCategoryChange(
                        event.target.value,
                      )
                    }
                    className="clara-input"
                    placeholder="legalitas / keberatan / kepercayaan"
                  />
                </Field>
                <Field label="Langkah berikutnya">
                  <select
                    value={props.knowledgeProposalStatusInput}
                    onChange={(event) =>
                      props.onKnowledgeProposalStatusChange(event.target.value)
                    }
                    className="clara-select"
                  >
                    {KNOWLEDGE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "draft"
                          ? "Simpan sebagai konsep"
                          : "Kirim ke superadmin untuk disetujui"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Alasan usulan">
                <textarea
                  value={props.knowledgeProposalRationaleInput}
                  onChange={(event) =>
                    props.onKnowledgeProposalRationaleChange(event.target.value)
                  }
                  rows={3}
                  className="clara-textarea"
                  placeholder="Jelaskan kenapa kasus ini layak dijadikan jawaban resmi."
                />
              </Field>
              <Field label="Isi jawaban resmi yang diusulkan">
                <textarea
                  value={props.knowledgeProposalContentInput}
                  maxLength={50_000}
                  onChange={(event) =>
                    props.onKnowledgeProposalContentChange(event.target.value)
                  }
                  rows={8}
                  className="clara-textarea"
                  placeholder="Tulis jawaban final yang nantinya dipakai Clara dan Sales."
                />
                <span className="text-xs clara-text-muted">
                  {props.knowledgeProposalContentInput.length.toLocaleString(
                    "id-ID",
                  )}{" "}
                  / 50.000 karakter
                </span>
              </Field>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={cannotSave}
                  className="clara-button clara-button-primary"
                >
                  {props.isSavingKnowledgeProposal
                    ? "Menyimpan..."
                    : props.knowledgeProposalStatusInput === "pending_approval"
                      ? "Simpan dan kirim ke superadmin"
                      : "Simpan usulan"}
                </button>
              </div>
            </form>
          ) : null}

          {proposal ? (
            <div className="mt-5 space-y-2">
              <ReadOnlyRow
                label="Diusulkan oleh"
                value={proposal.proposed_by_user_name ?? "-"}
              />
              <ReadOnlyRow
                label="Alasan usulan"
                value={proposal.rationale ?? "-"}
              />
              <ReadOnlyRow
                label="Catatan keputusan"
                value={proposal.review_decision_note ?? "-"}
              />
              <ReadOnlyRow
                label="Jawaban resmi yang terbit"
                value={proposal.published_product_knowledge_title ?? "-"}
              />
            </div>
          ) : null}

          {canReviewProposal && proposal ? (
            <div className="mt-5 space-y-3 rounded-2xl border border-clara-line bg-clara-sunken p-4">
              <Field label="Catatan keputusan (alasan setuju, tolak, atau revisi)">
                <textarea
                  value={props.knowledgeProposalDecisionNoteInput}
                  onChange={(event) =>
                    props.onKnowledgeProposalDecisionNoteChange(
                      event.target.value,
                    )
                  }
                  rows={3}
                  className="clara-textarea"
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={props.isReviewingKnowledgeProposal}
                  onClick={() =>
                    void props.onReviewKnowledgeProposal("rejected")
                  }
                  className="clara-button clara-button-danger"
                >
                  {props.isReviewingKnowledgeProposal
                    ? "Memproses..."
                    : "Tolak"}
                </button>
                <button
                  type="button"
                  disabled={props.isReviewingKnowledgeProposal}
                  onClick={() =>
                    void props.onReviewKnowledgeProposal("approved")
                  }
                  className="clara-button clara-button-success"
                >
                  {props.isReviewingKnowledgeProposal
                    ? "Memproses..."
                    : "Setujui dan terbitkan"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
