"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";
import { ReviewerWorkspace } from "@/components/dashboard/ReviewerWorkspace";
import { SalesConversationPane } from "@/components/dashboard/SalesConversationPane";
import { SalesWorkbench } from "@/components/dashboard/SalesWorkbench";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { canAccessQueueAndActionCenter } from "@/lib/roles";
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

function canManageReviewCase(role?: string | null): boolean {
  return ["manager", "head", "superadmin"].includes((role ?? "").toLowerCase());
}

function canReviewKnowledgeProposal(role?: string | null): boolean {
  return ["superadmin"].includes((role ?? "").toLowerCase());
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

  const backHref = isReviewer ? "/approvals" : "/sales";
  const backLabel = isReviewer ? "Kembali ke Review Sales" : "Kembali ke Chat Masuk";

  return (
    <WorkspaceShell
      bare
      currentUser={currentUser}
      title={detail?.title ?? "Detail percakapan"}
      description=""
    >
      <div className="space-y-4">
        {isLoading ? (
          <div role="status" aria-live="polite" className="clara-empty-state text-sm">
            Memuat percakapan...
          </div>
        ) : null}

        {errorMessage && !isLoading ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            <p>{errorMessage}</p>
            <Link href={backHref} className="clara-button clara-button-secondary mt-3">
              {backLabel}
            </Link>
          </div>
        ) : null}

        {detail && !isLoading && !errorMessage ? (
          <ReviewerWorkspace
            currentUser={currentUser}
            detail={detail}
            backHref={backHref}
            backLabel={backLabel}
            uploadBanner={buildUploadResultBanner(searchParams)}
            canOperate={canAccessQueueAndActionCenter(currentUser?.role)}
            canManage={canManageReviewCase(currentUser?.role)}
            canReviewProposal={canReviewKnowledgeProposal(currentUser?.role)}
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
            knowledgeProposalSourceTypeInput={knowledgeProposalSourceTypeInput}
            knowledgeProposalRationaleInput={knowledgeProposalRationaleInput}
            knowledgeProposalStatusInput={knowledgeProposalStatusInput}
            knowledgeProposalDecisionNoteInput={knowledgeProposalDecisionNoteInput}
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
            onKnowledgeProposalCategoryChange={setKnowledgeProposalCategoryInput}
            onKnowledgeProposalContentChange={setKnowledgeProposalContentInput}
            onKnowledgeProposalRationaleChange={setKnowledgeProposalRationaleInput}
            onKnowledgeProposalStatusChange={setKnowledgeProposalStatusInput}
            onKnowledgeProposalDecisionNoteChange={setKnowledgeProposalDecisionNoteInput}
            onPrefillReviewCase={handlePrefillReviewCase}
            onSaveReviewCase={handleSaveReviewCase}
            onAddReviewNote={handleAddReviewNote}
            onSaveKnowledgeProposal={handleSaveKnowledgeProposal}
            onReviewKnowledgeProposal={handleReviewKnowledgeProposal}
            onUpdated={loadConversationDetail}
          />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
