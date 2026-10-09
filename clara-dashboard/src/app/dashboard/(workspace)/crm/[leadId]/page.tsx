"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { customerLabel } from "@/lib/customer";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { rememberFollowUpNotice } from "@/lib/follow-up-notice";
import { QUICK_SCHEDULES } from "@/lib/schedule";
import { getRoleDisplayLabel, isHeadRole, isManagerRole } from "@/lib/roles";
import {
  ACCOUNT_CATEGORY,
  ACTIVITY_EVENT,
  DEAL_STATUS,
  DISCIPLINE_ACTIVITY,
  DISCIPLINE_MOOD,
  DISCIPLINE_RESULT,
  DISCIPLINE_STATUS,
  STAGE,
  TASK_STATUS,
  TEMPERATURE,
  humanizeActivityDescription,
  humanizeActivityTitle,
  humanizeActivityValue,
  labelOf,
  plainJargon,
  type VocabTable,
} from "@/lib/vocab";
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

function getTodayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
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
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;
  const disciplineSuccessRef = useRef<HTMLDivElement | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [customScheduleInput, setCustomScheduleInput] = useState("");

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
        error instanceof Error ? error.message : "Detail lead belum bisa dimuat.",
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
      setDealSuccessMessage("Nilai deal tersimpan.");
    } catch (error) {
      setDealErrorMessage(
        error instanceof Error
          ? error.message
          : "Nilai deal belum bisa disimpan. Coba lagi.",
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
  const timelinePageSize = 5;
  const timelineTotalPages = lead
    ? Math.max(1, Math.ceil(lead.timeline.length / timelinePageSize))
    : 1;
  const effectiveTimelinePage = Math.min(timelinePage, timelineTotalPages);
  const leadFocus = useMemo(() => {
    if (!lead) {
      return { headline: "", helper: "" };
    }

    if (lead.next_follow_up_at) {
      return {
        headline: `Follow-up berikutnya ${formatDateTime(lead.next_follow_up_at)}`,
        helper: isLeadershipWorkspace
          ? "Cek apakah pemilik dan tahap lead ini sudah sesuai."
          : "Pastikan langkah berikutnya jelas supaya lead ini tidak terlewat.",
      };
    }

    if ((lead.tasks ?? []).some((task) => task.status === "open")) {
      return {
        headline: "Ada tugas terbuka, tapi belum ada jadwal follow-up",
        helper: isLeadershipWorkspace
          ? "Tanyakan ke sales kapan tugas ini akan dikerjakan."
          : "Selesaikan tugasnya atau atur jadwal follow-up berikutnya.",
      };
    }

    return {
      headline: "Belum ada jadwal follow-up",
      helper: isLeadershipWorkspace
        ? "Pastikan ada langkah berikutnya yang terjadwal sebelum lead ini makin tertinggal."
        : "Pilih jadwalnya di bawah ini, misalnya Besok pagi, supaya lead ini muncul di Tindak Lanjut dan tidak terlewat.",
    };
  }, [isLeadershipWorkspace, lead]);
  const visibleTimeline = useMemo(() => {
    if (!lead) {
      return [];
    }

    const startIndex = (effectiveTimelinePage - 1) * timelinePageSize;
    return lead.timeline.slice(startIndex, startIndex + timelinePageSize);
  }, [effectiveTimelinePage, lead]);

  /** Atur jadwal follow-up saja, tanpa menyentuh kolom lead yang lain. Backend ikut membuat tugasnya. */
  async function handleSchedule(date: Date | null) {
    if (!lead) {
      return;
    }

    setIsScheduling(true);
    setScheduleError("");
    setScheduleMessage("");

    try {
      const payload: LeadUpdateRequest = { next_follow_up_at: date ? date.toISOString() : null };
      const updatedLead = await apiFetch<LeadDetail>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: payload,
      });

      setLead(updatedLead);
      setFollowUpInput(toDateTimeLocalValue(updatedLead.next_follow_up_at));
      setCustomScheduleInput("");
      setScheduleMessage(
        updatedLead.next_follow_up_at
          ? `Jadwal tersimpan: ${formatDateTime(updatedLead.next_follow_up_at)}. Lead ini akan muncul di Tindak Lanjut pada hari itu.`
          : "Jadwal follow-up dihapus.",
      );
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Jadwal belum bisa disimpan. Coba lagi.");
    } finally {
      setIsScheduling(false);
    }
  }

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
      setSuccessMessage("Perubahan tersimpan.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Perubahan belum bisa disimpan. Coba lagi.",
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
        error instanceof Error ? error.message : "Tugas belum bisa dibuat. Coba lagi.",
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  useEffect(() => {
    if (disciplineSuccessMessage) {
      // Tombol simpan ada di bawah formulir, jadi pesan suksesnya harus dibawa ke layar.
      disciplineSuccessRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [disciplineSuccessMessage]);

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
      setDisciplineSuccessMessage("Catatan tersimpan.");
      setDisciplineSuggestionHint("");
      rememberFollowUpNotice(
        `Catatan untuk ${refreshedLead.display_name} sudah tersimpan, jadi tugas "Isi catatan" untuknya selesai dan hilang dari daftar.`,
      );
    } catch (error) {
      setDisciplineErrorMessage(
        error instanceof Error
          ? error.message
          : "Catatan belum bisa disimpan. Coba lagi.",
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
        `${plainJargon(suggestion.source_summary)} Cek dulu isinya sebelum menyimpan.`,
      );
    } catch (error) {
      setDisciplineErrorMessage(
        error instanceof Error
          ? error.message
          : "Clara belum bisa mengisi catatan. Isi sendiri atau coba lagi.",
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
    setUpdatingTaskId(taskId);

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
        error instanceof Error ? error.message : "Status tugas belum bisa diubah. Coba lagi.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={lead ? customerLabel(lead.display_name).text : "Detail lead"}
      description={
        isLeadershipWorkspace
          ? "Cek tahap, pemilik, dan jadwal follow-up lead ini, lalu putuskan apakah perlu arahan."
          : "Lihat kondisi lead, atur jadwal follow-up, dan catat hasil menghubungi customer."
      }
      backHref="/crm"
      backLabel="Kembali ke daftar lead"
      actions={
        <>
          {lead?.customer_profile_id ? (
            <Link href={`/customers/${lead.customer_profile_id}`} className="clara-button clara-button-secondary">
              Profil customer
            </Link>
          ) : null}
          {lead?.latest_conversation_id ? (
            <Link
              href={`/sales/conversations/${lead.latest_conversation_id}`}
              className="clara-button clara-button-primary"
            >
              Buka chat
            </Link>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat detail lead..." /> : null}

        {errorMessage && !lead ? (
          <ErrorState message={errorMessage} onRetry={() => void loadLeadDetail()} />
        ) : null}

        {errorMessage && lead ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {lead && !isLoading ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="min-w-0 space-y-5">
              <section
                data-onboarding-id="sales-lead-detail-focus"
                aria-label="Kondisi lead"
                className="clara-card p-5 sm:p-6"
              >
                <h2 className="break-words text-xl font-bold clara-text-primary sm:text-2xl">{leadFocus.headline}</h2>
                <p className="mt-2 text-sm leading-6 clara-text-secondary">{leadFocus.helper}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {lead.current_stage !== "unknown" ? <ValueTag table={STAGE} value={lead.current_stage} /> : null}
                  {lead.lead_temperature !== "unknown" ? (
                    <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
                  ) : null}
                  {lead.account_category !== "unknown" ? (
                    <Tag>{labelOf(ACCOUNT_CATEGORY, lead.account_category)}</Tag>
                  ) : null}
                  {lead.deal?.status ? <ValueTag table={DEAL_STATUS} value={lead.deal.status} /> : null}
                </div>

                <dl
                  data-onboarding-id="sales-lead-detail-snapshot"
                  className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm lg:grid-cols-4"
                >
                  <Fact label="Pemilik" value={lead.assigned_user_name ?? "Belum ada"} />
                  <Fact label="Terakhir dihubungi" value={formatRelativeTime(lead.last_contact_at)} />
                  <Fact label="Follow-up berikutnya" value={formatDateTime(lead.next_follow_up_at)} />
                  <Fact label="Jumlah percakapan" value={String(lead.conversation_count)} />
                </dl>

                {dealMetricsNeedsSync ? (
                  <div className="clara-alert clara-alert-warning mt-4">
                    Tahap lead sudah {labelOf(STAGE, lead.current_stage)}, tapi status deal-nya belum
                    ikut berubah. Buka Nilai deal di sebelah kanan lalu simpan supaya laporan KPI cocok.
                  </div>
                ) : null}

                {isLeadershipWorkspace ? null : (
                  <div className="mt-5 space-y-3 border-t border-clara-line-subtle pt-4" data-onboarding-id="sales-lead-schedule">
                    <h3 className="text-sm font-semibold clara-text-primary">
                      {lead.next_follow_up_at ? "Ubah jadwal follow-up" : "Jadwalkan follow-up"}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_SCHEDULES.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          disabled={isScheduling}
                          onClick={() => void handleSchedule(option.date())}
                          className="clara-button clara-button-secondary"
                        >
                          {option.label}
                        </button>
                      ))}
                      {lead.next_follow_up_at ? (
                        <button
                          type="button"
                          disabled={isScheduling}
                          onClick={() => void handleSchedule(null)}
                          className="clara-button clara-button-ghost"
                        >
                          Hapus jadwal
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="sm:w-64">
                        <label htmlFor="custom-schedule" className="clara-label">
                          Atau pilih tanggal dan jam sendiri
                        </label>
                        <input
                          id="custom-schedule"
                          type="datetime-local"
                          value={customScheduleInput}
                          onChange={(event) => setCustomScheduleInput(event.target.value)}
                          className="clara-input mt-2 w-full"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isScheduling || !customScheduleInput}
                        onClick={() => {
                          const iso = fromDateTimeLocalValue(customScheduleInput);
                          if (iso) {
                            void handleSchedule(new Date(iso));
                          }
                        }}
                        className="clara-button clara-button-primary"
                      >
                        {isScheduling ? "Menyimpan..." : "Simpan jadwal"}
                      </button>
                    </div>
                    {scheduleMessage ? (
                      <p role="status" aria-live="polite" className="clara-alert clara-alert-success">
                        {scheduleMessage}{" "}
                        <Link href="/follow-up" className="font-semibold underline">
                          Lihat di Tindak Lanjut
                        </Link>
                      </p>
                    ) : null}
                    {scheduleError ? (
                      <p role="alert" className="clara-alert clara-alert-danger">
                        {scheduleError}
                      </p>
                    ) : null}
                  </div>
                )}
              </section>

              <details
                open={isLeadershipWorkspace || Boolean(successMessage)}
                data-onboarding-id="sales-lead-detail-context"
                className="clara-card p-5 sm:p-6"
              >
              <summary className="clara-disclosure text-lg font-bold clara-text-primary">
                Ubah tahap, jadwal, dan catatan lead
              </summary>
              <form onSubmit={(event) => void handleSaveLead(event)} className="mt-4 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm clara-text-secondary">
                    Perbarui tahap, suhu, dan jadwal follow-up kalau ada perkembangan.
                  </p>
                  {successMessage ? (
                    <span role="status" aria-live="polite" className="clara-alert clara-alert-success">
                      {successMessage}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Tahap customer">
                    <LabeledSelect
                      value={stageInput}
                      onChange={setStageInput}
                      options={STAGE_OPTIONS}
                      table={STAGE}
                    />
                  </Field>

                  <Field label="Suhu customer">
                    <LabeledSelect
                      value={temperatureInput}
                      onChange={setTemperatureInput}
                      options={TEMPERATURE_OPTIONS}
                      table={TEMPERATURE}
                    />
                  </Field>

                  <Field label="Kategori akun">
                    <LabeledSelect
                      value={accountCategoryInput}
                      onChange={setAccountCategoryInput}
                      options={ACCOUNT_CATEGORY_OPTIONS}
                      table={ACCOUNT_CATEGORY}
                    />
                  </Field>

                  <Field label="Jadwal follow-up berikutnya">
                    <input
                      type="datetime-local"
                      value={followUpInput}
                      onChange={(event) => setFollowUpInput(event.target.value)}
                      className="clara-input w-full"
                    />
                  </Field>

                  {canReassignLead ? (
                    <Field label="Sales yang menangani">
                      <select
                        value={assignedUserInput}
                        onChange={(event) => setAssignedUserInput(event.target.value)}
                        className="clara-select w-full"
                      >
                        <option value="">Belum ada</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({getRoleDisplayLabel(user.role)})
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                </div>

                <Field label="Ringkasan lead">
                  <textarea
                    value={summaryInput}
                    onChange={(event) => setSummaryInput(event.target.value)}
                    rows={3}
                    className="clara-textarea w-full"
                  />
                </Field>

                <Field label="Catatan internal (hanya dilihat tim)">
                  <textarea
                    value={notesInput}
                    onChange={(event) => setNotesInput(event.target.value)}
                    rows={4}
                    placeholder="Tulis kebutuhan customer, hal yang membuatnya ragu, dan rencana follow-up."
                    className="clara-textarea w-full"
                  />
                </Field>

                <div className="flex justify-end">
                  <button type="submit" disabled={isSaving} className="clara-button clara-button-primary">
                    {isSaving ? "Menyimpan..." : "Simpan perubahan"}
                  </button>
                </div>
              </form>
              </details>

              <section
                data-onboarding-id="sales-lead-detail-discipline"
                aria-labelledby="activity-log-title"
                className="clara-card space-y-5 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="activity-log-title" className="text-lg font-bold clara-text-primary">
                      Catat hasil menghubungi customer
                    </h2>
                    <p className="mt-1 text-sm clara-text-secondary">
                      Satu catatan per aktivitas supaya perkembangan lead ini mudah dilacak.
                    </p>
                  </div>
                  <ValueTag table={DISCIPLINE_STATUS} value={lead.discipline_summary.compliance_status} />
                </div>

                <p className="text-sm clara-text-muted">
                  Catatan hari ini: {lead.discipline_summary.logs_today_count} · Total catatan:{" "}
                  {lead.discipline_summary.log_count}
                  {lead.discipline_summary.latest_log_date
                    ? ` · Terakhir ${lead.discipline_summary.latest_log_date}`
                    : ""}
                </p>

                {disciplineSuccessMessage ? (
                  <div
                    ref={disciplineSuccessRef}
                    role="status"
                    aria-live="polite"
                    className="clara-alert clara-alert-success space-y-3"
                  >
                    <p className="font-semibold">{disciplineSuccessMessage}</p>
                    {isLeadershipWorkspace ? null : (
                      <>
                        <p className="text-sm">
                          Tugas &ldquo;Isi catatan&rdquo; untuk customer ini sudah selesai, jadi hilang dari Tindak
                          Lanjut.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link href="/follow-up" className="clara-button clara-button-primary">
                            Kembali ke Tindak Lanjut
                          </Link>
                          <Link href="/sales" className="clara-button clara-button-secondary">
                            Buka Chat Masuk
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {disciplineSuggestionHint ? (
                  <div className="rounded-2xl border border-clara-info-line bg-clara-info-surface p-4 text-sm text-clara-info">
                    {disciplineSuggestionHint}
                  </div>
                ) : null}

                {disciplineErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger">
                    {disciplineErrorMessage}
                  </div>
                ) : null}

                <form
                  onSubmit={(event) => void handleCreateDisciplineLog(event)}
                  className="space-y-4 rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4 sm:p-5"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Tanggal">
                      <input
                        type="date"
                        value={disciplineLogDateInput}
                        onChange={(event) => setDisciplineLogDateInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Apa yang kamu lakukan?">
                      <LabeledSelect
                        value={disciplineActivityTypeInput}
                        onChange={setDisciplineActivityTypeInput}
                        options={DISCIPLINE_ACTIVITY_OPTIONS}
                        table={DISCIPLINE_ACTIVITY}
                      />
                    </Field>

                    <Field label="Hasilnya">
                      <LabeledSelect
                        value={disciplineResultStatusInput}
                        onChange={setDisciplineResultStatusInput}
                        options={DISCIPLINE_RESULT_OPTIONS}
                        table={DISCIPLINE_RESULT}
                      />
                    </Field>

                    <Field label="Suasana hati customer">
                      <LabeledSelect
                        value={disciplineMoodInput}
                        onChange={setDisciplineMoodInput}
                        options={DISCIPLINE_MOOD_OPTIONS}
                        table={DISCIPLINE_MOOD}
                      />
                    </Field>

                    <Field label="Hal yang membuat customer ragu">
                      <input
                        value={disciplineObjectionInput}
                        onChange={(event) => setDisciplineObjectionInput(event.target.value)}
                        placeholder="Contoh: legalitas, harga, kepercayaan"
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Jadwal follow-up berikutnya">
                      <input
                        type="datetime-local"
                        value={disciplineFollowUpInput}
                        onChange={(event) => setDisciplineFollowUpInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>
                  </div>

                  <Field label="Catatan">
                    <textarea
                      value={disciplineNotesInput}
                      onChange={(event) => setDisciplineNotesInput(event.target.value)}
                      rows={3}
                      placeholder="Tulis hasilnya, tanggapan customer, dan langkah berikutnya."
                      className="clara-textarea w-full"
                    />
                  </Field>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void handlePrefillDisciplineLog()}
                      disabled={isPrefillingDisciplineLog}
                      className="clara-button clara-button-secondary"
                    >
                      {isPrefillingDisciplineLog ? "Clara sedang mengisi..." : "Isikan dengan bantuan Clara"}
                    </button>
                    <button type="submit" disabled={isCreatingDisciplineLog} className="clara-button clara-button-primary">
                      {isCreatingDisciplineLog ? "Menyimpan..." : "Simpan catatan"}
                    </button>
                  </div>
                </form>

                {lead.discipline_logs.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-clara-dashed p-4 text-sm clara-text-secondary">
                    Belum ada catatan untuk lead ini. Catatan pertama akan muncul di sini.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lead.discipline_logs.slice(0, 5).map((log) => (
                      <li key={log.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold clara-text-primary">
                              {labelOf(DISCIPLINE_ACTIVITY, log.activity_type)}
                            </h3>
                            <p className="mt-0.5 text-xs clara-text-muted">
                              {log.actor_user_name ?? "Sistem"} · {log.log_date}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <ValueTag table={DISCIPLINE_RESULT} value={log.result_status} />
                            {log.customer_mood ? <ValueTag table={DISCIPLINE_MOOD} value={log.customer_mood} /> : null}
                          </div>
                        </div>
                        {log.main_objection ? (
                          <p className="mt-2 text-sm clara-text-secondary">
                            <span className="font-semibold clara-text-primary">Keberatan: </span>
                            {log.main_objection}
                          </p>
                        ) : null}
                        {log.notes ? <p className="mt-2 text-sm leading-6 clara-text-secondary">{log.notes}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="min-w-0 space-y-5">
              <section
                data-onboarding-id="sales-lead-detail-timeline"
                aria-labelledby="related-customer-title"
                className="clara-card p-5 sm:p-6"
              >
                <h2 id="related-customer-title" className="text-lg font-bold clara-text-primary">
                  Customer ini
                </h2>
                <p className="mt-1 text-sm clara-text-secondary">
                  Kalau customer yang sama pernah muncul di channel lain, semuanya digabung di sini.
                </p>

                {lead.customer_profile ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-semibold clara-text-primary">
                            {lead.customer_profile.display_name}
                          </h3>
                          <p className="mt-0.5 text-xs clara-text-muted">
                            Penanggung jawab: {lead.customer_profile.assigned_user_name ?? "belum ada"}
                          </p>
                        </div>
                        <Link
                          href={`/customers/${lead.customer_profile.id}`}
                          className="clara-button clara-button-ghost"
                        >
                          Lihat profil
                        </Link>
                      </div>

                      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <Fact label="Lead" value={String(lead.customer_profile.lead_count)} />
                        <Fact label="Percakapan" value={String(lead.customer_profile.conversation_count)} />
                        <Fact label="Terakhir dihubungi" value={formatRelativeTime(lead.customer_profile.last_contact_at)} />
                      </dl>

                      {lead.customer_profile.source_labels.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lead.customer_profile.source_labels.map((label) => (
                            <Tag key={label}>{label}</Tag>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {lead.customer_profile.related_leads.length > 1 ? (
                      <ul className="space-y-3">
                        {lead.customer_profile.related_leads
                          .filter((relatedLead) => relatedLead.id !== lead.id)
                          .map((relatedLead) => (
                            <li
                              key={relatedLead.id}
                              className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold clara-text-primary">{customerLabel(relatedLead.display_name).text}</h3>
                                {relatedLead.lead_temperature !== "unknown" ? (
                                  <ValueTag table={TEMPERATURE} value={relatedLead.lead_temperature} />
                                ) : null}
                                <Tag>{relatedLead.source_label}</Tag>
                              </div>
                              <p className="mt-2 text-xs clara-text-muted">
                                Tahap {labelOf(STAGE, relatedLead.current_stage)} · terakhir dihubungi{" "}
                                {formatRelativeTime(relatedLead.last_contact_at)}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link href={`/crm/${relatedLead.id}`} className="clara-button clara-button-secondary">
                                  Buka lead
                                </Link>
                                {relatedLead.latest_conversation_id ? (
                                  <Link
                                    href={`/sales/conversations/${relatedLead.latest_conversation_id}`}
                                    className="clara-button clara-button-ghost"
                                  >
                                    Buka chat
                                  </Link>
                                ) : null}
                              </div>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-clara-dashed p-4 text-sm clara-text-secondary">
                    Lead ini belum punya profil customer. Profilnya dibuat otomatis saat ada chat baru dari customer.
                  </p>
                )}
              </section>

              <details open={dealMetricsNeedsSync} className="clara-card group p-5 sm:p-6">
                <summary className="clara-disclosure text-lg font-bold clara-text-primary">Nilai deal</summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  Isi perkiraan nilai dan status deal supaya laporan KPI akurat.
                </p>

                {dealSuccessMessage ? (
                  <p role="status" aria-live="polite" className="clara-alert clara-alert-success mt-3">
                    {dealSuccessMessage}
                  </p>
                ) : null}
                {dealErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger mt-3">
                    {dealErrorMessage}
                  </div>
                ) : null}

                <form onSubmit={(event) => void handleSaveDeal(event)} className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Status deal">
                      <LabeledSelect
                        value={dealStatusInput}
                        onChange={setDealStatusInput}
                        options={DEAL_STATUS_OPTIONS}
                        table={DEAL_STATUS}
                      />
                    </Field>

                    <Field label="Mata uang">
                      <input
                        value={dealCurrencyInput}
                        onChange={(event) => setDealCurrencyInput(event.target.value.toUpperCase())}
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Perkiraan nilai deal">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={expectedValueInput}
                        onChange={(event) => setExpectedValueInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Setoran awal">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={depositAmountInput}
                        onChange={(event) => setDepositAmountInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Perkiraan tanggal closing">
                      <input
                        type="date"
                        value={expectedCloseDateInput}
                        onChange={(event) => setExpectedCloseDateInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Waktu closing sebenarnya">
                      <input
                        type="datetime-local"
                        value={dealClosedAtInput}
                        onChange={(event) => setDealClosedAtInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>
                  </div>

                  <Field label="Catatan deal">
                    <textarea
                      value={dealNotesInput}
                      onChange={(event) => setDealNotesInput(event.target.value)}
                      rows={3}
                      className="clara-textarea w-full"
                    />
                  </Field>

                  <div className="flex justify-end">
                    <button type="submit" disabled={isSavingDeal} className="clara-button clara-button-primary">
                      {isSavingDeal ? "Menyimpan..." : "Simpan nilai deal"}
                    </button>
                  </div>
                </form>
              </details>

              <section aria-labelledby="tasks-title" className="clara-card p-5 sm:p-6">
                <h2 id="tasks-title" className="text-lg font-bold clara-text-primary">
                  Tugas follow-up
                </h2>
                <p className="mt-1 text-sm clara-text-secondary">
                  Catat hal yang harus dikerjakan supaya tidak hanya mengandalkan ingatan.
                </p>

                {taskErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger mt-3">
                    {taskErrorMessage}
                  </div>
                ) : null}

                {openTasks.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-clara-dashed p-4 text-sm clara-text-secondary">
                    Belum ada tugas yang terbuka untuk lead ini.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {openTasks.map((task) => (
                      <li key={task.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-semibold clara-text-primary">{task.title}</h3>
                            <p className="mt-0.5 text-xs clara-text-muted">Jatuh tempo: {formatDateTime(task.due_at)}</p>
                          </div>
                          <select
                            aria-label={`Status tugas ${task.title}`}
                            value={task.status}
                            disabled={updatingTaskId === task.id}
                            onChange={(event) => void handleTaskStatusChange(task.id, event.target.value)}
                            className="clara-select w-auto"
                          >
                            {Object.keys(TASK_STATUS).map((status) => (
                              <option key={status} value={status}>
                                {labelOf(TASK_STATUS, status)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {task.description ? (
                          <p className="mt-2 text-sm leading-6 clara-text-secondary">{task.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <details className="mt-4 border-t border-clara-line-subtle pt-3">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-clara-gold">
                    Tambah tugas baru
                  </summary>
                  <form onSubmit={(event) => void handleCreateTask(event)} className="mt-3 space-y-4">
                    <Field label="Judul tugas">
                      <input
                        value={taskTitleInput}
                        onChange={(event) => setTaskTitleInput(event.target.value)}
                        placeholder="Contoh: Jelaskan soal legalitas"
                        className="clara-input w-full"
                      />
                    </Field>

                    <Field label="Keterangan (boleh dikosongkan)">
                      <textarea
                        value={taskDescriptionInput}
                        onChange={(event) => setTaskDescriptionInput(event.target.value)}
                        rows={3}
                        className="clara-textarea w-full"
                      />
                    </Field>

                    <Field label="Tenggat">
                      <input
                        type="datetime-local"
                        value={taskDueAtInput}
                        onChange={(event) => setTaskDueAtInput(event.target.value)}
                        className="clara-input w-full"
                      />
                    </Field>

                    <button
                      type="submit"
                      disabled={isCreatingTask || taskTitleInput.trim().length === 0}
                      className="clara-button clara-button-primary"
                    >
                      {isCreatingTask ? "Menyimpan..." : "Tambah tugas"}
                    </button>
                  </form>
                </details>
              </section>

              <details open={isLeadershipWorkspace} aria-labelledby="history-title" className="clara-card-outline p-5 sm:p-6">
                <summary id="history-title" className="clara-disclosure text-lg font-bold clara-text-primary">
                  Riwayat lead ({lead.timeline.length})
                </summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  Semua perubahan penting pada lead ini, dari yang terbaru.
                </p>

                {lead.timeline.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-clara-dashed p-4 text-sm clara-text-secondary">
                    Belum ada riwayat untuk lead ini.
                  </p>
                ) : (
                  <>
                    <ul className="mt-4 space-y-3">
                      {visibleTimeline.map((event) => {
                        const description = event.description ? humanizeActivityDescription(event.description) : "";

                        return (
                          <li key={event.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="break-words text-sm font-semibold clara-text-primary">
                                  {humanizeActivityTitle(event.title)}
                                </h3>
                                <p className="mt-0.5 text-xs clara-text-muted">
                                  {event.actor_user_name ?? "Sistem"} · {formatRelativeTime(event.created_at)}
                                </p>
                              </div>
                              <ValueTag table={ACTIVITY_EVENT} value={event.event_type} />
                            </div>

                            {description ? (
                              <p className="mt-2 break-words text-sm leading-6 clara-text-secondary">{description}</p>
                            ) : null}

                            {event.from_value || event.to_value ? (
                              <p className="mt-2 text-sm clara-text-secondary">
                                {humanizeActivityValue(event.event_type, event.from_value)}
                                <span aria-hidden="true"> → </span>
                                <span className="sr-only"> menjadi </span>
                                <span className="font-semibold clara-text-primary">
                                  {humanizeActivityValue(event.event_type, event.to_value)}
                                </span>
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>

                    {lead.timeline.length > timelinePageSize ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm clara-text-secondary">
                          Menampilkan {visibleTimeline.length} dari {lead.timeline.length}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setTimelinePage((current) => Math.max(1, current - 1))}
                            disabled={effectiveTimelinePage === 1}
                            className="clara-button clara-button-ghost"
                          >
                            Sebelumnya
                          </button>
                          <button
                            type="button"
                            onClick={() => setTimelinePage((current) => Math.min(timelineTotalPages, current + 1))}
                            disabled={effectiveTimelinePage === timelineTotalPages}
                            className="clara-button clara-button-ghost"
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </details>
            </aside>
          </div>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="clara-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

/** Pilihan dengan label Indonesia dari kamus; nilai yang dikirim ke backend tetap kode aslinya. */
function LabeledSelect({
  value,
  onChange,
  options,
  table,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  table: VocabTable;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="clara-select w-full">
      {options.map((option) => (
        <option key={option} value={option}>
          {labelOf(table, option)}
        </option>
      ))}
    </select>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}
