"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { canAccessQueueAndActionCenter, isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import { AGE, ALERT_SEVERITY, ALERT_STATUS, plainJargon } from "@/lib/vocab";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResolveRequest,
  OpsNotificationResponse,
} from "@/types/dashboard";

const VISIBLE_STEP = 8;

const STATUS_CHIPS = ["open", "resolved", "ignored"] as const;

const CHIP_LABELS: Record<string, string> = {
  open: "Perlu ditangani",
  resolved: "Selesai",
  ignored: "Diabaikan",
};

function resolveNotificationTargetHref(href: string | null | undefined, role?: string | null): string | null {
  if (!href) {
    return null;
  }

  const normalized = href.replace(/^\/dashboard/, "") || "/";
  const canQueue = canAccessQueueAndActionCenter(role);

  if (normalizeWorkspaceRole(role) === "head" && !canQueue) {
    if (normalized.startsWith("/follow-up")) return "/notifications";
    if (normalized.startsWith("/sales")) return "/approvals";
  }

  if (isManagerRole(role) && !canQueue) {
    if (normalized.startsWith("/follow-up")) return "/manager-insights";
    if (normalized.startsWith("/sales")) return "/approvals";
  }

  return normalized;
}

export default function NotificationsPage() {
  const noteId = useId();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<OpsNotificationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [visible, setVisible] = useState(VISIBLE_STEP);

  async function loadNotifications() {
    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<OpsNotificationResponse>("/dashboard/notifications"),
      ]);
      setCurrentUser(me);
      setNotifications(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Daftar alert belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  async function runAction(item: OpsNotificationItem, path: string, withNote: boolean, failure: string) {
    setUpdatingId(item.id);
    setActionError("");

    try {
      const body: OpsNotificationResolveRequest | undefined = withNote
        ? { resolution_note: resolutionNote.trim() || null }
        : undefined;
      await apiFetch(`/dashboard/notifications/${item.id}/${path}`, { method: "PATCH", body });
      if (withNote) {
        setResolutionNote("");
      }
      await loadNotifications();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : failure);
    } finally {
      setUpdatingId(null);
    }
  }

  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const isHeadView = isHeadRole(currentUser?.role);
  const isOversightView = isHeadView || (isManagerRole(currentUser?.role) && !canAccessQueue);
  const canEscalate = ["head", "superadmin"].includes(currentUser?.role ?? "");

  const scoped = useMemo(() => {
    const items = notifications?.items ?? [];
    return isOversightView ? items.filter((item) => Boolean(item.alert_type)) : items.filter((item) => !item.alert_type);
  }, [isOversightView, notifications?.items]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { active: 0, acknowledged: 0, resolved: 0, ignored: 0 };

    for (const item of scoped) {
      result[item.status] = (result[item.status] ?? 0) + 1;
    }

    return result;
  }, [scoped]);

  const filtered = useMemo(
    () =>
      scoped.filter(
        (item) =>
          (statusFilter === "all" ||
            (statusFilter === "open" ? item.status === "active" || item.status === "acknowledged" : item.status === statusFilter)) &&
          (severityFilter === "all" ||
            (severityFilter === "medium" ? item.severity === "medium" || item.severity === "warning" : item.severity === severityFilter)),
      ),
    [scoped, severityFilter, statusFilter],
  );
  const shown = filtered.slice(0, visible);

  const openCount = (counts.active ?? 0) + (counts.acknowledged ?? 0);
  const summaryTitle =
    openCount > 0
      ? `${openCount} alert perlu ditangani`
      : scoped.length > 0
        ? "Semua alert sudah ditangani"
        : "Belum ada alert";
  const summaryHelper =
    openCount > 0
      ? isHeadView
        ? "Mulai dari yang paling atas. Putuskan apakah cukup dipantau, diserahkan ke manager, atau perlu dinaikkan."
        : "Mulai dari yang paling atas. Buka konteksnya dan tangani. Alert hilang sendiri setelah beres."
      : "Alert yang sudah ditangani ada di kelompok Selesai.";
  const reappearNote = "Alert peringatan yang ditandai selesai akan muncul lagi kalau masalahnya belum beres.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={isHeadView ? PAGE_NAMES.alertsTeam : PAGE_NAMES.alerts}
      description={
        isHeadView
          ? "Peringatan lintas tim yang perlu keputusanmu."
          : isOversightView
            ? "Follow-up Sales yang mulai terlambat dan lead yang belum ditindak."
            : "Hal yang perlu segera ditindak: follow-up terlambat, review kritis, dan peringatan KPI."
      }
      actions={
        <Link href="/approvals" className="clara-button clara-button-primary">
          {isHeadView ? "Buka Arahan Tim" : "Buka Review Sales"}
        </Link>
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat alert..." /> : null}

        {!isLoading && errorMessage && !notifications ? (
          <ErrorState message={errorMessage} onRetry={() => void loadNotifications()} />
        ) : null}

        {actionError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionError}
          </div>
        ) : null}

        {notifications ? (
          <>
            <section data-onboarding-id="head-alerts-summary" aria-labelledby="alert-summary" className="clara-card p-5 sm:p-6">
              <h2 id="alert-summary" className="text-xl font-bold clara-text-primary sm:text-2xl">
                {summaryTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">{summaryHelper}</p>
              {isOversightView ? <p className="mt-1 text-sm leading-6 clara-text-muted">{reappearNote}</p> : null}
            </section>

            <section
              data-onboarding-id="head-alerts-filters"
              aria-label="Saring alert"
              className="clara-card space-y-4 p-4 sm:p-5"
            >
              <div data-onboarding-id="head-alerts-metrics" role="group" aria-label="Status alert" className="flex flex-wrap gap-2">
                {STATUS_CHIPS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={statusFilter === status}
                    onClick={() => {
                      setStatusFilter(status);
                      setVisible(VISIBLE_STEP);
                    }}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                      statusFilter === status
                        ? "border-clara-gold bg-clara-gold text-clara-deep"
                        : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
                    }`}
                  >
                    {CHIP_LABELS[status]} ({status === "open" ? (counts.active ?? 0) + (counts.acknowledged ?? 0) : (counts[status] ?? 0)})
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={statusFilter === "all"}
                  onClick={() => {
                    setStatusFilter("all");
                    setVisible(VISIBLE_STEP);
                  }}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                    statusFilter === "all"
                      ? "border-clara-gold bg-clara-gold text-clara-deep"
                      : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
                  }`}
                >
                  Semua ({scoped.length})
                </button>
              </div>

              <details>
                <summary className="clara-disclosure">Saring menurut tingkat kepentingan, dan tambah catatan</summary>
                <div className="mt-3 space-y-4">
                  <div className="max-w-xs">
                    <label htmlFor="alert-severity" className="clara-label">
                      Tingkat kepentingan
                    </label>
                    <select
                      id="alert-severity"
                      value={severityFilter}
                      onChange={(event) => {
                        setSeverityFilter(event.target.value);
                        setVisible(VISIBLE_STEP);
                      }}
                      className="clara-select mt-2 w-full"
                    >
                      <option value="all">Semua</option>
                      <option value="critical">Kritis</option>
                      <option value="high">Penting</option>
                      <option value="medium">Perlu dicek</option>
                      <option value="low">Info</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={noteId} className="clara-label">
                      Catatan penyelesaian (opsional)
                    </label>
                    <p className="mt-1 text-xs clara-text-muted">
                      Ikut tersimpan saat kamu menekan Tandai selesai atau Abaikan.
                    </p>
                    <textarea
                      id={noteId}
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      rows={2}
                      className="clara-textarea mt-2 w-full"
                      placeholder="Contoh: sudah dibicarakan dengan manager"
                    />
                  </div>
                </div>
              </details>

              <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
                {filtered.length} alert
              </p>
            </section>

            {filtered.length === 0 ? (
              <EmptyState
                title={scoped.length === 0 ? "Belum ada alert" : "Tidak ada alert di kelompok ini"}
                description={
                  scoped.length === 0
                    ? "Alert muncul otomatis saat ada follow-up terlambat atau area tim yang bermasalah."
                    : "Pilih kelompok lain atau ubah tingkat kepentingan."
                }
              />
            ) : (
              <ul data-onboarding-id="head-alerts-list" className="space-y-3">
                {shown.map((item) => {
                  const href = resolveNotificationTargetHref(item.target_href, currentUser?.role);
                  const busy = updatingId === item.id;
                  const owner = item.sales_owner_name?.trim() || item.team_name?.trim();
                  // Alert turunan (mis. antrean persetujuan) dihitung ulang dari data terbaru dan
                  // hilang sendiri setelah masalahnya ditangani, jadi tidak bisa ditutup manual.
                  const isDerived = item.source_type !== "operational_alert";

                  return (
                    <li key={item.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-semibold clara-text-primary">
                              {plainJargon(item.title)}
                            </h3>
                            <ValueTag table={ALERT_SEVERITY} value={item.severity} />
                            <ValueTag table={ALERT_STATUS} value={item.status} />
                            {item.age_bucket !== "fresh" ? <ValueTag table={AGE} value={item.age_bucket} /> : null}
                            {item.escalation_level !== "none" ? <Tag tone="danger">Sudah dinaikkan</Tag> : null}
                          </div>
                          <p className="mt-1 text-xs clara-text-muted">
                            {owner ? `${owner} · ` : ""}
                            {formatRelativeTime(item.triggered_at ?? item.created_at)}
                          </p>
                          <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(item.body)}</p>
                          {isDerived && (item.status === "active" || item.status === "acknowledged") ? (
                            <p className="mt-2 text-xs clara-text-muted">Alert ini hilang sendiri setelah kamu menanganinya.</p>
                          ) : null}
                          {item.resolution_note ? (
                            <p className="mt-2 text-sm clara-text-secondary">
                              <span className="font-semibold clara-text-primary">Catatan: </span>
                              {item.resolution_note}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:flex-col">
                          {href ? (
                            <Link href={href} className="clara-button clara-button-primary">
                              {isOversightView ? "Buka konteks" : "Buka follow-up"}
                            </Link>
                          ) : null}
                          {item.status === "active" && !isDerived ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runAction(item, "acknowledge", false, "Alert belum bisa ditandai dibaca. Coba lagi.")}
                              className="clara-button clara-button-secondary"
                            >
                              {busy ? "Memproses..." : "Tandai sudah dibaca"}
                            </button>
                          ) : null}
                          {item.status === "active" || item.status === "acknowledged" ? (
                            <>
                              {!isDerived ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runAction(item, "resolve", true, "Alert belum bisa ditandai selesai. Coba lagi.")}
                                  className="clara-button clara-button-secondary"
                                >
                                  Tandai selesai
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(item, "ignore", true, "Alert belum bisa diabaikan. Coba lagi.")}
                                className="clara-button clara-button-ghost"
                              >
                                Abaikan
                              </button>
                              {canEscalate && item.escalation_level === "none" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void runAction(item, "escalate", false, "Alert belum bisa dinaikkan. Coba lagi.")}
                                  className="clara-button clara-button-ghost"
                                >
                                  Naikkan ke atasan
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {(item.status === "resolved" || item.status === "ignored") && item.source_type !== "operational_alert" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runAction(item, "reopen", false, "Alert belum bisa dibuka lagi. Coba lagi.")}
                              className="clara-button clara-button-secondary"
                            >
                              Buka lagi
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {filtered.length > visible ? (
              <button type="button" onClick={() => setVisible((count) => count + VISIBLE_STEP)} className="clara-button clara-button-ghost">
                Tampilkan {Math.min(filtered.length - visible, VISIBLE_STEP)} alert lagi ({filtered.length - visible} tersisa)
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
