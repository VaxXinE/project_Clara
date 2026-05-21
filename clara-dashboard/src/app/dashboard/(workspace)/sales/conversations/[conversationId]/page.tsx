"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getLeadBadgeClass,
  getRiskBadgeClass,
} from "@/lib/format";
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
  return ["head", "superadmin"].includes((role ?? "").toLowerCase());
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

export default function SalesConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
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
  const [knowledgeProposalSourceTypeInput, setKnowledgeProposalSourceTypeInput] =
    useState("coaching_case");
  const [knowledgeProposalRationaleInput, setKnowledgeProposalRationaleInput] =
    useState("");
  const [knowledgeProposalStatusInput, setKnowledgeProposalStatusInput] =
    useState("draft");
  const [knowledgeProposalDecisionNoteInput, setKnowledgeProposalDecisionNoteInput] =
    useState("");
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

  useEffect(() => {
    if (!detail) {
      return;
    }

    const reviewCase = detail.chat_review_case;
    setReviewStatusInput(reviewCase?.status ?? "draft");
    setReviewLabelInput(reviewCase?.review_label ?? "unik");
    setReviewerUserInput(reviewCase?.reviewer_user_id ?? currentUser?.id ?? "");
    setReviewSummaryInput(reviewCase?.review_summary ?? "");
    setCoachingFocusInput(reviewCase?.coaching_focus ?? "");
    setRecommendedActionInput(reviewCase?.recommended_action ?? "");

    const knowledgeProposal = detail.knowledge_update_proposal;
    setKnowledgeProposalTitleInput(
      knowledgeProposal?.title ??
        `${detail.title} · update knowledge`,
    );
    setKnowledgeProposalCategoryInput(knowledgeProposal?.category ?? "general");
    setKnowledgeProposalContentInput(
      knowledgeProposal?.proposed_content ??
        [
          reviewCase?.review_summary ? `Ringkasan kasus: ${reviewCase.review_summary}` : "",
          reviewCase?.coaching_focus ? `Fokus coaching: ${reviewCase.coaching_focus}` : "",
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
  }, [detail, currentUser]);

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

  async function handleSaveKnowledgeProposal(event: FormEvent<HTMLFormElement>) {
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
          ? "Proposal knowledge berhasil diajukan ke approval queue."
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

  async function handleReviewKnowledgeProposal(status: "approved" | "rejected") {
    if (!detail?.knowledge_update_proposal) {
      return;
    }

    setIsReviewingKnowledgeProposal(true);
    setKnowledgeProposalErrorMessage("");
    setKnowledgeProposalSuccessMessage("");

    try {
      const payload: KnowledgeUpdateProposalReviewRequest = {
        status,
        review_decision_note:
          knowledgeProposalDecisionNoteInput.trim() || null,
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
          ? "Proposal knowledge berhasil di-approve dan dipublish."
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
      backHref="/dashboard/sales"
      backLabel="Kembali ke inbox"
      actions={
        <Link
          href="/dashboard/follow-up"
          className="clara-button clara-button-ghost"
        >
          Buka Worklist
        </Link>
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
            <Link href="/dashboard/sales" className="font-semibold underline">
              sales inbox
            </Link>
            .
          </div>
        )}

        {detail && !isLoading && !errorMessage && (
          <>
            <ConversationDetailHeader detail={detail} />
            <ConversationUsageGuide detail={detail} />
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
              knowledgeProposalSourceTypeInput={knowledgeProposalSourceTypeInput}
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
              onKnowledgeProposalContentChange={setKnowledgeProposalContentInput}
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

function ConversationDetailHeader({
  detail,
}: {
  detail: SalesConversationDetail;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="clara-card rounded-[30px] p-6">
        <p className="clara-kicker">Conversation Signal</p>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          Ringkasan kondisi percakapan saat ini
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Last message: {formatDateTime(detail.last_message_at)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                extraction.lead_temperature,
              )}`}
            >
              {extraction.lead_temperature.toUpperCase()}
            </span>
          )}

          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadgeClass(
                extraction.risk_level,
              )}`}
            >
              Risk {extraction.risk_level}
            </span>
          )}

          {suggestion && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {formatStatusLabel(suggestion.approval_status)}
            </span>
          )}
        </div>
      </div>

      <div className="clara-card-dark rounded-[30px] p-6">
        <p className="clara-kicker text-[#d4b07b]">Snapshot</p>
        <div className="mt-4 space-y-3">
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
    </section>
  );
}

function ConversationUsageGuide({
  detail,
}: {
  detail: SalesConversationDetail;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const sentCount = detail.sent_messages.length;

  const nextStep = !extraction
    ? {
        title: "Jalankan AI analysis dulu",
        description:
          "Tanpa AI analysis, Anda belum punya ringkasan stage, risiko, objection, dan next best action. Ini langkah pertama yang paling masuk akal.",
      }
    : !suggestion
      ? {
          title: "Buat draft balasan",
          description:
            "Analisis sudah ada. Langkah berikutnya adalah menghasilkan reply suggestion supaya conversation ini bisa ditindaklanjuti dengan cepat.",
        }
      : sentCount === 0
        ? {
            title: "Review lalu kirim atau approve draft",
            description:
              "Draft sudah tersedia. Sekarang fokus Anda adalah mengecek kesesuaian bahasa, approval status, dan apakah balasan sudah siap dikirim.",
          }
        : {
            title: "Naikkan konteksnya ke lead dan follow-up",
            description:
              "Percakapan ini sudah punya jejak balasan. Pastikan lead stage, task, dan follow-up berikutnya di CRM sudah ikut rapi.",
          };

  return (
    <section className="clara-card rounded-[30px] p-5 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="clara-kicker">Langkah Berikutnya</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            {nextStep.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            {nextStep.description}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <UsageCard
            title="1. Baca chat dulu"
            description="Pahami konteks terbaru sebelum melihat analisis atau draft."
          />
          <UsageCard
            title="2. Lihat AI analysis"
            description="Gunakan stage, risk, objection, dan next action sebagai panduan keputusan."
          />
          <UsageCard
            title="3. Putuskan aksi"
            description="Entah generate draft, approve/kirim, atau pindah ke lead detail untuk follow-up."
          />
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
  onReviewKnowledgeProposal: (
    status: "approved" | "rejected",
  ) => Promise<void>;
  onUpdated: () => Promise<void>;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const canManage = canManageReviewCase(currentUser?.role);
  const canReviewProposal = canReviewKnowledgeProposal(currentUser?.role);
  const reviewCase = detail.chat_review_case;
  const knowledgeProposal = detail.knowledge_update_proposal;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="clara-card rounded-[30px] p-5 sm:p-6">
        <div>
          <p className="clara-kicker">Chat Timeline</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            Timeline percakapan
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Pesan hasil parsing dari export WhatsApp.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {detail.messages.map((message) => {
            const isSales = message.sender_type === "sales";

            return (
              <div
                key={message.id}
                className={`flex ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${
                    isSales
                      ? "bg-[#10172d] text-white"
                      : "bg-[rgba(255,248,239,0.92)] text-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">
                      {message.sender_name}
                    </p>
                    <p
                      className={`text-xs ${
                        isSales ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {formatDateTime(message.message_timestamp)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                    {message.message_text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-6">
        <ConversationAiActions
          conversationId={detail.conversation_id}
          hasAiExtraction={Boolean(extraction)}
          hasReplySuggestion={Boolean(suggestion)}
          onUpdated={onUpdated}
        />

        <div className="clara-card rounded-[30px] p-5">
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
                <p className="clara-kicker text-[11px]">Main objections</p>
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
                    <p className="text-slate-600">Tidak ada objection.</p>
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
            onUpdated={onUpdated}
          />
        ) : (
          <div className="clara-card-outline rounded-[30px] p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Belum ada reply suggestion
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate reply suggestion dulu, lalu review approval status
              sebelum memutuskan kirim balasan.
            </p>
          </div>
        )}

        <div className="clara-card rounded-[30px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="clara-kicker">Coaching Review</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                Review case manusia untuk manager dan head
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gunakan section ini untuk memberi label coaching, menunjuk reviewer,
                dan menyimpan manager note yang persisten per conversation.
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
                    onChange={(event) => onReviewStatusChange(event.target.value)}
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
                    onChange={(event) => onReviewLabelChange(event.target.value)}
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
                    onChange={(event) => onReviewerUserChange(event.target.value)}
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
                  onChange={(event) => onReviewSummaryChange(event.target.value)}
                  rows={3}
                  className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                  placeholder="Tulis konteks singkat percakapan dan alasan kenapa case ini perlu coaching."
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Fokus coaching</span>
                <textarea
                  value={coachingFocusInput}
                  onChange={(event) => onCoachingFocusChange(event.target.value)}
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
                    {isSavingReviewCase ? "Menyimpan review..." : "Simpan Review Case"}
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
                    onChange={(event) => onReviewNoteChange(event.target.value)}
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
                      {isAddingReviewNote ? "Menyimpan note..." : "Tambah Manager Note"}
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

        <div className="clara-card rounded-[30px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="clara-kicker">Knowledge Update Queue</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
                Usulan knowledge dari kasus lapangan
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Setelah coaching case jelas, naikkan insight penting jadi proposal knowledge
                supaya bisa direview dan dipublish ke knowledge base resmi.
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
              Buat dan simpan coaching review dulu. Proposal knowledge Tahap 4 sengaja
              diikat ke review case supaya audit trail-nya jelas.
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
                <form onSubmit={onSaveKnowledgeProposal} className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Judul proposal</span>
                      <input
                        value={knowledgeProposalTitleInput}
                        onChange={(event) =>
                          onKnowledgeProposalTitleChange(event.target.value)
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
                          onKnowledgeProposalCategoryChange(event.target.value)
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
                          onKnowledgeProposalSourceTypeChange(event.target.value)
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
                          onKnowledgeProposalStatusChange(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        {KNOWLEDGE_PROPOSAL_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {formatKnowledgeProposalStatus(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>Rationale</span>
                    <textarea
                      value={knowledgeProposalRationaleInput}
                      onChange={(event) =>
                        onKnowledgeProposalRationaleChange(event.target.value)
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
                        onKnowledgeProposalContentChange(event.target.value)
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
                        knowledgeProposalCategoryInput.trim().length === 0 ||
                        knowledgeProposalContentInput.trim().length === 0 ||
                        knowledgeProposalSourceTypeInput.trim().length === 0
                      }
                      className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingKnowledgeProposal
                        ? "Menyimpan proposal..."
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
                      knowledgeProposal.published_product_knowledge_title ?? "-"
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
                        onKnowledgeProposalDecisionNoteChange(event.target.value)
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
                      onClick={() => void onReviewKnowledgeProposal("rejected")}
                      className="inline-flex rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isReviewingKnowledgeProposal ? "Memproses..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      disabled={isReviewingKnowledgeProposal}
                      onClick={() => void onReviewKnowledgeProposal("approved")}
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

        <div className="clara-card rounded-[30px] p-5">
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
      </aside>
    </section>
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

function UsageCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="clara-card-soft rounded-[22px] p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
