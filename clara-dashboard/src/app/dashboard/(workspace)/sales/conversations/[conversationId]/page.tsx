"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatDateTime,
  formatProviderLabel,
  formatStatusLabel,
  getChannelBadgeClass,
  getLeadBadgeClass,
  getProviderBadgeClass,
  getRiskBadgeClass,
  inferProviderFromSource,
  isExperimentalChannel,
} from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  ChatReviewCaseItem,
  ChatReviewCaseSuggestionResponse,
  ChatReviewCaseUpsertRequest,
  ChatReviewNoteCreateRequest,
  ChatReviewerCandidateItem,
  CurrentUser,
  KnowledgeUpdateProposalItem,
  KnowledgeUpdateProposalReviewRequest,
  KnowledgeUpdateProposalUpsertRequest,
  SalesConversationDetail,
} from "@/types/dashboard";

const CHAT_REVIEW_STATUS_OPTIONS = [
  "draft",
  "in_review",
  "needs_rework",
  "coaching_done",
  "escalated",
];

const CHAT_REVIEW_LABEL_OPTIONS = [
  "berhasil",
  "gagal",
  "unik",
  "perlu_eskalasi",
];

const KNOWLEDGE_PROPOSAL_STATUS_OPTIONS = ["draft", "pending_approval"];

function canManageReviewCase(role?: string | null): boolean {
  return ["manager", "head", "superadmin"].includes((role ?? "").toLowerCase());
}

function canReviewKnowledgeProposal(role?: string | null): boolean {
  return ["superadmin"].includes((role ?? "").toLowerCase());
}

function formatReviewCaseStatus(value: string): string {
  return formatStatusLabel(value);
}

function formatReviewCaseLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatKnowledgeProposalStatus(value: string): string {
  return formatStatusLabel(value);
}

function formatAccountCategory(value: string): string {
  switch (value) {
    case "mini":
      return "Mini";
    case "reguler":
      return "Reguler";
    case "unknown":
      return "Belum ditentukan";
    default:
      return value.replaceAll("_", " ");
  }
}

function getAccountCategoryBadgeClass(value: string): string {
  switch (value) {
    case "mini":
      return "bg-emerald-100 text-emerald-700";
    case "reguler":
      return "bg-amber-100 text-amber-700";
    default:
      return "border border-[#d9bf87] bg-[#f7ebc9] text-[#6a4a17]";
  }
}

function getLatestConversationMessage(detail: SalesConversationDetail) {
  return [...detail.messages].sort((left, right) =>
    left.message_timestamp.localeCompare(right.message_timestamp),
  )[detail.messages.length - 1] ?? null;
}

function isSalesConversationMessage(
  message: SalesConversationDetail["messages"][number],
): boolean {
  const normalizedSenderType = message.sender_type.trim().toLowerCase();

  return ["sales", "outgoing", "agent", "admin"].includes(
    normalizedSenderType,
  );
}

function getLatestSentMessage(detail: SalesConversationDetail) {
  return [...detail.sent_messages].sort((left, right) =>
    left.sent_at.localeCompare(right.sent_at),
  )[detail.sent_messages.length - 1] ?? null;
}

function isAnalysisStale(detail: SalesConversationDetail): boolean {
  const extraction = detail.latest_ai_extraction;
  const latestMessage = getLatestConversationMessage(detail);
  if (!extraction || !latestMessage || latestMessage.sender_type !== "customer") {
    return false;
  }
  return extraction.created_at < latestMessage.message_timestamp;
}

function isReplySuggestionStale(detail: SalesConversationDetail): boolean {
  const suggestion = detail.latest_reply_suggestion;
  const latestMessage = getLatestConversationMessage(detail);
  if (!suggestion || !latestMessage || latestMessage.sender_type !== "customer") {
    return false;
  }
  return suggestion.created_at < latestMessage.message_timestamp;
}

function hasFreshCustomerReply(detail: SalesConversationDetail): boolean {
  const latestMessage = getLatestConversationMessage(detail);
  const latestSent = getLatestSentMessage(detail);
  if (!latestMessage || latestMessage.sender_type !== "customer" || !latestSent) {
    return false;
  }
  return latestMessage.message_timestamp > latestSent.sent_at;
}

function buildContinuationHref(detail: SalesConversationDetail): string {
  const params = new URLSearchParams({
    mode: "continue",
    title: detail.title,
    channel: detail.source_channel || "whatsapp",
    conversationId: detail.conversation_id,
  });
  return `/dashboard/upload?${params.toString()}`;
}

function buildUploadResultBanner(
  searchParams: { get(name: string): string | null },
): { tone: "success" | "neutral"; text: string } | null {
  const uploadStatus = searchParams.get("uploadStatus");
  if (!uploadStatus) {
    return null;
  }

  const appendedCount = Number(searchParams.get("appended") ?? "0");
  const messageCount = Number(searchParams.get("messageCount") ?? "0");

  if (uploadStatus === "created") {
    return {
      tone: "success",
      text: `Conversation baru dibuat dari ${messageCount} pesan yang baru di-upload.`,
    };
  }

  if (uploadStatus === "updated") {
    return {
      tone: "success",
      text: `${appendedCount} pesan baru berhasil ditempelkan ke conversation ini. Cek lagi analisis dan draft lama karena konteks chat sudah berkembang.`,
    };
  }

  if (uploadStatus === "unchanged") {
    return {
      tone: "neutral",
      text: "Upload terakhir tidak menambah pesan baru. Clara menganggap isi chat yang Anda kirim sama dengan yang sudah ada di conversation ini.",
    };
  }

  return null;
}

export default function SalesConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [detail, setDetail] = useState<SalesConversationDetail | null>(null);
  const [reviewerCandidates, setReviewerCandidates] = useState<
    ChatReviewerCandidateItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewErrorMessage, setReviewErrorMessage] = useState("");
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState("");
  const [isSavingReviewCase, setIsSavingReviewCase] = useState(false);
  const [isAddingReviewNote, setIsAddingReviewNote] = useState(false);
  const [isPrefillingReviewCase, setIsPrefillingReviewCase] = useState(false);
  const [reviewStatusInput, setReviewStatusInput] = useState("draft");
  const [reviewLabelInput, setReviewLabelInput] = useState("unik");
  const [reviewerUserInput, setReviewerUserInput] = useState("");
  const [reviewSummaryInput, setReviewSummaryInput] = useState("");
  const [coachingFocusInput, setCoachingFocusInput] = useState("");
  const [recommendedActionInput, setRecommendedActionInput] = useState("");
  const [reviewNoteInput, setReviewNoteInput] = useState("");
  const [reviewSuggestionHint, setReviewSuggestionHint] = useState("");
  const [knowledgeProposalTitleInput, setKnowledgeProposalTitleInput] =
    useState("");
  const [knowledgeProposalCategoryInput, setKnowledgeProposalCategoryInput] =
    useState("general");
  const [knowledgeProposalContentInput, setKnowledgeProposalContentInput] =
    useState("");
  const [
    knowledgeProposalSourceTypeInput,
    setKnowledgeProposalSourceTypeInput,
  ] = useState("coaching_case");
  const [knowledgeProposalRationaleInput, setKnowledgeProposalRationaleInput] =
    useState("");
  const [knowledgeProposalStatusInput, setKnowledgeProposalStatusInput] =
    useState("draft");
  const [
    knowledgeProposalDecisionNoteInput,
    setKnowledgeProposalDecisionNoteInput,
  ] = useState("");
  const [knowledgeProposalErrorMessage, setKnowledgeProposalErrorMessage] =
    useState("");
  const [knowledgeProposalSuccessMessage, setKnowledgeProposalSuccessMessage] =
    useState("");
  const [isSavingKnowledgeProposal, setIsSavingKnowledgeProposal] =
    useState(false);
  const [isReviewingKnowledgeProposal, setIsReviewingKnowledgeProposal] =
    useState(false);

  const loadConversationDetail = useCallback(async () => {
    if (!conversationId) {
      setDetail(null);
      setErrorMessage("Conversation ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const [data, me] = await Promise.all([
        apiFetch<SalesConversationDetail>(
          `/dashboard/sales/conversations/${conversationId}`,
        ),
        apiFetch<CurrentUser>("/auth/me"),
      ]);
      setDetail(data);
      setCurrentUser(me);
      const reviewCase = data.chat_review_case;
      setReviewStatusInput(reviewCase?.status ?? "draft");
      setReviewLabelInput(reviewCase?.review_label ?? "unik");
      setReviewerUserInput(reviewCase?.reviewer_user_id ?? me.id ?? "");
      setReviewSummaryInput(reviewCase?.review_summary ?? "");
      setCoachingFocusInput(reviewCase?.coaching_focus ?? "");
      setRecommendedActionInput(reviewCase?.recommended_action ?? "");

      const knowledgeProposal = data.knowledge_update_proposal;
      setKnowledgeProposalTitleInput(
        knowledgeProposal?.title ?? `${data.title} · update knowledge`,
      );
      setKnowledgeProposalCategoryInput(knowledgeProposal?.category ?? "general");
      setKnowledgeProposalContentInput(
        knowledgeProposal?.proposed_content ??
          [
            reviewCase?.review_summary
              ? `Ringkasan kasus: ${reviewCase.review_summary}`
              : "",
            reviewCase?.coaching_focus
              ? `Fokus coaching: ${reviewCase.coaching_focus}`
              : "",
            reviewCase?.recommended_action
              ? `Aksi yang direkomendasikan: ${reviewCase.recommended_action}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
      );
      setKnowledgeProposalSourceTypeInput(
        knowledgeProposal?.source_type ?? "coaching_case",
      );
      setKnowledgeProposalRationaleInput(knowledgeProposal?.rationale ?? "");
      setKnowledgeProposalStatusInput(knowledgeProposal?.status ?? "draft");
      setKnowledgeProposalDecisionNoteInput(
        knowledgeProposal?.review_decision_note ?? "",
      );
      if (canManageReviewCase(me.role)) {
        const candidates = await apiFetch<ChatReviewerCandidateItem[]>(
          "/dashboard/sales/reviewer-candidates",
        );
        setReviewerCandidates(candidates);
      } else {
        setReviewerCandidates([]);
      }
    } catch (error) {
      setDetail(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat detail conversation.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversationDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadConversationDetail]);

  async function handleSaveReviewCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) {
      return;
    }

    setIsSavingReviewCase(true);
    setReviewErrorMessage("");
    setReviewSuccessMessage("");

    try {
      const payload: ChatReviewCaseUpsertRequest = {
        reviewer_user_id: reviewerUserInput || null,
        status: reviewStatusInput,
        review_label: reviewLabelInput,
        review_summary: reviewSummaryInput.trim() || null,
        coaching_focus: coachingFocusInput.trim() || null,
        recommended_action: recommendedActionInput.trim() || null,
      };

      const reviewCase = await apiFetch<ChatReviewCaseItem>(
        `/dashboard/sales/conversations/${detail.conversation_id}/review-case`,
        {
          method: "PUT",
          body: payload,
        },
      );

      setDetail((currentDetail) =>
        currentDetail
          ? { ...currentDetail, chat_review_case: reviewCase }
          : currentDetail,
      );
      setReviewSuccessMessage("Review case coaching berhasil disimpan.");
    } catch (error) {
      setReviewErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan review case.",
      );
    } finally {
      setIsSavingReviewCase(false);
    }
  }

  async function handlePrefillReviewCase() {
    if (!detail) {
      return;
    }

    setIsPrefillingReviewCase(true);
    setReviewErrorMessage("");
    setReviewSuccessMessage("");

    try {
      const suggestion = await apiFetch<ChatReviewCaseSuggestionResponse>(
        `/dashboard/sales/conversations/${detail.conversation_id}/review-case-suggestion`,
      );
      setReviewStatusInput(suggestion.status);
      setReviewLabelInput(suggestion.review_label);
      setReviewSummaryInput(suggestion.review_summary);
      setCoachingFocusInput(suggestion.coaching_focus);
      setRecommendedActionInput(suggestion.recommended_action);
      setReviewSuggestionHint(
        `${suggestion.source_summary} Confidence ${Math.round(
          suggestion.confidence_score * 100,
        )}%.`,
      );
    } catch (error) {
      setReviewErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengambil prefill coaching review dari Clara.",
      );
    } finally {
      setIsPrefillingReviewCase(false);
    }
  }

  async function handleAddReviewNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail?.chat_review_case || !reviewNoteInput.trim()) {
      return;
    }

    setIsAddingReviewNote(true);
    setReviewErrorMessage("");
    setReviewSuccessMessage("");

    try {
      const payload: ChatReviewNoteCreateRequest = {
        note_type: "manager_note",
        body: reviewNoteInput.trim(),
      };

      const reviewCase = await apiFetch<ChatReviewCaseItem>(
        `/dashboard/sales/review-cases/${detail.chat_review_case.id}/notes`,
        {
          method: "POST",
          body: payload,
        },
      );

      setDetail((currentDetail) =>
        currentDetail
          ? { ...currentDetail, chat_review_case: reviewCase }
          : currentDetail,
      );
      setReviewNoteInput("");
      setReviewSuccessMessage("Manager note berhasil ditambahkan.");
    } catch (error) {
      setReviewErrorMessage(
        error instanceof Error ? error.message : "Gagal menambah manager note.",
      );
    } finally {
      setIsAddingReviewNote(false);
    }
  }

  async function handleSaveKnowledgeProposal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!detail) {
      return;
    }

    setIsSavingKnowledgeProposal(true);
    setKnowledgeProposalErrorMessage("");
    setKnowledgeProposalSuccessMessage("");

    try {
      const payload: KnowledgeUpdateProposalUpsertRequest = {
        title: knowledgeProposalTitleInput.trim(),
        category: knowledgeProposalCategoryInput.trim(),
        proposed_content: knowledgeProposalContentInput.trim(),
        source_type: knowledgeProposalSourceTypeInput.trim(),
        rationale: knowledgeProposalRationaleInput.trim() || null,
        status: knowledgeProposalStatusInput,
      };

      const proposal = await apiFetch<KnowledgeUpdateProposalItem>(
        `/product-knowledge/conversations/${detail.conversation_id}/proposal`,
        {
          method: "PUT",
          body: payload,
        },
      );

      setDetail((currentDetail) =>
        currentDetail
          ? { ...currentDetail, knowledge_update_proposal: proposal }
          : currentDetail,
      );
      setKnowledgeProposalDecisionNoteInput(
        proposal.review_decision_note ?? "",
      );
      setKnowledgeProposalSuccessMessage(
        proposal.status === "pending_approval"
          ? "Proposal knowledge berhasil dieskalasi ke superadmin review queue."
          : "Proposal knowledge berhasil disimpan sebagai draft.",
      );
    } catch (error) {
      setKnowledgeProposalErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan proposal knowledge.",
      );
    } finally {
      setIsSavingKnowledgeProposal(false);
    }
  }

  async function handleReviewKnowledgeProposal(
    status: "approved" | "rejected",
  ) {
    if (!detail?.knowledge_update_proposal) {
      return;
    }

    setIsReviewingKnowledgeProposal(true);
    setKnowledgeProposalErrorMessage("");
    setKnowledgeProposalSuccessMessage("");

    try {
      const payload: KnowledgeUpdateProposalReviewRequest = {
        status,
        review_decision_note: knowledgeProposalDecisionNoteInput.trim() || null,
      };

      const proposal = await apiFetch<KnowledgeUpdateProposalItem>(
        `/product-knowledge/proposals/${detail.knowledge_update_proposal.id}/review`,
        {
          method: "PATCH",
          body: payload,
        },
      );

      setDetail((currentDetail) =>
        currentDetail
          ? { ...currentDetail, knowledge_update_proposal: proposal }
          : currentDetail,
      );
      setKnowledgeProposalStatusInput(proposal.status);
      setKnowledgeProposalDecisionNoteInput(
        proposal.review_decision_note ?? "",
      );
      setKnowledgeProposalSuccessMessage(
        status === "approved"
          ? "Proposal knowledge berhasil di-approve dan dipublish oleh superadmin."
          : "Proposal knowledge berhasil di-reject.",
      );
    } catch (error) {
      setKnowledgeProposalErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memproses review proposal knowledge.",
      );
    } finally {
      setIsReviewingKnowledgeProposal(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Conversation detail"
      title={detail?.title ?? "Detail percakapan"}
      description="Baca timeline chat, cek hasil analisis AI, dan review draft balasan dari satu layar kerja yang konsisten."
      backHref={
        currentUser && !canAccessQueueAndActionCenter(currentUser.role)
          ? "/dashboard/approvals"
          : "/dashboard/sales"
      }
      backLabel={
        currentUser && !canAccessQueueAndActionCenter(currentUser.role)
          ? "Kembali ke review sales"
          : "Kembali ke inbox"
      }
      actions={
        <>
          {detail ? (
            <Link
              href={buildContinuationHref(detail)}
              className="clara-button clara-button-primary"
            >
              Tambah Chat Lanjutan
            </Link>
          ) : null}
          <Link
            href={
              currentUser && !canAccessQueueAndActionCenter(currentUser.role)
                ? normalizeWorkspaceRole(currentUser.role) === "head"
                  ? "/dashboard/notifications"
                  : "/dashboard/manager-insights"
                : "/dashboard/follow-up"
            }
            className="clara-button clara-button-ghost"
          >
            {currentUser && !canAccessQueueAndActionCenter(currentUser.role)
              ? normalizeWorkspaceRole(currentUser.role) === "head"
                ? "Buka Alert Tim"
                : "Buka Monitor Tim"
              : "Buka Worklist"}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading conversation...
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="clara-alert clara-alert-danger">
            {errorMessage}. Coba kembali ke{" "}
            <Link
              href={
                currentUser && !canAccessQueueAndActionCenter(currentUser.role)
                  ? "/dashboard/approvals"
                  : "/dashboard/sales"
              }
              className="font-semibold underline"
            >
              {currentUser && !canAccessQueueAndActionCenter(currentUser.role)
                ? "review sales"
                : "sales inbox"}
            </Link>
            .
          </div>
        )}

        {detail && !isLoading && !errorMessage && (
          <>
            <ConversationFreshnessBanner
              detail={detail}
              uploadBanner={buildUploadResultBanner(searchParams)}
            />
            <ConversationDetailHeader detail={detail} />
            <ConversationDetailContent
              currentUser={currentUser}
              detail={detail}
              reviewerCandidates={reviewerCandidates}
              reviewErrorMessage={reviewErrorMessage}
              reviewSuccessMessage={reviewSuccessMessage}
              isSavingReviewCase={isSavingReviewCase}
              isAddingReviewNote={isAddingReviewNote}
              isPrefillingReviewCase={isPrefillingReviewCase}
              reviewStatusInput={reviewStatusInput}
              reviewLabelInput={reviewLabelInput}
              reviewerUserInput={reviewerUserInput}
              reviewSummaryInput={reviewSummaryInput}
              coachingFocusInput={coachingFocusInput}
              recommendedActionInput={recommendedActionInput}
              reviewNoteInput={reviewNoteInput}
              reviewSuggestionHint={reviewSuggestionHint}
              knowledgeProposalTitleInput={knowledgeProposalTitleInput}
              knowledgeProposalCategoryInput={knowledgeProposalCategoryInput}
              knowledgeProposalContentInput={knowledgeProposalContentInput}
              knowledgeProposalSourceTypeInput={
                knowledgeProposalSourceTypeInput
              }
              knowledgeProposalRationaleInput={knowledgeProposalRationaleInput}
              knowledgeProposalStatusInput={knowledgeProposalStatusInput}
              knowledgeProposalDecisionNoteInput={
                knowledgeProposalDecisionNoteInput
              }
              knowledgeProposalErrorMessage={knowledgeProposalErrorMessage}
              knowledgeProposalSuccessMessage={knowledgeProposalSuccessMessage}
              isSavingKnowledgeProposal={isSavingKnowledgeProposal}
              isReviewingKnowledgeProposal={isReviewingKnowledgeProposal}
              onReviewStatusChange={setReviewStatusInput}
              onReviewLabelChange={setReviewLabelInput}
              onReviewerUserChange={setReviewerUserInput}
              onReviewSummaryChange={setReviewSummaryInput}
              onCoachingFocusChange={setCoachingFocusInput}
              onRecommendedActionChange={setRecommendedActionInput}
              onReviewNoteChange={setReviewNoteInput}
              onKnowledgeProposalTitleChange={setKnowledgeProposalTitleInput}
              onKnowledgeProposalCategoryChange={
                setKnowledgeProposalCategoryInput
              }
              onKnowledgeProposalContentChange={
                setKnowledgeProposalContentInput
              }
              onKnowledgeProposalSourceTypeChange={
                setKnowledgeProposalSourceTypeInput
              }
              onKnowledgeProposalRationaleChange={
                setKnowledgeProposalRationaleInput
              }
              onKnowledgeProposalStatusChange={setKnowledgeProposalStatusInput}
              onKnowledgeProposalDecisionNoteChange={
                setKnowledgeProposalDecisionNoteInput
              }
              onPrefillReviewCase={handlePrefillReviewCase}
              onSaveReviewCase={handleSaveReviewCase}
              onAddReviewNote={handleAddReviewNote}
              onSaveKnowledgeProposal={handleSaveKnowledgeProposal}
              onReviewKnowledgeProposal={handleReviewKnowledgeProposal}
              onUpdated={loadConversationDetail}
            />
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function ConversationFreshnessBanner({
  detail,
  uploadBanner,
}: {
  detail: SalesConversationDetail;
  uploadBanner: { tone: "success" | "neutral"; text: string } | null;
}) {
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const freshCustomerReply = hasFreshCustomerReply(detail);
  const continuationHref = buildContinuationHref(detail);

  return (
    <div className="space-y-3">
      {uploadBanner ? (
        <div
          className={
            uploadBanner.tone === "success"
              ? "rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
              : "rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
          }
        >
          {uploadBanner.text}
        </div>
      ) : null}

      {(freshCustomerReply || analysisStale || suggestionStale) ? (
        <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,#fff8eb_0%,#fff2d8_100%)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="clara-kicker text-[#9a5a08]">
                Chat terus berkembang
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">
                Ada konteks baru setelah tindakan terakhir
              </h2>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {freshCustomerReply ? (
                  <p>
                    Customer sudah membalas lagi setelah pesan terakhir yang
                    ditandai terkirim. Conversation ini aktif lagi dan perlu
                    dibaca ulang.
                  </p>
                ) : null}
                {analysisStale ? (
                  <p>
                    AI analysis lama sudah tertinggal dari chat terbaru. Jalankan
                    ulang analisis sebelum mengambil keputusan baru.
                  </p>
                ) : null}
                {suggestionStale ? (
                  <p>
                    Draft balasan lama sudah tidak sepenuhnya relevan. Generate
                    ulang reply suggestion setelah memastikan konteks terbaru.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={continuationHref}
                className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
              >
                Upload Chat Lanjutan
              </Link>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Baca dari atas lagi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConversationDetailHeader({
  detail,
}: {
  detail: SalesConversationDetail;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const provider = inferProviderFromSource(detail.source);

  return (
    <section className="clara-card rounded-[30px] p-5 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div>
          <p className="clara-kicker">Conversation Signal</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            Ringkasan kondisi percakapan saat ini
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Last message: {formatDateTime(detail.last_message_at)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getChannelBadgeClass(
                detail.source_channel,
              )}`}
            >
              {formatChannelLabel(detail.source_channel)}
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getProviderBadgeClass(
                provider,
              )}`}
            >
              {formatProviderLabel(provider)}
            </span>

            {isExperimentalChannel(detail.source_channel) ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                Experimental
              </span>
            ) : null}

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getAccountCategoryBadgeClass(
                detail.account_category,
              )}`}
            >
              Kategori akun: {formatAccountCategory(detail.account_category)}
            </span>

            {extraction ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                  extraction.lead_temperature,
                )}`}
              >
                {extraction.lead_temperature.toUpperCase()}
              </span>
            ) : (
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Menunggu AI analysis
              </span>
            )}

            {extraction ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadgeClass(
                  extraction.risk_level,
                )}`}
              >
                Risk {extraction.risk_level}
              </span>
            ) : null}

            {suggestion ? (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {formatStatusLabel(suggestion.approval_status)}
              </span>
            ) : (
              <span className="rounded-full border border-[#d3a74b]/22 bg-[#f3e0b3] px-3 py-1 text-xs font-semibold text-[#5c3a12]">
                Belum ada draft
              </span>
            )}

            {analysisStale ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Analysis perlu diperbarui
              </span>
            ) : null}

            {suggestionStale ? (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                Draft lama
              </span>
            ) : null}
          </div>
        </div>

        <div className="clara-card-dark rounded-[26px] p-5">
          <p className="clara-kicker text-[#d4b07b]">Snapshot</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <MetaPill
              label="Channel"
              value={formatChannelLabel(detail.source_channel)}
              dark
            />
            <MetaPill
              label="Provider"
              value={formatProviderLabel(provider)}
              dark
            />
            <MetaPill label="Source" value={detail.source_label} dark />
            <MetaPill
              label="Messages"
              value={String(detail.messages.length)}
              dark
            />
            <MetaPill
              label="Sent logs"
              value={String(detail.sent_messages.length)}
              dark
            />
            <MetaPill
              label="AI status"
              value={extraction ? "Analyzed" : "Pending"}
              dark
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ConversationDetailContent({
  currentUser,
  detail,
  reviewerCandidates,
  reviewErrorMessage,
  reviewSuccessMessage,
  isSavingReviewCase,
  isAddingReviewNote,
  isPrefillingReviewCase,
  reviewStatusInput,
  reviewLabelInput,
  reviewerUserInput,
  reviewSummaryInput,
  coachingFocusInput,
  recommendedActionInput,
  reviewNoteInput,
  reviewSuggestionHint,
  knowledgeProposalTitleInput,
  knowledgeProposalCategoryInput,
  knowledgeProposalContentInput,
  knowledgeProposalSourceTypeInput,
  knowledgeProposalRationaleInput,
  knowledgeProposalStatusInput,
  knowledgeProposalDecisionNoteInput,
  knowledgeProposalErrorMessage,
  knowledgeProposalSuccessMessage,
  isSavingKnowledgeProposal,
  isReviewingKnowledgeProposal,
  onReviewStatusChange,
  onReviewLabelChange,
  onReviewerUserChange,
  onReviewSummaryChange,
  onCoachingFocusChange,
  onRecommendedActionChange,
  onReviewNoteChange,
  onKnowledgeProposalTitleChange,
  onKnowledgeProposalCategoryChange,
  onKnowledgeProposalContentChange,
  onKnowledgeProposalSourceTypeChange,
  onKnowledgeProposalRationaleChange,
  onKnowledgeProposalStatusChange,
  onKnowledgeProposalDecisionNoteChange,
  onPrefillReviewCase,
  onSaveReviewCase,
  onAddReviewNote,
  onSaveKnowledgeProposal,
  onReviewKnowledgeProposal,
  onUpdated,
}: {
  currentUser: CurrentUser | null;
  detail: SalesConversationDetail;
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
  onKnowledgeProposalSourceTypeChange: (value: string) => void;
  onKnowledgeProposalRationaleChange: (value: string) => void;
  onKnowledgeProposalStatusChange: (value: string) => void;
  onKnowledgeProposalDecisionNoteChange: (value: string) => void;
  onPrefillReviewCase: () => Promise<void>;
  onSaveReviewCase: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddReviewNote: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveKnowledgeProposal: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReviewKnowledgeProposal: (status: "approved" | "rejected") => Promise<void>;
  onUpdated: () => Promise<void>;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const isSalesWorkspace = currentUser?.role === "sales";
  const canManage = canManageReviewCase(currentUser?.role);
  const canReviewProposal = canReviewKnowledgeProposal(currentUser?.role);
  const reviewCase = detail.chat_review_case;
  const knowledgeProposal = detail.knowledge_update_proposal;
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const provider = inferProviderFromSource(detail.source);
  const [activePanel, setActivePanel] = useState<
    "ai_reply" | "coaching" | "knowledge" | "sent_logs"
  >("ai_reply");
  const [showAllMessages, setShowAllMessages] = useState(false);
  const visibleMessages = showAllMessages
    ? detail.messages
    : detail.messages.slice(Math.max(detail.messages.length - 12, 0));
  const chatTimeline = (
    <div
      data-onboarding-id="sales-conversation-timeline"
      className="clara-card rounded-[30px] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="clara-kicker">Chat Timeline</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#fff0c9]">
            Timeline percakapan
          </h2>
          <p className="mt-2 text-sm text-[#d6bb84]">
            Fokus ke pesan terbaru dulu. Expand penuh hanya saat butuh membaca
            konteks lama.
          </p>
        </div>

        <div className="rounded-full border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(24,17,12,0.96)_100%)] px-4 py-2 text-sm text-[#d6bb84]">
          Menampilkan {visibleMessages.length} dari {detail.messages.length}{" "}
          pesan
        </div>
      </div>

      <div
        className="clara-scrollbar mt-5 max-h-[70vh] overflow-y-auto rounded-[28px] border border-[#f0cb73]/12 p-4 pr-2 shadow-[inset_0_1px_0_rgba(255,240,201,0.03)] sm:p-5 sm:pr-3"
        style={{
          backgroundImage:
            "linear-gradient(rgba(18, 13, 9, 0.84), rgba(18, 13, 9, 0.84)), url('/assets/eb24786e5579a01bdd4bb103695b8286.jpg')",
          backgroundPosition: "center",
          backgroundRepeat: "repeat",
          backgroundSize: "280px auto",
        }}
      >
        <div className="space-y-3">
          {!showAllMessages &&
          detail.messages.length > visibleMessages.length ? (
            <div className="rounded-[22px] border border-dashed border-[#f0cb73]/24 bg-[rgba(32,23,14,0.92)] p-4 text-sm text-[#d6bb84]">
              {detail.messages.length - visibleMessages.length} pesan lama
              disembunyikan dulu supaya halaman tetap ringkas.
            </div>
          ) : null}

          {visibleMessages.map((message) => {
            const isSales = isSalesConversationMessage(message);

            return (
              <div
                key={message.id}
                className={`flex px-1 ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[78%] rounded-[24px] border px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.18)] ${
                    isSales
                      ? "rounded-tr-[10px] border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(250,220,134,0.98)_0%,rgba(227,186,92,0.98)_55%,rgba(194,138,43,0.98)_100%)] text-[#2c1907]"
                      : "rounded-tl-[10px] border-[#5a3a17]/72 bg-[linear-gradient(180deg,rgba(55,35,21,0.98)_0%,rgba(36,23,14,0.98)_100%)] text-[#fff0c9]"
                  }`}
                >
                  {!isSales ? (
                    <p className="mb-1 text-xs font-semibold text-[#ff7792]">
                      {message.sender_name}
                    </p>
                  ) : null}
                  {message.reply_context_text ? (
                    <div
                      className={`mb-3 rounded-[18px] border px-3 py-2 text-xs leading-6 ${
                        isSales
                          ? "border-[#7d5316]/24 bg-[rgba(95,62,17,0.12)] text-[#5f3910]"
                          : "border-[#f0cb73]/16 bg-[rgba(255,240,201,0.06)] text-[#dcbf86]"
                      }`}
                    >
                      <p className="mb-1 font-semibold">
                        Membalas{" "}
                        {message.reply_context_sender_type === "sales"
                          ? "pesan sales"
                          : "pesan customer"}
                        {message.reply_context_sender_name
                          ? ` · ${message.reply_context_sender_name}`
                          : ""}
                      </p>
                      <p className="whitespace-pre-wrap opacity-90">
                        {message.reply_context_text}
                      </p>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {message.message_text}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <p
                      className={`text-[11px] font-medium ${
                        isSales ? "text-[#6f4311]" : "text-[#d4b06d]"
                      }`}
                    >
                      {formatDateTime(message.message_timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detail.messages.length > 12 ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllMessages((current) => !current)}
            className="inline-flex rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#f0cb73] hover:border-[#f0cb73]/32"
          >
            {showAllMessages ? "Tampilkan ringkas" : "Tampilkan semua pesan"}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="space-y-6">
      <section
        className={`grid gap-6 xl:items-start ${
          isSalesWorkspace
            ? "xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]"
            : "xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]"
        }`}
      >
        {isSalesWorkspace ? (
          <>
            <div>{chatTimeline}</div>

            <section
              data-onboarding-id="sales-conversation-workspace"
              className="clara-card rounded-[30px] p-5 xl:sticky xl:top-28"
            >
              <div>
                <p className="clara-kicker">Area kerja sales</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">
                  Baca konteks lalu pilih aksi
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Fokus ke timeline chat, hasil baca Clara, lalu lanjut pilih jawaban atau cek riwayat kirim.
                </p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <PanelTab
                  label="AI & Jawaban"
                  isActive={activePanel === "ai_reply"}
                  onClick={() => setActivePanel("ai_reply")}
                />
                <PanelTab
                  label="Riwayat Kirim"
                  isActive={activePanel === "sent_logs"}
                  onClick={() => setActivePanel("sent_logs")}
                />
              </div>

              <div className="mt-5">
                {activePanel === "ai_reply" ? (
                  <div className="space-y-6">
                    <ConversationAiActions
                      conversationId={detail.conversation_id}
                      hasAiExtraction={Boolean(extraction)}
                      hasReplySuggestion={Boolean(suggestion)}
                      analysisNeedsRefresh={analysisStale}
                      replyNeedsRefresh={suggestionStale}
                      onUpdated={onUpdated}
                    />

                    <div
                      data-onboarding-id="sales-conversation-ai-summary"
                      className="rounded-[26px] border border-slate-200 bg-white p-5"
                    >
                      <p className="clara-kicker">Ringkasan Clara</p>
                      <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                        Hasil baca percakapan
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getChannelBadgeClass(
                            detail.source_channel,
                          )}`}
                        >
                          Tone channel: {formatChannelLabel(detail.source_channel)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProviderBadgeClass(
                            provider,
                          )}`}
                        >
                          Suggestion source: {formatProviderLabel(provider)}
                        </span>
                      </div>
                      {isExperimentalChannel(detail.source_channel) ? (
                        <p className="mt-3 text-xs leading-6 text-slate-500">
                          Channel ini masih experimental. Untuk Instagram dan TikTok, baca ulang konteks sebelum pakai draft mentah.
                        </p>
                      ) : null}

                      {extraction ? (
                        <div className="mt-4 space-y-3 text-sm">
                          <InfoBlock
                            label="Tahap customer"
                            value={formatStatusLabel(extraction.pipeline_stage)}
                          />
                          <InfoBlock
                            label="Sentimen"
                            value={formatStatusLabel(extraction.sentiment)}
                          />
                          <div className="clara-card-soft rounded-[22px] p-4">
                            <p className="clara-kicker text-[11px]">
                              Objection utama
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {extraction.main_objections.length > 0 ? (
                                extraction.main_objections.map((objection) => (
                                  <span
                                    key={objection}
                                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                                  >
                                    {objection}
                                  </span>
                                ))
                              ) : (
                                <p className="text-slate-600">
                                  Belum ada objection utama yang menonjol.
                                </p>
                              )}
                            </div>
                          </div>
                          <InfoBlock
                            label="Langkah berikutnya"
                            value={extraction.next_best_action}
                          />
                        </div>
                      ) : (
                        <div className="clara-card-outline mt-4 rounded-[24px] p-4 text-sm text-slate-600">
                          Percakapan ini belum dibaca AI. Jalankan analisis dulu supaya Clara bisa bantu menyiapkan arah balasan.
                        </div>
                      )}
                    </div>

                    <div data-onboarding-id="sales-conversation-reply-actions">
                      {suggestion ? (
                        <ReplySuggestionActions
                          replySuggestionId={suggestion.id}
                          suggestedReplies={suggestion.suggested_replies}
                          approvalStatus={suggestion.approval_status}
                          hasBeenSent={detail.sent_messages.some(
                            (sentMessage) =>
                              sentMessage.reply_suggestion_id === suggestion.id,
                          )}
                          isStale={suggestionStale}
                          onUpdated={onUpdated}
                        />
                      ) : (
                        <div className="clara-card-outline rounded-[30px] p-5">
                          <h2 className="text-lg font-semibold text-slate-950">
                            Belum ada jawaban terbaik
                          </h2>
                          <p className="mt-2 text-sm text-slate-600">
                            Setelah chat dibaca AI, lanjut buat jawaban terbaik supaya kamu tinggal review dan pakai.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activePanel === "sent_logs" ? (
                  <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                    <p className="clara-kicker">Riwayat kirim</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                      Balasan yang sudah ditandai terkirim
                    </h2>

                    {detail.sent_messages.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {detail.sent_messages.map((sentMessage) => (
                          <div
                            key={sentMessage.id}
                            className="rounded-[22px] border border-green-200/80 bg-green-50/88 p-4 text-sm text-green-900"
                          >
                            <p className="font-semibold">
                              Dikirim oleh {sentMessage.sent_by_name}
                            </p>
                            <p className="mt-1 text-xs text-green-700">
                              {formatDateTime(sentMessage.sent_at)} &bull;{" "}
                              {sentMessage.send_mode}
                            </p>
                            <p className="mt-3 whitespace-pre-wrap leading-6">
                              {sentMessage.message_text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">
                        Belum ada balasan yang ditandai terkirim untuk percakapan ini.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="clara-card rounded-[30px] p-5">
          <div>
            <p className="clara-kicker">Workspace Panel</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              Pilih area kerja
            </h3>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <PanelTab
              label="AI & Reply"
              isActive={activePanel === "ai_reply"}
              onClick={() => setActivePanel("ai_reply")}
            />
            <PanelTab
              label="Coaching"
              isActive={activePanel === "coaching"}
              onClick={() => setActivePanel("coaching")}
            />
            <PanelTab
              label="Knowledge"
              isActive={activePanel === "knowledge"}
              onClick={() => setActivePanel("knowledge")}
            />
            <PanelTab
              label="Sent Logs"
              isActive={activePanel === "sent_logs"}
              onClick={() => setActivePanel("sent_logs")}
            />
          </div>

          <div className="mt-5">
            {activePanel === "ai_reply" ? (
              <div className="space-y-6">
                <ConversationAiActions
                  conversationId={detail.conversation_id}
                  hasAiExtraction={Boolean(extraction)}
                  hasReplySuggestion={Boolean(suggestion)}
                  analysisNeedsRefresh={analysisStale}
                  replyNeedsRefresh={suggestionStale}
                  onUpdated={onUpdated}
                />

                <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                  <p className="clara-kicker">AI Analysis</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                    Hasil pembacaan Clara
                  </h2>

                  {extraction ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <InfoBlock
                        label="Pipeline stage"
                        value={formatStatusLabel(extraction.pipeline_stage)}
                      />
                      <InfoBlock
                        label="Sentiment"
                        value={formatStatusLabel(extraction.sentiment)}
                      />
                      <div className="clara-card-soft rounded-[22px] p-4">
                        <p className="clara-kicker text-[11px]">
                          Main objections
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {extraction.main_objections.length > 0 ? (
                            extraction.main_objections.map((objection) => (
                              <span
                                key={objection}
                                className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                              >
                                {objection}
                              </span>
                            ))
                          ) : (
                            <p className="text-slate-600">
                              Tidak ada objection.
                            </p>
                          )}
                        </div>
                      </div>
                      <InfoBlock
                        label="Next best action"
                        value={extraction.next_best_action}
                      />
                      <InfoBlock
                        label="Confidence"
                        value={`${(extraction.confidence_score * 100).toFixed(0)}%`}
                      />
                    </div>
                  ) : (
                    <div className="clara-card-outline mt-4 rounded-[24px] p-4 text-sm text-slate-600">
                      Conversation ini belum dianalisis AI.
                    </div>
                  )}
                </div>

                {suggestion ? (
                  <ReplySuggestionActions
                    replySuggestionId={suggestion.id}
                    suggestedReplies={suggestion.suggested_replies}
                    approvalStatus={suggestion.approval_status}
                    hasBeenSent={detail.sent_messages.some(
                      (sentMessage) =>
                        sentMessage.reply_suggestion_id === suggestion.id,
                    )}
                    isStale={suggestionStale}
                    onUpdated={onUpdated}
                  />
                ) : (
                  <div className="clara-card-outline rounded-[30px] p-5">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Belum ada reply suggestion
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Generate reply suggestion dulu, lalu review approval
                      status sebelum memutuskan kirim balasan.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {activePanel === "coaching" ? (
              <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="clara-kicker">Coaching Review</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                      Review case manusia untuk manager dan head
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Gunakan section ini untuk memberi label coaching, menunjuk
                      reviewer, dan menyimpan manager note yang persisten per
                      conversation.
                    </p>
                  </div>
                  {reviewCase ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {formatReviewCaseStatus(reviewCase.status)} ·{" "}
                      {formatReviewCaseLabel(reviewCase.review_label)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Belum ada review case
                    </span>
                  )}
                </div>

                {reviewSuccessMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    {reviewSuccessMessage}
                  </div>
                ) : null}

                {reviewErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {reviewErrorMessage}
                  </div>
                ) : null}

                {reviewSuggestionHint ? (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
                    {reviewSuggestionHint}
                  </div>
                ) : null}

                {canManage ? (
                  <form onSubmit={onSaveReviewCase} className="mt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        <span>Status review</span>
                        <select
                          value={reviewStatusInput}
                          onChange={(event) =>
                            onReviewStatusChange(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          {CHAT_REVIEW_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatReviewCaseStatus(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        <span>Label coaching</span>
                        <select
                          value={reviewLabelInput}
                          onChange={(event) =>
                            onReviewLabelChange(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          {CHAT_REVIEW_LABEL_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatReviewCaseLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        <span>Reviewer</span>
                        <select
                          value={reviewerUserInput}
                          onChange={(event) =>
                            onReviewerUserChange(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          <option value="">Belum ditunjuk</option>
                          {reviewerCandidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} · {candidate.role}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Ringkasan review</span>
                      <textarea
                        value={reviewSummaryInput}
                        onChange={(event) =>
                          onReviewSummaryChange(event.target.value)
                        }
                        rows={3}
                        className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                        placeholder="Tulis konteks singkat percakapan dan alasan kenapa case ini perlu coaching."
                      />
                    </label>

                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Fokus coaching</span>
                      <textarea
                        value={coachingFocusInput}
                        onChange={(event) =>
                          onCoachingFocusChange(event.target.value)
                        }
                        rows={3}
                        className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                        placeholder="Contoh: handling objection legalitas, tone closing, atau cara mengarahkan next step."
                      />
                    </label>

                    <label className="block space-y-2 text-sm font-medium text-slate-700">
                      <span>Recommended action</span>
                      <textarea
                        value={recommendedActionInput}
                        onChange={(event) =>
                          onRecommendedActionChange(event.target.value)
                        }
                        rows={3}
                        className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                        placeholder="Jelaskan apa yang sales harus lakukan setelah coaching ini dibaca."
                      />
                    </label>

                    <div className="flex justify-end">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void onPrefillReviewCase()}
                          disabled={isPrefillingReviewCase}
                          className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isPrefillingReviewCase
                            ? "Clara sedang mengisi..."
                            : "Prefill dengan Clara"}
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingReviewCase}
                          className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSavingReviewCase
                            ? "Menyimpan review..."
                            : "Simpan Review Case"}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : reviewCase ? (
                  <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <InfoBlock
                      label="Reviewer"
                      value={reviewCase.reviewer_user_name ?? "Belum ditunjuk"}
                    />
                    <InfoBlock
                      label="Ringkasan review"
                      value={reviewCase.review_summary ?? "-"}
                    />
                    <InfoBlock
                      label="Fokus coaching"
                      value={reviewCase.coaching_focus ?? "-"}
                    />
                    <InfoBlock
                      label="Recommended action"
                      value={reviewCase.recommended_action ?? "-"}
                    />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Belum ada review case coaching untuk percakapan ini.
                  </div>
                )}

                {reviewCase ? (
                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="clara-kicker">Manager Notes</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        Catatan coaching yang tersimpan
                      </h3>
                    </div>

                    {canManage ? (
                      <form onSubmit={onAddReviewNote} className="space-y-3">
                        <textarea
                          value={reviewNoteInput}
                          onChange={(event) =>
                            onReviewNoteChange(event.target.value)
                          }
                          rows={3}
                          className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                          placeholder="Tulis catatan coaching, instruksi rework, atau alasan eskalasi."
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isAddingReviewNote || !reviewCase}
                            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isAddingReviewNote
                              ? "Menyimpan note..."
                              : "Tambah Manager Note"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {reviewCase.notes.length > 0 ? (
                      <div className="space-y-3">
                        {reviewCase.notes.map((note) => (
                          <article
                            key={note.id}
                            className="rounded-[22px] border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">
                                {note.author_user_name ?? "System"}
                              </span>
                              <span>{formatDateTime(note.created_at)}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                                {formatReviewCaseLabel(note.note_type)}
                              </span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {note.body}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        Belum ada manager note di review case ini.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePanel === "knowledge" ? (
              <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="clara-kicker">Knowledge Update Queue</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                      Usulan knowledge dari kasus lapangan
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Setelah coaching case jelas, naikkan insight penting jadi
                      proposal knowledge supaya bisa dikoreksi, dieskalasi ke
                      superadmin, lalu dipublish ke knowledge base resmi bila
                      disetujui.
                    </p>
                  </div>
                  {knowledgeProposal ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {formatKnowledgeProposalStatus(knowledgeProposal.status)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Belum ada proposal
                    </span>
                  )}
                </div>

                {!reviewCase ? (
                  <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Buat dan simpan coaching review dulu. Proposal knowledge
                    Tahap 4 sengaja diikat ke review case supaya audit trail-nya
                    jelas.
                  </div>
                ) : (
                  <>
                    {knowledgeProposalSuccessMessage ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        {knowledgeProposalSuccessMessage}
                      </div>
                    ) : null}

                    {knowledgeProposalErrorMessage ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {knowledgeProposalErrorMessage}
                      </div>
                    ) : null}

                    {canManage ? (
                      <form
                        onSubmit={onSaveKnowledgeProposal}
                        className="mt-5 space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            <span>Judul proposal</span>
                            <input
                              value={knowledgeProposalTitleInput}
                              onChange={(event) =>
                                onKnowledgeProposalTitleChange(
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                              placeholder="Contoh: Playbook handling objection legalitas"
                            />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            <span>Kategori</span>
                            <input
                              value={knowledgeProposalCategoryInput}
                              onChange={(event) =>
                                onKnowledgeProposalCategoryChange(
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                              placeholder="legalitas / objection / trust"
                            />
                          </label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            <span>Source type</span>
                            <input
                              value={knowledgeProposalSourceTypeInput}
                              onChange={(event) =>
                                onKnowledgeProposalSourceTypeChange(
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                              placeholder="coaching_case"
                            />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            <span>Status proposal</span>
                            <select
                              value={knowledgeProposalStatusInput}
                              onChange={(event) =>
                                onKnowledgeProposalStatusChange(
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                            >
                              {KNOWLEDGE_PROPOSAL_STATUS_OPTIONS.map(
                                (option) => (
                                  <option key={option} value={option}>
                                    {formatKnowledgeProposalStatus(option)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>

                        <label className="block space-y-2 text-sm font-medium text-slate-700">
                          <span>Rationale</span>
                          <textarea
                            value={knowledgeProposalRationaleInput}
                            onChange={(event) =>
                              onKnowledgeProposalRationaleChange(
                                event.target.value,
                              )
                            }
                            rows={3}
                            className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                            placeholder="Jelaskan kenapa kasus ini layak dinaikkan ke knowledge base."
                          />
                        </label>

                        <label className="block space-y-2 text-sm font-medium text-slate-700">
                          <span>Isi knowledge yang diusulkan</span>
                          <textarea
                            value={knowledgeProposalContentInput}
                            onChange={(event) =>
                              onKnowledgeProposalContentChange(
                                event.target.value,
                              )
                            }
                            rows={8}
                            className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                            placeholder="Tulis knowledge final yang nantinya akan dipublish ke product knowledge."
                          />
                        </label>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={
                              isSavingKnowledgeProposal ||
                              knowledgeProposalTitleInput.trim().length === 0 ||
                              knowledgeProposalCategoryInput.trim().length ===
                                0 ||
                              knowledgeProposalContentInput.trim().length ===
                                0 ||
                              knowledgeProposalSourceTypeInput.trim().length ===
                                0
                            }
                            className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isSavingKnowledgeProposal
                              ? "Menyimpan proposal..."
                              : knowledgeProposalStatusInput === "pending_approval"
                                ? "Simpan & Eskalasi ke Superadmin"
                                : "Simpan Proposal Knowledge"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {knowledgeProposal ? (
                      <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <InfoBlock
                          label="Pengusul"
                          value={knowledgeProposal.proposed_by_user_name ?? "-"}
                        />
                        <InfoBlock
                          label="Rationale"
                          value={knowledgeProposal.rationale ?? "-"}
                        />
                        <InfoBlock
                          label="Review decision note"
                          value={knowledgeProposal.review_decision_note ?? "-"}
                        />
                        <InfoBlock
                          label="Published knowledge"
                          value={
                            knowledgeProposal.published_product_knowledge_title ??
                            "-"
                          }
                        />
                      </div>
                    ) : null}

                    {canReviewProposal && knowledgeProposal ? (
                      <div className="mt-5 space-y-3 rounded-[24px] border border-amber-200 bg-amber-50/70 p-4">
                        <label className="block space-y-2 text-sm font-medium text-slate-700">
                          <span>Catatan keputusan approval</span>
                          <textarea
                            value={knowledgeProposalDecisionNoteInput}
                            onChange={(event) =>
                              onKnowledgeProposalDecisionNoteChange(
                                event.target.value,
                              )
                            }
                            rows={3}
                            className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                            placeholder="Tulis alasan approve/reject atau catatan revisi."
                          />
                        </label>
                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            disabled={isReviewingKnowledgeProposal}
                            onClick={() =>
                              void onReviewKnowledgeProposal("rejected")
                            }
                            className="inline-flex rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isReviewingKnowledgeProposal
                              ? "Memproses..."
                              : "Reject"}
                          </button>
                          <button
                            type="button"
                            disabled={isReviewingKnowledgeProposal}
                            onClick={() =>
                              void onReviewKnowledgeProposal("approved")
                            }
                            className="inline-flex rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isReviewingKnowledgeProposal
                              ? "Memproses..."
                              : "Approve & Publish"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {activePanel === "sent_logs" ? (
              <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                <p className="clara-kicker">Sent Messages</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                  Riwayat balasan terkirim
                </h2>

                {detail.sent_messages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {detail.sent_messages.map((sentMessage) => (
                      <div
                        key={sentMessage.id}
                        className="rounded-[22px] border border-green-200/80 bg-green-50/88 p-4 text-sm text-green-900"
                      >
                        <p className="font-semibold">
                          Sent by {sentMessage.sent_by_name}
                        </p>
                        <p className="mt-1 text-xs text-green-700">
                          {formatDateTime(sentMessage.sent_at)} &bull;{" "}
                          {sentMessage.send_mode}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap leading-6">
                          {sentMessage.message_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Belum ada pesan yang ditandai terkirim. Kalau balasan sudah
                    benar-benar dikirim, pastikan status ini ikut tercatat.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </section>

            <div className="xl:sticky xl:top-28">{chatTimeline}</div>
          </>
        )}
      </section>
    </section>
  );
}

function PanelTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl px-3.5 py-2.5 text-center text-sm font-semibold transition ${
        isActive
          ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function MetaPill({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
        dark ? "bg-white/7 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <span className={dark ? "text-slate-300" : "text-slate-600"}>
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-[22px] p-4">
      <p className="clara-kicker text-[11px]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
