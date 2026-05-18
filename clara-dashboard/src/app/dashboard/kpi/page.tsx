"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [alertHistory, setAlertHistory] = useState<KpiAlertHistoryResponse | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<KpiSnapshotHistoryResponse | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadKpiPage() {
    try {
      const kpiPath =
        sourceChannelFilter === "all"
          ? "/dashboard/kpi/command-center"
          : `/dashboard/kpi/command-center?source_channel=${encodeURIComponent(
              sourceChannelFilter
            )}`;
      const [me, kpiResponse, alertsResponse, snapshotsResponse] =
        await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<KpiCommandCenterResponse>(kpiPath),
          apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
          apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
        ]);
      setCurrentUser(me);
      setKpi(kpiResponse);
      setAlertHistory(alertsResponse);
      setSnapshotHistory(snapshotsResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat KPI command center."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadKpiPage();
  }, [sourceChannelFilter]);

  async function reloadAlertHistory() {
    const alertsResponse = await apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts");
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
              sourceChannelFilter
            )}`;
      const refreshed = await apiFetch<KpiCommandCenterResponse>(
        refreshPath,
        { method: "POST" }
      );
      setKpi(refreshed);
      const [alertsResponse, snapshotsResponse] = await Promise.all([
        apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
        apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
      ]);
      setAlertHistory(alertsResponse);
      setSnapshotHistory(snapshotsResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal me-refresh snapshot KPI."
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
        error instanceof Error ? error.message : "Gagal acknowledge alert."
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
        error instanceof Error ? error.message : "Gagal resolve alert."
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
        error instanceof Error ? error.message : "Gagal reopen alert."
      );
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="KPI foundation"
      title="KPI Command Center"
      description="Owner dan admin bisa membaca kesehatan pipeline, produktivitas sales, dan performa organization dari data conversation yang benar-benar sudah ada."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {kpi ? (
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
              Generated: {formatDateTime(kpi.generated_at)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleRefreshSnapshot();
            }}
            disabled={isRefreshing}
            className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Snapshot"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading KPI command center...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {kpi && !isLoading && !errorMessage && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Leads"
                value={String(kpi.summary.total_leads)}
                hint="Jumlah lead yang sudah masuk lapisan CRM Clara."
              />
              <MetricCard
                label="Hot Leads"
                value={String(kpi.summary.hot_leads)}
                hint="Lead yang paling dekat ke tindakan cepat atau closing."
              />
              <MetricCard
                label="Reply Sent Rate"
                value={formatPercent(kpi.summary.reply_sent_rate)}
                hint="Persentase conversation yang sudah punya balasan final terkirim."
              />
              <MetricCard
                label="Overdue Follow-up"
                value={String(kpi.summary.overdue_follow_ups)}
                hint="Follow-up yang sudah lewat jadwal dan berisiko kehilangan momentum."
              />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Filter Channel
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Summary KPI live bisa difokuskan ke WhatsApp atau Telegram.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                            ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Pipeline Value"
                value={formatIdr(kpi.summary.pipeline_value)}
                hint="Total nilai deal yang masih terbuka dan perlu dijaga sampai close."
              />
              <MetricCard
                label="Won Value"
                value={formatIdr(kpi.summary.won_value)}
                hint="Nilai deal yang sudah resmi dimenangkan oleh tim."
              />
              <MetricCard
                label="Deposit Amount"
                value={formatIdr(kpi.summary.deposit_amount)}
                hint="Akumulasi deposit yang sudah tercatat dari lead aktif dan deal selesai."
              />
              <MetricCard
                label="Win Rate"
                value={formatPercent(kpi.summary.win_rate)}
                hint="Persentase deal won dibanding deal yang sudah benar-benar closed."
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Executive Summary
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                      Health snapshot
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {kpi.scope_type}
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
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
                    label="Pipeline value"
                    value={formatIdr(kpi.summary.pipeline_value)}
                  />
                  <SummaryRow
                    label="Won value"
                    value={formatIdr(kpi.summary.won_value)}
                  />
                  <SummaryRow
                    label="Deposit amount"
                    value={formatIdr(kpi.summary.deposit_amount)}
                  />
                  <SummaryRow
                    label="Win rate"
                    value={formatPercent(kpi.summary.win_rate)}
                  />
                </div>

                <div className="mt-6 rounded-[24px] bg-slate-950 p-5 text-white">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Observations
                  </p>
                  <div className="mt-4 space-y-3">
                    {kpi.key_observations.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-100"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Sales Leaderboard
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                      Produktivitas per sales
                    </h2>
                  </div>
                  <Link
                    href="/dashboard/follow-up"
                    className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                  >
                    Buka Worklist
                  </Link>
                </div>

                <div className="mt-5 space-y-4">
                  {kpi.sales_performance.length === 0 ? (
                    <EmptyState text="Belum ada data sales yang cukup untuk dirangking." />
                  ) : (
                    kpi.sales_performance.map((row, index) => (
                      <article
                        key={row.user_id}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Rank {index + 1}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-950">
                              {row.user_name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {row.organization_name ?? "No organization"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                              Replies Sent
                            </p>
                            <p className="mt-1 text-2xl font-bold">{row.replies_sent}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <SummaryTile label="Assigned Leads" value={String(row.assigned_leads)} />
                          <SummaryTile label="Hot Leads" value={String(row.hot_leads)} />
                          <SummaryTile label="Closing Leads" value={String(row.closing_leads)} />
                          <SummaryTile label="Won Leads" value={String(row.won_leads)} />
                          <SummaryTile label="Owned Conversations" value={String(row.conversations_owned)} />
                          <SummaryTile label="Analyzed" value={String(row.analyzed_conversations)} />
                          <SummaryTile label="Overdue Follow-up" value={String(row.overdue_follow_ups)} />
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
              </section>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Source Performance
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    Performa pipeline per source dan channel
                  </h2>
                </div>
                <Badge label={`${kpi.source_performance.length} sources`} />
              </div>

              <div className="mt-5 space-y-4">
                {kpi.source_performance.length === 0 ? (
                  <EmptyState text="Belum ada data source yang cukup untuk dibandingkan." />
                ) : (
                  kpi.source_performance.map((row) => (
                    <article
                      key={row.source_key}
                      className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {row.source_label}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Channel: {row.source_channel}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge label={`Leads ${row.lead_count}`} />
                          <Badge label={`Conv ${row.conversation_count}`} />
                          <Badge label={`Hot ${row.hot_leads}`} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
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
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Alerts
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  Anomali dan warning yang butuh perhatian
                </h2>

                <div className="mt-5 space-y-4">
                  {kpi.alerts.length === 0 ? (
                    <EmptyState text="Belum ada alert yang cukup kuat untuk ditampilkan." />
                  ) : (
                    kpi.alerts.map((alert) => (
                      <article
                        key={`${alert.severity}-${alert.title}`}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                              alert.severity === "high"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <h3 className="text-base font-semibold text-slate-950">
                            {alert.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {alert.description}
                        </p>
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Recommended action
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {alert.recommended_action}
                          </p>
                        </div>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="mt-4 inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                          >
                            Buka area terkait
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Executive Actions
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  Rekomendasi tindakan untuk owner dan admin
                </h2>

                <div className="mt-5 space-y-4">
                  {kpi.recommendations.length === 0 ? (
                    <EmptyState text="Belum ada rekomendasi aksi yang cukup kuat." />
                  ) : (
                    kpi.recommendations.map((recommendation) => (
                      <article
                        key={`${recommendation.owner_role}-${recommendation.title}`}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                            {recommendation.owner_role}
                          </span>
                          <h3 className="text-base font-semibold text-slate-950">
                            {recommendation.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {recommendation.rationale}
                        </p>
                        <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                            Next step
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-100">
                            {recommendation.next_step}
                          </p>
                        </div>
                        {recommendation.target_href ? (
                          <Link
                            href={recommendation.target_href}
                            className="mt-4 inline-flex rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Jalankan sekarang
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Persistent Alerts
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                      Riwayat alert yang tersimpan
                    </h2>
                  </div>
                  {alertHistory ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge label={`Active ${alertHistory.active_count}`} />
                      <Badge label={`Ack ${alertHistory.acknowledged_count}`} />
                      <Badge label={`Resolved ${alertHistory.resolved_count}`} />
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  {alertHistory && alertHistory.items.length > 0 ? (
                    alertHistory.items.slice(0, 8).map((alert) => (
                      <article
                        key={alert.id}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                              {alert.status}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                              {alert.severity}
                            </span>
                            <h3 className="text-base font-semibold text-slate-950">
                              {alert.title}
                            </h3>
                          </div>
                          {alert.status === "active" && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleAcknowledgeAlert(alert.id);
                              }}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {alert.description}
                        </p>
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Recommended action
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {alert.recommended_action}
                          </p>
                        </div>
                        {alert.resolution_note ? (
                          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                              Resolution note
                            </p>
                            <p className="mt-2 text-sm leading-6 text-emerald-900">
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
                              className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400"
                            />
                            <div className="flex flex-wrap gap-3">
                              {alert.status === "active" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleAcknowledgeAlert(alert.id);
                                  }}
                                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                                >
                                  Acknowledge
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  void handleResolveAlert(alert.id);
                                }}
                                className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                Resolve
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <p className="text-xs text-slate-500">
                              Resolved: {alert.resolved_at ? formatDateTime(alert.resolved_at) : "-"}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                void handleReopenAlert(alert.id);
                              }}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                            >
                              Reopen
                            </button>
                          </div>
                        )}
                        <p className="mt-3 text-xs text-slate-500">
                          First detected: {formatDateTime(alert.first_detected_at)} • Last detected:{" "}
                          {formatDateTime(alert.last_detected_at)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="Belum ada alert yang tersimpan. Jalankan refresh snapshot untuk mulai menyimpan alert historis." />
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Snapshot History
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  Jejak KPI yang dipersist ke database
                </h2>

                <div className="mt-5 space-y-4">
                  {snapshotHistory && snapshotHistory.items.length > 0 ? (
                    snapshotHistory.items.slice(0, 8).map((snapshot, index) => (
                      <article
                        key={snapshot.id}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Snapshot {snapshotHistory.items.length - index}
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-950">
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
                            value={formatPercent(snapshot.metrics_json.reply_sent_rate)}
                          />
                          <SummaryTile
                            label="Overdue"
                            value={String(snapshot.metrics_json.overdue_follow_ups)}
                          />
                          <SummaryTile
                            label="Won Value"
                            value={formatIdr(snapshot.metrics_json.won_value)}
                          />
                          <SummaryTile
                            label="Deposit"
                            value={formatIdr(snapshot.metrics_json.deposit_amount)}
                          />
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="Belum ada snapshot yang tersimpan. Jalankan refresh snapshot untuk mulai merekam histori KPI." />
                  )}
                </div>
              </section>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Organization Health
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    Pipeline readiness per organization
                  </h2>
                </div>
                <Link
                  href="/dashboard/marketing"
                  className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                >
                  Buka Marketing Insights
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {kpi.organization_performance.length === 0 ? (
                  <EmptyState text="Belum ada organization performance yang cukup untuk ditampilkan." />
                ) : (
                  kpi.organization_performance.map((row) => (
                    <article
                      key={row.organization_id}
                      className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-950">
                          {row.organization_name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge label={`Leads ${row.total_leads}`} />
                          <Badge label={`Hot ${row.hot_leads}`} />
                          <Badge label={`Closing ${row.closing_leads}`} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                        <SummaryTile label="Conversations" value={String(row.conversations)} />
                        <SummaryTile label="Analyzed" value={String(row.analyzed_conversations)} />
                        <SummaryTile label="Won Leads" value={String(row.won_leads)} />
                        <SummaryTile
                          label="Reply Sent Rate"
                          value={formatPercent(row.reply_sent_rate)}
                        />
                        <SummaryTile
                          label="Approved Reply Rate"
                          value={formatPercent(row.approved_reply_rate)}
                        />
                        <SummaryTile label="Overdue" value={String(row.overdue_follow_ups)} />
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
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
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
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
      {text}
    </div>
  );
}
