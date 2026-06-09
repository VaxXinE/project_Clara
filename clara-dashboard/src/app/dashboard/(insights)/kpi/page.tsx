"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { canAccessStrategicInsights } from "@/lib/roles";
import type {
  CurrentUser,
  KpiAlertHistoryResponse,
  KpiCommandCenterResponse,
  KpiSnapshotHistoryResponse,
} from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua Channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
] as const;

function numberOrZero(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatIdr(value: number | undefined | null): string {
  return `IDR ${numberOrZero(value).toLocaleString("id-ID")}`;
}

function formatPercent(value: number | undefined | null): string {
  return `${(numberOrZero(value) * 100).toFixed(0)}%`;
}

export default function KpiCommandCenterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [alertHistory, setAlertHistory] =
    useState<KpiAlertHistoryResponse | null>(null);
  const [snapshotHistory, setSnapshotHistory] =
    useState<KpiSnapshotHistoryResponse | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<
    Record<string, string>
  >({});
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadKpiPage = useCallback(async () => {
    try {
      const kpiPath =
        sourceChannelFilter === "all"
          ? "/dashboard/kpi/command-center"
          : `/dashboard/kpi/command-center?source_channel=${encodeURIComponent(
              sourceChannelFilter,
            )}`;
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessStrategicInsights(me.role)) {
        router.replace("/dashboard");
        return;
      }

      const [kpiResponse, alertsResponse, snapshotsResponse] =
        await Promise.all([
          apiFetch<KpiCommandCenterResponse>(kpiPath),
          apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
          apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
        ]);
      setKpi(kpiResponse);
      setAlertHistory(alertsResponse);
      setSnapshotHistory(snapshotsResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat KPI command center.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, sourceChannelFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await loadKpiPage();
        } catch {
          // loadKpiPage already mengatur error state.
        }
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadKpiPage]);

  async function reloadAlertHistory() {
    const alertsResponse = await apiFetch<KpiAlertHistoryResponse>(
      "/dashboard/kpi/alerts",
    );
    setAlertHistory(alertsResponse);
  }

  async function handleRefreshSnapshot() {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const refreshPath =
        sourceChannelFilter === "all"
          ? "/dashboard/kpi/command-center/refresh"
          : `/dashboard/kpi/command-center/refresh?source_channel=${encodeURIComponent(
              sourceChannelFilter,
            )}`;
      const refreshed = await apiFetch<KpiCommandCenterResponse>(refreshPath, {
        method: "POST",
      });
      setKpi(refreshed);
      const [alertsResponse, snapshotsResponse] = await Promise.all([
        apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
        apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
      ]);
      setAlertHistory(alertsResponse);
      setSnapshotHistory(snapshotsResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal me-refresh snapshot KPI.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    try {
      await apiFetch(`/dashboard/kpi/alerts/${alertId}/acknowledge`, {
        method: "PATCH",
      });
      await reloadAlertHistory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal acknowledge alert.",
      );
    }
  }

  async function handleResolveAlert(alertId: string) {
    try {
      await apiFetch(`/dashboard/kpi/alerts/${alertId}/resolve`, {
        method: "PATCH",
        body: {
          resolution_note: resolutionNotes[alertId]?.trim() || null,
        },
      });
      setResolutionNotes((current) => ({
        ...current,
        [alertId]: "",
      }));
      await reloadAlertHistory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal resolve alert.",
      );
    }
  }

  async function handleReopenAlert(alertId: string) {
    try {
      await apiFetch(`/dashboard/kpi/alerts/${alertId}/reopen`, {
        method: "PATCH",
      });
      await reloadAlertHistory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal reopen alert.",
      );
    }
  }

  const topSales = kpi?.sales_performance.slice(0, 3) ?? [];
  const topSources = kpi?.source_performance.slice(0, 4) ?? [];
  const topOrganizations = kpi?.organization_performance.slice(0, 6) ?? [];
  const activeAlerts = alertHistory?.items.slice(0, 6) ?? [];
  const latestSnapshots = snapshotHistory?.items.slice(0, 6) ?? [];

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="KPI foundation"
      title="Ops Dashboard"
      description="Superadmin dan head bisa membaca kesehatan pipeline, produktivitas sales, dan performa organization dari data conversation yang benar-benar sudah ada."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {kpi ? (
            <div className="rounded-full border border-[#f0cb73]/18 bg-[#1d150d] px-4 py-2.5 text-sm text-[#d6bb84]">
              Generated: {formatDateTime(kpi.generated_at)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleRefreshSnapshot();
            }}
            disabled={isRefreshing}
            className="clara-button clara-button-primary"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Snapshot"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="clara-empty-state p-8 text-center text-sm text-[#d6bb84]">
            Loading KPI command center...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5 text-sm text-[#f0cb73]">
            {errorMessage}
          </div>
        ) : null}

        {kpi && !isLoading && !errorMessage ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <SectionPanel
                eyebrow="Executive Summary"
                title="Health snapshot"
                description="Pandangan pertama untuk membaca tekanan operasional, risiko momentum, dan kualitas eksekusi tim."
                action={<Badge label={kpi.scope_type} />}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Total Leads"
                    value={String(kpi.summary.total_leads)}
                    hint="Lead yang sudah tercatat di CRM."
                    tone="highlight"
                  />
                  <MetricCard
                    label="Hot Leads"
                    value={String(kpi.summary.hot_leads)}
                    hint="Prospect yang perlu digerakkan cepat."
                    tone="highlight"
                  />
                  <MetricCard
                    label="Reply Sent Rate"
                    value={formatPercent(kpi.summary.reply_sent_rate)}
                    hint="Conversation yang sudah punya reply final."
                  />
                  <MetricCard
                    label="Overdue Follow-up"
                    value={String(kpi.summary.overdue_follow_ups)}
                    hint="Follow-up yang sudah lewat jadwal."
                  />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
                  <div className="space-y-3">
                    <SummaryRow
                      label="Organizations"
                      value={String(kpi.summary.total_organizations)}
                    />
                    <SummaryRow
                      label="Sales users"
                      value={String(kpi.summary.total_sales_users)}
                    />
                    <SummaryRow
                      label="Closing leads"
                      value={String(kpi.summary.closing_leads)}
                    />
                    <SummaryRow
                      label="Analyzed conversations"
                      value={String(kpi.summary.analyzed_conversations)}
                    />
                    <SummaryRow
                      label="Approved reply rate"
                      value={formatPercent(kpi.summary.approved_reply_rate)}
                    />
                    <SummaryRow
                      label="Win rate"
                      value={formatPercent(kpi.summary.win_rate)}
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[linear-gradient(180deg,rgba(26,19,13,0.98)_0%,rgba(16,12,9,0.98)_100%)] p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                      Observations
                    </p>
                    <div className="mt-4 space-y-3">
                      {kpi.key_observations.length === 0 ? (
                        <EmptyState text="Belum ada observasi utama yang cukup kuat untuk ditampilkan." />
                      ) : (
                        kpi.key_observations.map((item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-[#f0cb73]/12 bg-[#1b130c] p-4 text-sm leading-6 text-[#fff0c9]"
                          >
                            {item}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionPanel>

              <div className="space-y-6">
                <SectionPanel
                  eyebrow="Control Rail"
                  title="Filter and actions"
                  description="Gunakan rail ini untuk mengganti scope channel, refresh snapshot, dan lompat ke area eksekusi terkait."
                >
                  <div className="space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                        Source Channel
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SOURCE_CHANNEL_OPTIONS.map((option) => {
                          const isActive = sourceChannelFilter === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setSourceChannelFilter(option.value);
                              }}
                              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                                isActive
                                  ? "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                  : "border border-[#3c2c16] bg-[#22190f] text-[#e1c27c] hover:border-[#f0cb73]/28"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SummaryTile
                        label="Pipeline Value"
                        value={formatIdr(kpi.summary.pipeline_value)}
                      />
                      <SummaryTile
                        label="Won Value"
                        value={formatIdr(kpi.summary.won_value)}
                      />
                      <SummaryTile
                        label="Deposit"
                        value={formatIdr(kpi.summary.deposit_amount)}
                      />
                      <SummaryTile
                        label="Exec Actions"
                        value={String(kpi.recommendations.length)}
                      />
                    </div>

                    <div className="grid gap-3">
                      <QuickLink
                        href="/dashboard/follow-up"
                        label="Buka Worklist"
                        description="Eksekusi follow-up yang sudah overdue atau tertahan."
                      />
                      <QuickLink
                        href="/dashboard/marketing"
                        label="Buka Marketing Insights"
                        description="Bandingkan output marketing terhadap performa pipeline."
                      />
                      <QuickLink
                        href="/dashboard/notifications"
                        label="Buka Notification Center"
                        description="Pantau alert yang aktif lintas modul."
                      />
                    </div>
                  </div>
                </SectionPanel>

                <SectionPanel
                  eyebrow="Marketing Attribution"
                  title="Attribution pulse"
                  description="Membaca kontribusi marketing terhadap lead, won value, dan deposit."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryTile
                      label="Leads Generated"
                      value={String(
                        kpi.marketing_execution_summary.leads_generated,
                      )}
                    />
                    <SummaryTile
                      label="Won Leads"
                      value={String(kpi.marketing_execution_summary.won_leads)}
                    />
                    <SummaryTile
                      label="Attributed Won"
                      value={formatIdr(
                        kpi.marketing_execution_summary.attributed_won_value,
                      )}
                    />
                    <SummaryTile
                      label="Attributed Deposit"
                      value={formatIdr(
                        kpi.marketing_execution_summary
                          .attributed_deposit_amount,
                      )}
                    />
                  </div>
                </SectionPanel>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Pipeline Value"
                value={formatIdr(kpi.summary.pipeline_value)}
                hint="Total nilai deal yang masih terbuka."
              />
              <MetricCard
                label="Won Value"
                value={formatIdr(kpi.summary.won_value)}
                hint="Nilai deal yang sudah dimenangkan tim."
              />
              <MetricCard
                label="Deposit Amount"
                value={formatIdr(kpi.summary.deposit_amount)}
                hint="Akumulasi deposit yang sudah tercatat."
              />
              <MetricCard
                label="Win Rate"
                value={formatPercent(kpi.summary.win_rate)}
                hint="Proporsi deal won terhadap closed deal."
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <SectionPanel
                eyebrow="Sales Leaderboard"
                title="Produktivitas per sales"
                description="Urutkan energi tim dari volume reply ke nilai pipeline dan deal yang benar-benar jadi."
                className="h-full"
                bodyClassName="flex-1"
                action={
                  <Link
                    href="/dashboard/follow-up"
                    className="clara-button clara-button-ghost"
                  >
                    Buka Worklist
                  </Link>
                }
              >
                <div className="h-full space-y-4">
                  {topSales.length === 0 ? (
                    <EmptyState
                      text="Belum ada data sales yang cukup untuk dirangking."
                      className="flex h-full min-h-[240px] items-center justify-center"
                    />
                  ) : (
                    topSales.map((row, index) => (
                      <article
                        key={row.user_id}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
                              Rank {index + 1}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-[#fff0c9]">
                              {row.user_name}
                            </h3>
                            <p className="mt-1 text-sm text-[#b89a62]">
                              {row.organization_name ?? "No organization"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(28,21,14,0.96)_0%,rgba(16,12,9,0.98)_100%)] px-4 py-3 text-right text-[#fff0c9]">
                            <p className="text-xs uppercase tracking-[0.16em] text-[#f0cb73]">
                              Replies Sent
                            </p>
                            <p className="mt-1 text-2xl font-bold">
                              {row.replies_sent}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <SummaryTile
                            label="Assigned Leads"
                            value={String(row.assigned_leads)}
                          />
                          <SummaryTile
                            label="Hot Leads"
                            value={String(row.hot_leads)}
                          />
                          <SummaryTile
                            label="Closing Leads"
                            value={String(row.closing_leads)}
                          />
                          <SummaryTile
                            label="Won Leads"
                            value={String(row.won_leads)}
                          />
                          <SummaryTile
                            label="Overdue"
                            value={String(row.overdue_follow_ups)}
                          />
                          <SummaryTile
                            label="Owned Conv"
                            value={String(row.conversations_owned)}
                          />
                          <SummaryTile
                            label="Analyzed"
                            value={String(row.analyzed_conversations)}
                          />
                          <SummaryTile
                            label="Approved Drafts"
                            value={String(row.approved_drafts)}
                          />
                          <SummaryTile
                            label="Pipeline"
                            value={formatIdr(row.pipeline_value)}
                          />
                          <SummaryTile
                            label="Won Value"
                            value={formatIdr(row.won_value)}
                          />
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>

              <SectionPanel
                eyebrow="Executive Actions"
                title="Tindakan prioritas"
                description="Rekomendasi yang bisa langsung dijalankan oleh superadmin dan head."
              >
                <div className="space-y-4">
                  {kpi.recommendations.length === 0 ? (
                    <EmptyState text="Belum ada rekomendasi aksi yang cukup kuat." />
                  ) : (
                    kpi.recommendations.map((recommendation) => (
                      <article
                        key={`${recommendation.owner_role}-${recommendation.title}`}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge label={recommendation.owner_role} />
                          <h3 className="text-base font-semibold text-[#fff0c9]">
                            {recommendation.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                          {recommendation.rationale}
                        </p>
                        <div className="mt-4 rounded-2xl bg-[linear-gradient(180deg,rgba(28,21,14,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-4 text-[#fff0c9]">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cb73]">
                            Next step
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#fff0c9]">
                            {recommendation.next_step}
                          </p>
                        </div>
                        {recommendation.target_href ? (
                          <Link
                            href={recommendation.target_href}
                            className="mt-4 inline-flex rounded-xl border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105"
                          >
                            Jalankan sekarang
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <SectionPanel
                eyebrow="Live Alerts"
                title="Anomali yang perlu perhatian"
                description="Alert real-time dari snapshot aktif, sebelum masuk ke histori persistent."
              >
                <div className="space-y-4">
                  {kpi.alerts.length === 0 ? (
                    <EmptyState text="Belum ada alert yang cukup kuat untuk ditampilkan." />
                  ) : (
                    kpi.alerts.map((alert) => (
                      <article
                        key={`${alert.severity}-${alert.title}`}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                              alert.severity === "high"
                                ? "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                : "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <h3 className="text-base font-semibold text-[#fff0c9]">
                            {alert.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                          {alert.description}
                        </p>
                        <div className="mt-4 rounded-2xl bg-[#1d150d] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cb73]">
                            Recommended action
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#fff0c9]">
                            {alert.recommended_action}
                          </p>
                        </div>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="mt-4 inline-flex rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                          >
                            Buka area terkait
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>

              <SectionPanel
                eyebrow="Source Performance"
                title="Per source dan channel"
                description="Membandingkan sumber lead yang paling sehat dan yang paling banyak menyumbat pipeline."
                action={
                  <Badge label={`${kpi.source_performance.length} sources`} />
                }
              >
                <div className="space-y-4">
                  {topSources.length === 0 ? (
                    <EmptyState text="Belum ada data source yang cukup untuk dibandingkan." />
                  ) : (
                    topSources.map((row) => (
                      <article
                        key={row.source_key}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-[#fff0c9]">
                              {row.source_label}
                            </h3>
                            <p className="mt-1 text-sm text-[#b89a62]">
                              Channel: {row.source_channel}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge label={`Leads ${row.lead_count}`} />
                            <Badge label={`Conv ${row.conversation_count}`} />
                            <Badge label={`Hot ${row.hot_leads}`} />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <SummaryTile
                            label="Analyzed"
                            value={String(row.analyzed_conversations)}
                          />
                          <SummaryTile
                            label="Reply Sent Rate"
                            value={formatPercent(row.reply_sent_rate)}
                          />
                          <SummaryTile
                            label="Pipeline Value"
                            value={formatIdr(row.pipeline_value)}
                          />
                          <SummaryTile
                            label="Won Value"
                            value={formatIdr(row.won_value)}
                          />
                          <SummaryTile
                            label="Source Key"
                            value={row.source_key}
                          />
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionPanel
                eyebrow="Persistent Alerts"
                title="Riwayat alert yang tersimpan"
                description="Workflow acknowledge, resolve, dan reopen untuk alert yang sudah dipersist ke database."
                action={
                  alertHistory ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge label={`Active ${alertHistory.active_count}`} />
                      <Badge label={`Ack ${alertHistory.acknowledged_count}`} />
                      <Badge
                        label={`Resolved ${alertHistory.resolved_count}`}
                      />
                    </div>
                  ) : null
                }
              >
                <div className="space-y-4">
                  {activeAlerts.length === 0 ? (
                    <EmptyState text="Belum ada alert yang tersimpan. Jalankan refresh snapshot untuk mulai menyimpan alert historis." />
                  ) : (
                    activeAlerts.map((alert) => (
                      <article
                        key={alert.id}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge label={alert.status} />
                            <Badge label={alert.severity} />
                            <h3 className="text-base font-semibold text-[#fff0c9]">
                              {alert.title}
                            </h3>
                          </div>
                          {alert.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleAcknowledgeAlert(alert.id);
                              }}
                              className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                            >
                              Acknowledge
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                          {alert.description}
                        </p>
                        <div className="mt-4 rounded-2xl bg-[#1d150d] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cb73]">
                            Recommended action
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#fff0c9]">
                            {alert.recommended_action}
                          </p>
                        </div>
                        {alert.resolution_note ? (
                          <div className="mt-4 rounded-2xl border border-[#f0cb73]/16 bg-[#1d150d] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cb73]">
                              Resolution note
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#fff0c9]">
                              {alert.resolution_note}
                            </p>
                          </div>
                        ) : null}
                        {alert.status !== "resolved" ? (
                          <div className="mt-4 space-y-3">
                            <textarea
                              value={resolutionNotes[alert.id] ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setResolutionNotes((current) => ({
                                  ...current,
                                  [alert.id]: value,
                                }));
                              }}
                              placeholder="Catatan resolusi opsional sebelum alert ditutup..."
                              className="min-h-[96px] w-full rounded-2xl border border-[#4a3618] bg-[#1a130d] px-4 py-3 text-sm leading-6 text-[#f7e7b7] outline-none transition placeholder:text-[#907953] focus:border-[#f0cb73]/28"
                            />
                            <div className="flex flex-wrap gap-3">
                              {alert.status === "active" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleAcknowledgeAlert(alert.id);
                                  }}
                                  className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                                >
                                  Acknowledge
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  void handleResolveAlert(alert.id);
                                }}
                                className="rounded-xl border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105"
                              >
                                Resolve
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <p className="text-xs text-[#b89a62]">
                              Resolved:{" "}
                              {alert.resolved_at
                                ? formatDateTime(alert.resolved_at)
                                : "-"}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                void handleReopenAlert(alert.id);
                              }}
                              className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                            >
                              Reopen
                            </button>
                          </div>
                        )}
                        <p className="mt-3 text-xs text-[#b89a62]">
                          First detected:{" "}
                          {formatDateTime(alert.first_detected_at)} | Last
                          detected: {formatDateTime(alert.last_detected_at)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>

              <SectionPanel
                eyebrow="Snapshot History"
                title="Jejak KPI yang tersimpan"
                description="Riwayat snapshot dipakai untuk membaca perubahan kesehatan pipeline dari waktu ke waktu."
              >
                <div className="space-y-4">
                  {latestSnapshots.length === 0 ? (
                    <EmptyState text="Belum ada snapshot yang tersimpan. Jalankan refresh snapshot untuk mulai merekam histori KPI." />
                  ) : (
                    latestSnapshots.map((snapshot, index) => (
                      <article
                        key={snapshot.id}
                        className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
                              Snapshot {latestSnapshots.length - index}
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-[#fff0c9]">
                              {formatDateTime(snapshot.created_at)}
                            </h3>
                          </div>
                          <Badge label={snapshot.scope_type} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <SummaryTile
                            label="Total Leads"
                            value={String(snapshot.metrics_json.total_leads)}
                          />
                          <SummaryTile
                            label="Hot Leads"
                            value={String(snapshot.metrics_json.hot_leads)}
                          />
                          <SummaryTile
                            label="Reply Sent Rate"
                            value={formatPercent(
                              snapshot.metrics_json.reply_sent_rate,
                            )}
                          />
                          <SummaryTile
                            label="Overdue"
                            value={String(
                              snapshot.metrics_json.overdue_follow_ups,
                            )}
                          />
                          <SummaryTile
                            label="Won Value"
                            value={formatIdr(snapshot.metrics_json.won_value)}
                          />
                          <SummaryTile
                            label="Deposit"
                            value={formatIdr(
                              snapshot.metrics_json.deposit_amount,
                            )}
                          />
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </SectionPanel>
            </section>

            <SectionPanel
              eyebrow="Organization Health"
              title="Pipeline readiness per organization"
              description="Melihat organisasi mana yang paling sehat, paling padat, atau paling tertahan di approval dan follow-up."
              action={
                <Link
                  href="/dashboard/marketing"
                  className="clara-button clara-button-ghost"
                >
                  Buka Marketing Insights
                </Link>
              }
            >
              <div className="space-y-4">
                {topOrganizations.length === 0 ? (
                  <EmptyState text="Belum ada organization performance yang cukup untuk ditampilkan." />
                ) : (
                  topOrganizations.map((row) => (
                    <article
                      key={row.organization_id}
                      className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-[#fff0c9]">
                          {row.organization_name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge label={`Leads ${row.total_leads}`} />
                          <Badge label={`Hot ${row.hot_leads}`} />
                          <Badge label={`Closing ${row.closing_leads}`} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <SummaryTile
                          label="Conversations"
                          value={String(row.conversations)}
                        />
                        <SummaryTile
                          label="Analyzed"
                          value={String(row.analyzed_conversations)}
                        />
                        <SummaryTile
                          label="Won Leads"
                          value={String(row.won_leads)}
                        />
                        <SummaryTile
                          label="Reply Sent Rate"
                          value={formatPercent(row.reply_sent_rate)}
                        />
                        <SummaryTile
                          label="Approved Reply Rate"
                          value={formatPercent(row.approved_reply_rate)}
                        />
                        <SummaryTile
                          label="Overdue"
                          value={String(row.overdue_follow_ups)}
                        />
                        <SummaryTile
                          label="Pipeline Value"
                          value={formatIdr(row.pipeline_value)}
                        />
                        <SummaryTile
                          label="Won Value"
                          value={formatIdr(row.won_value)}
                        />
                        <SummaryTile
                          label="Deposit"
                          value={formatIdr(row.deposit_amount)}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SectionPanel>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function SectionPanel({
  eyebrow,
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.22)] ${className ?? ""}`.trim()}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-[#fff0c9]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d6bb84]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className={`mt-5 ${bodyClassName ?? ""}`.trim()}>{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "highlight";
}) {
  if (tone === "highlight") {
    return (
      <article className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">
          {label}
        </p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-[#140f08]">
          {value}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#2f210f]">{hint}</p>
      </article>
    );
  }

  return (
    <article className="clara-card rounded-[24px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#fff0c9]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{hint}</p>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft flex items-center justify-between rounded-2xl px-4 py-3">
      <span className="text-sm text-[#d6bb84]">{label}</span>
      <span className="text-sm font-semibold text-[#fff0c9]">{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl px-4 py-3">
      <p className="clara-kicker text-xs text-[#b89a62]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#fff0c9] break-words">
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[22px] border border-[#f0cb73]/14 bg-[linear-gradient(180deg,rgba(27,20,14,0.94)_0%,rgba(18,13,10,0.98)_100%)] p-4 hover:border-[#f0cb73]/26"
    >
      <p className="text-sm font-semibold text-[#fff0c9]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#d6bb84]">{description}</p>
    </Link>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="clara-chip clara-chip-neutral px-3 py-1 text-xs">
      {label}
    </span>
  );
}

function EmptyState({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={`clara-empty-state p-5 text-sm text-[#d6bb84] ${className ?? ""}`.trim()}
    >
      {text}
    </div>
  );
}
