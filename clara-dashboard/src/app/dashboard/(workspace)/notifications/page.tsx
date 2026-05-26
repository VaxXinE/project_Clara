"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  isManagerLike,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResolveRequest,
  OpsNotificationResponse,
} from "@/types/dashboard";

function getSeverityClass(severity: string) {
  if (severity === "high") {
    return "bg-red-100 text-red-700";
  }
  if (severity === "medium") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

function resolveNotificationTargetHref(
  href: string | null | undefined,
  role?: string | null,
): string | null {
  if (!href) {
    return null;
  }

  if (normalizeWorkspaceRole(role) === "head" && !canAccessQueueAndActionCenter(role)) {
    if (href.startsWith("/dashboard/follow-up")) {
      return "/dashboard/notifications";
    }

    if (href.startsWith("/dashboard/sales")) {
      return "/dashboard/approvals";
    }
  }

  if (isManagerLike(role) && !canAccessQueueAndActionCenter(role)) {
    if (href.startsWith("/dashboard/follow-up")) {
      return "/dashboard/manager-insights";
    }

    if (href.startsWith("/dashboard/sales")) {
      return "/dashboard/approvals";
    }
  }

  return href;
}

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<OpsNotificationResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [notificationPage, setNotificationPage] = useState(1);
  const pageSize = 5;

  function updateNotificationLocally(
    notificationId: string,
    updater: (item: OpsNotificationItem) => OpsNotificationItem
  ) {
    setNotifications((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current.items.map((item) =>
        item.id === notificationId ? updater(item) : item
      );

      return {
        ...current,
        active_count: nextItems.filter((item) => item.status === "active").length,
        acknowledged_count: nextItems.filter((item) => item.status === "acknowledged").length,
        resolved_count: nextItems.filter((item) => item.status === "resolved").length,
        escalated_count: nextItems.filter((item) => item.escalation_level !== "none").length,
        items: nextItems,
      };
    });
  }

  async function loadNotifications() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<OpsNotificationResponse>("/dashboard/notifications"),
      ]);
      setCurrentUser(me);
      setNotifications(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat notification center."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function handleAcknowledge(item: OpsNotificationItem) {
    setUpdatingId(item.id);
    setErrorMessage("");

    try {
      await apiFetch(`/dashboard/notifications/${item.id}/acknowledge`, {
        method: "PATCH",
      });
      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal acknowledge notification."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleResolve(item: OpsNotificationItem) {
    setUpdatingId(item.id);
    setErrorMessage("");
    try {
      const payload: OpsNotificationResolveRequest = {
        resolution_note: resolutionNote.trim() || null,
      };
      await apiFetch(`/dashboard/notifications/${item.id}/resolve`, {
        method: "PATCH",
        body: payload,
      });
      setResolutionNote("");
      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal resolve notification."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReopen(item: OpsNotificationItem) {
    setUpdatingId(item.id);
    setErrorMessage("");
    try {
      const reopenedItem = await apiFetch<OpsNotificationItem>(
        `/dashboard/notifications/${item.id}/reopen`,
        {
        method: "PATCH",
        }
      );
      updateNotificationLocally(item.id, () => reopenedItem);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal reopen notification."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleEscalate(item: OpsNotificationItem) {
    setUpdatingId(item.id);
    setErrorMessage("");
    try {
      await apiFetch(`/dashboard/notifications/${item.id}/escalate`, {
        method: "PATCH",
      });
      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal escalate notification."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredNotifications = useMemo(() => {
    const items = notifications?.items ?? [];

    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesSeverity =
        severityFilter === "all" || item.severity === severityFilter;

      return matchesStatus && matchesSeverity;
    });
  }, [notifications?.items, severityFilter, statusFilter]);

  const totalNotificationPages = Math.max(
    1,
    Math.ceil(filteredNotifications.length / pageSize),
  );

  const paginatedNotifications = useMemo(() => {
    const startIndex = (notificationPage - 1) * pageSize;
    return filteredNotifications.slice(startIndex, startIndex + pageSize);
  }, [filteredNotifications, notificationPage]);

  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const isManagerMonitorView =
    isManagerLike(currentUser?.role) && !canAccessQueue;
  const isHeadMonitorView = normalizedRole === "head";
  const isOversightAlertView = isManagerMonitorView || isHeadMonitorView;
  const hasAnyNotifications = (notifications?.items.length ?? 0) > 0;
  const hasActiveNotifications = (notifications?.active_count ?? 0) > 0;
  const isActiveStatusView = statusFilter === "active";
  const showActiveEmptyState =
    hasAnyNotifications && isActiveStatusView && filteredNotifications.length === 0;

  useEffect(() => {
    setNotificationPage(1);
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    if (notificationPage > totalNotificationPages) {
      setNotificationPage(totalNotificationPages);
    }
  }, [notificationPage, totalNotificationPages]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Operational orchestration"
      title="Alert Center"
      description="Tempat untuk melihat sinyal operasional yang harus segera ditindak: follow-up overdue, chat review kritis, dan alert KPI yang relevan dengan role Anda."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          {currentUser && canAccessQueueAndActionCenter(currentUser.role) ? (
            <Link
              href="/dashboard/follow-up"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Action Center
            </Link>
          ) : (
            <Link
              href="/dashboard/manager-insights"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Manager Insights
            </Link>
          )}
          <Link
            href="/dashboard/approvals"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Chat Review Center
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading notifications...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {notifications && !isLoading && !errorMessage && (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_45%,#f8fafc_100%)] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {notifications.items.length === 0
                      ? "Tidak ada notifikasi aktif sekarang"
                      : "Ambil notifikasi active yang paling kritis lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {notifications.items.length === 0
                      ? currentUser && canAccessQueueAndActionCenter(currentUser.role)
                        ? "Kalau Alert Center kosong, itu berarti operasional relatif stabil. Tetap cek Action Center untuk memastikan tidak ada task yang harus ditindak."
                        : "Kalau Alert Center kosong, itu berarti operasional relatif stabil. Lanjutkan cek Manager Insights atau Chat Review Center untuk memantau bottleneck tim."
                      : "Alert Center dipakai untuk aksi cepat pada sinyal operasional. Baca severity, age, dan target tindakan sebelum memilih acknowledge, resolve, atau escalate."}
                  </p>
                </div>
                <Link
                  href={
                    resolveNotificationTargetHref(
                      notifications.items[0]?.target_href,
                      currentUser?.role,
                    ) ??
                    (canAccessQueue
                      ? "/dashboard/follow-up"
                      : "/dashboard/manager-insights")
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {notifications.items[0]
                    ? "Buka Alert Teratas"
                    : canAccessQueue
                      ? "Buka Action Center"
                      : "Buka Manager Insights"}
                </Link>
              </div>
            </section>

            {hasAnyNotifications ? (
              <>
                {!showActiveEmptyState ? (
                  <>
                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Cara Pakai Halaman Ini
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {isOversightAlertView ? (
                          <>
                            <UsageHint
                              title="1. Baca severity dan target tindakan"
                              description="Role oversight memakai alert untuk membaca bottleneck paling cepat, bukan untuk kerja seperti operator."
                            />
                            <UsageHint
                              title="2. Buka chat review atau lead terkait"
                              description="Masuk ke Chat Review Center atau Lead Management saat alert butuh keputusan, coaching, atau follow-up lanjutan."
                            />
                            <UsageHint
                              title="3. Pantau pola, bukan cuma satu alert"
                              description={
                                isHeadMonitorView
                                  ? "Kalau alert serupa muncul berulang, lanjutkan ke KPI atau Manager Insights untuk baca pola lintas team."
                                  : "Kalau alert serupa muncul berulang, lanjutkan ke Manager Insights untuk baca akar masalah per team."
                              }
                            />
                          </>
                        ) : (
                          <>
                            <UsageHint
                              title="1. Baca title dan severity"
                              description="Itu memberi konteks tercepat soal seberapa kritis notifikasi ini."
                            />
                            <UsageHint
                              title="2. Pakai Acknowledge untuk tandai sedang ditangani"
                              description="Resolve dipakai kalau isu memang selesai, bukan sekadar sudah dibaca."
                            />
                            <UsageHint
                              title="3. Escalate kalau perlu level keputusan lebih tinggi"
                              description="Gunakan escalation untuk isu yang tidak bisa diselesaikan di level operator saat ini."
                            />
                          </>
                        )}
                      </div>
                    </section>

                    <section className="grid gap-4 md:grid-cols-3">
                      <MetricCard label="Active" value={String(notifications.active_count)} />
                      <MetricCard
                        label="Acknowledged"
                        value={String(notifications.acknowledged_count)}
                      />
                      <MetricCard label="Resolved" value={String(notifications.resolved_count)} />
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                      <div
                        className={`grid gap-4 ${isOversightAlertView ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}
                      >
                        <MetricCard
                          label="Escalated"
                          value={String(notifications.escalated_count)}
                        />
                        <MetricCard
                          label="Generated"
                          value={formatDateTime(notifications.generated_at)}
                        />
                        {!isOversightAlertView ? (
                          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Resolution Note
                            </p>
                            <textarea
                              value={resolutionNote}
                              onChange={(event) => {
                                setResolutionNote(event.target.value);
                              }}
                              placeholder="Catatan saat resolve notification..."
                              className="mt-3 min-h-[88px] w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                            />
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Tidak Ada Alert Aktif
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-950">
                          Tidak ada sinyal operasional yang perlu ditangani sekarang
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                          Fokus halaman ini adalah alert aktif. Karena sekarang kosong, lanjutkan kerja dari{" "}
                          {canAccessQueue ? "Action Center, Queue, atau Lead Management" : "Manager Insights, KPI, atau Chat Review Center"}.
                          {notifications.resolved_count > 0
                            ? ` Ada ${notifications.resolved_count} alert resolved yang bisa dibuka kalau kamu butuh melihat histori.`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setStatusFilter("resolved")}
                          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                        >
                          Lihat Histori Alert
                        </button>
                        <Link
                          href={canAccessQueue ? "/dashboard/follow-up" : isHeadMonitorView ? "/dashboard/kpi" : "/dashboard/manager-insights"}
                          className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          {canAccessQueue
                            ? "Buka Action Center"
                            : isHeadMonitorView
                              ? "Buka KPI Dashboard"
                              : "Buka Manager Insights"}
                        </Link>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <MetricCard label="Active" value={String(notifications.active_count)} />
                      <MetricCard
                        label="Resolved"
                        value={String(notifications.resolved_count)}
                      />
                      <MetricCard
                        label="Generated"
                        value={formatDateTime(notifications.generated_at)}
                      />
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Filter status</span>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="all">Semua status</option>
                        <option value="active">Active</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium text-slate-700">
                      <span>Filter severity</span>
                      <select
                        value={severityFilter}
                        onChange={(event) => setSeverityFilter(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="all">Semua severity</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
                      <p className="text-sm text-slate-600">
                        Menampilkan {paginatedNotifications.length} dari {filteredNotifications.length} alert
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Halaman {notificationPage} dari {totalNotificationPages}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  {filteredNotifications.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      Tidak ada alert yang cocok dengan filter saat ini. Coba ubah status atau severity untuk melihat histori alert lain.
                    </div>
                  ) : (
                    paginatedNotifications.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                      >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-950">
                            {item.title}
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getSeverityClass(
                              item.severity
                            )}`}
                          >
                            {item.severity.toUpperCase()}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatStatusLabel(item.status)}
                          </span>
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Delivery: {formatStatusLabel(item.delivery_status)}
                          </span>
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            Escalation: {formatStatusLabel(item.escalation_level)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Age: {formatStatusLabel(item.age_bucket)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {item.body}
                        </p>
                        <p className="mt-3 text-xs text-slate-500">
                          Dibuat: {formatDateTime(item.created_at)} • Update:{" "}
                          {formatDateTime(item.updated_at)}
                        </p>
                        {item.resolution_note ? (
                          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                            Resolution note: {item.resolution_note}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex w-full flex-col gap-2 md:w-64">
                        {resolveNotificationTargetHref(item.target_href, currentUser?.role) ? (
                          <Link
                            href={
                              resolveNotificationTargetHref(
                                item.target_href,
                                currentUser?.role,
                              ) as string
                            }
                            className="inline-flex justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                          >
                            Buka Tindakan
                          </Link>
                        ) : null}
                        {item.status === "active" ? (
                          <>
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => {
                                void handleAcknowledge(item);
                              }}
                              className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {updatingId === item.id ? "Memproses..." : "Acknowledge"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => {
                                void handleResolve(item);
                              }}
                              className="inline-flex justify-center rounded-full border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Resolve
                            </button>
                            {["head", "superadmin"].includes(currentUser?.role ?? "") ? (
                              <button
                                type="button"
                                disabled={updatingId === item.id}
                                onClick={() => {
                                  void handleEscalate(item);
                                }}
                                className="inline-flex justify-center rounded-full border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                Escalate
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {item.status === "resolved" ? (
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => {
                              void handleReopen(item);
                            }}
                            className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Reopen
                          </button>
                        ) : null}
                      </div>
                      </div>
                    </article>
                    ))
                  )}
                </section>

                {filteredNotifications.length > pageSize ? (
                  <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">Navigasi daftar alert</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationPage((current) => Math.max(1, current - 1))
                          }
                          disabled={notificationPage === 1}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationPage((current) =>
                              Math.min(totalNotificationPages, current + 1),
                            )
                          }
                          disabled={notificationPage === totalNotificationPages}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Lanjutkan Dari Sini
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {isHeadMonitorView
                    ? "Saat Alert Center kosong, itu artinya tidak ada sinyal operasional yang sedang meledak. Untuk role head, langkah berikutnya biasanya memantau kesehatan lintas team, coaching queue, dan pipeline lead yang masih tertahan."
                    : "Saat Alert Center kosong, itu artinya tidak ada sinyal operasional yang sedang meledak. Untuk role manager, langkah berikutnya biasanya memantau disiplin tim, coaching review, atau status lead yang masih tertahan."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {isHeadMonitorView ? (
                    <Link
                      href="/dashboard/kpi"
                      className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Buka KPI Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/manager-insights"
                      className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Buka Manager Insights
                    </Link>
                  )}
                  <Link
                    href="/dashboard/approvals"
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Buka Chat Review Center
                  </Link>
                  <Link
                    href="/dashboard/crm"
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Buka Lead Management
                  </Link>
                  {isHeadMonitorView ? (
                    <Link
                      href="/dashboard/manager-insights"
                      className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Buka Manager Insights
                    </Link>
                  ) : null}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function UsageHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
    </article>
  );
}
