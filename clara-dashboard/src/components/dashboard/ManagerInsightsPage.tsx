"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessManagerInsights, isHeadRole } from "@/lib/roles";
import type {
  CurrentUser,
  HistoricalPerformanceSummary,
  ManagerInsightsResponse,
  PerformanceActionCreateRequest,
  PerformanceActionItem,
  PerformanceActionListResponse,
  PerformanceActionUpdateRequest,
  SalesPerformanceDetailResponse,
  WeeklyReviewAlertItem,
  WeeklyReviewEntityItem,
  WeeklyPerformanceSnapshotItem,
} from "@/types/dashboard";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatWeekLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

type ActionDraft = {
  contextKey: string;
  sourceType: string;
  sourceReferenceId: string | null;
  teamId: string | null;
  salesUserId: string | null;
  actionType: string;
  title: string;
  description: string;
  assignedToUserId: string;
  priorityLabel: string;
  dueAt: string;
};

function resolveDefaultActionType(focusArea: string): string {
  if (focusArea === "reply_backlog") {
    return "reply_backlog_review";
  }
  if (focusArea === "follow_up") {
    return "follow_up_recovery";
  }
  if (focusArea === "discipline") {
    return "crm_cleanup";
  }
  return "coaching";
}

function resolveActionPriority(priorityLabel: string): string {
  if (priorityLabel === "stable") {
    return "low";
  }
  return priorityLabel;
}

function getCoachingPriorityAction(item: {
  review_status: string;
  risk_level: string | null;
  review_label: string;
}, isHeadView: boolean) {
  if (item.review_status === "in_review") {
    return {
      title: isHeadView
        ? "Kasus ini perlu perhatian Head sekarang"
        : "Manager perlu review kasus ini sekarang",
      description:
        isHeadView
          ? "Baca conversation, lihat hambatan utamanya, lalu beri arahan yang tegas ke sales agar next action tidak menggantung."
          : "Baca conversation, pastikan masalah utamanya jelas, lalu isi coaching note atau putuskan apakah case ini perlu `needs_rework`, `coaching_done`, atau `escalated`.",
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "needs_rework") {
    return {
      title: isHeadView
        ? "Kasus ini perlu arahan revisi dari Head"
        : "Manager perlu beri arahan revisi yang tegas",
      description:
        isHeadView
          ? "Kasus ini belum selesai. Buka Arahan Tim, tulis revisi yang tegas ke sales, lalu pastikan owner berikutnya jelas."
          : "Kasus ini belum selesai. Buka review center, tulis revisi yang harus dilakukan sales, dan pastikan next action tidak ambigu.",
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Lanjutkan Review",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "escalated") {
    return {
      title: isHeadView
        ? "Kasus ini perlu keputusan Head"
        : "Kasus ini perlu keputusan level lebih tinggi",
      description:
        isHeadView
          ? "Cek alasan eskalasinya, validasi risiko atau klaim sensitifnya, lalu putuskan arahan yang harus dibawa sales."
          : "Cek alasan eskalasinya, validasi risiko atau klaim sensitifnya, lalu tentukan apakah perlu dinaikkan lagi atau dikembalikan dengan arahan yang jelas.",
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.risk_level === "high") {
    return {
      title: isHeadView
        ? "Lead ini berisiko tinggi"
        : "Kasus ini berisiko tinggi",
      description:
        isHeadView
          ? "Jangan cukup baca summary. Head perlu buka conversation dan memastikan sales tidak jalan tanpa arahan di lead sensitif ini."
          : "Jangan cukup baca summary. Manager perlu buka conversation dan pastikan tidak ada jawaban yang berpotensi mis-selling atau klaim sensitif.",
      primaryLabel: "Buka Conversation",
      primaryHref: null,
    };
  }

  return {
      title: isHeadView
        ? "Head perlu memastikan arah follow-up-nya jelas"
        : "Manager perlu pastikan arah coaching-nya jelas",
    description:
      item.review_label === "unik"
        ? isHeadView
          ? "Kasus ini unik, jadi Head perlu memastikan arahan utamanya terdokumentasi dan tidak hilang setelah dibaca."
          : "Kasus ini unik, jadi manager perlu memastikan insight utamanya terdokumentasi dan tidak hilang setelah dibaca."
        : isHeadView
          ? "Buka case ini dan pastikan sales mendapat arahan yang jelas, bukan cuma dibaca lalu dibiarkan."
          : "Buka case ini dan pastikan keputusan review-nya jelas, bukan cuma dibaca lalu ditinggalkan.",
    primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
    primaryHref: "/dashboard/approvals",
  };
}

export function ManagerInsightsPage() {
  const salesPageSize = 4;
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [insights, setInsights] = useState<ManagerInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
  const [performanceRange, setPerformanceRange] = useState("7d");
  const [salesSlaFilter, setSalesSlaFilter] = useState("all");
  const [salesDisciplineFilter, setSalesDisciplineFilter] = useState("all");
  const [salesSortBy, setSalesSortBy] = useState("overdue");
  const [salesPage, setSalesPage] = useState(1);
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string | null>(null);
  const [salesDetail, setSalesDetail] = useState<SalesPerformanceDetailResponse | null>(null);
  const [salesDetailLoadingId, setSalesDetailLoadingId] = useState<string | null>(null);
  const [salesDetailError, setSalesDetailError] = useState("");
  const [actionList, setActionList] = useState<PerformanceActionListResponse | null>(null);
  const [actionListError, setActionListError] = useState("");
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [actionSubmitKey, setActionSubmitKey] = useState<string | null>(null);
  const [actionStatusLoadingId, setActionStatusLoadingId] = useState<string | null>(null);
  const isHeadView = isHeadRole(currentUser?.role);
  const weeklyReview = insights?.weekly_review ?? null;
  const teamRows = insights?.team_discipline ?? [];
  const reviewCases = insights?.coaching_priority ?? [];
  const boundaryAlerts = insights?.boundary_alerts ?? [];
  const objectionTrends = insights?.objection_trends ?? [];
  const topBoundaryAlert = boundaryAlerts[0] ?? null;
  const topReviewCase = reviewCases[0] ?? null;
  const priorityTeamRows = [...teamRows].sort((left, right) => {
    const leftScore =
      left.overdue_follow_ups * 4 +
      left.missing_or_stale_logs * 3 +
      left.open_coaching_cases * 2 +
      left.pending_knowledge_proposals;
    const rightScore =
      right.overdue_follow_ups * 4 +
      right.missing_or_stale_logs * 3 +
      right.open_coaching_cases * 2 +
      right.pending_knowledge_proposals;

    return rightScore - leftScore;
  });
  const topTeamRows = priorityTeamRows.slice(0, 4);
  const monitorUrgencyCount =
    (insights?.overdue_follow_up_count ?? 0) +
    (insights?.open_coaching_case_count ?? 0) +
    boundaryAlerts.length;
  const teamHealthTone =
    (insights?.follow_up_compliance_rate ?? 0) >= 0.8
      ? "Ritme tim masih sehat"
      : (insights?.follow_up_compliance_rate ?? 0) >= 0.6
        ? "Ritme tim mulai longgar"
        : "Ritme tim butuh intervensi cepat";
  const monitorSummary = isHeadView
    ? `Mulai dari ${boundaryAlerts.length} area risiko utama, lalu turun hanya ke ${reviewCases.length} case yang benar-benar butuh keputusan Head.`
    : `Manager cukup mulai dari ${monitorUrgencyCount} item penting: overdue, coaching case aktif, dan boundary alert yang bikin ritme tim melambat.`;
  const monitorNextAction = topBoundaryAlert
    ? `Prioritas pertama: cek ${topBoundaryAlert.team_name} karena "${topBoundaryAlert.title}" sudah muncul sebagai sinyal utama.`
    : topReviewCase
      ? isHeadView
        ? `Prioritas pertama: buka case ${topReviewCase.lead_name} lalu pastikan arahan akhirnya jelas dan tidak berhenti di level manager saja.`
        : `Prioritas pertama: buka case ${topReviewCase.lead_name} lalu putuskan arahan yang paling jelas untuk sales.`
      : isHeadView
        ? "Belum ada alert besar. Pakai halaman ini untuk membaca pola hambatan antar tim dan mendeteksi area yang mulai longgar sebelum membesar."
        : "Belum ada alert besar. Pakai halaman ini untuk cek tim dengan overdue tertinggi dan menjaga ritme follow-up tetap rapi.";
  const filteredSalesPerformance = useMemo(() => {
    const items = insights?.sales_performance ?? [];
    const nextItems = items.filter((item) => {
      if (salesSlaFilter !== "all" && item.avg_response_sla_status !== salesSlaFilter) {
        return false;
      }
      if (
        salesDisciplineFilter !== "all"
        && item.crm_discipline_status !== salesDisciplineFilter
      ) {
        return false;
      }
      return true;
    });

    return [...nextItems].sort((left, right) => {
      if (salesSortBy === "priority") {
        return right.coaching_signal.priority_score - left.coaching_signal.priority_score;
      }
      if (salesSortBy === "hot") {
        return right.hot_leads_count - left.hot_leads_count;
      }
      if (salesSortBy === "latest_activity") {
        return (right.latest_activity_at ?? "").localeCompare(left.latest_activity_at ?? "");
      }
      if (salesSortBy === "needs_reply") {
        return right.needs_reply_count - left.needs_reply_count;
      }
      return right.overdue_follow_up_count - left.overdue_follow_up_count;
    });
  }, [insights?.sales_performance, salesDisciplineFilter, salesSlaFilter, salesSortBy]);
  const openActionItems = useMemo(
    () =>
      (actionList?.items ?? []).filter(
        (item) => item.status === "open" || item.status === "in_progress",
      ),
    [actionList?.items],
  );
  const salesPageCount = Math.max(
    1,
    Math.ceil(filteredSalesPerformance.length / salesPageSize),
  );
  const paginatedSalesPerformance = useMemo(() => {
    const startIndex = (salesPage - 1) * salesPageSize;
    return filteredSalesPerformance.slice(startIndex, startIndex + salesPageSize);
  }, [filteredSalesPerformance, salesPage, salesPageSize]);
  const actionAssigneeOptions = insights?.sales_performance ?? [];

  useEffect(() => {
    setSalesPage(1);
  }, [salesSlaFilter, salesDisciplineFilter, salesSortBy, performanceRange]);

  useEffect(() => {
    if (salesPage > salesPageCount) {
      setSalesPage(salesPageCount);
    }
  }, [salesPage, salesPageCount]);

  async function loadPerformanceActions() {
    try {
      const response = await apiFetch<PerformanceActionListResponse>(
        "/dashboard/performance-actions",
      );
      setActionList(response);
      setActionListError("");
    } catch (error) {
      setActionListError(
        error instanceof Error
          ? error.message
          : "Gagal memuat action operasional.",
      );
    }
  }

  async function fetchSalesDetail(salesUserId: string, rangeLabel: string) {
    setSelectedSalesUserId(salesUserId);
    setSalesDetail(null);
    setSalesDetailError("");
    setSalesDetailLoadingId(salesUserId);

    try {
      const response = await apiFetch<SalesPerformanceDetailResponse>(
        `/dashboard/manager-insights/sales/${salesUserId}?range=${rangeLabel}`,
      );
      setSalesDetail(response);
    } catch (error) {
      setSalesDetailError(
        error instanceof Error
          ? error.message
          : "Gagal memuat detail performa sales.",
      );
    } finally {
      setSalesDetailLoadingId(null);
    }
  }

  useEffect(() => {
    async function loadPage() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!canAccessManagerInsights(me.role)) {
          router.replace("/dashboard");
          return;
        }

        const response = await apiFetch<ManagerInsightsResponse>(
          `/dashboard/manager-insights?range=${performanceRange}`,
        );
        setInsights(response);
        await loadPerformanceActions();

        if (selectedSalesUserId) {
          await fetchSalesDetail(selectedSalesUserId, performanceRange);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat manager insights.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPage();
  }, [performanceRange, router]);

  function toggleTeamMembers(teamId: string | null) {
    if (!teamId) {
      return;
    }

    setExpandedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  }

  async function handleOpenSalesDetail(salesUserId: string) {
    if (
      selectedSalesUserId === salesUserId
      && salesDetail
      && salesDetail.sales_user.id === salesUserId
    ) {
      setSelectedSalesUserId(null);
      setSalesDetail(null);
      setSalesDetailError("");
      setSalesDetailLoadingId(null);
      return;
    }
    await fetchSalesDetail(salesUserId, performanceRange);
  }

  function handleWeeklyReviewEntityOpen(item: WeeklyReviewEntityItem) {
    if (item.scope_type === "sales" && item.sales_user_id) {
      void handleOpenSalesDetail(item.sales_user_id);
      return;
    }
    router.push(item.target_href ?? "/dashboard/manager-insights");
  }

  function handleWeeklyReviewTeamAction(item: WeeklyReviewEntityItem) {
    const matchedTeam = insights?.team_performance.find(
      (team) => team.team_id === item.team_id,
    );
    if (matchedTeam) {
      openTeamActionDraft(matchedTeam);
      return;
    }
    router.push("/dashboard/notifications");
  }

  function openSalesActionDraft(item: ManagerInsightsResponse["sales_performance"][number]) {
    setActionDraft({
      contextKey: `sales:${item.sales_user_id}`,
      sourceType: "sales_performance",
      sourceReferenceId: item.sales_user_id,
      teamId: null,
      salesUserId: item.sales_user_id,
      actionType: resolveDefaultActionType(item.coaching_signal.focus_area),
      title: `Tindak lanjuti ${item.sales_name}`,
      description: item.coaching_signal.recommended_action,
      assignedToUserId: item.sales_user_id,
      priorityLabel: resolveActionPriority(item.coaching_signal.priority_label),
      dueAt: "",
    });
  }

  function openTeamActionDraft(item: ManagerInsightsResponse["team_performance"][number]) {
    const defaultAssigneeId =
      item.top_sales_contributors[0]?.sales_user_id ?? actionAssigneeOptions[0]?.sales_user_id ?? "";

    setActionDraft({
      contextKey: `team:${item.team_id ?? item.team_name}`,
      sourceType: "team_performance",
      sourceReferenceId: item.team_id,
      teamId: item.team_id,
      salesUserId: defaultAssigneeId || null,
      actionType: resolveDefaultActionType(item.coaching_signal.focus_area),
      title: `Intervensi ${item.team_name}`,
      description: item.coaching_signal.recommended_action,
      assignedToUserId: defaultAssigneeId,
      priorityLabel: resolveActionPriority(item.coaching_signal.priority_label),
      dueAt: "",
    });
  }

  async function handleSubmitActionDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionDraft) {
      return;
    }

    setActionSubmitKey(actionDraft.contextKey);
    setErrorMessage("");

    try {
      const payload: PerformanceActionCreateRequest = {
        assigned_to_user_id: actionDraft.assignedToUserId,
        team_id: actionDraft.teamId,
        sales_user_id: actionDraft.salesUserId,
        source_type: actionDraft.sourceType,
        source_reference_id: actionDraft.sourceReferenceId,
        title: actionDraft.title,
        description: actionDraft.description,
        action_type: actionDraft.actionType,
        priority_label: actionDraft.priorityLabel,
        due_at: actionDraft.dueAt ? new Date(actionDraft.dueAt).toISOString() : null,
      };
      await apiFetch<PerformanceActionItem>("/dashboard/performance-actions", {
        method: "POST",
        body: payload,
      });
      setActionDraft(null);
      await loadPerformanceActions();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal membuat action operasional.",
      );
    } finally {
      setActionSubmitKey(null);
    }
  }

  async function handleActionStatusUpdate(
    actionId: string,
    nextStatus: "in_progress" | "done" | "skipped",
  ) {
    setActionStatusLoadingId(actionId);
    setActionListError("");

    try {
      let resolutionNote: string | null = null;
      if (nextStatus === "skipped" && typeof window !== "undefined") {
        resolutionNote = window.prompt("Alasan lewati action ini:", "")?.trim() ?? "";
        if (!resolutionNote) {
          setActionStatusLoadingId(null);
          return;
        }
      }

      const payload: PerformanceActionUpdateRequest = {
        status: nextStatus,
        resolution_note: resolutionNote,
      };
      await apiFetch<PerformanceActionItem>(`/dashboard/performance-actions/${actionId}`, {
        method: "PATCH",
        body: payload,
      });
      await loadPerformanceActions();
    } catch (error) {
      setActionListError(
        error instanceof Error
          ? error.message
          : "Gagal mengubah status action.",
      );
    } finally {
      setActionStatusLoadingId(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={isHeadView ? "Ringkasan Head" : "Manager monitoring"}
      title={isHeadView ? "Head Insight" : "Monitor Tim"}
      description={
        isHeadView
          ? "Halaman ini dipakai Head untuk membaca ritme lintas tim, melihat area berisiko, lalu memutuskan intervensi tanpa tenggelam di detail operasional."
          : "Halaman ini dipakai manager untuk melihat progres tim, hambatan follow-up, case yang perlu direview, dan area yang butuh arahan lebih dulu."
      }
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {insights ? (
            <div className="rounded-full border border-[#f0cb73]/18 bg-[#1d150d] px-4 py-2.5 text-sm text-[#d6bb84]">
              Data: {formatDateTime(insights.generated_at)}
            </div>
          ) : null}
          <Link
            href={isHeadView ? "/dashboard/notifications" : "/dashboard/approvals"}
            className="clara-button clara-button-primary"
          >
            {isHeadView ? "Buka Alert Tim" : "Buka Review Sales"}
          </Link>
          <Link
            href="/api/dashboard/manager-insights/weekly-review?format=csv"
            className="clara-button clara-button-ghost"
            target="_blank"
          >
            Export Weekly CSV
          </Link>
          {isHeadView ? (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Buka Arahan Tim
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            {isHeadView ? "Loading head insight..." : "Loading monitor tim..."}
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {insights && !isLoading && !errorMessage ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_320px]">
              <section
                data-onboarding-id="manager-insights-hero"
                className="clara-card rounded-[32px] p-6"
              >
                <div className="max-w-4xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                    {isHeadView ? "Head insight" : "Prioritas monitor"}
                  </p>
                  <h2 className="mt-3 text-[clamp(2rem,3vw,2.6rem)] font-semibold leading-tight text-[#fff4d6]">
                    {isHeadView
                      ? "Lihat area tim yang mulai longgar, lalu putuskan intervensi Head"
                      : "Lihat tim yang mulai macet dulu, baru turun ke case review"}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-[#d6bb84]">
                    {monitorSummary}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                        Scope aktif
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[#fff0c9]">
                        {isHeadView ? "Cakupan pantau Head" : insights.scope_label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                        {insights.scope_team_count} tim • {insights.scope_member_count} member yang sedang masuk area pantau.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                        Ringkasan cepat
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[#fff0c9]">
                        {isHeadView
                          ? boundaryAlerts.length > 0
                            ? "Ada area yang perlu keputusan Head"
                            : teamHealthTone
                          : teamHealthTone}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                        {monitorNextAction}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                      Aksi cepat
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                      {isHeadView
                        ? "Setelah baca halaman ini, biasanya Head lanjut ke Alert Tim atau Arahan Tim untuk menurunkan keputusan yang lebih tegas."
                        : "Buka area kerja yang paling sering dipakai manager setelah membaca monitor tim."}
                    </p>
                    <Link
                      href={isHeadView ? "/dashboard/notifications" : "/dashboard/approvals"}
                      className="clara-button clara-button-primary mt-4 w-full justify-center px-5 py-3"
                    >
                      {isHeadView ? "Buka Alert Tim" : "Buka Review Sales"}
                    </Link>
                    <Link
                      href={isHeadView ? "/dashboard/approvals" : "/dashboard/sales"}
                      className="clara-button clara-button-ghost mt-3 w-full justify-center px-5 py-3"
                    >
                      {isHeadView ? "Buka Arahan Tim" : "Lihat Queue Sales"}
                    </Link>
                  </div>
                </div>
              </section>

              <section
                data-onboarding-id="manager-insights-steps"
                className="clara-card rounded-[32px] p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                  Urutan baca cepat
                </p>
                <div className="mt-5 space-y-4">
                  <ManagerStepItem
                    step="01"
                    title={isHeadView ? "Lihat area risiko paling menonjol" : "Cek tim paling bermasalah"}
                    description={
                      isHeadView
                        ? "Mulai dari boundary alert, overdue tertinggi, dan gap follow-up yang paling terasa."
                        : "Mulai dari overdue, stale log, dan boundary alert yang paling tinggi dulu."
                    }
                  />
                  <ManagerStepItem
                    step="02"
                    title={isHeadView ? "Turun ke case yang butuh keputusan" : "Turun ke case coaching"}
                    description={
                      isHeadView
                        ? "Setelah tahu area timnya, buka hanya case yang memang perlu penegasan arah atau keputusan level Head."
                        : "Setelah tahu timnya, baru buka case review yang memang butuh keputusan."
                    }
                  />
                  <ManagerStepItem
                    step="03"
                    title={isHeadView ? "Baca pola hambatan yang berulang" : "Lihat pola hambatan tim"}
                    description={
                      isHeadView
                        ? "Pakai objection trend untuk melihat masalah yang layak dijadikan arahan umum lintas tim."
                        : "Pakai objection trend untuk lihat masalah yang berulang dan layak dijadikan arahan tim."
                    }
                  />
                </div>
              </section>
            </section>

            <section
              data-onboarding-id="manager-insights-metrics"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <MetricCard
                label={isHeadView ? "Perlu Keputusan" : "Item Mendesak"}
                value={String(monitorUrgencyCount)}
                hint={
                  isHeadView
                    ? "Gabungan boundary alert, overdue, dan case yang perlu dibaca Head."
                    : "Gabungan overdue, coaching aktif, dan boundary alert yang perlu ditangani manager."
                }
              />
              <MetricCard
                label="Follow-up Overdue"
                value={String(insights.overdue_follow_up_count)}
                hint={
                  isHeadView
                    ? "Semakin tinggi, semakin banyak lead tim yang perlu perhatian lintas sales."
                    : "Jumlah lead yang ritme follow-up-nya sudah lewat dari jalur aman."
                }
              />
              <MetricCard
                label="Kepatuhan Follow-up"
                value={formatPercent(insights.follow_up_compliance_rate)}
                hint={
                  isHeadView
                    ? "Menunjukkan seberapa rapi ritme follow-up seluruh tim yang dipantau Head."
                    : "Angka global untuk baca apakah ritme tim masih sehat atau mulai longgar."
                }
              />
              <MetricCard
                label={isHeadView ? "Case Arahan" : "Case Coaching"}
                value={String(insights.open_coaching_case_count)}
                hint={
                  isHeadView
                    ? "Case yang perlu dibaca head sebelum memberi arahan lintas tim."
                    : "Case review aktif yang masih perlu keputusan atau arahan manager."
                }
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div>
                <Panel
                title={isHeadView ? "Area Risiko yang Perlu Dibaca Dulu" : "Alert yang Perlu Dicek Dulu"}
                description={
                  isHeadView
                    ? "Ini daftar area yang sebaiknya dibaca Head dulu sebelum turun ke lead atau case tertentu."
                    : "Mulai dari daftar ini dulu supaya manager tidak tenggelam di semua data tim sekaligus."
                }
              >
                <div className="space-y-3">
                  {boundaryAlerts.length === 0 ? (
                    <EmptyText text="Belum ada alert boundary yang cukup kuat." />
                  ) : (
                    boundaryAlerts.slice(0, 4).map((alert, index) => (
                      <article
                        key={`${alert.team_name}-${index}`}
                        data-onboarding-id={
                          index === 0 ? "manager-insights-alerts" : undefined
                        }
                        className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                            {alert.team_name}
                          </span>
                          {alert.unit_name ? (
                            <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                              {alert.unit_name}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              alert.severity === "high"
                                ? "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                : "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-[#fff0c9]">
                          {alert.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                          {alert.description}
                        </p>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="mt-4 inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                          >
                            Buka area terkait
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
                </Panel>
              </div>

              <div>
                <Panel
                title={isHeadView ? "Case yang Butuh Keputusan Head" : "Case Review yang Harus Dibaca"}
                description={
                  isHeadView
                    ? "Setelah baca alert di kiri, lanjutkan hanya ke case yang memang perlu keputusan atau validasi Head."
                    : "Case ini yang paling cepat memberi dampak kalau manager ambil keputusan sekarang."
                }
              >
                <div className="space-y-3">
                  {reviewCases.length === 0 ? (
                    <EmptyText text="Belum ada coaching case aktif di scope ini." />
                  ) : (
                    reviewCases.slice(0, 3).map((item, index) => (
                      <CoachingPriorityCard
                        key={item.review_case_id}
                        item={item}
                        isHeadView={isHeadView}
                        onboardingTargetId={
                          index === 0 ? "manager-insights-cases" : undefined
                        }
                      />
                    ))
                  )}
                </div>
                </Panel>
              </div>
            </section>

            <section>
              <Panel
                title={isHeadView ? "Action Operasional Terbuka" : "Action Tim yang Sedang Jalan"}
                description={
                  isHeadView
                    ? "Head cukup cek action yang masih terbuka untuk melihat apakah arahan yang sudah dibuat benar-benar bergerak."
                    : "Bagian ini menjaga insight tidak berhenti di layar. Lihat action yang masih open, sedang dikerjakan, atau perlu ditutup."
                }
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard
                    label="Open"
                    value={String(actionList?.open_count ?? 0)}
                    hint="Action yang belum mulai dikerjakan."
                  />
                  <MetricCard
                    label="In Progress"
                    value={String(actionList?.in_progress_count ?? 0)}
                    hint="Action yang sedang dijalankan tim."
                  />
                  <MetricCard
                    label="Done"
                    value={String(actionList?.done_count ?? 0)}
                    hint="Action yang sudah ditutup selesai."
                  />
                  <MetricCard
                    label="Skipped"
                    value={String(actionList?.skipped_count ?? 0)}
                    hint="Action yang ditutup tanpa dikerjakan."
                  />
                </div>

                {actionListError ? (
                  <div className="mt-4 clara-alert clara-alert-danger">{actionListError}</div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {openActionItems.length === 0 ? (
                    <EmptyText text="Belum ada action terbuka. Buat action langsung dari kartu sales atau team di bawah." />
                  ) : (
                    openActionItems.slice(0, 8).map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[#fff0c9]">{item.title}</p>
                              <span className={getCoachingPriorityClass(item.priority_label)}>
                                {formatStatusLabel(item.priority_label)}
                              </span>
                              <span className={getSalesPerformanceDisciplineClass(item.status)}>
                                {formatStatusLabel(item.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#d6bb84]">{item.description}</p>
                            <p className="mt-2 text-xs text-[#b89a62]">
                              Assignee: {item.assigned_to_user_name ?? "-"} • Source: {formatStatusLabel(item.source_type)} • Due: {formatDateTime(item.due_at)}
                            </p>
                            <p className="mt-1 text-xs text-[#b89a62]">
                              Creator: {item.created_by_user_name ?? "-"} • Target: {item.sales_name ?? item.team_name ?? "-"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.status === "open" ? (
                              <button
                                type="button"
                                onClick={() => void handleActionStatusUpdate(item.id, "in_progress")}
                                className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-xs font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                              >
                                {actionStatusLoadingId === item.id ? "Memproses..." : "Mulai"}
                              </button>
                            ) : null}
                            {item.status !== "done" ? (
                              <button
                                type="button"
                                onClick={() => void handleActionStatusUpdate(item.id, "done")}
                                className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3 py-2 text-xs font-semibold text-[#140f08] hover:brightness-105"
                              >
                                {actionStatusLoadingId === item.id ? "Memproses..." : "Selesai"}
                              </button>
                            ) : null}
                            {item.status !== "done" && item.status !== "skipped" ? (
                              <button
                                type="button"
                                onClick={() => void handleActionStatusUpdate(item.id, "skipped")}
                                className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-xs font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                              >
                                {actionStatusLoadingId === item.id ? "Memproses..." : "Lewati"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </Panel>
            </section>

            {insights.historical_summary ? (
              <section>
                <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                    Ringkasan historis mingguan
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={getMomentumClass(insights.historical_summary.trend_label)}>
                      {formatStatusLabel(insights.historical_summary.trend_label)}
                    </span>
                    <TrendDeltaChip
                      label="Backlog"
                      value={insights.historical_summary.delta_total_needs_reply}
                      inverse
                    />
                    <TrendDeltaChip
                      label="Overdue"
                      value={insights.historical_summary.delta_total_overdue_follow_up}
                      inverse
                    />
                  </div>
                  <p className="mt-3 text-sm text-[#d6bb84]">
                    Dibanding snapshot minggu sebelumnya
                    {insights.historical_summary.latest_snapshot_date
                      ? ` (${formatWeekLabel(insights.historical_summary.latest_snapshot_date)})`
                      : ""}
                    . Kalau backlog dan overdue turun, berarti ritme tim mulai membaik.
                  </p>
                </div>
              </section>
            ) : null}

            {weeklyReview ? (
              <section>
                <Panel
                  title={isHeadView ? "Weekly Review Head" : "Weekly Review Manager"}
                  description={
                    isHeadView
                      ? "Ringkas dulu siapa yang naik, siapa yang turun, tim mana yang perlu disentuh, action apa yang masih terbuka, dan alert kritikal apa yang belum selesai."
                      : "Pakai blok ini untuk review mingguan cepat tanpa bongkar semua kartu performa satu per satu."
                  }
                >
                  <div className="mb-4 rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 text-sm text-[#d6bb84]">
                    Periode review:{" "}
                    <span className="font-semibold text-[#fff0c9]">
                      {formatWeekLabel(weeklyReview.review_start)} - {formatWeekLabel(weeklyReview.review_end)}
                    </span>
                    {" "}• Scope:{" "}
                    <span className="font-semibold text-[#fff0c9]">{weeklyReview.scope_label}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Tim Sehat"
                      value={String(weeklyReview.healthy_team_count)}
                      hint="Jumlah tim yang ritmenya masih relatif aman minggu ini."
                    />
                    <MetricCard
                      label="Perlu Perhatian"
                      value={String(weeklyReview.teams_needing_attention_count)}
                      hint="Tim yang backlog, overdue, atau disiplin CRM-nya mulai bocor."
                    />
                    <MetricCard
                      label="Action Terbuka"
                      value={String(weeklyReview.unresolved_action_count)}
                      hint="Action open dan in progress yang belum selesai."
                    />
                    <MetricCard
                      label="Critical Alert"
                      value={String(weeklyReview.critical_alert_open_count)}
                      hint="Alert kritikal yang masih aktif atau baru di-acknowledge."
                    />
                  </div>

                  <div className="mt-5 grid gap-6 xl:grid-cols-3">
                    <WeeklyReviewEntitySection
                      title="Top Improvers"
                      description="Naik paling jelas dibanding snapshot minggu sebelumnya."
                      items={weeklyReview.top_improvers}
                      emptyText="Belum ada improver yang cukup menonjol minggu ini."
                      actionLabel="Buka detail"
                      onAction={handleWeeklyReviewEntityOpen}
                    />
                    <WeeklyReviewEntitySection
                      title="Biggest Risks"
                      description="Yang paling terasa melambat atau mulai bocor."
                      items={weeklyReview.biggest_risks}
                      emptyText="Belum ada risiko besar yang menonjol minggu ini."
                      actionLabel="Buka detail"
                      onAction={handleWeeklyReviewEntityOpen}
                    />
                    <WeeklyReviewEntitySection
                      title="Teams Needing Intervention"
                      description="Tim yang paling layak disentuh dulu minggu ini."
                      items={weeklyReview.teams_needing_intervention}
                      emptyText="Belum ada tim yang butuh intervensi tambahan."
                      actionLabel="Buat action"
                      onAction={handleWeeklyReviewTeamAction}
                    />
                  </div>

                  <div className="mt-5 grid gap-6 xl:grid-cols-2">
                    <section id="open-actions" className="space-y-3">
                      <h3 className="text-base font-semibold text-[#fff0c9]">Unresolved Actions</h3>
                      <p className="text-sm text-[#d6bb84]">
                        Action terbuka yang masih harus ditutup supaya review mingguan tidak berhenti di insight.
                      </p>
                      {weeklyReview.unresolved_actions.length === 0 ? (
                        <EmptyText text="Belum ada unresolved action di scope review ini." />
                      ) : (
                        weeklyReview.unresolved_actions.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[#fff0c9]">{item.title}</p>
                              <span className={getCoachingPriorityClass(item.priority_label)}>
                                {formatStatusLabel(item.priority_label)}
                              </span>
                              <span className={getSalesPerformanceDisciplineClass(item.status)}>
                                {formatStatusLabel(item.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#d6bb84]">{item.description}</p>
                            <p className="mt-2 text-xs text-[#b89a62]">
                              Target: {item.sales_name ?? item.team_name ?? "-"} • Due: {formatDateTime(item.due_at)}
                            </p>
                          </article>
                        ))
                      )}
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-base font-semibold text-[#fff0c9]">Critical Alerts Open</h3>
                      <p className="text-sm text-[#d6bb84]">
                        Alert kritikal yang belum selesai dan perlu dibaca sebelum review minggu ini ditutup.
                      </p>
                      {weeklyReview.critical_alerts_open.length === 0 ? (
                        <EmptyText text="Belum ada alert kritikal yang masih terbuka." />
                      ) : (
                        weeklyReview.critical_alerts_open.map((item) => (
                          <WeeklyReviewAlertCard key={item.notification_id} item={item} />
                        ))
                      )}
                      <Link
                        href="/dashboard/notifications"
                        className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                      >
                        Buka Notification Center
                      </Link>
                    </section>
                  </div>
                </Panel>
              </section>
            ) : null}

            <section data-onboarding-id="manager-insights-team-performance">
              <Panel
                title={isHeadView ? "Perbandingan Performa Tim" : "Perbandingan Tim"}
                description={
                  isHeadView
                    ? "Ringkasan ini membantu Head membandingkan ritme antar tim tanpa harus turun dulu ke level sales individu."
                    : "Lihat team mana yang backlog-nya paling berat, mana yang stabil, dan siapa sales yang paling mewakili kondisi team itu."
                }
              >
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <MetricCard
                    label="Jumlah Tim"
                    value={String(insights.team_performance_summary.team_count)}
                    hint="Total tim yang masuk scope pantau."
                  />
                  <MetricCard
                    label="Perlu Balas"
                    value={String(insights.team_performance_summary.total_needs_reply)}
                    hint="Akumulasi backlog balasan di seluruh tim."
                  />
                  <MetricCard
                    label="Overdue"
                    value={String(insights.team_performance_summary.total_overdue_follow_up)}
                    hint="Akumulasi follow-up yang sudah lewat jadwal."
                  />
                  <MetricCard
                    label="Periode"
                    value={insights.team_performance_summary.range_label}
                    hint={`Dibanding ${insights.team_performance_summary.previous_range_label}.`}
                  />
                </div>

                <div className="space-y-3">
                  {insights.team_performance.length === 0 ? (
                    <EmptyText text="Belum ada data perbandingan tim di scope ini." />
                  ) : (
                    insights.team_performance.map((item) => (
                      <div key={item.team_id ?? item.team_name} className="space-y-3">
                        <TeamPerformanceCard
                          item={item}
                          onCreateAction={() => openTeamActionDraft(item)}
                        />
                        {actionDraft?.contextKey === `team:${item.team_id ?? item.team_name}` ? (
                          <ActionDraftPanel
                            draft={actionDraft}
                            salesOptions={actionAssigneeOptions}
                            isSubmitting={actionSubmitKey === actionDraft.contextKey}
                            onCancel={() => setActionDraft(null)}
                            onChange={setActionDraft}
                            onSubmit={handleSubmitActionDraft}
                          />
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div data-onboarding-id="manager-insights-sales-performance">
                <Panel
                title={isHeadView ? "Performa Sales Individu" : "Performa Tiap Sales"}
                description={
                  isHeadView
                    ? "Gunakan ini untuk melihat sales mana yang ritmenya paling rapi, siapa yang mulai overload, dan siapa yang perlu perhatian lebih cepat."
                    : "Bagian ini membantu manager melihat kondisi tiap sales tanpa harus buka lead satu per satu."
                }
              >
                <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 text-sm text-[#d6bb84]">
                    Periode aktif: <span className="font-semibold text-[#fff0c9]">{insights.sales_performance_summary.range_label}</span>
                    {" "}dibanding{" "}
                    <span className="font-semibold text-[#fff0c9]">
                      {insights.sales_performance_summary.previous_range_label}
                    </span>
                    . Delta backlog: {formatDelta(insights.sales_performance_summary.delta_total_needs_reply)} perlu balas • {formatDelta(insights.sales_performance_summary.delta_total_overdue_follow_up)} overdue.
                  </div>
                  <select
                    value={performanceRange}
                    onChange={(event) => setPerformanceRange(event.target.value)}
                    className="clara-input"
                  >
                    <option value="7d">7 hari</option>
                    <option value="14d">14 hari</option>
                    <option value="30d">30 hari</option>
                  </select>
                </div>

                <div className="mb-4 rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                    Prioritas intervensi hari ini
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {insights.top_coaching_targets.length === 0 ? (
                      <EmptyText text="Belum ada sales yang butuh intervensi khusus." />
                    ) : (
                      insights.top_coaching_targets.map((item) => (
                        <button
                          key={item.sales_user_id}
                          type="button"
                          onClick={() => void handleOpenSalesDetail(item.sales_user_id)}
                          className="rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 text-left hover:border-[#f0cb73]/28"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#fff0c9]">{item.sales_name}</p>
                            <span className={getCoachingPriorityClass(item.priority_label)}>
                              {formatStatusLabel(item.priority_label)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#d6bb84]">{item.primary_reason}</p>
                          <p className="mt-2 text-xs text-[#b89a62]">{item.recommended_action}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard
                    label="Jumlah Sales"
                    value={String(insights.sales_performance_summary.sales_count)}
                    hint="Jumlah sales aktif yang masuk scope pantau."
                  />
                  <MetricCard
                    label="Lead Aktif"
                    value={String(insights.sales_performance_summary.total_active_leads)}
                    hint="Lead yang masih berjalan dan belum closed."
                  />
                  <MetricCard
                    label="Perlu Balas"
                    value={String(insights.sales_performance_summary.total_needs_reply)}
                    hint="Conversation yang paling butuh tindakan balas."
                  />
                  <MetricCard
                    label="Follow-up Overdue"
                    value={String(insights.sales_performance_summary.total_overdue_follow_up)}
                    hint="Lead yang ritme follow-up-nya sudah melewati jalur aman."
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <select
                    value={salesSlaFilter}
                    onChange={(event) => setSalesSlaFilter(event.target.value)}
                    className="clara-input"
                  >
                    <option value="all">Semua SLA</option>
                    <option value="healthy">SLA sehat</option>
                    <option value="warning">SLA warning</option>
                    <option value="critical">SLA critical</option>
                  </select>
                  <select
                    value={salesDisciplineFilter}
                    onChange={(event) => setSalesDisciplineFilter(event.target.value)}
                    className="clara-input"
                  >
                    <option value="all">Semua disiplin CRM</option>
                    <option value="disciplined">CRM rapi</option>
                    <option value="needs_attention">Perlu perhatian</option>
                  </select>
                  <select
                    value={salesSortBy}
                    onChange={(event) => setSalesSortBy(event.target.value)}
                    className="clara-input"
                  >
                    <option value="priority">Urutkan prioritas</option>
                    <option value="overdue">Urutkan overdue</option>
                    <option value="needs_reply">Urutkan perlu balas</option>
                    <option value="hot">Urutkan hot lead</option>
                    <option value="latest_activity">Urutkan aktivitas terbaru</option>
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#f0cb73]/12 bg-[#1b140e] px-4 py-3 text-sm text-[#d6bb84]">
                  <p>
                    Menampilkan{" "}
                    <span className="font-semibold text-[#fff0c9]">
                      {paginatedSalesPerformance.length}
                    </span>{" "}
                    dari{" "}
                    <span className="font-semibold text-[#fff0c9]">
                      {filteredSalesPerformance.length}
                    </span>{" "}
                    sales
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSalesPage((current) => Math.max(1, current - 1))}
                      disabled={salesPage === 1}
                      className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3 py-1.5 text-xs font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1.5 text-xs font-semibold text-[#f0cb73]">
                      Halaman {salesPage} / {salesPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSalesPage((current) => Math.min(salesPageCount, current + 1))
                      }
                      disabled={salesPage === salesPageCount}
                      className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3 py-1.5 text-xs font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[1600px] space-y-3 overflow-y-auto pr-2">
                  {filteredSalesPerformance.length === 0 ? (
                    <EmptyText text="Belum ada data performa sales yang cocok dengan filter ini." />
                  ) : (
                    paginatedSalesPerformance.map((item) => (
                      <div key={item.sales_user_id} className="space-y-3">
                        <article className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-[#fff0c9]">
                                {item.sales_name}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#b89a62]">
                                {formatStatusLabel(item.role)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={getCoachingPriorityClass(item.coaching_signal.priority_label)}>
                                {formatStatusLabel(item.coaching_signal.priority_label)}
                              </span>
                              <span className={getMomentumClass(item.trend.momentum_label)}>
                                {formatStatusLabel(item.trend.momentum_label)}
                              </span>
                              <span className={getSalesPerformanceToneClass(item.avg_response_sla_status)}>
                                SLA {formatStatusLabel(item.avg_response_sla_status)}
                              </span>
                              <span className={getSalesPerformanceDisciplineClass(item.crm_discipline_status)}>
                                CRM {formatStatusLabel(item.crm_discipline_status)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                            <MiniStat label="Lead aktif" value={String(item.active_leads_count)} />
                            <MiniStat label="Perlu balas" value={String(item.needs_reply_count)} />
                            <MiniStat label="Overdue" value={String(item.overdue_follow_up_count)} />
                            <MiniStat label="Hot lead" value={String(item.hot_leads_count)} />
                            <MiniStat
                              label="Analyzed"
                              value={`${item.analyzed_conversations_count}/${item.analyzed_conversations_count + item.needs_analysis_count}`}
                            />
                            <MiniStat label="Butuh analysis" value={String(item.needs_analysis_count)} />
                            <MiniStat
                              label="Won/Lost/Open"
                              value={`${item.won_deals_count}/${item.lost_deals_count}/${item.open_deals_count}`}
                            />
                            <MiniStat
                              label="Aktivitas terbaru"
                              value={item.latest_activity_at ? formatDateTime(item.latest_activity_at) : "-"}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d6bb84]">
                            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                              Score {item.scorecard.overall_score}
                            </span>
                            <span className={getScoreLabelClass(item.scorecard.score_label)}>
                              {formatStatusLabel(item.scorecard.score_label)}
                            </span>
                            <span className={getMomentumClass(item.scorecard.score_trend_label)}>
                              {formatStatusLabel(item.scorecard.score_trend_label)}
                            </span>
                            <TrendDeltaChip label="Score" value={item.scorecard.score_delta_vs_previous} />
                            <TrendDeltaChip label="Lead" value={item.trend.delta_active_leads} />
                            <TrendDeltaChip label="Reply" value={item.trend.delta_needs_reply} inverse />
                            <TrendDeltaChip label="Overdue" value={item.trend.delta_overdue_follow_up} inverse />
                            <TrendDeltaChip label="Hot" value={item.trend.delta_hot_leads} />
                            <TrendDeltaChip label="Analyzed" value={item.trend.delta_analyzed_conversations} />
                            <TrendDeltaChip label="Won" value={item.trend.delta_won_deals} />
                          </div>

                          <HistoricalSummaryPanel
                            className="mt-4"
                            summary={item.history_summary}
                            weeklyHistory={item.weekly_history}
                          />

                          <div className="mt-4 rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={getFocusAreaClass(item.coaching_signal.focus_area)}>
                                Fokus {formatStatusLabel(item.coaching_signal.focus_area)}
                              </span>
                              <span className="text-xs text-[#b89a62]">
                                Score {item.coaching_signal.priority_score}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[#fff0c9]">
                              {item.coaching_signal.primary_reason}
                            </p>
                            <p className="mt-2 text-sm text-[#d6bb84]">
                              {item.coaching_signal.recommended_action}
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleOpenSalesDetail(item.sales_user_id)}
                              className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3.5 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105"
                            >
                              {selectedSalesUserId === item.sales_user_id
                                ? salesDetailLoadingId === item.sales_user_id
                                  ? "Memuat detail..."
                                  : "Tutup detail"
                                : "Buka detail sales"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openSalesActionDraft(item)}
                              className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                            >
                              Buat action
                            </button>
                          </div>
                        </article>

                        {actionDraft?.contextKey === `sales:${item.sales_user_id}` ? (
                          <ActionDraftPanel
                            draft={actionDraft}
                            salesOptions={actionAssigneeOptions}
                            isSubmitting={actionSubmitKey === actionDraft.contextKey}
                            onCancel={() => setActionDraft(null)}
                            onChange={setActionDraft}
                            onSubmit={handleSubmitActionDraft}
                          />
                        ) : null}

                        {selectedSalesUserId === item.sales_user_id ? (
                          <>
                            {salesDetailLoadingId === item.sales_user_id ? (
                              <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[#1b140e] p-5 text-sm text-[#d6bb84]">
                                Clara sedang memuat detail operasional sales ini...
                              </div>
                            ) : null}

                            {!salesDetailLoadingId && salesDetailError ? (
                              <div className="clara-alert clara-alert-danger">{salesDetailError}</div>
                            ) : null}

                            {!salesDetailLoadingId
                            && salesDetail
                            && salesDetail.sales_user.id === selectedSalesUserId ? (
                              <SalesPerformanceDetailPanel detail={salesDetail} />
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                </Panel>
              </div>

              <div>
                <Panel
                title={isHeadView ? "Tim yang Perlu Dipantau" : "Ringkasan Kondisi Tiap Tim"}
                description={
                  isHeadView
                    ? "Tidak semua tim harus dibaca penuh. Fokus ke tim dengan gap follow-up, stale log, atau case paling terasa dulu."
                    : "Bagian ini menggantikan tabel besar supaya manager bisa cepat tahu tim mana yang butuh intervensi."
                }
              >
                <div className="space-y-4">
                  {topTeamRows.length === 0 ? (
                    <EmptyText text="Belum ada data team yang bisa diringkas." />
                  ) : (
                    topTeamRows.map((row, index) => {
                      const teamKey = row.team_id ?? row.team_name;
                      const isExpanded =
                        row.team_id !== null && expandedTeamIds.includes(row.team_id);

                      return (
                        <Fragment key={teamKey}>
                          <TeamHealthCard
                            row={row}
                            isExpanded={isExpanded}
                            onboardingTargetId={
                              index === 0 ? "manager-insights-teams" : undefined
                            }
                            onToggle={toggleTeamMembers}
                          />

                          {isExpanded ? (
                            <div className="rounded-[20px] border border-[#f0cb73]/12 bg-[#1a130d]/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                                Anggota tim
                              </p>
                              {row.members.length === 0 ? (
                                <p className="mt-3 text-sm text-[#b89a62]">
                                  Belum ada anggota team yang bisa ditampilkan.
                                </p>
                              ) : (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {row.members.map((member) => (
                                    <div
                                      key={member.id}
                                      className="rounded-[16px] border border-[#f0cb73]/14 bg-[#1d150d] p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-[#fff0c9]">
                                          {member.name}
                                        </p>
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                            member.is_active
                                              ? "border border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
                                              : "border border-[#3c2c16] bg-[#22190f] text-[#c8ad75]"
                                          }`}
                                        >
                                          {member.is_active ? "Active" : "Inactive"}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#b89a62]">
                                        {member.role}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </div>
                </Panel>
              </div>

              <div data-onboarding-id="manager-insights-objections">
                <Panel
                title={isHeadView ? "Pola Hambatan Tim" : "Objection yang Paling Sering Muncul"}
                description={
                  isHeadView
                    ? "Head bisa pakai ini untuk melihat pola hambatan yang layak dijadikan arahan umum tim."
                    : "Kalau hambatan yang sama terus muncul, berarti manager perlu kasih arahan yang lebih sistematis ke sales."
                }
              >
                <div className="space-y-3">
                  {objectionTrends.length === 0 ? (
                    <EmptyText text="Belum ada objection trend yang cukup kuat di scope ini." />
                  ) : (
                    objectionTrends.slice(0, 6).map((item) => (
                      <div
                        key={item.objection}
                        className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#fff0c9]">
                            {item.objection}
                          </p>
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                            {item.count} chat
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </Panel>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function CoachingPriorityCard({
  item,
  isHeadView,
  onboardingTargetId,
}: {
  item: ManagerInsightsResponse["coaching_priority"][number];
  isHeadView: boolean;
  onboardingTargetId?: string;
}) {
  const action = getCoachingPriorityAction(item, isHeadView);

  return (
    <article
      data-onboarding-id={onboardingTargetId}
      className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-[#fff0c9]">{item.lead_name}</p>
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          {formatStatusLabel(item.review_status)}
        </span>
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          {item.review_label.replaceAll("_", " ")}
        </span>
        {item.risk_level ? (
          <span className="rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
            Risk {item.risk_level}
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
        <p className="text-sm font-semibold text-[#fff0c9]">{action.title}</p>
        <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
          {action.description}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
        {item.recommended_action ?? "Belum ada recommended action."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#b89a62]">
        <span>Owner: {item.sales_owner_name ?? "-"}</span>
        <span>&bull;</span>
        <span>Reviewer: {item.reviewer_user_name ?? "-"}</span>
        <span>&bull;</span>
        <span>Score: {item.priority_score}</span>
        <span>&bull;</span>
        <span>Last message: {formatDateTime(item.latest_message_at)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {action.primaryHref ? (
          <Link
            href={action.primaryHref}
            className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3.5 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105"
          >
            {action.primaryLabel}
          </Link>
        ) : null}
        <Link
          href={`/dashboard/sales/conversations/${item.conversation_id}`}
          className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
        >
          Buka Conversation
        </Link>
      </div>
    </article>
  );
}

function WeeklyReviewEntitySection({
  title,
  description,
  items,
  emptyText,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  items: WeeklyReviewEntityItem[];
  emptyText: string;
  actionLabel: string;
  onAction: (item: WeeklyReviewEntityItem) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-[#fff0c9]">{title}</h3>
        <p className="mt-1 text-sm text-[#d6bb84]">{description}</p>
      </div>
      {items.length === 0 ? (
        <EmptyText text={emptyText} />
      ) : (
        items.map((item) => (
          <article
            key={`${title}-${item.scope_type}-${item.sales_user_id ?? item.team_id ?? item.label}`}
            className="rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#fff0c9]">{item.label}</p>
              <span className={getScoreLabelClass(item.score_label)}>
                {formatStatusLabel(item.score_label)}
              </span>
              <span className={getMomentumClass(item.trend_label)}>
                {formatStatusLabel(item.trend_label)}
              </span>
              <TrendDeltaChip label="Score" value={item.score_delta} />
            </div>
            <p className="mt-2 text-sm text-[#d6bb84]">{item.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d6bb84]">
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 font-semibold text-[#f0cb73]">
                Score {item.score}
              </span>
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-2.5 py-1 font-semibold text-[#e1c27c]">
                Backlog {item.backlog_count}
              </span>
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-2.5 py-1 font-semibold text-[#e1c27c]">
                Overdue {item.overdue_count}
              </span>
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-2.5 py-1 font-semibold text-[#e1c27c]">
                Action {item.action_open_count}
              </span>
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-2.5 py-1 font-semibold text-[#e1c27c]">
                Alert {item.critical_alert_count}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAction(item)}
              className="mt-4 inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
            >
              {actionLabel}
            </button>
          </article>
        ))
      )}
    </section>
  );
}

function WeeklyReviewAlertCard({
  item,
}: {
  item: WeeklyReviewAlertItem;
}) {
  return (
    <article className="rounded-[20px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[#fff0c9]">{item.title}</p>
        <span className={getCoachingPriorityClass(item.severity)}>
          {formatStatusLabel(item.severity)}
        </span>
        <span className={getSalesPerformanceDisciplineClass(item.status)}>
          {formatStatusLabel(item.status)}
        </span>
      </div>
      <p className="mt-2 text-sm text-[#d6bb84]">{item.description}</p>
      <p className="mt-2 text-xs text-[#b89a62]">
        {item.team_name ?? item.sales_name ?? "Tanpa target spesifik"} • Trigger: {formatDateTime(item.triggered_at)}
      </p>
      {item.target_href ? (
        <Link
          href={item.target_href}
          className="mt-4 inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
        >
          Buka area terkait
        </Link>
      ) : null}
    </article>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#140f08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#2f210f]">{hint}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clara-card rounded-[28px] p-5">
      <h2 className="text-lg font-semibold text-[#fff0c9]">{title}</h2>
      <p className="mt-1 text-sm text-[#d6bb84]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5 text-sm text-[#d6bb84]">
      {text}
    </div>
  );
}

function ManagerStepItem({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#f0cb73]/16 bg-[#f0cb73]/10 text-sm font-semibold text-[#f0cb73]">
          {step}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#fff0c9]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6bb84]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function TeamHealthCard({
  row,
  isExpanded,
  onboardingTargetId,
  onToggle,
}: {
  row: ManagerInsightsResponse["team_discipline"][number];
  isExpanded: boolean;
  onboardingTargetId?: string;
  onToggle: (teamId: string | null) => void;
}) {
  return (
    <article
      data-onboarding-id={onboardingTargetId}
      className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[#fff0c9]">{row.team_name}</p>
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
              {row.lead_count} lead
            </span>
          </div>
          <p className="mt-2 text-sm text-[#b89a62]">
            {row.unit_name ?? "Tanpa unit"} • Manager: {row.manager_user_name ?? "-"} • {row.member_count} member
          </p>
        </div>

        {row.team_id ? (
          <button
            type="button"
            onClick={() => onToggle(row.team_id)}
            className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
          >
            {isExpanded ? "Sembunyikan anggota" : "Lihat anggota"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeamMiniMetric
          label="Log discipline"
          value={formatPercent(row.discipline_compliance_rate)}
          hint={`${row.missing_or_stale_logs} stale/missing`}
        />
        <TeamMiniMetric
          label="Follow-up"
          value={formatPercent(row.follow_up_compliance_rate)}
          hint={`${row.overdue_follow_ups} overdue`}
        />
        <TeamMiniMetric
          label="Coaching"
          value={String(row.open_coaching_cases)}
          hint="case aktif"
        />
        <TeamMiniMetric
          label="Knowledge"
          value={String(row.pending_knowledge_proposals)}
          hint="proposal pending"
        />
      </div>
    </article>
  );
}

function TeamMiniMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#f0cb73]/12 bg-[#1b140e] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[#fff0c9]">{value}</p>
      <p className="mt-1 text-xs text-[#d6bb84]">{hint}</p>
    </div>
  );
}

function HistoricalSummaryPanel({
  summary,
  weeklyHistory,
  className = "",
}: {
  summary: HistoricalPerformanceSummary | null;
  weeklyHistory: WeeklyPerformanceSnapshotItem[];
  className?: string;
}) {
  if (!summary && weeklyHistory.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
          4 minggu terakhir
        </p>
        {summary ? (
          <>
            <span className={getMomentumClass(summary.trend_label)}>
              {formatStatusLabel(summary.trend_label)}
            </span>
            <TrendDeltaChip label="Reply" value={summary.delta_needs_reply} inverse />
            <TrendDeltaChip label="Overdue" value={summary.delta_overdue_follow_up} inverse />
            <TrendDeltaChip label="Won" value={summary.delta_won_deals} />
          </>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {weeklyHistory.length === 0 ? (
          <p className="text-sm text-[#d6bb84]">Snapshot mingguan belum tersedia.</p>
        ) : (
          weeklyHistory.map((item) => (
            <div
              key={`${item.snapshot_granularity}-${item.snapshot_date}`}
              className="rounded-[16px] border border-[#f0cb73]/12 bg-[#17110b] p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
                {formatWeekLabel(item.snapshot_date)}
              </p>
              <div className="mt-2 space-y-1 text-sm text-[#d6bb84]">
                <p>Reply {item.needs_reply_count}</p>
                <p>Overdue {item.overdue_follow_up_count}</p>
                <p>Won {item.won_deals_count}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ScorecardPanel({
  scorecard,
  className = "",
}: {
  scorecard: ManagerInsightsResponse["sales_performance"][number]["scorecard"];
  className?: string;
}) {
  return (
    <div className={`rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
          Scorecard operasional
        </p>
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          Score {scorecard.overall_score}
        </span>
        <span className={getScoreLabelClass(scorecard.score_label)}>
          {formatStatusLabel(scorecard.score_label)}
        </span>
        <span className={getMomentumClass(scorecard.score_trend_label)}>
          {formatStatusLabel(scorecard.score_trend_label)}
        </span>
        <TrendDeltaChip label="Score" value={scorecard.score_delta_vs_previous} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Response" value={String(scorecard.response_discipline_score)} />
        <MiniStat label="Follow-up" value={String(scorecard.follow_up_discipline_score)} />
        <MiniStat label="Hot lead" value={String(scorecard.hot_lead_handling_score)} />
        <MiniStat label="Pipeline" value={String(scorecard.pipeline_movement_score)} />
        <MiniStat label="CRM hygiene" value={String(scorecard.crm_hygiene_score)} />
      </div>

      <div className="mt-4 rounded-[16px] border border-[#f0cb73]/12 bg-[#17110b] p-4">
        <p className="text-sm font-semibold text-[#fff0c9]">{scorecard.primary_reason}</p>
        {scorecard.secondary_reason ? (
          <p className="mt-2 text-sm text-[#d6bb84]">{scorecard.secondary_reason}</p>
        ) : null}
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
          Rekomendasi
        </p>
        <p className="mt-1 text-sm text-[#d6bb84]">{scorecard.recommended_action}</p>
      </div>
    </div>
  );
}

function TeamPerformanceCard({
  item,
  onCreateAction,
}: {
  item: ManagerInsightsResponse["team_performance"][number];
  onCreateAction: () => void;
}) {
  return (
    <article className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[#fff0c9]">{item.team_name}</p>
            <span className={getCoachingPriorityClass(item.coaching_signal.priority_label)}>
              {formatStatusLabel(item.coaching_signal.priority_label)}
            </span>
            <span className={getMomentumClass(item.trend.momentum_label)}>
              {formatStatusLabel(item.trend.momentum_label)}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#b89a62]">
            {item.unit_name ?? "Tanpa unit"} • Manager: {item.manager_user_name ?? "-"} • {item.member_count} sales
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={getSalesPerformanceToneClass(item.avg_response_sla_status)}>
            SLA {formatStatusLabel(item.avg_response_sla_status)}
          </span>
          <span className={getSalesPerformanceDisciplineClass(item.crm_discipline_status)}>
            CRM {formatStatusLabel(item.crm_discipline_status)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <MiniStat label="Lead aktif" value={String(item.active_leads_count)} />
        <MiniStat label="Perlu balas" value={String(item.needs_reply_count)} />
        <MiniStat label="Overdue" value={String(item.overdue_follow_up_count)} />
        <MiniStat label="Hot lead" value={String(item.hot_leads_count)} />
        <MiniStat
          label="Analyzed"
          value={`${item.analyzed_conversations_count}/${item.analyzed_conversations_count + item.needs_analysis_count}`}
        />
        <MiniStat label="Butuh analysis" value={String(item.needs_analysis_count)} />
        <MiniStat label="Won deals" value={String(item.won_deals_count)} />
        <MiniStat
          label="Aktivitas terbaru"
          value={item.latest_activity_at ? formatDateTime(item.latest_activity_at) : "-"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d6bb84]">
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          Score {item.scorecard.overall_score}
        </span>
        <span className={getScoreLabelClass(item.scorecard.score_label)}>
          {formatStatusLabel(item.scorecard.score_label)}
        </span>
        <span className={getMomentumClass(item.scorecard.score_trend_label)}>
          {formatStatusLabel(item.scorecard.score_trend_label)}
        </span>
        <TrendDeltaChip label="Score" value={item.scorecard.score_delta_vs_previous} />
        <TrendDeltaChip label="Lead" value={item.trend.delta_active_leads} />
        <TrendDeltaChip label="Reply" value={item.trend.delta_needs_reply} inverse />
        <TrendDeltaChip label="Overdue" value={item.trend.delta_overdue_follow_up} inverse />
        <TrendDeltaChip label="Hot" value={item.trend.delta_hot_leads} />
        <TrendDeltaChip label="Analyzed" value={item.trend.delta_analyzed_conversations} />
        <TrendDeltaChip label="Won" value={item.trend.delta_won_deals} />
      </div>

      <HistoricalSummaryPanel
        className="mt-4"
        summary={item.history_summary}
        weeklyHistory={item.weekly_history}
      />

      <div className="mt-4 rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={getFocusAreaClass(item.coaching_signal.focus_area)}>
            Fokus {formatStatusLabel(item.coaching_signal.focus_area)}
          </span>
          <span className="text-xs text-[#b89a62]">
            Score {item.coaching_signal.priority_score}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#fff0c9]">
          {item.coaching_signal.primary_reason}
        </p>
        <p className="mt-2 text-sm text-[#d6bb84]">
          {item.coaching_signal.recommended_action}
        </p>
      </div>

      <div className="mt-4 rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
          Top contributor team
        </p>
        {item.top_sales_contributors.length === 0 ? (
          <p className="mt-3 text-sm text-[#d6bb84]">
            Belum ada sales yang bisa dirangkum untuk team ini.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {item.top_sales_contributors.map((contributor) => (
              <div
                key={contributor.sales_user_id}
                className="rounded-[16px] border border-[#f0cb73]/12 bg-[#17110b] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#fff0c9]">
                    {contributor.sales_name}
                  </p>
                  <span className={getCoachingPriorityClass(contributor.priority_label)}>
                    {formatStatusLabel(contributor.priority_label)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#d6bb84]">
                  {contributor.primary_reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreateAction}
          className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
        >
          Buat action tim
        </button>
      </div>
    </article>
  );
}

function ActionDraftPanel({
  draft,
  salesOptions,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
}: {
  draft: ActionDraft;
  salesOptions: ManagerInsightsResponse["sales_performance"];
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (draft: ActionDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="rounded-[22px] border border-[#f0cb73]/16 bg-[#1b140e] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#fff0c9]">Buat action operasional</p>
          <p className="mt-1 text-xs text-[#b89a62]">
            Simpan tindakan langsung dari insight ini tanpa pindah halaman.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3 py-1.5 text-xs font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
        >
          Tutup
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select
          value={draft.actionType}
          onChange={(event) => onChange({ ...draft, actionType: event.target.value })}
          className="clara-input"
        >
          <option value="coaching">Coaching</option>
          <option value="follow_up_recovery">Follow-up recovery</option>
          <option value="reply_backlog_review">Reply backlog review</option>
          <option value="crm_cleanup">CRM cleanup</option>
          <option value="weekly_review">Weekly review</option>
        </select>
        <select
          value={draft.priorityLabel}
          onChange={(event) => onChange({ ...draft, priorityLabel: event.target.value })}
          className="clara-input"
        >
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select
          value={draft.assignedToUserId}
          onChange={(event) =>
            onChange({
              ...draft,
              assignedToUserId: event.target.value,
              salesUserId: draft.salesUserId ? event.target.value : draft.salesUserId,
            })
          }
          className="clara-input"
        >
          <option value="">Pilih assignee</option>
          {salesOptions.map((item) => (
            <option key={item.sales_user_id} value={item.sales_user_id}>
              {item.sales_name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={draft.dueAt}
          onChange={(event) => onChange({ ...draft, dueAt: event.target.value })}
          className="clara-input"
        />
      </div>

      <div className="mt-3 space-y-3">
        <input
          type="text"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className="clara-input"
          placeholder="Judul action"
        />
        <textarea
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          className="clara-input min-h-[110px]"
          placeholder="Apa yang perlu dilakukan?"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !draft.assignedToUserId}
          className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3.5 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan action"}
        </button>
      </div>
    </form>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#f0cb73]/12 bg-[#1b140e] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#fff0c9]">{value}</p>
    </div>
  );
}

function SalesPerformanceDetailPanel({
  detail,
}: {
  detail: SalesPerformanceDetailResponse;
}) {
  const summary = detail.summary;
  const teamLabel = [detail.sales_user.team_name, detail.sales_user.unit_name]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className="rounded-[24px] border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(28,20,14,0.98)_0%,rgba(15,11,8,0.98)_100%)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
            Drill-down performa sales
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-[#fff0c9]">
            {detail.sales_user.name}
          </h3>
          <p className="mt-2 text-sm text-[#d6bb84]">
            {formatStatusLabel(detail.sales_user.role)}
            {teamLabel ? ` • ${teamLabel}` : ""}
            {` • ${detail.sales_user.is_active ? "Active" : "Inactive"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={getSalesPerformanceToneClass(summary.avg_response_sla_status)}>
            SLA {formatStatusLabel(summary.avg_response_sla_status)}
          </span>
          <span className={getSalesPerformanceDisciplineClass(summary.crm_discipline_status)}>
            CRM {formatStatusLabel(summary.crm_discipline_status)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Lead aktif" value={String(summary.active_leads_count)} />
        <MiniStat label="Perlu balas" value={String(summary.needs_reply_count)} />
        <MiniStat label="Overdue" value={String(summary.overdue_follow_up_count)} />
        <MiniStat label="Hot lead" value={String(summary.hot_leads_count)} />
        <MiniStat
          label="Analyzed"
          value={`${summary.analyzed_conversations_count}/${summary.analyzed_conversations_count + summary.needs_analysis_count}`}
        />
        <MiniStat label="Butuh analysis" value={String(summary.needs_analysis_count)} />
        <MiniStat
          label="Won/Lost/Open"
          value={`${summary.won_deals_count}/${summary.lost_deals_count}/${summary.open_deals_count}`}
        />
        <MiniStat
          label="Aktivitas terbaru"
          value={summary.latest_activity_at ? formatDateTime(summary.latest_activity_at) : "-"}
        />
      </div>

      <div className="mt-4 rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 text-sm text-[#d6bb84]">
        Periode aktif: <span className="font-semibold text-[#fff0c9]">{summary.range_label}</span>
        {" "}dibanding{" "}
        <span className="font-semibold text-[#fff0c9]">{summary.previous_range_label}</span>.
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={getMomentumClass(summary.trend.momentum_label)}>
            {formatStatusLabel(summary.trend.momentum_label)}
          </span>
          <TrendDeltaChip label="Lead" value={summary.trend.delta_active_leads} />
          <TrendDeltaChip label="Reply" value={summary.trend.delta_needs_reply} inverse />
          <TrendDeltaChip label="Overdue" value={summary.trend.delta_overdue_follow_up} inverse />
          <TrendDeltaChip label="Hot" value={summary.trend.delta_hot_leads} />
          <TrendDeltaChip label="Analyzed" value={summary.trend.delta_analyzed_conversations} />
          <TrendDeltaChip label="Won" value={summary.trend.delta_won_deals} />
        </div>
      </div>

      <HistoricalSummaryPanel
        className="mt-4"
        summary={summary.history_summary}
        weeklyHistory={summary.weekly_history}
      />

      <ScorecardPanel className="mt-4" scorecard={summary.scorecard} />

      <div className="mt-4 rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={getCoachingPriorityClass(summary.coaching_signal.priority_label)}>
            {formatStatusLabel(summary.coaching_signal.priority_label)}
          </span>
          <span className={getFocusAreaClass(summary.coaching_signal.focus_area)}>
            Fokus {formatStatusLabel(summary.coaching_signal.focus_area)}
          </span>
          <span className="text-xs text-[#b89a62]">
            Score {summary.coaching_signal.priority_score}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#fff0c9]">
          Arahan intervensi
        </p>
        <p className="mt-2 text-sm text-[#d6bb84]">
          {summary.coaching_signal.primary_reason}
        </p>
        <p className="mt-2 text-sm text-[#d6bb84]">
          {summary.coaching_signal.recommended_action}
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <DetailListPanel
          title="Lead Milik Sales"
          emptyText="Belum ada lead milik sales ini."
          items={detail.lead_items.map((item) => (
            <Link
              key={item.lead_id}
              href={item.target_href}
              className="block rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 hover:border-[#f0cb73]/28"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#fff0c9]">{item.lead_name}</p>
                <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                  {formatStatusLabel(item.current_stage)}
                </span>
                <span className={getSalesPerformanceDisciplineClass(item.discipline_status)}>
                  {formatStatusLabel(item.discipline_status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#d6bb84]">
                Temp: {formatStatusLabel(item.lead_temperature)} • Last contact: {item.last_contact_at ? formatDateTime(item.last_contact_at) : "-"}
              </p>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Next follow-up: {item.next_follow_up_at ? formatDateTime(item.next_follow_up_at) : "-"}
              </p>
            </Link>
          ))}
        />

        <DetailListPanel
          title="Conversation Perlu Perhatian"
          emptyText="Belum ada conversation yang perlu perhatian khusus."
          items={detail.conversation_items.map((item) => (
            <Link
              key={item.conversation_id}
              href={item.target_href}
              className="block rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 hover:border-[#f0cb73]/28"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#fff0c9]">{item.conversation_title}</p>
                <span className={getConversationStatusClass(item.ui_status)}>
                  {formatStatusLabel(item.ui_status)}
                </span>
                {item.risk_level ? (
                  <span className={getSalesPerformanceToneClass(item.risk_level === "high" ? "critical" : "warning")}>
                    Risk {formatStatusLabel(item.risk_level)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-[#d6bb84]">
                Channel: {formatStatusLabel(item.source_channel)} • Last message: {item.last_message_at ? formatDateTime(item.last_message_at) : "-"}
              </p>
            </Link>
          ))}
        />

        <DetailListPanel
          title="Follow-up Overdue"
          emptyText="Belum ada follow-up overdue untuk sales ini."
          items={detail.follow_up_items.map((item) => (
            <Link
              key={item.lead_id}
              href={item.target_href}
              className="block rounded-[18px] border border-[#f0cb73]/14 bg-[#1b140e] p-4 hover:border-[#f0cb73]/28"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#fff0c9]">{item.lead_name}</p>
                <span className={getFollowUpPriorityClass(item.priority_label)}>
                  {formatStatusLabel(item.priority_label)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#d6bb84]">
                Task: {formatStatusLabel(item.task_type)} • Due: {item.due_at ? formatDateTime(item.due_at) : "-"}
              </p>
            </Link>
          ))}
        />
      </div>
    </section>
  );
}

function DetailListPanel({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: React.ReactNode[];
}) {
  return (
    <section className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="text-sm font-semibold text-[#fff0c9]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <EmptyText text={emptyText} /> : items}
      </div>
    </section>
  );
}

function TrendDeltaChip({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  const isPositiveGood = inverse ? value < 0 : value > 0;
  const isNegativeBad = inverse ? value > 0 : value < 0;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isPositiveGood
          ? "border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
          : isNegativeBad
            ? "border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
            : "border-[#3c2c16] bg-[#22190f] text-[#c8ad75]"
      }`}
    >
      {label} {formatDelta(value)}
    </span>
  );
}

function getSalesPerformanceToneClass(status: string) {
  if (status === "critical") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (status === "warning") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
}

function getSalesPerformanceDisciplineClass(status: string) {
  if (status === "needs_attention") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
}

function getConversationStatusClass(status: string) {
  if (status === "needs_escalation" || status === "needs_approval") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (status === "needs_analysis" || status === "needs_reply_suggestion") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
}

function getFollowUpPriorityClass(priorityLabel: string) {
  if (priorityLabel === "tinggi") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (priorityLabel === "sedang") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
}

function getMomentumClass(momentumLabel: string) {
  if (momentumLabel === "declining") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (momentumLabel === "improving") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#3c2c16] bg-[#22190f] px-2.5 py-1 text-xs font-semibold text-[#c8ad75]";
}

function getScoreLabelClass(scoreLabel: string) {
  if (scoreLabel === "critical") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (scoreLabel === "needs_attention") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (scoreLabel === "excellent") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#3c2c16] bg-[#22190f] px-2.5 py-1 text-xs font-semibold text-[#c8ad75]";
}

function getCoachingPriorityClass(priorityLabel: string) {
  if (priorityLabel === "urgent") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (priorityLabel === "high") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  if (priorityLabel === "normal") {
    return "rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]";
  }
  return "rounded-full border border-[#3c2c16] bg-[#22190f] px-2.5 py-1 text-xs font-semibold text-[#c8ad75]";
}

function getFocusAreaClass(focusArea: string) {
  return "rounded-full border border-[#f0cb73]/18 bg-[#1f160d] px-2.5 py-1 text-xs font-semibold text-[#d6bb84]";
}

function formatDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}
