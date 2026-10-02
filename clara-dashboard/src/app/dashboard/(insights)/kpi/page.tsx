"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { canAccessStrategicInsights, getRoleDisplayLabel } from "@/lib/roles";
import { ALERT_SEVERITY, ALERT_STATUS, plainJargon } from "@/lib/vocab";
import type {
  CurrentUser,
  KpiAlertHistoryResponse,
  KpiCommandCenterResponse,
  KpiSnapshotHistoryResponse,
} from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
] as const;

const SALES_STEP = 5;

function numberOrZero(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatIdr(value: number | undefined | null): string {
  return `Rp ${numberOrZero(value).toLocaleString("id-ID")}`;
}

function formatPercent(value: number | undefined | null): string {
  return `${(numberOrZero(value) * 100).toFixed(0)}%`;
}

/** Link dari backend memakai awalan /dashboard; rute sebenarnya tanpa awalan itu. */
function toRoute(href: string | null | undefined): string | null {
  if (!href) {
    return null;
  }

  return href.replace(/^\/dashboard(?=\/|$)/, "") || "/";
}

export default function KpiCommandCenterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [alertHistory, setAlertHistory] = useState<KpiAlertHistoryResponse | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<KpiSnapshotHistoryResponse | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [salesVisible, setSalesVisible] = useState(SALES_STEP);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadKpiPage = useCallback(async () => {
    setErrorMessage("");

    try {
      const kpiPath =
        sourceChannelFilter === "all"
          ? "/dashboard/kpi/command-center"
          : `/dashboard/kpi/command-center?source_channel=${encodeURIComponent(sourceChannelFilter)}`;
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessStrategicInsights(me.role)) {
        router.replace("/dashboard");
        return;
      }

      const [kpiResult, alertsResult, snapshotsResult] = await Promise.allSettled([
        apiFetch<KpiCommandCenterResponse>(kpiPath),
        apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
        apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
      ]);

      if (kpiResult.status === "fulfilled") {
        setKpi(kpiResult.value);
      }
      if (alertsResult.status === "fulfilled") {
        setAlertHistory(alertsResult.value);
      }
      if (snapshotsResult.status === "fulfilled") {
        setSnapshotHistory(snapshotsResult.value);
      }
      if (
        kpiResult.status === "rejected" ||
        alertsResult.status === "rejected" ||
        snapshotsResult.status === "rejected"
      ) {
        setErrorMessage("Sebagian data belum bisa dimuat. Data yang berhasil dimuat tetap ditampilkan.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Dashboard operasional belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, [router, sourceChannelFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadKpiPage();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadKpiPage]);

  async function reloadAlertHistory() {
    setAlertHistory(await apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"));
  }

  async function handleRefreshSnapshot() {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const refreshPath =
        sourceChannelFilter === "all"
          ? "/dashboard/kpi/command-center/refresh"
          : `/dashboard/kpi/command-center/refresh?source_channel=${encodeURIComponent(sourceChannelFilter)}`;
      setKpi(await apiFetch<KpiCommandCenterResponse>(refreshPath, { method: "POST" }));
      const [alertsResponse, snapshotsResponse] = await Promise.all([
        apiFetch<KpiAlertHistoryResponse>("/dashboard/kpi/alerts"),
        apiFetch<KpiSnapshotHistoryResponse>("/dashboard/kpi/snapshots"),
      ]);
      setAlertHistory(alertsResponse);
      setSnapshotHistory(snapshotsResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Data belum bisa diperbarui. Coba lagi.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function runAlertAction(alertId: string, action: "acknowledge" | "resolve" | "reopen", failure: string) {
    setErrorMessage("");

    try {
      await apiFetch(`/dashboard/kpi/alerts/${alertId}/${action}`, {
        method: "PATCH",
        body: action === "resolve" ? { resolution_note: resolutionNotes[alertId]?.trim() || null } : undefined,
      });
      if (action === "resolve") {
        setResolutionNotes((current) => ({ ...current, [alertId]: "" }));
      }
      await reloadAlertHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : failure);
    }
  }

  const summary = kpi?.summary;
  const liveAlerts = kpi?.alerts.slice(0, 3) ?? [];
  const recommendations = kpi?.recommendations.slice(0, 3) ?? [];
  const observations = kpi?.key_observations.slice(0, 3) ?? [];
  const salesRows = [...(kpi?.sales_performance ?? [])].sort(
    (a, b) => b.overdue_follow_ups - a.overdue_follow_ups || b.pipeline_value - a.pipeline_value,
  );
  const sources = kpi?.source_performance ?? [];
  const organizations = kpi?.organization_performance ?? [];
  const keptAlerts = alertHistory?.items.slice(0, 6) ?? [];
  const snapshots = snapshotHistory?.items.slice(0, 6) ?? [];
  const marketing = kpi?.marketing_execution_summary;

  const needsAttention = Boolean(summary && (summary.overdue_follow_ups > 0 || (kpi?.alerts.length ?? 0) >= 3));
  const statusTitle = !summary
    ? ""
    : needsAttention
      ? "Ada hal yang perlu kamu cek dulu"
      : "Kondisi operasional stabil";
  const statusHelper = !summary
    ? ""
    : needsAttention
      ? `${summary.overdue_follow_ups} follow-up lewat jadwal dan ${kpi?.alerts.length ?? 0} alert aktif. Mulai dari bagian "Perlu perhatian" di bawah.`
      : "Tidak ada yang mendesak. Cukup jaga ritme follow-up tim.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.opsDashboard}
      description="Gambaran kesehatan penjualan: lead, follow-up, dan nilai penjualan dari chat yang sudah masuk."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <button
          type="button"
          onClick={() => void handleRefreshSnapshot()}
          disabled={isRefreshing}
          className="clara-button clara-button-primary"
        >
          {isRefreshing ? "Memperbarui..." : "Perbarui data"}
        </button>
      }
    >
      <div className="space-y-6">
        {isLoading ? <LoadingState message="Memuat dashboard operasional..." /> : null}

        {!isLoading && errorMessage && !kpi ? (
          <ErrorState message={errorMessage} onRetry={() => void loadKpiPage()} />
        ) : null}

        {errorMessage && kpi ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {kpi && summary && !isLoading ? (
          <>
            <section aria-labelledby="kpi-status" className="clara-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="kpi-status" className="text-xl font-bold clara-text-primary sm:text-2xl">
                  {statusTitle}
                </h2>
                <Tag tone={needsAttention ? "warn" : "good"}>{needsAttention ? "Perlu perhatian" : "Aman"}</Tag>
              </div>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">{statusHelper}</p>
              <p className="mt-1 text-xs clara-text-muted">
                Data per {formatRelativeTime(kpi.generated_at)} ({formatDateTime(kpi.generated_at)}). Angka ini
                membantu penilaian manusia, bukan satu-satunya dasar keputusan soal anggota tim atau keuangan.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/notifications" className="clara-button clara-button-secondary">
                  Lihat Alert Tim
                </Link>
                <Link href="/manager-insights" className="clara-button clara-button-secondary">
                  Buka Monitor Tim
                </Link>
                <Link href="/marketing" className="clara-button clara-button-secondary">
                  Buka Insight Pasar
                </Link>
              </div>
            </section>

            <section aria-labelledby="kpi-numbers" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="kpi-numbers" className="text-lg font-bold clara-text-primary">
                  Angka utama
                </h2>
                <div>
                  <label htmlFor="kpi-channel" className="clara-label">
                    Tampilkan chat dari
                  </label>
                  <select
                    id="kpi-channel"
                    value={sourceChannelFilter}
                    onChange={(event) => setSourceChannelFilter(event.target.value)}
                    className="clara-select mt-1 w-full sm:w-52"
                  >
                    {SOURCE_CHANNEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Figure label="Lead aktif" value={String(summary.total_leads)} hint="Seluruh lead yang tercatat" />
                <Figure label="Lead panas" value={String(summary.hot_leads)} hint="Paling siap dibeli" />
                <Figure label="Siap closing" value={String(summary.closing_leads)} hint="Tinggal diselesaikan" />
                <Figure
                  label="Follow-up terlambat"
                  value={String(summary.overdue_follow_ups)}
                  hint="Sudah lewat jadwal"
                  warn={summary.overdue_follow_ups > 0}
                />
                <Figure label="Nilai pipeline" value={formatIdr(summary.pipeline_value)} hint="Deal yang masih berjalan" />
                <Figure label="Nilai closing" value={formatIdr(summary.won_value)} hint="Deal yang sudah menang" />
                <Figure label="Deposit masuk" value={formatIdr(summary.deposit_amount)} hint="Yang sudah tercatat" />
                <Figure label="Tingkat closing" value={formatPercent(summary.win_rate)} hint="Menang dari deal yang selesai" />
              </dl>

              <p className="text-sm clara-text-secondary">
                Dari {summary.analyzed_conversations} chat yang sudah dianalisis, {formatPercent(summary.reply_sent_rate)}{" "}
                balasan sudah dikirim dan {formatPercent(summary.approved_reply_rate)} disetujui.
              </p>
            </section>

            <section aria-labelledby="kpi-attention" className="space-y-3">
              <h2 id="kpi-attention" className="text-lg font-bold clara-text-primary">
                Perlu perhatian
              </h2>
              {liveAlerts.length === 0 && recommendations.length === 0 ? (
                <EmptyState title="Belum ada yang perlu dicek" description="Alert dan saran langkah muncul di sini saat ada pola yang menonjol." />
              ) : (
                <ul className="space-y-3">
                  {liveAlerts.map((alert) => {
                    const href = toRoute(alert.target_href);

                    return (
                      <li key={`alert-${alert.severity}-${alert.title}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(alert.title)}</h3>
                          <ValueTag table={ALERT_SEVERITY} value={alert.severity} />
                        </div>
                        <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(alert.description)}</p>
                        <p className="mt-2 text-sm leading-6 clara-text-primary">
                          <span className="font-semibold">Saran: </span>
                          {plainJargon(alert.recommended_action)}
                        </p>
                        {href ? (
                          <Link href={href} className="clara-button clara-button-secondary mt-3">
                            Buka bagian terkait
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                  {recommendations.map((item) => {
                    const href = toRoute(item.target_href);

                    return (
                      <li key={`rec-${item.owner_role}-${item.title}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(item.title)}</h3>
                          <Tag tone="info">Untuk {getRoleDisplayLabel(item.owner_role)}</Tag>
                        </div>
                        <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(item.rationale)}</p>
                        <p className="mt-2 text-sm leading-6 clara-text-primary">
                          <span className="font-semibold">Langkah berikutnya: </span>
                          {plainJargon(item.next_step)}
                        </p>
                        {href ? (
                          <Link href={href} className="clara-button clara-button-primary mt-3">
                            Kerjakan sekarang
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {observations.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm clara-text-secondary">
                  {observations.map((text) => (
                    <li key={text}>{plainJargon(text)}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section aria-labelledby="kpi-sales" className="space-y-3">
              <h2 id="kpi-sales" className="text-lg font-bold clara-text-primary">
                Kinerja per Sales
              </h2>
              <p className="text-sm clara-text-secondary">Diurutkan dari yang follow-up terlambatnya paling banyak.</p>
              {salesRows.length === 0 ? (
                <EmptyState title="Belum ada data Sales" description="Data muncul setelah ada lead yang ditangani Sales." />
              ) : (
                <ul className="space-y-3">
                  {salesRows.slice(0, salesVisible).map((row) => (
                    <li key={row.user_id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold clara-text-primary">{row.user_name}</h3>
                        {row.organization_name ? <span className="text-xs clara-text-muted">{row.organization_name}</span> : null}
                        {row.overdue_follow_ups > 0 ? <Tag tone="warn">{row.overdue_follow_ups} follow-up terlambat</Tag> : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                        <Stat label="Lead dipegang" value={String(row.assigned_leads)} />
                        <Stat label="Lead panas" value={String(row.hot_leads)} />
                        <Stat label="Siap closing" value={String(row.closing_leads)} />
                        <Stat label="Balasan terkirim" value={String(row.replies_sent)} />
                        <Stat label="Nilai pipeline" value={formatIdr(row.pipeline_value)} />
                        <Stat label="Nilai closing" value={formatIdr(row.won_value)} />
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              {salesRows.length > salesVisible ? (
                <button type="button" onClick={() => setSalesVisible((count) => count + SALES_STEP)} className="clara-button clara-button-ghost">
                  Tampilkan {Math.min(salesRows.length - salesVisible, SALES_STEP)} Sales lagi ({salesRows.length - salesVisible} tersisa)
                </button>
              ) : null}
            </section>

            <section aria-labelledby="kpi-sources" className="space-y-3">
              <h2 id="kpi-sources" className="text-lg font-bold clara-text-primary">
                Dari mana lead datang
              </h2>
              {sources.length === 0 ? (
                <EmptyState title="Belum ada data sumber lead" description="Sumber lead terisi otomatis dari channel chat yang dipakai." />
              ) : (
                <ul className="space-y-3">
                  {sources.slice(0, 6).map((row) => (
                    <li key={row.source_key} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <h3 className="break-words text-base font-semibold clara-text-primary">{row.source_label}</h3>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                        <Stat label="Lead" value={String(row.lead_count)} />
                        <Stat label="Lead panas" value={String(row.hot_leads)} />
                        <Stat label="Nilai pipeline" value={formatIdr(row.pipeline_value)} />
                        <Stat label="Nilai closing" value={formatIdr(row.won_value)} />
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              {marketing && marketing.total_items > 0 ? (
                <p className="text-sm clara-text-secondary">
                  Dari kampanye: {marketing.done_items} dari {marketing.total_items} kegiatan selesai, menghasilkan{" "}
                  {marketing.leads_generated} lead ({marketing.won_leads} closing, nilai{" "}
                  {formatIdr(marketing.attributed_won_value)}).
                </p>
              ) : null}
            </section>

            {organizations.length > 1 ? (
              <details className="clara-card p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                  Perbandingan antar organisasi ({organizations.length})
                </summary>
                <ul className="mt-3 space-y-3">
                  {organizations.map((row) => (
                    <li key={row.organization_id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <h3 className="break-words text-base font-semibold clara-text-primary">{row.organization_name}</h3>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                        <Stat label="Lead" value={String(row.total_leads)} />
                        <Stat label="Lead panas" value={String(row.hot_leads)} />
                        <Stat label="Follow-up terlambat" value={String(row.overdue_follow_ups)} />
                        <Stat label="Lead closing" value={String(row.won_leads)} />
                        <Stat label="Nilai pipeline" value={formatIdr(row.pipeline_value)} />
                        <Stat label="Nilai closing" value={formatIdr(row.won_value)} />
                        <Stat label="Deposit" value={formatIdr(row.deposit_amount)} />
                        <Stat label="Balasan terkirim" value={formatPercent(row.reply_sent_rate)} />
                      </dl>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Riwayat alert ({alertHistory?.active_count ?? 0} aktif)
              </summary>
              <p className="mt-1 text-sm clara-text-secondary">
                Alert yang ditandai selesai akan muncul lagi kalau masalahnya belum beres.
              </p>
              {keptAlerts.length === 0 ? (
                <p className="mt-3 text-sm clara-text-secondary">Belum ada riwayat alert.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {keptAlerts.map((item) => {
                    const noteId = `kpi-note-${item.id}`;

                    return (
                      <li key={item.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(item.title)}</h3>
                          <ValueTag table={ALERT_SEVERITY} value={item.severity} />
                          <ValueTag table={ALERT_STATUS} value={item.status} />
                        </div>
                        <p className="mt-1 text-xs clara-text-muted">Terakhir terdeteksi {formatRelativeTime(item.last_detected_at)}</p>
                        <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(item.description)}</p>
                        {item.resolution_note ? (
                          <p className="mt-2 text-sm clara-text-secondary">
                            <span className="font-semibold clara-text-primary">Catatan: </span>
                            {item.resolution_note}
                          </p>
                        ) : null}
                        {item.status !== "resolved" ? (
                          <div className="mt-3">
                            <label htmlFor={noteId} className="clara-label">
                              Catatan penyelesaian (opsional)
                            </label>
                            <input
                              id={noteId}
                              value={resolutionNotes[item.id] ?? ""}
                              onChange={(event) => setResolutionNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                              className="clara-input mt-1 w-full"
                              placeholder="Contoh: sudah dibahas dengan manager"
                            />
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => void runAlertAction(item.id, "acknowledge", "Alert belum bisa ditandai dibaca. Coba lagi.")}
                              className="clara-button clara-button-secondary"
                            >
                              Tandai sudah dibaca
                            </button>
                          ) : null}
                          {item.status !== "resolved" ? (
                            <button
                              type="button"
                              onClick={() => void runAlertAction(item.id, "resolve", "Alert belum bisa ditandai selesai. Coba lagi.")}
                              className="clara-button clara-button-secondary"
                            >
                              Tandai selesai
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void runAlertAction(item.id, "reopen", "Alert belum bisa dibuka lagi. Coba lagi.")}
                              className="clara-button clara-button-secondary"
                            >
                              Buka lagi
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Catatan angka dari waktu ke waktu ({snapshots.length})
              </summary>
              {snapshots.length === 0 ? (
                <p className="mt-3 text-sm clara-text-secondary">Belum ada catatan. Tekan Perbarui data untuk menyimpan satu.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {snapshots.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <p className="text-sm font-semibold clara-text-primary">{formatDateTime(item.created_at)}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                        <Stat label="Lead" value={String(item.metrics_json.total_leads)} />
                        <Stat label="Lead panas" value={String(item.metrics_json.hot_leads)} />
                        <Stat label="Follow-up terlambat" value={String(item.metrics_json.overdue_follow_ups)} />
                        <Stat label="Nilai closing" value={formatIdr(item.metrics_json.won_value)} />
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Figure({ label, value, hint, warn = false }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`clara-card-soft min-w-0 p-4 ${warn ? "border-clara-warning-line" : ""}`}>
      <dt className="text-sm clara-text-secondary">{label}</dt>
      <dd className="mt-1 break-words text-2xl font-bold clara-text-primary">{value}</dd>
      <p className="mt-1 text-xs clara-text-muted">{hint}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}
