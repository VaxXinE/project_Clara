"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import {
  isHeadRole,
  isManagerRole,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  CurrentUser,
  LeadDealItem,
  LeadDisciplineLogCreateRequest,
  LeadDisciplineSuggestionResponse,
  LeadDealUpsertRequest,
  LeadDetail,
  LeadTaskCreateRequest,
  LeadTaskItem,
  LeadTaskUpdateRequest,
  LeadUpdateRequest,
} from "@/types/dashboard";

const STAGE_OPTIONS = [
  "new_lead",
  "qualification",
  "education",
  "objection",
  "negotiation",
  "closing",
  "won",
  "lost",
  "unknown",
];

const TEMPERATURE_OPTIONS = ["cold", "warm", "hot", "unknown"];
const ACCOUNT_CATEGORY_OPTIONS = ["mini", "reguler", "unknown"];
const DEAL_STATUS_OPTIONS = ["open", "won", "lost"];
const DISCIPLINE_ACTIVITY_OPTIONS = [
  "follow_up_call",
  "follow_up_chat",
  "site_visit",
  "proposal_sent",
  "closing_push",
  "internal_coordination",
];
const DISCIPLINE_RESULT_OPTIONS = [
  "waiting_customer",
  "follow_up_scheduled",
  "needs_escalation",
  "won_progress",
  "lost_signal",
  "no_response",
];
const DISCIPLINE_MOOD_OPTIONS = [
  "positive",
  "neutral",
  "cautious",
  "resistant",
  "unresponsive",
];

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return new Date(value).toISOString();
}

function formatTimelineValue(value: string | null): string {
  if (!value) {
    return "-";
  }

  if (value.includes("T") && (value.endsWith("Z") || value.includes("+"))) {
    return formatDateTime(value);
  }

  return value;
}

function getTodayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisciplineStatus(value: string): string {
  switch (value) {
    case "logged_today":
      return "Logged today";
    case "missing_today_log":
      return "Missing today log";
    case "stale_log":
      return "Stale log";
    default:
      return value.replaceAll("_", " ");
  }
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

function formatStageLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveDealStatusInput(
  currentStage: string,
  explicitDealStatus: string | null | undefined,
): string {
  if (explicitDealStatus && explicitDealStatus !== "open") {
    return explicitDealStatus;
  }

  if (currentStage === "won" || currentStage === "lost") {
    return currentStage;
  }

  return explicitDealStatus ?? "open";
}

function leadNeedsDealMetricsSync(
  currentStage: string,
  explicitDealStatus: string | null | undefined,
): boolean {
  if (currentStage !== "won" && currentStage !== "lost") {
    return false;
  }

  return explicitDealStatus !== currentStage;
}

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingDisciplineLog, setIsCreatingDisciplineLog] = useState(false);
  const [isPrefillingDisciplineLog, setIsPrefillingDisciplineLog] =
    useState(false);
  const [isSavingDeal, setIsSavingDeal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dealSuccessMessage, setDealSuccessMessage] = useState("");
  const [taskErrorMessage, setTaskErrorMessage] = useState("");
  const [disciplineErrorMessage, setDisciplineErrorMessage] = useState("");
  const [disciplineSuccessMessage, setDisciplineSuccessMessage] = useState("");
  const [disciplineSuggestionHint, setDisciplineSuggestionHint] = useState("");
  const [dealErrorMessage, setDealErrorMessage] = useState("");
  const [timelinePage, setTimelinePage] = useState(1);

  const [summaryInput, setSummaryInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [stageInput, setStageInput] = useState("new_lead");
  const [temperatureInput, setTemperatureInput] = useState("unknown");
  const [accountCategoryInput, setAccountCategoryInput] = useState("unknown");
  const [followUpInput, setFollowUpInput] = useState("");
  const [assignedUserInput, setAssignedUserInput] = useState("");

  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskDescriptionInput, setTaskDescriptionInput] = useState("");
  const [taskDueAtInput, setTaskDueAtInput] = useState("");
  const [disciplineLogDateInput, setDisciplineLogDateInput] = useState(
    getTodayDateInputValue(),
  );
  const [disciplineActivityTypeInput, setDisciplineActivityTypeInput] =
    useState(DISCIPLINE_ACTIVITY_OPTIONS[0]);
  const [disciplineResultStatusInput, setDisciplineResultStatusInput] =
    useState(DISCIPLINE_RESULT_OPTIONS[0]);
  const [disciplineObjectionInput, setDisciplineObjectionInput] = useState("");
  const [disciplineMoodInput, setDisciplineMoodInput] = useState(
    DISCIPLINE_MOOD_OPTIONS[0],
  );
  const [disciplineNotesInput, setDisciplineNotesInput] = useState("");
  const [disciplineFollowUpInput, setDisciplineFollowUpInput] = useState("");
  const [dealStatusInput, setDealStatusInput] = useState("open");
  const [dealCurrencyInput, setDealCurrencyInput] = useState("IDR");
  const [expectedValueInput, setExpectedValueInput] = useState("0");
  const [depositAmountInput, setDepositAmountInput] = useState("0");
  const [expectedCloseDateInput, setExpectedCloseDateInput] = useState("");
  const [dealClosedAtInput, setDealClosedAtInput] = useState("");
  const [dealNotesInput, setDealNotesInput] = useState("");
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;

  const canReassignLead =
    currentUser?.role === "head" || currentUser?.role === "superadmin";
  const dealMetricsNeedsSync = lead
    ? leadNeedsDealMetricsSync(lead.current_stage, lead.deal?.status ?? null)
    : false;

  const fetchLeadDetail = useCallback(async (): Promise<LeadDetail> => {
    return apiFetch<LeadDetail>(`/leads/${leadId}`);
  }, [leadId]);

  const loadLeadDetail = useCallback(async () => {
    if (!leadId) {
      setErrorMessage("Lead ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, leadDetail] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        fetchLeadDetail(),
      ]);
      const canLoadScopedUsers = me.role === "head" || me.role === "superadmin";
      const scopedUsers = canLoadScopedUsers
        ? await apiFetch<CurrentUser[]>("/auth/users")
        : [];

      setCurrentUser(me);
      setUsers(scopedUsers.filter((user) => user.is_active));
      setLead(leadDetail);
      setSummaryInput(leadDetail.summary ?? "");
      setNotesInput(leadDetail.notes ?? "");
      setStageInput(leadDetail.current_stage);
      setTemperatureInput(leadDetail.lead_temperature);
      setAccountCategoryInput(leadDetail.account_category);
      setFollowUpInput(toDateTimeLocalValue(leadDetail.next_follow_up_at));
      setAssignedUserInput(leadDetail.assigned_user_id ?? "");
      setDealStatusInput(
        resolveDealStatusInput(
          leadDetail.current_stage,
          leadDetail.deal?.status ?? null,
        ),
      );
      setDealCurrencyInput(leadDetail.deal?.currency ?? "IDR");
      setExpectedValueInput(String(leadDetail.deal?.expected_value ?? 0));
      setDepositAmountInput(String(leadDetail.deal?.deposit_amount ?? 0));
      setExpectedCloseDateInput(leadDetail.deal?.expected_close_date ?? "");
      setDealClosedAtInput(
        toDateTimeLocalValue(leadDetail.deal?.closed_at ?? null),
      );
      setDealNotesInput(leadDetail.deal?.notes ?? "");
      setSuccessMessage("");
      setDisciplineSuccessMessage("");
      setDealSuccessMessage("");
    } catch (error) {
      setLead(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat detail lead.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchLeadDetail, leadId]);

  async function handleSaveDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) {
      return;
    }

    setIsSavingDeal(true);
    setDealErrorMessage("");
    setDealSuccessMessage("");

    try {
      const payload: LeadDealUpsertRequest = {
        status: dealStatusInput,
        currency: dealCurrencyInput.trim().toUpperCase() || "IDR",
        expected_value: Number(expectedValueInput || 0),
        deposit_amount: Number(depositAmountInput || 0),
        expected_close_date: expectedCloseDateInput || null,
        closed_at: fromDateTimeLocalValue(dealClosedAtInput),
        notes: dealNotesInput || null,
      };

      const updatedDeal = await apiFetch<LeadDealItem>(
        `/leads/${lead.id}/deal`,
        {
          method: "PUT",
          body: payload,
        },
      );

      const refreshedLead = await fetchLeadDetail();
      setLead(refreshedLead);
      setSummaryInput(refreshedLead.summary ?? "");
      setNotesInput(refreshedLead.notes ?? "");
      setStageInput(refreshedLead.current_stage);
      setTemperatureInput(refreshedLead.lead_temperature);
      setAccountCategoryInput(refreshedLead.account_category);
      setFollowUpInput(toDateTimeLocalValue(refreshedLead.next_follow_up_at));
      setAssignedUserInput(refreshedLead.assigned_user_id ?? "");
      setDealStatusInput(updatedDeal.status);
      setDealCurrencyInput(updatedDeal.currency);
      setExpectedValueInput(String(updatedDeal.expected_value ?? 0));
      setDepositAmountInput(String(updatedDeal.deposit_amount ?? 0));
      setExpectedCloseDateInput(updatedDeal.expected_close_date ?? "");
      setDealClosedAtInput(toDateTimeLocalValue(updatedDeal.closed_at ?? null));
      setDealNotesInput(updatedDeal.notes ?? "");
      setDealSuccessMessage("Deal metrics berhasil diperbarui.");
    } catch (error) {
      setDealErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan deal metrics.",
      );
    } finally {
      setIsSavingDeal(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLeadDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadLeadDetail]);

  const openTasks = useMemo(
    () =>
      (lead?.tasks ?? []).filter(
        (task) => task.status === "open" || task.status === "snoozed",
      ),
    [lead],
  );
  const timelinePageSize = 2;
  const timelineTotalPages = lead
    ? Math.max(1, Math.ceil(lead.timeline.length / timelinePageSize))
    : 1;
  const effectiveTimelinePage = Math.min(timelinePage, timelineTotalPages);
  const salesLeadFocus = useMemo(() => {
    if (!lead) {
      return {
        headline: "Lead belum dimuat.",
        helper: "Muat detail lead dulu untuk melihat konteks kerja berikutnya.",
      };
    }

    if (lead.next_follow_up_at) {
      return {
        headline: `Follow-up berikutnya ${formatDateTime(lead.next_follow_up_at)}.`,
        helper: "Pastikan step berikutnya jelas supaya lead tidak berhenti di status saja.",
      };
    }

    if ((lead.tasks ?? []).some((task) => task.status === "open")) {
      return {
        headline: "Lead ini masih punya tugas terbuka.",
        helper: "Bereskan task yang masih aktif atau set jadwal follow-up berikutnya.",
      };
    }

    return {
      headline: "Lead ini belum punya jadwal follow-up berikutnya.",
      helper: "Isi next follow-up supaya alur kerja sales tetap rapi dan lead tidak hilang dari radar.",
    };
  }, [lead]);
  const leadershipLeadFocus = useMemo(() => {
    if (!lead) {
      return {
        headline: "Lead belum dimuat.",
        helper: isHeadWorkspace
          ? "Muat detail lead dulu untuk melihat konteks tim, owner, dan keputusan apa yang mungkin perlu diambil."
          : "Muat detail lead dulu untuk melihat konteks tim dan next action lead ini.",
      };
    }

    if (lead.next_follow_up_at) {
      return {
        headline: `Lead ini punya next follow-up di ${formatDateTime(lead.next_follow_up_at)}.`,
        helper: isHeadWorkspace
          ? "Head cukup cek apakah owner, stage, dan arah follow-up-nya sudah selaras sebelum turun ke bagian detail lain."
          : "Manager cukup cek apakah owner, stage, dan arah follow-up-nya sudah masuk akal sebelum turun ke detail lain.",
      };
    }

    if ((lead.tasks ?? []).some((task) => task.status === "open")) {
      return {
        headline: "Lead ini masih punya task terbuka tetapi belum punya jadwal follow-up.",
        helper: isHeadWorkspace
          ? "Ini sinyal bahwa ritme tim belum rapi. Head cukup validasi apakah ini perlu arahan, eskalasi, atau cukup dibenahi oleh manager."
          : "Ini sinyal bahwa eksekusi sales belum rapi. Pastikan task dan jadwal follow-up saling nyambung.",
      };
    }

    return {
      headline: "Lead ini belum punya next follow-up yang jelas.",
      helper: isHeadWorkspace
        ? "Head sebaiknya mulai dari sini: cek owner, cek stage, lalu pastikan memang ada next step yang jelas sebelum lead ini makin tertinggal."
        : "Manager sebaiknya mulai dari sini: cek owner, cek stage, lalu pastikan ada step lanjutan yang benar-benar terjadwal.",
    };
  }, [isHeadWorkspace, lead]);
  const visibleTimeline = useMemo(() => {
    if (!lead) {
      return [];
    }

    const startIndex = (effectiveTimelinePage - 1) * timelinePageSize;
    return lead.timeline.slice(startIndex, startIndex + timelinePageSize);
  }, [effectiveTimelinePage, lead]);

  async function handleSaveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: LeadUpdateRequest = {
        summary: summaryInput || null,
        notes: notesInput || null,
        account_category: accountCategoryInput,
        current_stage: stageInput,
        lead_temperature: temperatureInput,
        next_follow_up_at: fromDateTimeLocalValue(followUpInput),
      };

      if (canReassignLead) {
        payload.assigned_user_id = assignedUserInput || null;
      }

      const updatedLead = await apiFetch<LeadDetail>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: payload,
      });

      setLead(updatedLead);
      setSummaryInput(updatedLead.summary ?? "");
      setNotesInput(updatedLead.notes ?? "");
      setStageInput(updatedLead.current_stage);
      setTemperatureInput(updatedLead.lead_temperature);
      setAccountCategoryInput(updatedLead.account_category);
      setFollowUpInput(toDateTimeLocalValue(updatedLead.next_follow_up_at));
      setAssignedUserInput(updatedLead.assigned_user_id ?? "");
      setDealStatusInput(
        resolveDealStatusInput(
          updatedLead.current_stage,
          updatedLead.deal?.status ?? null,
        ),
      );
      setSuccessMessage("Lead berhasil diperbarui.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan perubahan lead.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !taskTitleInput.trim()) {
      return;
    }

    setIsCreatingTask(true);
    setTaskErrorMessage("");

    try {
      const payload: LeadTaskCreateRequest = {
        task_type: "manual_follow_up",
        title: taskTitleInput.trim(),
        description: taskDescriptionInput.trim() || null,
        due_at: fromDateTimeLocalValue(taskDueAtInput),
      };

      await apiFetch<LeadTaskItem>(`/leads/${lead.id}/tasks`, {
        method: "POST",
        body: payload,
      });

      const refreshedLead = await fetchLeadDetail();
      setLead(refreshedLead);
      setTaskTitleInput("");
      setTaskDescriptionInput("");
      setTaskDueAtInput("");
    } catch (error) {
      setTaskErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat task.",
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleCreateDisciplineLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) {
      return;
    }

    setIsCreatingDisciplineLog(true);
    setDisciplineErrorMessage("");
    setDisciplineSuccessMessage("");

    try {
      const payload: LeadDisciplineLogCreateRequest = {
        log_date: disciplineLogDateInput || null,
        activity_type: disciplineActivityTypeInput,
        result_status: disciplineResultStatusInput,
        main_objection: disciplineObjectionInput.trim() || null,
        customer_mood: disciplineMoodInput || null,
        notes: disciplineNotesInput.trim() || null,
        next_follow_up_at: fromDateTimeLocalValue(disciplineFollowUpInput),
      };

      await apiFetch(`/leads/${lead.id}/discipline-logs`, {
        method: "POST",
        body: payload,
      });

      const refreshedLead = await fetchLeadDetail();
      setLead(refreshedLead);
      setFollowUpInput(toDateTimeLocalValue(refreshedLead.next_follow_up_at));
      setDisciplineLogDateInput(getTodayDateInputValue());
      setDisciplineActivityTypeInput(DISCIPLINE_ACTIVITY_OPTIONS[0]);
      setDisciplineResultStatusInput(DISCIPLINE_RESULT_OPTIONS[0]);
      setDisciplineObjectionInput("");
      setDisciplineMoodInput(DISCIPLINE_MOOD_OPTIONS[0]);
      setDisciplineNotesInput("");
      setDisciplineFollowUpInput("");
      setDisciplineSuccessMessage("Discipline log berhasil disimpan.");
      setDisciplineSuggestionHint("");
    } catch (error) {
      setDisciplineErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan discipline log.",
      );
    } finally {
      setIsCreatingDisciplineLog(false);
    }
  }

  async function handlePrefillDisciplineLog() {
    if (!lead) {
      return;
    }

    setIsPrefillingDisciplineLog(true);
    setDisciplineErrorMessage("");
    setDisciplineSuccessMessage("");

    try {
      const suggestion = await apiFetch<LeadDisciplineSuggestionResponse>(
        `/leads/${lead.id}/discipline-log-suggestion`,
      );
      setDisciplineActivityTypeInput(suggestion.activity_type);
      setDisciplineResultStatusInput(suggestion.result_status);
      setDisciplineObjectionInput(suggestion.main_objection ?? "");
      setDisciplineMoodInput(
        suggestion.customer_mood &&
          DISCIPLINE_MOOD_OPTIONS.includes(suggestion.customer_mood)
          ? suggestion.customer_mood
          : DISCIPLINE_MOOD_OPTIONS[0],
      );
      setDisciplineNotesInput(suggestion.notes);
      setDisciplineFollowUpInput(
        toDateTimeLocalValue(suggestion.next_follow_up_at),
      );
      setDisciplineSuggestionHint(
        `${suggestion.source_summary} Confidence ${Math.round(
          suggestion.confidence_score * 100,
        )}%.`,
      );
    } catch (error) {
      setDisciplineErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengambil prefill discipline log dari Clara.",
      );
    } finally {
      setIsPrefillingDisciplineLog(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, status: string) {
    if (!lead) {
      return;
    }

    setTaskErrorMessage("");

    try {
      const payload: LeadTaskUpdateRequest = { status };
      await apiFetch<LeadTaskItem>(`/leads/${lead.id}/tasks/${taskId}`, {
        method: "PATCH",
        body: payload,
      });

      const refreshedLead = await fetchLeadDetail();
      setLead(refreshedLead);
    } catch (error) {
      setTaskErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah status task.",
      );
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Detail lead"
      title={lead?.display_name ?? "Detail Lead"}
      description={
        isSalesWorkspace
          ? "Halaman ini dipakai untuk melihat status lead, mengatur follow-up berikutnya, dan menyimpan catatan kerja tanpa pindah-pindah halaman."
          : isHeadWorkspace
            ? "Halaman head untuk validasi satu lead secara cepat: owner, stage, follow-up, risiko eksekusi, dan apakah perlu arahan atau eskalasi."
            : isLeadershipWorkspace
            ? "Halaman manager untuk membaca kondisi satu lead dengan cepat: owner, stage, follow-up, risiko eksekusi, dan keputusan berikutnya."
            : "Halaman ini dipakai untuk merapikan konteks lead, menyetel follow-up berikutnya, dan membuat task yang benar-benar persisten."
      }
      backHref="/dashboard/crm"
      backLabel="Kembali ke daftar lead"
      actions={
        <div className="flex flex-wrap gap-3">
          {isHeadWorkspace ? (
            <>
              <Link
                href="/dashboard/notifications"
                className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Buka Alert Tim
              </Link>
              <Link
                href="/dashboard/approvals"
                className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Buka Arahan Tim
              </Link>
            </>
          ) : isLeadershipWorkspace ? (
            <Link
              href="/dashboard/manager-insights"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Monitor Tim
            </Link>
          ) : null}
          {lead?.customer_profile_id ? (
            <Link
              href={`/dashboard/customers/${lead.customer_profile_id}`}
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Buka Profil Customer
            </Link>
          ) : null}
          {lead?.latest_conversation_id ? (
            <Link
              href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
              className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
            >
              Buka Percakapan
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading lead detail...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {lead && !isLoading && !errorMessage && (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(71,49,19,0.94)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                  {isHeadWorkspace
                    ? "Prioritas head"
                    : isLeadershipWorkspace
                      ? "Prioritas manager"
                      : "Fokus kerja lead ini"}
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#fff3cf]">
                  {isLeadershipWorkspace
                    ? leadershipLeadFocus.headline
                    : salesLeadFocus.headline}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#e3c990]">
                  {isLeadershipWorkspace
                    ? leadershipLeadFocus.helper
                    : salesLeadFocus.helper}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#e9d4a0]">
                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                    Stage: <span className="font-semibold text-[#fff3cf]">{formatStageLabel(lead.current_stage)}</span>
                  </span>
                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                    Suhu lead: <span className="font-semibold text-[#fff3cf]">{lead.lead_temperature.toUpperCase()}</span>
                  </span>
                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                    Owner: <span className="font-semibold text-[#fff3cf]">{lead.assigned_user_name ?? "Belum ada"}</span>
                  </span>
                  {lead.needs_deal_sync ? (
                    <span className="rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-3 py-1.5">
                      Sinkron KPI: <span className="font-semibold text-[#fff3cf]">Perlu dicek</span>
                    </span>
                  ) : null}
                </div>
              </section>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Snapshot lead
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">
                      {isHeadWorkspace
                        ? "Kondisi inti yang perlu dibaca head"
                        : isLeadershipWorkspace
                          ? "Kondisi inti yang perlu dibaca manager"
                        : "Kondisi inti lead ini"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      Kategori akun:{" "}
                      {formatAccountCategory(lead.account_category)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                        lead.lead_temperature,
                      )}`}
                    >
                      {lead.lead_temperature.toUpperCase()}
                    </span>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Kategori akun"
                    value={formatAccountCategory(lead.account_category)}
                  />
                  <Metric
                    label="Kontak terakhir"
                    value={formatDateTime(lead.last_contact_at)}
                  />
                  <Metric
                    label="Follow-up berikutnya"
                    value={formatDateTime(lead.next_follow_up_at)}
                  />
                  <Metric
                    label="Jumlah percakapan"
                    value={String(lead.conversation_count)}
                  />
                  <Metric
                    label="Owner"
                    value={lead.assigned_user_name ?? "Belum ada"}
                  />
                  <Metric
                    label="Deal status"
                    value={lead.deal?.status ?? "Belum diisi"}
                  />
                </dl>
              </div>

              <form
                onSubmit={(event) => void handleSaveLead(event)}
                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isSalesWorkspace
                        ? "Update Status Lead"
                        : isHeadWorkspace
                          ? "Validasi Konteks Lead"
                          : isLeadershipWorkspace
                          ? "Kontrol Konteks Lead"
                          : "Lead Context"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {isSalesWorkspace
                        ? "Rapikan kategori akun, stage, suhu lead, ringkasan, dan jadwal follow-up dari satu form."
                        : isHeadWorkspace
                          ? "Head cukup cek field yang memengaruhi keputusan: owner, stage, suhu lead, ringkasan, dan jadwal follow-up."
                          : isLeadershipWorkspace
                          ? "Manager cukup cek field penting yang memengaruhi keputusan: stage, suhu lead, owner, summary, dan jadwal follow-up."
                          : "Update summary, notes, follow-up date, dan ownership lead."}
                    </p>
                  </div>
                  {successMessage && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {successMessage}
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <Field label="Kategori akun">
                    <DetailSelect
                      value={accountCategoryInput}
                      onChange={setAccountCategoryInput}
                      options={ACCOUNT_CATEGORY_OPTIONS}
                      getOptionLabel={formatAccountCategory}
                    />
                  </Field>

                  <Field label="Stage">
                    <DetailSelect
                      value={stageInput}
                      onChange={setStageInput}
                      options={STAGE_OPTIONS}
                      getOptionLabel={formatStageLabel}
                    />
                  </Field>

                  <Field label="Lead temperature">
                    <DetailSelect
                      value={temperatureInput}
                      onChange={setTemperatureInput}
                      options={TEMPERATURE_OPTIONS}
                      getOptionLabel={(option) => option.toUpperCase()}
                    />
                  </Field>

                  <Field label="Next follow-up">
                    <input
                      type="datetime-local"
                      value={followUpInput}
                      onChange={(event) => setFollowUpInput(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  {canReassignLead ? (
                    <Field label="Assigned user">
                      <select
                        value={assignedUserInput}
                        onChange={(event) =>
                          setAssignedUserInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-100"
                      >
                        <option value="">Belum ada assignee</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} • {user.role}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-5">
                  <Field label="Lead summary">
                    <textarea
                      value={summaryInput}
                      onChange={(event) => setSummaryInput(event.target.value)}
                      rows={4}
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Internal notes">
                    <textarea
                      value={notesInput}
                      onChange={(event) => setNotesInput(event.target.value)}
                      rows={5}
                      placeholder={
                        isSalesWorkspace
                          ? "Tulis konteks singkat: kebutuhan customer, keberatan utama, dan arah follow-up berikutnya."
                          : undefined
                      }
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? "Menyimpan..." : "Simpan Update Lead"}
                  </button>
                </div>
              </form>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isSalesWorkspace
                        ? "Catatan Follow-up Harian"
                        : isHeadWorkspace
                          ? "Jejak Follow-up Tim"
                          : isLeadershipWorkspace
                          ? "Jejak Eksekusi Sales"
                          : "Daily Discipline Log"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {isSalesWorkspace
                        ? "Catat hasil follow-up harian supaya lead ini punya jejak kerja yang jelas dan follow-up berikutnya tidak hilang."
                        : isHeadWorkspace
                          ? "Bagian ini dipakai head untuk melihat apakah follow-up benar-benar jalan, objection utamanya apa, dan apakah ritme tim perlu diintervensi."
                          : isLeadershipWorkspace
                          ? "Bagian ini dipakai manager untuk melihat apakah follow-up sales benar-benar tercatat, apa objection utamanya, dan apakah next step-nya jelas."
                          : "Catat hasil aktivitas harian sales langsung dari halaman lead supaya manager bisa membaca ritme kerja, objection, dan follow-up tanpa menebak."}
                    </p>
                  </div>
                  {disciplineSuccessMessage ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {disciplineSuccessMessage}
                    </span>
                  ) : null}
                </div>

                {disciplineSuggestionHint ? (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
                    {disciplineSuggestionHint}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <Metric
                    label={isSalesWorkspace ? "Status catatan" : "Compliance"}
                    value={formatDisciplineStatus(
                      lead.discipline_summary.compliance_status,
                    )}
                  />
                  <Metric
                    label={isSalesWorkspace ? "Catatan terakhir" : "Latest log"}
                    value={lead.discipline_summary.latest_log_date ?? "-"}
                  />
                  <Metric
                    label={isSalesWorkspace ? "Catatan hari ini" : "Logs today"}
                    value={String(lead.discipline_summary.logs_today_count)}
                  />
                  <Metric
                    label={isSalesWorkspace ? "Total catatan" : "Total logs"}
                    value={String(lead.discipline_summary.log_count)}
                  />
                </div>

                {disciplineErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {disciplineErrorMessage}
                  </div>
                ) : null}

                <form
                  onSubmit={(event) => void handleCreateDisciplineLog(event)}
                  className="mt-6 space-y-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Log date">
                      <input
                        type="date"
                        value={disciplineLogDateInput}
                        onChange={(event) =>
                          setDisciplineLogDateInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Activity type">
                      <select
                        value={disciplineActivityTypeInput}
                        onChange={(event) =>
                          setDisciplineActivityTypeInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        {DISCIPLINE_ACTIVITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Result status">
                      <select
                        value={disciplineResultStatusInput}
                        onChange={(event) =>
                          setDisciplineResultStatusInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        {DISCIPLINE_RESULT_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Customer mood">
                      <select
                        value={disciplineMoodInput}
                        onChange={(event) =>
                          setDisciplineMoodInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        {DISCIPLINE_MOOD_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Main objection">
                      <input
                        value={disciplineObjectionInput}
                        onChange={(event) =>
                          setDisciplineObjectionInput(event.target.value)
                        }
                        placeholder="Contoh: legalitas, harga, trust"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Next follow-up">
                      <input
                        type="datetime-local"
                        value={disciplineFollowUpInput}
                        onChange={(event) =>
                          setDisciplineFollowUpInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>
                  </div>

                  <Field label="Notes">
                    <textarea
                      value={disciplineNotesInput}
                      onChange={(event) =>
                        setDisciplineNotesInput(event.target.value)
                      }
                      rows={4}
                      placeholder="Tulis hasil follow-up hari ini, sinyal customer, dan langkah berikutnya."
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <div className="flex justify-end">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handlePrefillDisciplineLog()}
                        disabled={isPrefillingDisciplineLog}
                        className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isPrefillingDisciplineLog
                          ? "Clara sedang mengisi..."
                          : "Isi dengan bantuan Clara"}
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingDisciplineLog}
                        className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCreatingDisciplineLog
                          ? "Menyimpan log..."
                          : "Simpan Catatan"}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-6 space-y-3">
                  {lead.discipline_logs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      Belum ada discipline log untuk lead ini.
                    </div>
                  ) : (
                    lead.discipline_logs.slice(0, 5).map((log) => (
                      <article
                        key={log.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">
                              {log.activity_type.replaceAll("_", " ")} ·{" "}
                              {log.result_status.replaceAll("_", " ")}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {log.actor_user_name ?? "System"} · {log.log_date}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {log.customer_mood?.replaceAll("_", " ") ??
                              "no mood"}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Metric
                            label="Main objection"
                            value={log.main_objection ?? "-"}
                          />
                          <Metric
                            label="Next follow-up"
                            value={formatDateTime(log.next_follow_up_at)}
                          />
                        </div>

                        {log.notes ? (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {log.notes}
                          </p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            </section>

            <aside className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isSalesWorkspace
                        ? "Profil Customer Terkait"
                        : isHeadWorkspace
                          ? "Customer dan Lead Terkait"
                          : isLeadershipWorkspace
                          ? "Customer yang Terkait dengan Lead Ini"
                          : "Unified Customer Identity"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {isSalesWorkspace
                        ? "Kalau customer ini pernah muncul di channel atau lead lain, Clara akan tampilkan keterkaitannya di sini."
                        : isHeadWorkspace
                          ? "Head bisa cek apakah lead ini berdiri sendiri atau sebenarnya bagian dari konteks customer yang lebih besar di tim lain atau channel lain."
                          : isLeadershipWorkspace
                          ? "Manager bisa cek apakah lead ini berdiri sendiri atau ternyata terkait ke lead dan percakapan lain dari customer yang sama."
                          : "Clara sekarang mengikat banyak lead lintas channel ke satu profil customer agar konteks tidak pecah antara WhatsApp dan Telegram."}
                    </p>
                  </div>

                {lead.customer_profile ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {lead.customer_profile.display_name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            PIC customer:{" "}
                            {lead.customer_profile.assigned_user_name ??
                              "Belum ada"}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/customers/${lead.customer_profile.id}`}
                          className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                        >
                          Detail Profil
                        </Link>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Metric
                          label="Total lead"
                          value={String(lead.customer_profile.lead_count)}
                        />
                        <Metric
                          label="Total percakapan"
                          value={String(
                            lead.customer_profile.conversation_count,
                          )}
                        />
                        <Metric
                          label="Kontak terakhir"
                          value={formatDateTime(
                            lead.customer_profile.last_contact_at,
                          )}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {lead.customer_profile.source_labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {lead.customer_profile.related_leads.map(
                        (relatedLead) => (
                          <article
                            key={relatedLead.id}
                            className="rounded-[24px] border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-950">
                                {relatedLead.display_name}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getLeadBadgeClass(
                                  relatedLead.lead_temperature,
                                )}`}
                              >
                                {relatedLead.lead_temperature.toUpperCase()}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {relatedLead.source_label}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <Metric
                                label="Stage"
                                value={relatedLead.current_stage.replaceAll(
                                  "_",
                                  " ",
                                )}
                              />
                              <Metric
                                label="Kontak terakhir"
                                value={formatDateTime(
                                  relatedLead.last_contact_at,
                                )}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Link
                                href={`/dashboard/crm/${relatedLead.id}`}
                                className="inline-flex rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                              >
                                Buka Lead
                              </Link>
                              {relatedLead.latest_conversation_id ? (
                                <Link
                                  href={`/dashboard/sales/conversations/${relatedLead.latest_conversation_id}`}
                                  className="inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Buka Conversation
                                </Link>
                              ) : null}
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Lead ini belum punya customer profile terpadu.
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isSalesWorkspace
                        ? "Nilai Deal"
                        : isHeadWorkspace
                          ? "Sinkron KPI dan Nilai Deal"
                          : isLeadershipWorkspace
                          ? "KPI dan Nilai Deal"
                          : "Deal Metrics"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {isSalesWorkspace
                        ? "Isi nilai bisnis lead ini supaya progressnya bukan cuma status, tapi juga punya gambaran potensi deal."
                        : isHeadWorkspace
                          ? "Head bisa pakai bagian ini untuk memastikan stage, status deal, dan angka KPI utama tidak saling bertabrakan."
                          : isLeadershipWorkspace
                          ? "Manager bisa pakai bagian ini untuk memastikan stage lead sudah sinkron dengan status deal dan angka KPI utamanya."
                          : "Isi angka bisnis lead ini supaya KPI owner tidak cuma berhenti di pipeline health."}
                    </p>
                  </div>
                  {dealSuccessMessage && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {dealSuccessMessage}
                    </span>
                  )}
                </div>

                {dealErrorMessage && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {dealErrorMessage}
                  </div>
                )}

                {dealMetricsNeedsSync && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Stage lead ini sudah{" "}
                    <span className="font-semibold uppercase">
                      {lead.current_stage}
                    </span>{" "}
                    tetapi deal status di KPI masih{" "}
                    <span className="font-semibold uppercase">
                      {lead.deal?.status ?? "belum diisi"}
                    </span>
                    . Klik{" "}
                    <span className="font-semibold">Simpan Deal Metrics</span>{" "}
                    supaya KPI dan nilai deal ikut sinkron.
                  </div>
                )}

                <form
                  onSubmit={(event) => void handleSaveDeal(event)}
                  className="mt-5 space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Deal status">
                      <select
                        value={dealStatusInput}
                        onChange={(event) =>
                          setDealStatusInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        {DEAL_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Currency">
                      <input
                        value={dealCurrencyInput}
                        onChange={(event) =>
                          setDealCurrencyInput(event.target.value.toUpperCase())
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Expected value">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={expectedValueInput}
                        onChange={(event) =>
                          setExpectedValueInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Deposit amount">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={depositAmountInput}
                        onChange={(event) =>
                          setDepositAmountInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Expected close date">
                      <input
                        type="date"
                        value={expectedCloseDateInput}
                        onChange={(event) =>
                          setExpectedCloseDateInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>

                    <Field label="Closed at">
                      <input
                        type="datetime-local"
                        value={dealClosedAtInput}
                        onChange={(event) =>
                          setDealClosedAtInput(event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </Field>
                  </div>

                  <Field label="Deal notes">
                    <textarea
                      value={dealNotesInput}
                      onChange={(event) =>
                        setDealNotesInput(event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Metric
                        label="Expected value"
                        value={`${dealCurrencyInput} ${Number(expectedValueInput || 0).toLocaleString("id-ID")}`}
                      />
                      <Metric
                        label="Deposit"
                        value={`${dealCurrencyInput} ${Number(depositAmountInput || 0).toLocaleString("id-ID")}`}
                      />
                      <Metric
                        label="Deal status"
                        value={dealStatusInput.toUpperCase()}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingDeal}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingDeal
                      ? "Menyimpan deal..."
                      : "Simpan Nilai Deal"}
                  </button>
                </div>
              </form>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isSalesWorkspace
                        ? "Tugas Follow-up"
                        : isHeadWorkspace
                          ? "Task Aktif pada Lead Ini"
                          : isLeadershipWorkspace
                          ? "Task yang Masih Berjalan"
                          : "Follow-up Tasks"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {isSalesWorkspace
                        ? "Simpan tugas yang benar-benar perlu dikerjakan supaya follow-up tidak hanya bergantung ke ingatan."
                        : isHeadWorkspace
                          ? "Head bisa cek apakah task yang aktif memang mendorong lead maju atau justru hanya menumpuk tanpa owner yang jelas."
                          : isLeadershipWorkspace
                          ? "Manager bisa cek task yang masih aktif dan menilai apakah pekerjaan sales benar-benar bergerak atau cuma berhenti di status."
                          : "Task disimpan permanen, jadi worklist sales sekarang tidak hanya derived dari conversation."}
                    </p>
                  </div>

                {taskErrorMessage && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {taskErrorMessage}
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {openTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Belum ada tugas terbuka untuk lead ini.
                    </div>
                  ) : (
                    openTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">
                              {task.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Jatuh tempo: {formatDateTime(task.due_at)}
                            </p>
                          </div>
                          <select
                            value={task.status}
                            onChange={(event) =>
                              void handleTaskStatusChange(
                                task.id,
                                event.target.value,
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                          >
                            <option value="open">Open</option>
                            <option value="snoozed">Snoozed</option>
                            <option value="done">Done</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        {task.description && (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {task.description}
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <form
                  onSubmit={(event) => void handleCreateTask(event)}
                  className="mt-6 space-y-4 rounded-[24px] border border-slate-200 bg-white p-4"
                >
                  <Field label="Task title">
                    <input
                      value={taskTitleInput}
                      onChange={(event) =>
                        setTaskTitleInput(event.target.value)
                      }
                      placeholder="Contoh: Follow up soal legalitas"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Task description">
                    <textarea
                      value={taskDescriptionInput}
                      onChange={(event) =>
                        setTaskDescriptionInput(event.target.value)
                      }
                      rows={3}
                      placeholder="Tulis konteks singkat supaya sales berikutnya tidak kehilangan arah."
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Due at">
                    <input
                      type="datetime-local"
                      value={taskDueAtInput}
                      onChange={(event) =>
                        setTaskDueAtInput(event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={isCreatingTask}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isCreatingTask ? "Membuat tugas..." : "Tambah Tugas"}
                  </button>
                </form>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {isSalesWorkspace
                      ? "Riwayat Aktivitas"
                      : isHeadWorkspace
                        ? "Riwayat Lead dan Keputusan"
                        : isLeadershipWorkspace
                        ? "Riwayat Perubahan Lead"
                        : "Activity Timeline"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {isSalesWorkspace
                      ? "Semua perubahan penting di lead ini dicatat di sini supaya sales bisa cepat lihat histori kerja dan perubahan status."
                      : isHeadWorkspace
                        ? "Timeline ini dipakai head untuk audit cepat: stage berubah kapan, follow-up diisi siapa, task dibuat kapan, dan apakah arah lead butuh keputusan tambahan."
                        : isLeadershipWorkspace
                        ? "Timeline ini dipakai manager untuk audit cepat: stage berubah kapan, follow-up diisi siapa, task dibuat kapan, dan arah lead bergerak ke mana."
                        : "Semua perubahan penting di lead ini dicatat supaya perpindahan stage, follow-up, task, dan deal bisa diaudit dengan enak."}
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {lead.timeline.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Belum ada aktivitas yang tercatat untuk lead ini.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {visibleTimeline.map((event) => (
                          <article
                            key={event.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-sm font-semibold text-slate-950">
                                  {event.title}
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                  {event.actor_user_name ?? "System"} ·{" "}
                                  {formatDateTime(event.created_at)}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {event.event_type.replaceAll("_", " ")}
                              </span>
                            </div>

                            {event.description && (
                              <p className="mt-3 text-sm leading-6 text-slate-600">
                                {event.description}
                              </p>
                            )}

                            {(event.from_value || event.to_value) && (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <Metric
                                  label="Dari"
                                  value={formatTimelineValue(event.from_value)}
                                />
                                <Metric
                                  label="Menjadi"
                                  value={formatTimelineValue(event.to_value)}
                                />
                              </div>
                            )}
                          </article>
                        ))}
                      </div>

                      {lead.timeline.length > timelinePageSize ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm text-slate-600">
                            Halaman {effectiveTimelinePage} dari {timelineTotalPages} ·
                            menampilkan {visibleTimeline.length} dari{" "}
                            {lead.timeline.length} aktivitas.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setTimelinePage((current) =>
                                  Math.max(1, current - 1),
                                )
                              }
                              disabled={effectiveTimelinePage === 1}
                              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTimelinePage((current) =>
                                  Math.min(timelineTotalPages, current + 1),
                                )
                              }
                              disabled={effectiveTimelinePage === timelineTotalPages}
                              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function DetailSelect({
  value,
  onChange,
  options,
  getOptionLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  getOptionLabel: (value: string) => string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDropdownOpen = !disabled && isOpen;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={isDropdownOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus-visible:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        <span>{getOptionLabel(value)}</span>
        <span
          aria-hidden="true"
          className={`text-slate-500 transition-transform ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        >
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.25 4.5L6 8.25L9.75 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isDropdownOpen ? (
        <div className="absolute inset-x-0 z-10 mt-2 rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(29,21,15,0.99)_0%,rgba(17,12,9,0.99)_100%)] p-2 shadow-[0_18px_36px_rgba(0,0,0,0.28)]">
          <ul
            role="listbox"
            aria-label="Select option"
            className="clara-scrollbar max-h-72 space-y-1 overflow-y-auto pr-1"
          >
            {options.map((option) => {
              const isSelected = option === value;

              return (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setIsOpen(false);
                      if (option !== value) {
                        onChange(option);
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? "bg-[#f0cb73] text-[#1a120b]"
                        : "text-[#fff0c9] hover:bg-[#2b2013] hover:text-[#fff8de]"
                    }`}
                  >
                    <span className="capitalize">{getOptionLabel(option)}</span>
                    {isSelected ? (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a3e16]">
                        Aktif
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
