"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { SalesConversationPane } from "@/components/dashboard/SalesConversationPane";
import { SalesWorkbench } from "@/components/dashboard/SalesWorkbench";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  getLatestCustomerMessage,
  isSalesConversationMessage,
  isAnalysisStale,
  isReplySuggestionStale,
  hasFreshCustomerReply,
  buildContinuationHref,
} from "@/lib/conversation";
import {
  formatChannelLabel,
  formatDateTime,
  formatProviderLabel,
  formatRelativeTime,
  formatStatusLabel,
  inferProviderFromSource,
  isExperimentalChannel,
} from "@/lib/format";
import {
  ACCOUNT_CATEGORY,
  STAGE,
  SUGGESTION_STATE,
  TEMPERATURE,
  labelOf,
} from "@/lib/vocab";
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
      text: `Percakapan baru dibuat dari ${messageCount} pesan yang baru kamu masukkan.`,
    };
  }

  if (uploadStatus === "updated") {
    return {
      tone: "success",
      text: `${appendedCount} pesan baru ditambahkan ke percakapan ini. Baca ulang percakapan dan susun ulang jawaban, karena isi chat sudah bertambah.`,
    };
  }

  if (uploadStatus === "unchanged") {
    return {
      tone: "neutral",
      text: "Tidak ada pesan baru. Isi chat yang kamu masukkan sama dengan yang sudah ada di percakapan ini.",
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

  const hasLoadedOnceRef = useRef(false);
  const dashboardUser = useDashboardUser();
  const [refreshToken, setRefreshToken] = useState(0);

  const loadConversationDetail = useCallback(async () => {
    if (!conversationId) {
      setDetail(null);
      setErrorMessage("Conversation ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setErrorMessage("");
    // Muat ulang setelah sebuah aksi berjalan diam-diam. Layar tidak boleh kosong dan kehilangan posisi scroll.
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }

    try {
      const [data, me] = await Promise.all([
        apiFetch<SalesConversationDetail>(
          `/dashboard/sales/conversations/${conversationId}`,
        ),
        apiFetch<CurrentUser>("/auth/me"),
      ]);
      setDetail(data);
      setCurrentUser(me);
      hasLoadedOnceRef.current = true;
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
      // Pindah ke chat lain: jangan menampilkan isi chat sebelumnya sambil menunggu.
      hasLoadedOnceRef.current = false;
      setDetail(null);
      void loadConversationDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadConversationDetail]);

  // Pesan baru dari extension harus muncul di chat yang sedang dibuka tanpa reload. Hanya untuk Sales,
  // karena memuat ulang di halaman review akan mengosongkan isian yang sedang diketik reviewer.
  const isSalesRole = (currentUser?.role ?? dashboardUser?.currentUser?.role) === "sales";

  useEffect(() => {
    if (!isSalesRole) {
      return;
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void loadConversationDetail();
      }
    }

    const timer = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [isSalesRole, loadConversationDetail]);

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

  const isReviewer = Boolean(currentUser && !canAccessQueueAndActionCenter(currentUser.role));

  if ((currentUser?.role ?? dashboardUser?.currentUser?.role) === "sales") {
    const currentDetail = detail?.conversation_id === conversationId ? detail : null;

    return (
      <SalesWorkbench
        currentUser={currentUser ?? dashboardUser?.currentUser ?? null}
        selectedId={conversationId}
        title={currentDetail?.title}
        refreshToken={refreshToken}
      >
        {errorMessage && !currentDetail ? (
          <div role="alert" className="m-6 space-y-3">
            <p className="clara-alert clara-alert-danger">{errorMessage}</p>
            <Link href="/sales" className="clara-button clara-button-secondary">
              Kembali ke daftar chat
            </Link>
          </div>
        ) : currentDetail ? (
          <SalesConversationPane
            key={currentDetail.conversation_id}
            detail={currentDetail}
            uploadBanner={buildUploadResultBanner(searchParams)}
            onUpdated={async () => {
              await loadConversationDetail();
              setRefreshToken((token) => token + 1);
            }}
          />
        ) : (
          <p role="status" aria-live="polite" className="p-6 text-sm clara-text-secondary">
            Memuat percakapan...
          </p>
        )}
      </SalesWorkbench>
    );
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={detail?.title ?? "Detail percakapan"}
      description={
        isReviewer
          ? "Baca chat dan tinjau jawaban yang disarankan Clara untuk Sales ini."
          : "Baca chat, lalu pilih jawaban dari Clara dan kirim sendiri dari WhatsApp."
      }
      backHref={isReviewer ? "/approvals" : "/sales"}
      backLabel={isReviewer ? "Kembali ke Review Sales" : "Kembali ke Chat Masuk"}
      actions={
        <>
          {detail ? (
            <Link
              href={buildContinuationHref(detail)}
              className="clara-button clara-button-secondary"
            >
              Tambah chat lanjutan
            </Link>
          ) : null}
          <Link
            href={
              isReviewer
                ? normalizeWorkspaceRole(currentUser?.role) === "head"
                  ? "/notifications"
                  : "/manager-insights"
                : "/follow-up"
            }
            className="clara-button clara-button-ghost"
          >
            {isReviewer
              ? normalizeWorkspaceRole(currentUser?.role) === "head"
                ? "Lihat Alert Tim"
                : "Lihat Monitor Tim"
              : "Lihat Tindak Lanjut"}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="clara-empty-state text-sm"
          >
            Memuat percakapan...
          </div>
        )}

        {errorMessage && !isLoading && (
          <div role="alert" className="clara-alert clara-alert-danger">
            <p>{errorMessage}</p>
            <Link
              href={isReviewer ? "/approvals" : "/sales"}
              className="clara-button clara-button-secondary mt-3"
            >
              {isReviewer ? "Kembali ke Review Sales" : "Kembali ke Chat Masuk"}
            </Link>
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
          role="status"
          aria-live="polite"
          className={
            uploadBanner.tone === "success"
              ? "clara-alert clara-alert-success"
              : "clara-alert clara-alert-info"
          }
        >
          {uploadBanner.text}
        </div>
      ) : null}

      {(freshCustomerReply || analysisStale || suggestionStale) ? (
        <div role="alert" className="clara-alert clara-alert-warning p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold clara-text-primary">
                Chat ini sudah berubah sejak terakhir dibaca
              </h2>
              <div className="mt-2 space-y-1.5 text-sm leading-6 clara-text-secondary">
                {freshCustomerReply ? (
                  <p>Customer membalas lagi setelah jawaban terakhir yang kamu kirim. Baca pesan terbarunya dulu.</p>
                ) : null}
                {analysisStale ? (
                  <p>Bacaan Clara sudah tertinggal dari chat terbaru. Baca ulang percakapan sebelum memutuskan.</p>
                ) : null}
                {suggestionStale ? (
                  <p>Draft jawaban yang lama mungkin sudah tidak cocok. Susun ulang setelah membaca ulang.</p>
                ) : null}
              </div>
            </div>

            <Link href={continuationHref} className="clara-button clara-button-secondary shrink-0">
              Tambah chat lanjutan
            </Link>
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
  const latestCustomerMessage = getLatestCustomerMessage(detail);
  const category =
    detail.account_category && detail.account_category !== "unknown"
      ? labelOf(ACCOUNT_CATEGORY, detail.account_category)
      : null;

  return (
    <section aria-label="Ringkasan percakapan" className="clara-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {extraction ? (
          <>
            <ValueTag table={TEMPERATURE} value={extraction.lead_temperature} />
            <ValueTag table={STAGE} value={extraction.pipeline_stage} />
            {extraction.risk_level !== "low" ? (
              <Tag tone={extraction.risk_level === "high" ? "danger" : "warn"}>
                {extraction.risk_level === "high" ? "Risiko tinggi" : "Risiko sedang"}
              </Tag>
            ) : null}
          </>
        ) : (
          <Tag tone="warn">Belum dibaca Clara</Tag>
        )}
        {suggestion ? (
          <ValueTag table={SUGGESTION_STATE} value={suggestion.approval_status} />
        ) : (
          <Tag tone="warn">Belum ada draft jawaban</Tag>
        )}
        {category ? <Tag>{category}</Tag> : null}
        {isExperimentalChannel(detail.source_channel) ? <Tag tone="warn">Eksperimental</Tag> : null}
        {analysisStale ? <Tag tone="warn">Perlu dibaca ulang</Tag> : null}
        {suggestionStale ? <Tag tone="warn">Draft sudah lama</Tag> : null}
      </div>

      <p className="mt-3 text-xs leading-5 clara-text-muted">
        Channel: {formatChannelLabel(detail.source_channel)} · Asal data: {formatProviderLabel(provider)} · Sumber:{" "}
        {detail.source_label} · Aktivitas terakhir {formatRelativeTime(detail.last_message_at)}
      </p>

      <article className="mt-4 min-w-0 rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4">
        <h2 className="text-sm font-semibold clara-text-primary">Pesan terbaru dari customer</h2>
        {latestCustomerMessage ? (
          <>
            <p className="mt-2 break-words whitespace-pre-wrap text-base leading-7 clara-text-primary [overflow-wrap:anywhere]">
              {latestCustomerMessage.message_text}
            </p>
            <p className="mt-2 text-xs clara-text-muted">
              {latestCustomerMessage.sender_name} · {formatDateTime(latestCustomerMessage.message_timestamp)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm clara-text-secondary">Belum ada pesan dari customer di chat ini.</p>
        )}
      </article>
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
  const canManage = canManageReviewCase(currentUser?.role);
  const canReviewProposal = canReviewKnowledgeProposal(currentUser?.role);
  const reviewCase = detail.chat_review_case;
  const knowledgeProposal = detail.knowledge_update_proposal;
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const [activePanel, setActivePanel] = useState<
    "ai_reply" | "coaching" | "knowledge" | "sent_logs"
  >("ai_reply");
  const [showAllMessages, setShowAllMessages] = useState(false);
  const visibleMessages = showAllMessages
    ? detail.messages
    : detail.messages.slice(Math.max(detail.messages.length - 12, 0));
  const chatTimeline = (
    <section
      data-onboarding-id="sales-conversation-timeline"
      className="clara-card min-w-0 p-4 sm:p-6"
      aria-labelledby="conversation-timeline-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="conversation-timeline-title" className="text-lg font-bold clara-text-primary">
          Isi chat
        </h2>
        <p className="text-sm clara-text-secondary">
          Menampilkan {visibleMessages.length} dari {detail.messages.length} pesan
        </p>
      </div>

      <div
        className="clara-scrollbar mt-4 max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-3 sm:p-4"
      >
        <ol className="space-y-3" aria-label="Pesan percakapan">
          {!showAllMessages &&
          detail.messages.length > visibleMessages.length ? (
            <li className="clara-card-outline p-3 text-sm clara-text-secondary">
              {detail.messages.length - visibleMessages.length} pesan lama disembunyikan.
              Pakai tombol di bawah untuk melihat semuanya.
            </li>
          ) : null}

          {visibleMessages.length === 0 ? (
            <li className="clara-empty-state text-sm">
              Belum ada pesan pada percakapan ini.
            </li>
          ) : null}

          {visibleMessages.map((message) => {
            const isSales = isSalesConversationMessage(message);

            return (
              <li
                key={message.id}
                className={`flex min-w-0 ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[92%] rounded-xl border px-4 py-3 sm:max-w-[78%] ${
                    isSales
                      ? "rounded-tr-sm border-[var(--color-border-strong)] bg-[var(--color-warning-surface)]"
                      : "rounded-tl-sm border-[var(--color-border-default)] bg-[var(--color-surface-base)]"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold clara-text-secondary">
                    {isSales ? "Sales" : "Customer"} · {message.sender_name}
                  </p>
                  {message.reply_context_text ? (
                    <blockquote className="mb-3 min-w-0 rounded-lg border-l-4 border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs leading-5 clara-text-secondary">
                      <p className="mb-1 font-semibold">
                        Membalas{" "}
                        {message.reply_context_sender_type === "sales"
                          ? "pesan sales"
                          : "pesan customer"}
                        {message.reply_context_sender_name
                          ? ` · ${message.reply_context_sender_name}`
                          : ""}
                      </p>
                      <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {message.reply_context_text}
                      </p>
                    </blockquote>
                  ) : null}
                  <p className="break-words whitespace-pre-wrap text-[15px] leading-7 clara-text-primary [overflow-wrap:anywhere]">
                    {message.message_text}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <p className="text-xs clara-text-muted">
                      {formatDateTime(message.message_timestamp)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {detail.messages.length > 12 ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllMessages((current) => !current)}
            className="clara-button clara-button-ghost"
          >
            {showAllMessages ? "Tampilkan pesan terbaru saja" : "Tampilkan semua pesan"}
          </button>
        </div>
      ) : null}
    </section>
  );

  return (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] xl:items-start">
        {
          <>
            <section className="clara-card rounded-3xl p-5">
          <div>
            <p className="clara-kicker">Workspace Panel</p>
            <h3 className="mt-2 text-lg font-semibold clara-text-primary">
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

                <div className="rounded-2xl border border-clara-line bg-clara-raised p-5">
                  <p className="clara-kicker">AI Analysis</p>
                  <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
                    Hasil pembacaan Clara
                  </h2>

                  {extraction ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <InfoBlock
                        label="Pipeline stage"
                        value={formatStatusLabel(extraction.pipeline_stage)}
                      />
                      <InfoBlock
                        label="Minat beli"
                        value={formatStatusLabel(extraction.buying_intent)}
                      />
                      <InfoBlock
                        label="Sentiment"
                        value={formatStatusLabel(extraction.sentiment)}
                      />
                      <div className="clara-card-soft rounded-2xl p-4">
                        <p className="clara-kicker text-xs">
                          Main objections
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {extraction.main_objections.length > 0 ? (
                            extraction.main_objections.map((objection) => (
                              <span
                                key={objection}
                                className="rounded-full bg-clara-raised px-2.5 py-1 text-xs font-medium text-clara-ink-2"
                              >
                                {objection}
                              </span>
                            ))
                          ) : (
                            <p className="text-clara-ink-2">
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
                    <div className="clara-card-outline mt-4 rounded-2xl p-4 text-sm text-clara-ink-2">
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
                  <div className="clara-card-outline rounded-3xl p-5">
                    <h2 className="text-lg font-semibold clara-text-primary">
                      Belum ada reply suggestion
                    </h2>
                    <p className="mt-2 text-sm text-clara-ink-2">
                      Generate reply suggestion dulu, lalu review approval
                      status sebelum memutuskan kirim balasan.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {activePanel === "coaching" ? (
              <div className="rounded-2xl border border-clara-line bg-clara-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="clara-kicker">Coaching Review</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
                      Review case manusia untuk manager dan head
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-clara-ink-2">
                      Gunakan section ini untuk memberi label coaching, menunjuk
                      reviewer, dan menyimpan manager note yang persisten per
                      conversation.
                    </p>
                  </div>
                  {reviewCase ? (
                    <span className="rounded-full bg-clara-raised px-3 py-1 text-xs font-semibold text-clara-ink-2">
                      {formatReviewCaseStatus(reviewCase.status)} ·{" "}
                      {formatReviewCaseLabel(reviewCase.review_label)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-clara-tint px-3 py-1 text-xs font-semibold text-clara-gold">
                      Belum ada review case
                    </span>
                  )}
                </div>

                {reviewSuccessMessage ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="clara-alert clara-alert-success mt-4"
                  >
                    {reviewSuccessMessage}
                  </div>
                ) : null}

                {reviewErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger mt-4">
                    {reviewErrorMessage}
                  </div>
                ) : null}

                {reviewSuggestionHint ? (
                  <div
                    role="status"
                    className="clara-alert clara-alert-info mt-4"
                  >
                    Saran AI—belum disimpan: {reviewSuggestionHint}
                  </div>
                ) : null}

                {canManage ? (
                  <form onSubmit={onSaveReviewCase} className="mt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                        <span>Status review</span>
                        <select
                          value={reviewStatusInput}
                          onChange={(event) =>
                            onReviewStatusChange(event.target.value)
                          }
                          className="clara-select"
                        >
                          {CHAT_REVIEW_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatReviewCaseStatus(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                        <span>Label coaching</span>
                        <select
                          value={reviewLabelInput}
                          onChange={(event) =>
                            onReviewLabelChange(event.target.value)
                          }
                          className="clara-select"
                        >
                          {CHAT_REVIEW_LABEL_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {formatReviewCaseLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                        <span>Reviewer</span>
                        <select
                          value={reviewerUserInput}
                          onChange={(event) =>
                            onReviewerUserChange(event.target.value)
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
                      </label>
                    </div>

                    <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                      <span>Ringkasan review</span>
                      <textarea
                        value={reviewSummaryInput}
                        onChange={(event) =>
                          onReviewSummaryChange(event.target.value)
                        }
                        rows={3}
                        className="clara-textarea"
                        placeholder="Tulis konteks singkat percakapan dan alasan kenapa case ini perlu coaching."
                      />
                    </label>

                    <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                      <span>Fokus coaching</span>
                      <textarea
                        value={coachingFocusInput}
                        onChange={(event) =>
                          onCoachingFocusChange(event.target.value)
                        }
                        rows={3}
                        className="clara-textarea"
                        placeholder="Contoh: handling objection legalitas, tone closing, atau cara mengarahkan next step."
                      />
                    </label>

                    <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                      <span>Recommended action</span>
                      <textarea
                        value={recommendedActionInput}
                        onChange={(event) =>
                          onRecommendedActionChange(event.target.value)
                        }
                        rows={3}
                        className="clara-textarea"
                        placeholder="Jelaskan apa yang sales harus lakukan setelah coaching ini dibaca."
                      />
                    </label>

                    <div className="flex justify-end">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void onPrefillReviewCase()}
                          disabled={isPrefillingReviewCase}
                          className="clara-button clara-button-secondary"
                        >
                          {isPrefillingReviewCase
                            ? "Clara sedang mengisi..."
                            : "Prefill dengan Clara"}
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingReviewCase}
                          className="clara-button clara-button-primary"
                        >
                          {isSavingReviewCase
                            ? "Menyimpan review..."
                            : "Simpan Review Case"}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : reviewCase ? (
                  <div className="mt-5 space-y-3 rounded-2xl border border-clara-line bg-clara-raised p-4 text-sm text-clara-ink-2">
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
                  <div className="mt-5 rounded-2xl border border-dashed border-clara-dashed bg-clara-raised p-4 text-sm text-clara-ink-2">
                    Belum ada review case coaching untuk percakapan ini.
                  </div>
                )}

                {reviewCase ? (
                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="clara-kicker">Manager Notes</p>
                      <h3 className="mt-2 text-lg font-semibold clara-text-primary">
                        Catatan coaching yang tersimpan
                      </h3>
                    </div>

                    {canManage ? (
                      <form onSubmit={onAddReviewNote} className="space-y-3">
                        <label htmlFor="manager-note" className="clara-label">
                          Manager note
                        </label>
                        <textarea
                          id="manager-note"
                          value={reviewNoteInput}
                          onChange={(event) =>
                            onReviewNoteChange(event.target.value)
                          }
                          rows={3}
                          className="clara-textarea"
                          placeholder="Tulis catatan coaching, instruksi rework, atau alasan eskalasi."
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isAddingReviewNote || !reviewCase}
                            className="clara-button clara-button-secondary"
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
                            className="rounded-2xl border border-clara-line bg-clara-raised p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-clara-ink-3">
                              <span className="font-semibold text-clara-ink-2">
                                {note.author_user_name ?? "System"}
                              </span>
                              <span>{formatDateTime(note.created_at)}</span>
                              <span className="rounded-full bg-clara-raised px-2.5 py-1 font-semibold text-clara-ink-2">
                                {formatReviewCaseLabel(note.note_type)}
                              </span>
                            </div>
                            <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 clara-text-secondary [overflow-wrap:anywhere]">
                              {note.body}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-clara-dashed bg-clara-raised p-4 text-sm text-clara-ink-3">
                        Belum ada manager note di review case ini.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePanel === "knowledge" ? (
              <div className="rounded-2xl border border-clara-line bg-clara-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="clara-kicker">Antrean Update Knowledge</p>
                    <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
                      Usulan knowledge dari kasus lapangan
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-clara-ink-2">
                      Setelah coaching case jelas, naikkan insight penting jadi
                      proposal knowledge supaya bisa dikoreksi, dieskalasi ke
                      superadmin, lalu dipublish ke knowledge base resmi bila
                      disetujui.
                    </p>
                  </div>
                  {knowledgeProposal ? (
                    <span className="rounded-full bg-clara-raised px-3 py-1 text-xs font-semibold text-clara-ink-2">
                      {formatKnowledgeProposalStatus(knowledgeProposal.status)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-clara-tint px-3 py-1 text-xs font-semibold text-clara-gold">
                      Belum ada proposal
                    </span>
                  )}
                </div>

                {!reviewCase ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-clara-dashed bg-clara-raised p-4 text-sm text-clara-ink-2">
                    Buat dan simpan coaching review dulu. Proposal knowledge
                    Tahap 4 sengaja diikat ke review case supaya audit trail-nya
                    jelas.
                  </div>
                ) : (
                  <>
                    {knowledgeProposalSuccessMessage ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="clara-alert clara-alert-success mt-4"
                      >
                        {knowledgeProposalSuccessMessage}
                      </div>
                    ) : null}

                    {knowledgeProposalErrorMessage ? (
                      <div
                        role="alert"
                        className="clara-alert clara-alert-danger mt-4"
                      >
                        {knowledgeProposalErrorMessage}
                      </div>
                    ) : null}

                    {canManage ? (
                      <form
                        onSubmit={onSaveKnowledgeProposal}
                        className="mt-5 space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                            <span>Judul proposal</span>
                            <input
                              value={knowledgeProposalTitleInput}
                              onChange={(event) =>
                                onKnowledgeProposalTitleChange(
                                  event.target.value,
                                )
                              }
                              className="clara-input"
                              placeholder="Contoh: Playbook handling objection legalitas"
                            />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                            <span>Kategori</span>
                            <input
                              value={knowledgeProposalCategoryInput}
                              onChange={(event) =>
                                onKnowledgeProposalCategoryChange(
                                  event.target.value,
                                )
                              }
                              className="clara-input"
                              placeholder="legalitas / objection / trust"
                            />
                          </label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                            <span>Source type</span>
                            <input
                              value={knowledgeProposalSourceTypeInput}
                              onChange={(event) =>
                                onKnowledgeProposalSourceTypeChange(
                                  event.target.value,
                                )
                              }
                              className="clara-input"
                              placeholder="coaching_case"
                            />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-clara-ink-2">
                            <span>Status proposal</span>
                            <select
                              value={knowledgeProposalStatusInput}
                              onChange={(event) =>
                                onKnowledgeProposalStatusChange(
                                  event.target.value,
                                )
                              }
                              className="clara-select"
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

                        <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                          <span>Rationale</span>
                          <textarea
                            value={knowledgeProposalRationaleInput}
                            onChange={(event) =>
                              onKnowledgeProposalRationaleChange(
                                event.target.value,
                              )
                            }
                            rows={3}
                            className="clara-textarea"
                            placeholder="Jelaskan kenapa kasus ini layak dinaikkan ke knowledge base."
                          />
                        </label>

                        <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                          <span>Isi knowledge yang diusulkan</span>
                          <textarea
                            value={knowledgeProposalContentInput}
                            maxLength={50_000}
                            onChange={(event) =>
                              onKnowledgeProposalContentChange(
                                event.target.value,
                              )
                            }
                            rows={8}
                            className="clara-textarea"
                            placeholder="Tulis knowledge final yang nantinya akan dipublish ke product knowledge."
                          />
                          <span className="text-xs text-clara-ink-3">
                            {knowledgeProposalContentInput.length.toLocaleString(
                              "id-ID",
                            )} / 50.000 karakter
                          </span>
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
                            className="clara-button clara-button-primary"
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
                      <div className="mt-5 space-y-3 rounded-2xl border border-clara-line bg-clara-raised p-4 text-sm text-clara-ink-2">
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
                      <div className="mt-5 space-y-3 rounded-2xl border border-clara-line bg-clara-tint p-4">
                        <label className="block space-y-2 text-sm font-medium text-clara-ink-2">
                          <span>Catatan keputusan approval</span>
                          <textarea
                            value={knowledgeProposalDecisionNoteInput}
                            onChange={(event) =>
                              onKnowledgeProposalDecisionNoteChange(
                                event.target.value,
                              )
                            }
                            rows={3}
                            className="clara-textarea"
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
                            className="clara-button clara-button-danger"
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
                            className="clara-button clara-button-success"
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
              <div className="rounded-2xl border border-clara-line bg-clara-raised p-5">
                <p className="clara-kicker">Sent Messages</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] clara-text-primary">
                  Balasan yang ditandai terkirim
                </h2>
                <p className="mt-2 text-sm leading-6 clara-text-secondary">
                  Riwayat manual dashboard; bukan konfirmasi delivery atau read
                  receipt dari provider.
                </p>

                {detail.sent_messages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {detail.sent_messages.map((sentMessage) => (
                      <div
                        key={sentMessage.id}
                        className="rounded-2xl border border-clara-success-line bg-clara-success-surface p-4 text-sm text-clara-success"
                      >
                        <p className="font-semibold">
                          Sent by {sentMessage.sent_by_name}
                        </p>
                        <p className="mt-1 text-xs text-clara-success">
                          {formatDateTime(sentMessage.sent_at)} &bull;{" "}
                          {sentMessage.send_mode}
                        </p>
                        <p className="mt-3 break-words whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                          {sentMessage.message_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-clara-ink-2">
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
        }
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
      aria-pressed={isActive}
      className={`min-h-11 w-full rounded-2xl px-3.5 py-2.5 text-center text-sm font-semibold transition ${
        isActive
          ? "bg-clara-deep text-clara-cream shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
          : "border border-clara-line bg-clara-raised text-clara-ink-2 hover:border-clara-line"
      }`}
    >
      {label}
    </button>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl p-4">
      <p className="clara-kicker text-xs">{label}</p>
      <p className="mt-2 text-sm leading-6 text-clara-ink-2">{value}</p>
    </div>
  );
}

