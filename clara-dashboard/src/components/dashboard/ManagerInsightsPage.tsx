"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { usePromptText } from "@/components/dashboard/ConfirmDialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format";
import { canAccessManagerInsights, isHeadRole } from "@/lib/roles";
import {
  ACTION_STATUS,
  ACTION_TYPE,
  ALERT_SEVERITY,
  CRM_DISCIPLINE,
  FOCUS_AREA,
  MOMENTUM,
  PRIORITY,
  REPLY_STATE,
  REVIEW_STATUS,
  SCORE_LABEL,
  SLA_STATUS,
  STAGE,
  TEMPERATURE,
  describe,
  describeDelta,
  describeRangeLabel,
  describeScopeLabel,
  labelOf,
  plainJargon,
} from "@/lib/vocab";
import type {
  CurrentUser,
  ManagerInsightsResponse,
  PerformanceActionCreateRequest,
  PerformanceActionItem,
  PerformanceActionListResponse,
  PerformanceActionUpdateRequest,
  SalesPerformanceDetailResponse,
  WeeklyReviewEntityItem,
} from "@/types/dashboard";

type SalesItem = ManagerInsightsResponse["sales_performance"][number];
type TeamItem = ManagerInsightsResponse["team_performance"][number];

const VISIBLE_STEP = 6;

const ACTION_TYPE_OPTIONS = [
  "coaching",
  "follow_up_recovery",
  "reply_backlog_review",
  "crm_cleanup",
  "weekly_review",
];
const PRIORITY_OPTIONS = ["urgent", "high", "normal", "low"];

const SORT_OPTIONS = [
  { value: "priority", label: "Paling perlu dibantu" },
  { value: "overdue", label: "Follow-up terlambat terbanyak" },
  { value: "needs_reply", label: "Chat belum dibalas terbanyak" },
  { value: "hot", label: "Customer panas terbanyak" },
  { value: "latest_activity", label: "Aktivitas terbaru" },
];

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

function resolveDefaultActionType(focusArea: string): string {
  if (focusArea === "reply_backlog") return "reply_backlog_review";
  if (focusArea === "follow_up") return "follow_up_recovery";
  if (focusArea === "discipline") return "crm_cleanup";
  return "coaching";
}

function resolveActionPriority(priorityLabel: string): string {
  return priorityLabel === "stable" ? "low" : priorityLabel;
}

/** Apa yang perlu dilakukan reviewer untuk sebuah kasus pembinaan, dalam satu kalimat. */
function describeReviewCase(
  item: ManagerInsightsResponse["coaching_priority"][number],
  isHeadView: boolean,
): string {
  if (item.review_status === "in_review") {
    return isHeadView
      ? "Baca chat-nya dan beri arahan yang tegas ke Sales."
      : "Baca chat-nya, lalu putuskan: perlu diperbaiki, pembinaan selesai, atau dieskalasi.";
  }
  if (item.review_status === "needs_rework") {
    return "Kasus ini belum selesai. Tulis revisi yang harus dilakukan Sales dan pastikan langkah berikutnya jelas.";
  }
  if (item.review_status === "escalated") {
    return isHeadView
      ? "Cek alasan eskalasinya, lalu putuskan arahan untuk Sales."
      : "Cek alasan eskalasinya, lalu putuskan apakah perlu naik lagi atau dikembalikan dengan arahan.";
  }
  if (item.risk_level === "high") {
    return "Topiknya berisiko tinggi. Buka chat-nya dan pastikan tidak ada jawaban yang menyesatkan.";
  }
  return "Buka kasus ini dan pastikan Sales mendapat arahan yang jelas.";
}

export function ManagerInsightsPage() {
  const promptText = usePromptText();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [insights, setInsights] = useState<ManagerInsightsResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [performanceRange, setPerformanceRange] = useState("7d");
  const [salesSortBy, setSalesSortBy] = useState("priority");
  const [salesVisible, setSalesVisible] = useState(VISIBLE_STEP);
  const [selectedSalesUserId, setSelectedSalesUserId] = useState<string | null>(
    null,
  );
  const [salesDetail, setSalesDetail] =
    useState<SalesPerformanceDetailResponse | null>(null);
  const [salesDetailLoadingId, setSalesDetailLoadingId] = useState<
    string | null
  >(null);
  const [salesDetailError, setSalesDetailError] = useState("");
  const [actionList, setActionList] =
    useState<PerformanceActionListResponse | null>(null);
  const [actionListError, setActionListError] = useState("");
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [actionSubmitKey, setActionSubmitKey] = useState<string | null>(null);
  const [actionStatusLoadingId, setActionStatusLoadingId] = useState<
    string | null
  >(null);
  const isHeadView = isHeadRole(currentUser?.role);

  const weeklyReview = insights?.weekly_review ?? null;
  const reviewCases = insights?.coaching_priority ?? [];
  const boundaryAlerts = insights?.boundary_alerts ?? [];
  const objectionTrends = insights?.objection_trends ?? [];
  const attentionCount = boundaryAlerts.length + reviewCases.length;
  const actionAssigneeOptions = insights?.sales_performance ?? [];

  const sortedSales = useMemo(() => {
    const items = [...(insights?.sales_performance ?? [])];

    return items.sort((left, right) => {
      if (salesSortBy === "priority")
        return (
          right.coaching_signal.priority_score -
          left.coaching_signal.priority_score
        );
      if (salesSortBy === "hot")
        return right.hot_leads_count - left.hot_leads_count;
      if (salesSortBy === "latest_activity") {
        return (right.latest_activity_at ?? "").localeCompare(
          left.latest_activity_at ?? "",
        );
      }
      if (salesSortBy === "needs_reply")
        return right.needs_reply_count - left.needs_reply_count;
      return right.overdue_follow_up_count - left.overdue_follow_up_count;
    });
  }, [insights?.sales_performance, salesSortBy]);

  const openActionItems = useMemo(
    () =>
      (actionList?.items ?? []).filter(
        (item) => item.status === "open" || item.status === "in_progress",
      ),
    [actionList?.items],
  );

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
          : "Daftar tugas tim belum bisa dimuat.",
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
          : "Detail Sales ini belum bisa dimuat.",
      );
    } finally {
      setSalesDetailLoadingId(null);
    }
  }

  useEffect(() => {
    async function loadPage() {
      setIsLoading(true);
      setErrorMessage("");

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
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Monitor tim belum bisa dimuat.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPage();
  }, [performanceRange, reloadKey, router]);

  async function handleOpenSalesDetail(salesUserId: string) {
    if (
      selectedSalesUserId === salesUserId &&
      salesDetail?.sales_user.id === salesUserId
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
    router.push(item.target_href ?? "/manager-insights");
  }

  function openSalesActionDraft(item: SalesItem) {
    setActionDraft({
      contextKey: `sales:${item.sales_user_id}`,
      sourceType: "sales_performance",
      sourceReferenceId: item.sales_user_id,
      teamId: null,
      salesUserId: item.sales_user_id,
      actionType: resolveDefaultActionType(item.coaching_signal.focus_area),
      title: `Tindak lanjuti ${item.sales_name}`,
      description: plainJargon(item.coaching_signal.recommended_action),
      assignedToUserId: item.sales_user_id,
      priorityLabel: resolveActionPriority(item.coaching_signal.priority_label),
      dueAt: "",
    });
  }

  function openTeamActionDraft(item: TeamItem) {
    const defaultAssigneeId =
      item.top_sales_contributors[0]?.sales_user_id ??
      actionAssigneeOptions[0]?.sales_user_id ??
      "";

    setActionDraft({
      contextKey: `team:${item.team_id ?? item.team_name}`,
      sourceType: "team_performance",
      sourceReferenceId: item.team_id,
      teamId: item.team_id,
      salesUserId: defaultAssigneeId || null,
      actionType: resolveDefaultActionType(item.coaching_signal.focus_area),
      title: `Bantu ${item.team_name}`,
      description: plainJargon(item.coaching_signal.recommended_action),
      assignedToUserId: defaultAssigneeId,
      priorityLabel: resolveActionPriority(item.coaching_signal.priority_label),
      dueAt: "",
    });
  }

  function handleWeeklyReviewTeamAction(item: WeeklyReviewEntityItem) {
    const matchedTeam = insights?.team_performance.find(
      (team) => team.team_id === item.team_id,
    );
    if (matchedTeam) {
      openTeamActionDraft(matchedTeam);
      return;
    }
    router.push("/notifications");
  }

  async function handleSubmitActionDraft(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!actionDraft) {
      return;
    }

    setActionSubmitKey(actionDraft.contextKey);
    setActionListError("");

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
        due_at: actionDraft.dueAt
          ? new Date(actionDraft.dueAt).toISOString()
          : null,
      };
      await apiFetch<PerformanceActionItem>("/dashboard/performance-actions", {
        method: "POST",
        body: payload,
      });
      setActionDraft(null);
      await loadPerformanceActions();
    } catch (error) {
      setActionListError(
        error instanceof Error
          ? error.message
          : "Tugas belum bisa dibuat. Coba lagi.",
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
      if (nextStatus === "skipped") {
        resolutionNote = await promptText({
          title: "Lewati tugas ini?",
          message: "Tulis alasannya supaya tim tahu kenapa tugas ini dilewati.",
          label: "Alasan",
          placeholder: "Contoh: sudah ditangani lewat telepon",
          confirmLabel: "Lewati tugas",
          required: true,
        });
        if (!resolutionNote) {
          setActionStatusLoadingId(null);
          return;
        }
      }

      const payload: PerformanceActionUpdateRequest = {
        status: nextStatus,
        resolution_note: resolutionNote,
      };
      await apiFetch<PerformanceActionItem>(
        `/dashboard/performance-actions/${actionId}`,
        { method: "PATCH", body: payload },
      );
      await loadPerformanceActions();
    } catch (error) {
      setActionListError(
        error instanceof Error
          ? error.message
          : "Status tugas belum bisa diubah. Coba lagi.",
      );
    } finally {
      setActionStatusLoadingId(null);
    }
  }

  const summaryTitle = !insights
    ? ""
    : attentionCount > 0
      ? `${attentionCount} hal perlu perhatianmu`
      : "Tim berjalan lancar";
  const summaryHelper = !insights
    ? ""
    : attentionCount > 0
      ? `${boundaryAlerts.length} peringatan dari tim dan ${reviewCases.length} kasus yang perlu masukanmu. Mulai dari daftar di bawah.`
      : insights.overdue_follow_up_count > 0
        ? `Tidak ada peringatan, tapi ada ${insights.overdue_follow_up_count} follow-up yang terlambat. Cek anggota tim di bawah.`
        : "Tidak ada peringatan dan tidak ada kasus yang menunggu.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.teamMonitor}
      description={
        isHeadView
          ? "Ritme kerja semua tim, area yang berisiko, dan hal yang perlu kamu putuskan."
          : "Progres timmu, hambatan follow-up, dan kasus yang butuh arahanmu."
      }
      actions={
        <>
          <Link
            href={isHeadView ? "/notifications" : "/approvals"}
            className="clara-button clara-button-primary"
          >
            {isHeadView ? "Lihat Alert Tim" : "Lihat Review Sales"}
          </Link>
          <Link
            href="/api/dashboard/manager-insights/weekly-review?format=csv"
            className="clara-button clara-button-ghost"
            target="_blank"
          >
            Unduh laporan mingguan (CSV)
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {isLoading && !insights ? (
          <LoadingState message="Memuat monitor tim..." />
        ) : null}

        {!isLoading && errorMessage && !insights ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {actionListError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionListError}
          </div>
        ) : null}

        {insights ? (
          <>
            <section
              data-onboarding-id="manager-insights-hero"
              aria-labelledby="monitor-summary"
              className="clara-card p-5 sm:p-6"
            >
              <h2
                id="monitor-summary"
                className="text-xl font-bold clara-text-primary sm:text-2xl"
              >
                {summaryTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                {summaryHelper}
              </p>

              <dl
                data-onboarding-id="manager-insights-metrics"
                className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm md:grid-cols-4"
              >
                <Fact
                  label="Follow-up terlambat"
                  value={String(insights.overdue_follow_up_count)}
                  hint="Jadwal follow-up yang sudah lewat."
                />
                <Fact
                  label="Follow-up tepat waktu"
                  value={`${Math.round(insights.follow_up_compliance_rate * 100)}%`}
                  hint="Persentase follow-up yang dikerjakan sesuai jadwal."
                />
                <Fact
                  label="Catatan aktivitas belum diisi"
                  value={String(insights.missing_or_stale_log_count)}
                  hint="Lead yang catatan hariannya kosong atau sudah lama."
                />
                <Fact
                  label="Kasus masukan yang belum selesai"
                  value={String(insights.open_coaching_case_count)}
                />
              </dl>
              <p className="mt-4 text-xs clara-text-muted">
                {describeScopeLabel(insights.scope_label)} ·{" "}
                {insights.scope_team_count} tim · {insights.scope_member_count}{" "}
                Sales · data per {formatDateTime(insights.generated_at)}
              </p>
            </section>

            <section aria-labelledby="attention-title" className="space-y-3">
              <h2
                id="attention-title"
                className="text-base font-semibold clara-text-primary"
              >
                Perlu perhatian{" "}
                <span className="font-normal clara-text-muted">
                  ({attentionCount})
                </span>
              </h2>

              {attentionCount === 0 ? (
                <EmptyState
                  title="Tidak ada yang perlu perhatian"
                  description="Peringatan dari tim dan kasus yang perlu masukanmu akan muncul di sini saat ada."
                />
              ) : (
                <ul
                  data-onboarding-id="manager-insights-steps"
                  className="space-y-3"
                >
                  {boundaryAlerts.map((alert) => (
                    <li
                      key={`${alert.team_id ?? alert.team_name}-${alert.title}`}
                      className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold clara-text-primary">
                              {plainJargon(alert.title)}
                            </h3>
                            <ValueTag
                              table={ALERT_SEVERITY}
                              value={alert.severity}
                            />
                          </div>
                          <p className="mt-1 text-xs clara-text-muted">
                            {alert.team_name}
                            {alert.unit_name ? ` · ${alert.unit_name}` : ""}
                          </p>
                          <p className="mt-2 text-sm leading-6 clara-text-secondary">
                            {plainJargon(alert.description)}
                          </p>
                        </div>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="clara-button clara-button-primary shrink-0"
                          >
                            Lihat
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}

                  {reviewCases.map((item) => (
                    <li
                      key={item.review_case_id}
                      data-onboarding-id={undefined}
                      className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold clara-text-primary">
                              {item.lead_name}
                            </h3>
                            <ValueTag
                              table={REVIEW_STATUS}
                              value={item.review_status}
                            />
                            {item.risk_level === "high" ? (
                              <Tag tone="danger">Risiko tinggi</Tag>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs clara-text-muted">
                            Sales: {item.sales_owner_name ?? "belum ada"} ·
                            Peninjau:{" "}
                            {item.reviewer_user_name ?? "belum ditunjuk"} ·
                            pesan terakhir{" "}
                            {formatRelativeTime(item.latest_message_at)}
                          </p>
                          <p className="mt-2 text-sm leading-6 clara-text-secondary">
                            <span className="font-semibold clara-text-primary">
                              Yang perlu dilakukan:{" "}
                            </span>
                            {describeReviewCase(item, isHeadView)}
                          </p>
                          {item.recommended_action ? (
                            <p className="mt-1 text-sm leading-6 clara-text-secondary">
                              <span className="font-semibold clara-text-primary">
                                Saran Clara:{" "}
                              </span>
                              {item.recommended_action}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Link
                            href={`/sales/conversations/${item.conversation_id}`}
                            className="clara-button clara-button-primary"
                          >
                            Buka chat
                          </Link>
                          <Link
                            href="/approvals"
                            className="clara-button clara-button-secondary"
                          >
                            {isHeadView ? "Arahan Tim" : "Review Sales"}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              data-onboarding-id="manager-insights-sales-performance"
              aria-labelledby="members-title"
              className="space-y-3"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="members-title"
                    className="text-base font-semibold clara-text-primary"
                  >
                    Anggota tim{" "}
                    <span className="font-normal clara-text-muted">
                      ({sortedSales.length})
                    </span>
                  </h2>
                  <p className="text-sm clara-text-secondary">
                    Dibanding{" "}
                    {describeRangeLabel(
                      insights.sales_performance_summary.previous_range_label,
                    )}
                    :{" "}
                    {
                      describeDelta(
                        insights.sales_performance_summary
                          .delta_total_needs_reply,
                        true,
                      ).text
                    }{" "}
                    chat belum dibalas,{" "}
                    {
                      describeDelta(
                        insights.sales_performance_summary
                          .delta_total_overdue_follow_up,
                        true,
                      ).text
                    }{" "}
                    follow-up terlambat.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label htmlFor="member-range" className="clara-label">
                      Periode
                    </label>
                    <select
                      id="member-range"
                      value={performanceRange}
                      onChange={(event) => {
                        setSalesVisible(VISIBLE_STEP);
                        setPerformanceRange(event.target.value);
                      }}
                      className="clara-select mt-2"
                    >
                      <option value="7d">7 hari terakhir</option>
                      <option value="14d">14 hari terakhir</option>
                      <option value="30d">30 hari terakhir</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="member-sort" className="clara-label">
                      Urutkan
                    </label>
                    <select
                      id="member-sort"
                      value={salesSortBy}
                      onChange={(event) => {
                        setSalesVisible(VISIBLE_STEP);
                        setSalesSortBy(event.target.value);
                      }}
                      className="clara-select mt-2"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {sortedSales.length === 0 ? (
                <EmptyState
                  title="Belum ada data Sales"
                  description="Data muncul setelah anggota tim mulai memakai Clara."
                />
              ) : (
                <ul className="space-y-3">
                  {sortedSales.slice(0, salesVisible).map((item) => (
                    <li key={item.sales_user_id} className="space-y-3">
                      <SalesRow
                        item={item}
                        isOpen={selectedSalesUserId === item.sales_user_id}
                        isLoading={salesDetailLoadingId === item.sales_user_id}
                        onToggleDetail={() =>
                          void handleOpenSalesDetail(item.sales_user_id)
                        }
                        onCreateAction={() => openSalesActionDraft(item)}
                      />

                      {actionDraft?.contextKey ===
                      `sales:${item.sales_user_id}` ? (
                        <ActionDraftPanel
                          draft={actionDraft}
                          salesOptions={actionAssigneeOptions}
                          isSubmitting={
                            actionSubmitKey === actionDraft.contextKey
                          }
                          onCancel={() => setActionDraft(null)}
                          onChange={setActionDraft}
                          onSubmit={handleSubmitActionDraft}
                        />
                      ) : null}

                      {selectedSalesUserId === item.sales_user_id ? (
                        <>
                          {salesDetailLoadingId === item.sales_user_id ? (
                            <LoadingState message="Memuat detail Sales ini..." />
                          ) : null}
                          {!salesDetailLoadingId && salesDetailError ? (
                            <div
                              role="alert"
                              className="clara-alert clara-alert-danger"
                            >
                              {salesDetailError}
                            </div>
                          ) : null}
                          {!salesDetailLoadingId &&
                          salesDetail &&
                          salesDetail.sales_user.id === selectedSalesUserId ? (
                            <SalesDetailPanel detail={salesDetail} />
                          ) : null}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {sortedSales.length > salesVisible ? (
                <button
                  type="button"
                  onClick={() =>
                    setSalesVisible((count) => count + VISIBLE_STEP)
                  }
                  className="clara-button clara-button-ghost"
                >
                  Tampilkan{" "}
                  {Math.min(sortedSales.length - salesVisible, VISIBLE_STEP)}{" "}
                  Sales lagi ({sortedSales.length - salesVisible} tersisa)
                </button>
              ) : null}
            </section>

            <section aria-labelledby="tasks-title" className="space-y-3">
              <div>
                <h2
                  id="tasks-title"
                  className="text-base font-semibold clara-text-primary"
                >
                  Tugas untuk tim{" "}
                  <span className="font-normal clara-text-muted">
                    ({openActionItems.length})
                  </span>
                </h2>
                <p className="text-sm clara-text-secondary">
                  Tugas yang kamu berikan ke anggota tim. Selesai:{" "}
                  {actionList?.done_count ?? 0} · Dilewati:{" "}
                  {actionList?.skipped_count ?? 0}
                </p>
              </div>

              {openActionItems.length === 0 ? (
                <EmptyState
                  title="Belum ada tugas yang berjalan"
                  description="Klik Beri tugas pada seorang anggota tim untuk membuat tugas baginya."
                />
              ) : (
                <ul className="space-y-3">
                  {openActionItems.slice(0, 8).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold clara-text-primary">
                              {item.title}
                            </h3>
                            <ValueTag
                              table={ACTION_STATUS}
                              value={item.status}
                            />
                            <ValueTag
                              table={PRIORITY}
                              value={item.priority_label}
                            />
                          </div>
                          <p className="mt-2 text-sm leading-6 clara-text-secondary">
                            {item.description}
                          </p>
                          <p className="mt-2 text-xs clara-text-muted">
                            Untuk: {item.assigned_to_user_name ?? "-"} ·
                            Tenggat: {formatDateTime(item.due_at)} · Dibuat oleh{" "}
                            {item.created_by_user_name ?? "-"} ·{" "}
                            {labelOf(ACTION_TYPE, item.action_type)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {item.status === "open" ? (
                            <button
                              type="button"
                              disabled={actionStatusLoadingId === item.id}
                              onClick={() =>
                                void handleActionStatusUpdate(
                                  item.id,
                                  "in_progress",
                                )
                              }
                              className="clara-button clara-button-secondary"
                            >
                              Mulai
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={actionStatusLoadingId === item.id}
                            onClick={() =>
                              void handleActionStatusUpdate(item.id, "done")
                            }
                            className="clara-button clara-button-primary"
                          >
                            {actionStatusLoadingId === item.id
                              ? "Menyimpan..."
                              : "Tandai selesai"}
                          </button>
                          <button
                            type="button"
                            disabled={actionStatusLoadingId === item.id}
                            onClick={() =>
                              void handleActionStatusUpdate(item.id, "skipped")
                            }
                            className="clara-button clara-button-ghost"
                          >
                            Lewati
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {insights.team_performance.length > 0 ? (
              <details
                data-onboarding-id="manager-insights-team-performance"
                className="clara-card group p-5 sm:p-6"
              >
                <summary className="clara-disclosure text-lg font-bold clara-text-primary">
                  <span>
                    Perbandingan antar tim{" "}
                    <span className="font-normal clara-text-muted">
                      ({insights.team_performance.length})
                    </span>
                  </span>
                </summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  Lihat tim mana yang beban kerjanya paling berat dan Sales mana
                  yang paling mewakili kondisinya.
                </p>

                <ul className="mt-4 space-y-3">
                  {insights.team_performance.map((team) => (
                    <li
                      key={team.team_id ?? team.team_name}
                      className="space-y-3"
                    >
                      <TeamRow
                        item={team}
                        onCreateAction={() => openTeamActionDraft(team)}
                      />
                      {actionDraft?.contextKey ===
                      `team:${team.team_id ?? team.team_name}` ? (
                        <ActionDraftPanel
                          draft={actionDraft}
                          salesOptions={actionAssigneeOptions}
                          isSubmitting={
                            actionSubmitKey === actionDraft.contextKey
                          }
                          onCancel={() => setActionDraft(null)}
                          onChange={setActionDraft}
                          onSubmit={handleSubmitActionDraft}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {weeklyReview ? (
              <details className="clara-card group p-5 sm:p-6">
                <summary className="clara-disclosure text-lg font-bold clara-text-primary">
                  <span>Review mingguan</span>
                </summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  {formatWeekLabel(weeklyReview.review_start)} sampai{" "}
                  {formatWeekLabel(weeklyReview.review_end)} ·{" "}
                  {describeScopeLabel(weeklyReview.scope_label)}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm md:grid-cols-4">
                  <Fact
                    label="Tim yang sehat"
                    value={String(weeklyReview.healthy_team_count)}
                  />
                  <Fact
                    label="Tim perlu perhatian"
                    value={String(weeklyReview.teams_needing_attention_count)}
                  />
                  <Fact
                    label="Tugas belum selesai"
                    value={String(weeklyReview.unresolved_action_count)}
                  />
                  <Fact
                    label="Peringatan penting yang masih terbuka"
                    value={String(weeklyReview.critical_alert_open_count)}
                  />
                </dl>

                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  <WeeklyList
                    title="Paling membaik"
                    items={weeklyReview.top_improvers}
                    emptyText="Belum ada yang menonjol minggu ini."
                    actionLabel="Lihat detail"
                    onAction={handleWeeklyReviewEntityOpen}
                  />
                  <WeeklyList
                    title="Paling berisiko"
                    items={weeklyReview.biggest_risks}
                    emptyText="Belum ada risiko besar minggu ini."
                    actionLabel="Lihat detail"
                    onAction={handleWeeklyReviewEntityOpen}
                  />
                  <WeeklyList
                    title="Tim yang perlu dibantu"
                    items={weeklyReview.teams_needing_intervention}
                    emptyText="Belum ada tim yang perlu dibantu."
                    actionLabel="Beri tugas"
                    onAction={handleWeeklyReviewTeamAction}
                  />
                </div>

                {weeklyReview.critical_alerts_open.length > 0 ? (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold clara-text-primary">
                      Peringatan penting yang masih terbuka
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {weeklyReview.critical_alerts_open.map((alert) => (
                        <li
                          key={alert.notification_id}
                          className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-3 text-sm"
                        >
                          <p className="font-semibold clara-text-primary">
                            {plainJargon(alert.title)}
                          </p>
                          <p className="mt-1 clara-text-secondary">
                            {plainJargon(alert.description)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/notifications"
                      className="clara-button clara-button-secondary mt-3"
                    >
                      Buka semua peringatan
                    </Link>
                  </div>
                ) : null}
              </details>
            ) : null}

            {objectionTrends.length > 0 ? (
              <section
                data-onboarding-id="manager-insights-objections"
                aria-labelledby="objection-title"
                className="clara-card-outline p-5 sm:p-6"
              >
                <h2
                  id="objection-title"
                  className="text-base font-semibold clara-text-primary"
                >
                  Hal yang paling sering membuat customer ragu
                </h2>
                <p className="mt-1 text-sm clara-text-secondary">
                  Kalau keraguan yang sama muncul terus, beri arahan umum ke
                  seluruh tim.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {objectionTrends.slice(0, 6).map((item) => (
                    <li key={item.objection}>
                      <Tag>
                        {item.objection} · {item.count} chat
                      </Tag>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0" title={hint}>
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-lg font-semibold clara-text-primary">
        {value}
      </dd>
    </div>
  );
}

function DeltaTag({
  label,
  value,
  lowerIsBetter,
}: {
  label: string;
  value: number;
  lowerIsBetter?: boolean;
}) {
  if (value === 0) {
    return null;
  }
  const delta = describeDelta(value, lowerIsBetter);

  return (
    <Tag tone={delta.tone}>
      {label} {delta.text}
    </Tag>
  );
}

function SalesRow({
  item,
  isOpen,
  isLoading,
  onToggleDetail,
  onCreateAction,
}: {
  item: SalesItem;
  isOpen: boolean;
  isLoading: boolean;
  onToggleDetail: () => void;
  onCreateAction: () => void;
}) {
  // Tanda "baik" tidak perlu ditampilkan di tiap baris. Manager mencari yang bermasalah.
  const hasSignal =
    describe(SLA_STATUS, item.avg_response_sla_status).tone !== "good" ||
    describe(CRM_DISCIPLINE, item.crm_discipline_status).tone !== "good" ||
    item.trend.delta_needs_reply !== 0 ||
    item.trend.delta_overdue_follow_up !== 0 ||
    item.trend.delta_won_deals !== 0;

  return (
    <div className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold clara-text-primary">
              {item.sales_name}
            </h3>
            <ValueTag
              table={PRIORITY}
              value={item.coaching_signal.priority_label}
            />
            {item.trend.momentum_label !== "stable" ? (
              <ValueTag table={MOMENTUM} value={item.trend.momentum_label} />
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 clara-text-secondary">
            {plainJargon(item.coaching_signal.primary_reason)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleDetail}
            aria-expanded={isOpen}
            className="clara-button clara-button-primary"
          >
            {isOpen
              ? isLoading
                ? "Memuat..."
                : "Tutup detail"
              : "Lihat detail"}
          </button>
          <button
            type="button"
            onClick={onCreateAction}
            className="clara-button clara-button-secondary"
          >
            Beri tugas
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
        <Fact label="Lead aktif" value={String(item.active_leads_count)} />
        <Fact
          label="Chat belum dibalas"
          value={String(item.needs_reply_count)}
        />
        <Fact
          label="Follow-up terlambat"
          value={String(item.overdue_follow_up_count)}
        />
        <Fact label="Customer panas" value={String(item.hot_leads_count)} />
      </dl>

      {hasSignal ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {describe(SLA_STATUS, item.avg_response_sla_status).tone !==
          "good" ? (
            <ValueTag table={SLA_STATUS} value={item.avg_response_sla_status} />
          ) : null}
          {describe(CRM_DISCIPLINE, item.crm_discipline_status).tone !==
          "good" ? (
            <ValueTag
              table={CRM_DISCIPLINE}
              value={item.crm_discipline_status}
            />
          ) : null}
          <DeltaTag
            label="Belum dibalas"
            value={item.trend.delta_needs_reply}
            lowerIsBetter
          />
          <DeltaTag
            label="Terlambat"
            value={item.trend.delta_overdue_follow_up}
            lowerIsBetter
          />
          <DeltaTag label="Deal berhasil" value={item.trend.delta_won_deals} />
        </div>
      ) : null}

      <p className="mt-3 text-xs clara-text-muted">
        Yang perlu difokuskan:{" "}
        {labelOf(FOCUS_AREA, item.coaching_signal.focus_area).toLowerCase()} ·
        Aktif terakhir{" "}
        {item.latest_activity_at
          ? formatRelativeTime(item.latest_activity_at)
          : "belum ada"}{" "}
        · Skor kinerja {item.scorecard.overall_score} dari 100 (
        {labelOf(SCORE_LABEL, item.scorecard.score_label).toLowerCase()})
      </p>
    </div>
  );
}

function TeamRow({
  item,
  onCreateAction,
}: {
  item: TeamItem;
  onCreateAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold clara-text-primary">
              {item.team_name}
            </h3>
            <ValueTag
              table={PRIORITY}
              value={item.coaching_signal.priority_label}
            />
            {item.trend.momentum_label !== "stable" ? (
              <ValueTag table={MOMENTUM} value={item.trend.momentum_label} />
            ) : null}
          </div>
          <p className="mt-1 text-xs clara-text-muted">
            {item.unit_name ?? "Tanpa unit"} · Manager:{" "}
            {item.manager_user_name ?? "-"} · {item.member_count} Sales
          </p>
          <p className="mt-2 text-sm leading-6 clara-text-secondary">
            {plainJargon(item.coaching_signal.primary_reason)}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateAction}
          className="clara-button clara-button-secondary shrink-0"
        >
          Beri tugas ke tim
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
        <Fact label="Lead aktif" value={String(item.active_leads_count)} />
        <Fact
          label="Chat belum dibalas"
          value={String(item.needs_reply_count)}
        />
        <Fact
          label="Follow-up terlambat"
          value={String(item.overdue_follow_up_count)}
        />
        <Fact label="Customer panas" value={String(item.hot_leads_count)} />
      </dl>

      {item.top_sales_contributors.length > 0 ? (
        <p className="mt-3 text-xs clara-text-muted">
          Paling mewakili kondisi tim:{" "}
          {item.top_sales_contributors
            .map((sales) => sales.sales_name)
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function WeeklyList({
  title,
  items,
  emptyText,
  actionLabel,
  onAction,
}: {
  title: string;
  items: WeeklyReviewEntityItem[];
  emptyText: string;
  actionLabel: string;
  onAction: (item: WeeklyReviewEntityItem) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold clara-text-primary">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm clara-text-secondary">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${title}-${item.scope_type}-${item.sales_user_id ?? item.team_id ?? item.label}`}
              className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold clara-text-primary">
                  {item.label}
                </p>
                <ValueTag table={SCORE_LABEL} value={item.score_label} />
                <ValueTag table={MOMENTUM} value={item.trend_label} />
              </div>
              <p className="mt-1 text-sm clara-text-secondary">
                {plainJargon(item.summary)}
              </p>
              <p className="mt-1 text-xs clara-text-muted">
                Belum dibalas {item.backlog_count} · Terlambat{" "}
                {item.overdue_count} · Tugas terbuka {item.action_open_count}
              </p>
              <button
                type="button"
                onClick={() => onAction(item)}
                className="clara-button clara-button-ghost mt-2"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const id = draft.contextKey.replace(/[^a-z0-9]/gi, "");

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-4 rounded-2xl border border-clara-line bg-clara-sunken p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold clara-text-primary">Beri tugas</h4>
          <p className="mt-1 text-sm clara-text-secondary">
            Tugasnya tersimpan dan muncul di daftar Tugas untuk tim.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="clara-button clara-button-ghost"
        >
          Batal
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-type`} className="clara-label">
            Jenis tugas
          </label>
          <select
            id={`${id}-type`}
            value={draft.actionType}
            onChange={(event) =>
              onChange({ ...draft, actionType: event.target.value })
            }
            className="clara-select mt-2 w-full"
          >
            {ACTION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelOf(ACTION_TYPE, option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-priority`} className="clara-label">
            Seberapa mendesak
          </label>
          <select
            id={`${id}-priority`}
            value={draft.priorityLabel}
            onChange={(event) =>
              onChange({ ...draft, priorityLabel: event.target.value })
            }
            className="clara-select mt-2 w-full"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelOf(PRIORITY, option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-assignee`} className="clara-label">
            Diberikan kepada
          </label>
          <select
            id={`${id}-assignee`}
            value={draft.assignedToUserId}
            onChange={(event) =>
              onChange({
                ...draft,
                assignedToUserId: event.target.value,
                salesUserId: draft.salesUserId
                  ? event.target.value
                  : draft.salesUserId,
              })
            }
            className="clara-select mt-2 w-full"
          >
            <option value="">Pilih nama</option>
            {salesOptions.map((item) => (
              <option key={item.sales_user_id} value={item.sales_user_id}>
                {item.sales_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-due`} className="clara-label">
            Tenggat (boleh dikosongkan)
          </label>
          <input
            id={`${id}-due`}
            type="datetime-local"
            value={draft.dueAt}
            onChange={(event) =>
              onChange({ ...draft, dueAt: event.target.value })
            }
            className="clara-input mt-2 w-full"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-title`} className="clara-label">
          Judul tugas
        </label>
        <input
          id={`${id}-title`}
          type="text"
          value={draft.title}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
          className="clara-input mt-2 w-full"
        />
      </div>

      <div>
        <label htmlFor={`${id}-desc`} className="clara-label">
          Apa yang perlu dilakukan?
        </label>
        <textarea
          id={`${id}-desc`}
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
          className="clara-textarea mt-2 min-h-[110px] w-full"
        />
      </div>

      <button
        type="submit"
        disabled={
          isSubmitting || !draft.assignedToUserId || !draft.title.trim()
        }
        className="clara-button clara-button-primary"
      >
        {isSubmitting ? "Menyimpan..." : "Simpan tugas"}
      </button>
    </form>
  );
}

function SalesDetailPanel({
  detail,
}: {
  detail: SalesPerformanceDetailResponse;
}) {
  const summary = detail.summary;
  const teamLabel = [detail.sales_user.team_name, detail.sales_user.unit_name]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-4 rounded-2xl border border-clara-line bg-clara-sunken p-4 sm:p-5">
      <div>
        <h4 className="text-lg font-bold clara-text-primary">
          {detail.sales_user.name}
        </h4>
        <p className="mt-1 text-xs clara-text-muted">
          {teamLabel || "Tanpa tim"} ·{" "}
          {detail.sales_user.is_active ? "Aktif" : "Nonaktif"} · periode{" "}
          {describeRangeLabel(summary.range_label)} dibanding{" "}
          {describeRangeLabel(summary.previous_range_label)}
        </p>
      </div>

      <div className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
        <p className="text-sm font-semibold clara-text-primary">
          {plainJargon(summary.coaching_signal.primary_reason)}
        </p>
        <p className="mt-1 text-sm clara-text-secondary">
          {plainJargon(summary.coaching_signal.recommended_action)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
        <Fact label="Lead aktif" value={String(summary.active_leads_count)} />
        <Fact
          label="Chat belum dibalas"
          value={String(summary.needs_reply_count)}
        />
        <Fact
          label="Follow-up terlambat"
          value={String(summary.overdue_follow_up_count)}
        />
        <Fact label="Customer panas" value={String(summary.hot_leads_count)} />
        <Fact
          label="Chat yang sudah dibaca Clara"
          value={`${summary.analyzed_conversations_count} dari ${summary.analyzed_conversations_count + summary.needs_analysis_count}`}
        />
        <Fact label="Deal berhasil" value={String(summary.won_deals_count)} />
        <Fact label="Deal batal" value={String(summary.lost_deals_count)} />
        <Fact label="Deal berjalan" value={String(summary.open_deals_count)} />
      </dl>

      <div className="grid gap-4 xl:grid-cols-3">
        <DetailList
          title="Lead Sales ini"
          emptyText="Belum ada lead."
          items={detail.lead_items.map((item) => (
            <Link
              key={item.lead_id}
              href={item.target_href}
              className="block rounded-2xl border border-clara-line-subtle bg-clara-raised p-3 hover:border-clara-gold"
            >
              <p className="text-sm font-semibold clara-text-primary">
                {item.lead_name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ValueTag table={STAGE} value={item.current_stage} />
                <ValueTag table={TEMPERATURE} value={item.lead_temperature} />
              </div>
              <p className="mt-1 text-xs clara-text-muted">
                Terakhir dihubungi {formatRelativeTime(item.last_contact_at)} ·
                follow-up{" "}
                {item.next_follow_up_at
                  ? formatDateTime(item.next_follow_up_at)
                  : "belum dijadwalkan"}
              </p>
            </Link>
          ))}
        />

        <DetailList
          title="Chat yang perlu perhatian"
          emptyText="Tidak ada chat yang perlu perhatian khusus."
          items={detail.conversation_items.map((item) => (
            <Link
              key={item.conversation_id}
              href={item.target_href}
              className="block rounded-2xl border border-clara-line-subtle bg-clara-raised p-3 hover:border-clara-gold"
            >
              <p className="text-sm font-semibold clara-text-primary">
                {item.conversation_title}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ValueTag table={REPLY_STATE} value={item.ui_status} />
                {item.risk_level === "high" ? (
                  <Tag tone="danger">Risiko tinggi</Tag>
                ) : null}
              </div>
              <p className="mt-1 text-xs clara-text-muted">
                {formatChannelLabel(item.source_channel)} · pesan terakhir{" "}
                {formatRelativeTime(item.last_message_at)}
              </p>
            </Link>
          ))}
        />

        <DetailList
          title="Follow-up yang terlambat"
          emptyText="Tidak ada follow-up yang terlambat."
          items={detail.follow_up_items.map((item) => (
            <Link
              key={item.lead_id}
              href={item.target_href}
              className="block rounded-2xl border border-clara-line-subtle bg-clara-raised p-3 hover:border-clara-gold"
            >
              <p className="text-sm font-semibold clara-text-primary">
                {item.lead_name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ValueTag table={PRIORITY} value={item.priority_label} />
              </div>
              <p className="mt-1 text-xs clara-text-muted">
                Jatuh tempo {item.due_at ? formatDateTime(item.due_at) : "-"}
              </p>
            </Link>
          ))}
        />
      </div>
    </section>
  );
}

function DetailList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: React.ReactNode[];
}) {
  return (
    <section className="min-w-0">
      <h5 className="text-sm font-semibold clara-text-primary">{title}</h5>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm clara-text-secondary">{emptyText}</p>
        ) : (
          items
        )}
      </div>
    </section>
  );
}
