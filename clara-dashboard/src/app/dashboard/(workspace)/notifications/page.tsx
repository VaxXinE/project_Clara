"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessQueueAndActionCenter, isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResolveRequest,
  OpsNotificationResponse,
} from "@/types/dashboard";

type NotificationGroup = {
  ownerName: string;
  items: OpsNotificationItem[];
};

function getSeverityClass(severity: string) {
  if (severity === "high") {
    return "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]";
  }
  if (severity === "medium") {
    return "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]";
  }
  return "border border-[#f0cb73]/18 bg-[#1f170f] text-[#f0cb73]";
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

  if (isManagerRole(role) && !canAccessQueueAndActionCenter(role)) {
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
        error instanceof Error ? error.message : "Gagal memuat alert center."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapNotifications() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [me, data] = await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<OpsNotificationResponse>("/dashboard/notifications"),
        ]);
        if (isCancelled) {
          return;
        }
        setCurrentUser(me);
        setNotifications(data);
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Gagal memuat alert center.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapNotifications();

    return () => {
      isCancelled = true;
    };
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

  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const isManagerMonitorView =
    isManagerRole(currentUser?.role) && !canAccessQueue;
  const isHeadMonitorView = isHeadRole(currentUser?.role);
  const isOversightAlertView = isManagerMonitorView || isHeadMonitorView;

  const roleScopedNotifications = useMemo(() => {
    const items = notifications?.items ?? [];

    if (!isOversightAlertView) {
      return items;
    }

    return items.filter((item) => item.workflow_scope === "head_follow_up");
  }, [isOversightAlertView, notifications?.items]);

  const filteredNotifications = useMemo(() => {
    const items = roleScopedNotifications;

    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesSeverity =
        severityFilter === "all" || item.severity === severityFilter;
      return matchesStatus && matchesSeverity;
    });
  }, [roleScopedNotifications, severityFilter, statusFilter]);

  const totalNotificationPages = Math.max(
    1,
    Math.ceil(filteredNotifications.length / pageSize),
  );
  const effectiveNotificationPage = Math.min(
    notificationPage,
    totalNotificationPages,
  );

  const paginatedNotifications = useMemo(() => {
    const startIndex = (effectiveNotificationPage - 1) * pageSize;
    return filteredNotifications.slice(startIndex, startIndex + pageSize);
  }, [effectiveNotificationPage, filteredNotifications]);

  const groupedNotifications = useMemo<NotificationGroup[]>(() => {
    const groups = new Map<string, OpsNotificationItem[]>();

    for (const item of paginatedNotifications) {
      const ownerName = item.sales_owner_name?.trim() || "Belum ada owner";
      const existing = groups.get(ownerName);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(ownerName, [item]);
      }
    }

    return Array.from(groups.entries()).map(([ownerName, items]) => ({
      ownerName,
      items,
    }));
  }, [paginatedNotifications]);

  const scopedCounts = useMemo(
    () => ({
      active: roleScopedNotifications.filter((item) => item.status === "active").length,
      acknowledged: roleScopedNotifications.filter((item) => item.status === "acknowledged")
        .length,
      resolved: roleScopedNotifications.filter((item) => item.status === "resolved").length,
      escalated: roleScopedNotifications.filter((item) => item.escalation_level !== "none")
        .length,
    }),
    [roleScopedNotifications],
  );

  const hasAnyNotifications = roleScopedNotifications.length > 0;
  const isActiveStatusView = statusFilter === "active";
  const showActiveEmptyState =
    hasAnyNotifications && isActiveStatusView && filteredNotifications.length === 0;
  const headPrimaryAlert = isHeadMonitorView ? roleScopedNotifications[0] ?? null : null;
  const headAlertSummary = isHeadMonitorView
    ? scopedCounts.active > 0
      ? `Ada ${scopedCounts.active} alert aktif yang sudah masuk radar Head. Mulai dari yang paling berisiko, lalu putuskan apakah cukup dipantau, perlu ditekan ke manager, atau harus dinaikkan levelnya.`
      : scopedCounts.resolved > 0
        ? "Tidak ada alert aktif saat ini. Kalau perlu, buka histori selesai untuk membaca pola masalah yang baru lewat."
        : "Belum ada sinyal lintas tim yang cukup besar untuk masuk radar Head."
    : "";
  const filterSummaryText = isHeadMonitorView
    ? `Menampilkan ${paginatedNotifications.length} dari ${filteredNotifications.length} alert yang relevan untuk keputusan Head.`
    : `Menampilkan ${paginatedNotifications.length} dari ${filteredNotifications.length} alert`;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={
        isHeadMonitorView
          ? "Alert Tim"
          : isOversightAlertView
            ? "Manager follow-up"
            : "Operational orchestration"
      }
      title={isHeadMonitorView ? "Alert Tim" : "Alert Center"}
      description={
        isHeadMonitorView
          ? "Halaman ini dipakai Head untuk membaca alert lintas tim yang paling penting, lalu cepat memutuskan area mana yang perlu dipantau, ditekan, atau dinaikkan eskalasinya."
          : isOversightAlertView
            ? "Halaman ini dipakai manager untuk mengecek follow-up sales yang mulai overdue, lead yang belum ditindak, dan titik yang perlu segera ditekan ke tim."
          : "Tempat untuk melihat sinyal operasional yang harus segera ditindak: follow-up overdue, chat review kritis, dan alert KPI yang relevan dengan role Anda."
      }
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <>
          {currentUser && canAccessQueueAndActionCenter(currentUser.role) ? (
            <Link
              href="/dashboard/follow-up"
              className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
            >
              Action Center
            </Link>
          ) : (
            <Link
              href={isHeadMonitorView ? "/dashboard/crm" : "/dashboard/manager-insights"}
              className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
            >
              {isHeadMonitorView ? "Buka Lead Tim" : "Monitor Tim"}
            </Link>
          )}
          <Link
            href="/dashboard/approvals"
            className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:brightness-105"
          >
            {isHeadMonitorView ? "Buka Arahan Tim" : "Review Sales"}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state p-8 text-center text-sm text-[#d6bb84]">
            Loading alert center...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5 text-sm text-[#f0cb73]">
            {errorMessage}
          </div>
        )}

        {notifications && !isLoading && !errorMessage && (
          <>
            {isHeadMonitorView ? (
              <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                      Ringkasan hari ini
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#fff0c9]">
                      Prioritaskan alert yang benar-benar butuh keputusan Head
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[#e3c990]">
                      {headAlertSummary}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/dashboard/manager-insights"
                      className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                    >
                      Buka Head Insight
                    </Link>
                    <Link
                      href="/dashboard/approvals"
                      className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:brightness-105"
                    >
                      Buka Arahan Tim
                    </Link>
                  </div>
                </div>

                {headPrimaryAlert ? (
                  <div className="mt-5 rounded-[24px] border border-[#f0cb73]/14 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                      Alert teratas untuk dibaca dulu
                    </p>
                    <p className="mt-2 text-base font-semibold text-[#fff0c9]">
                      {headPrimaryAlert.lead_name ?? headPrimaryAlert.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                      {headPrimaryAlert.body}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {hasAnyNotifications ? (
              <>
                {!showActiveEmptyState ? (
                  <>
                    <section className="grid gap-4 md:grid-cols-3">
                      <MetricCard
                        label={
                          isHeadMonitorView
                            ? "Butuh keputusan"
                            : isOversightAlertView
                              ? "Perlu Follow-up"
                              : "Active"
                        }
                        value={String(scopedCounts.active)}
                      />
                      <MetricCard
                        label={
                          isHeadMonitorView
                            ? "Sudah ditinjau"
                            : isOversightAlertView
                              ? "Sudah Dicek"
                              : "Acknowledged"
                        }
                        value={String(scopedCounts.acknowledged)}
                      />
                      <MetricCard
                        label={
                          isHeadMonitorView
                            ? "Sudah ditutup"
                            : isOversightAlertView
                              ? "Selesai"
                              : "Resolved"
                        }
                        value={String(scopedCounts.resolved)}
                      />
                    </section>

                    <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                      <div
                        className={`grid gap-4 ${isOversightAlertView ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}
                      >
                        <MetricCard
                          label={isHeadMonitorView ? "Naik level" : "Escalated"}
                          value={String(scopedCounts.escalated)}
                        />
                        <MetricCard
                          label={isHeadMonitorView ? "Data terakhir" : "Generated"}
                          value={formatDateTime(notifications.generated_at)}
                        />
                        {!isOversightAlertView ? (
                          <div className="rounded-[28px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-6 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                              Resolution Note
                            </p>
                            <textarea
                              value={resolutionNote}
                              onChange={(event) => {
                                setResolutionNote(event.target.value);
                              }}
                              placeholder="Catatan saat resolve notification..."
                              className="mt-3 min-h-[88px] w-full rounded-2xl border border-[#4a3618] bg-[#1a130d] p-3 text-sm text-[#f7e7b7] outline-none placeholder:text-[#907953]"
                            />
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                          Tidak Ada Alert Aktif
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-[#fff0c9]">
                          {isOversightAlertView
                            ? isHeadMonitorView
                              ? "Belum ada area tim yang perlu ditekan sekarang"
                              : "Tidak ada follow-up sales yang perlu ditekan sekarang"
                            : "Tidak ada sinyal operasional yang perlu ditangani sekarang"}
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#e3c990]">
                          {isOversightAlertView
                            ? isHeadMonitorView
                              ? "Kalau area ini kosong, berarti belum ada tim yang sedang bocor di follow-up. Langkah berikutnya biasanya cek lead tim, monitor tim, atau histori alert yang sudah selesai."
                              : "Kalau area ini kosong, berarti belum ada sales yang sedang bocor di follow-up. Langkah berikutnya biasanya cek lead tim, monitor tim, atau histori alert follow-up yang sudah selesai."
                            : `Fokus halaman ini adalah alert aktif. Karena sekarang kosong, lanjutkan kerja dari ${
                                canAccessQueue
                                  ? "Action Center, Queue, atau Lead Management"
                                  : isHeadMonitorView
                                    ? "Head Insight, Lead Tim, atau Arahan Tim"
                                    : "Monitor Tim atau Review Sales"
                              }.`}
                          {scopedCounts.resolved > 0
                            ? ` Ada ${scopedCounts.resolved} alert resolved yang bisa dibuka kalau kamu butuh melihat histori.`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter("resolved");
                            setNotificationPage(1);
                          }}
                          className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c]"
                        >
                          Lihat Histori Alert
                        </button>
                        <Link
                          href={
                            canAccessQueue
                              ? "/dashboard/follow-up"
                              : isHeadMonitorView
                                ? "/dashboard/manager-insights"
                                : "/dashboard/manager-insights"
                          }
                          className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
                        >
                          {canAccessQueue
                            ? "Buka Action Center"
                            : isHeadMonitorView
                              ? "Buka Head Insight"
                              : "Buka Monitor Tim"}
                        </Link>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <MetricCard
                        label={
                          isHeadMonitorView
                            ? "Butuh keputusan"
                            : isOversightAlertView
                              ? "Perlu Follow-up"
                              : "Active"
                        }
                        value={String(scopedCounts.active)}
                      />
                      <MetricCard
                        label={
                          isHeadMonitorView
                            ? "Sudah ditutup"
                            : isOversightAlertView
                              ? "Selesai"
                              : "Resolved"
                        }
                        value={String(scopedCounts.resolved)}
                      />
                      <MetricCard
                        label={isHeadMonitorView ? "Data terakhir" : "Generated"}
                        value={formatDateTime(notifications.generated_at)}
                      />
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                  <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
                        {isHeadMonitorView ? "Saring radar head" : "Saring alert"}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[#fff0c9]">
                        {isHeadMonitorView
                          ? "Tampilkan hanya alert yang memang perlu dibaca Head dulu"
                          : "Tampilkan hanya alert yang memang ingin Anda baca dulu"}
                      </h3>
                    </div>
                    <p className="text-sm text-[#d8bc84]">{filterSummaryText}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                      <span>Filter status</span>
                      <select
                        value={statusFilter}
                        onChange={(event) => {
                          setStatusFilter(event.target.value);
                          setNotificationPage(1);
                        }}
                        className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none"
                      >
                        <option value="all">Semua status</option>
                        <option value="active">Active</option>
                        <option value="acknowledged">Acknowledged</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>

                    <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                      <span>Filter severity</span>
                      <select
                        value={severityFilter}
                        onChange={(event) => {
                          setSeverityFilter(event.target.value);
                          setNotificationPage(1);
                        }}
                        className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none"
                      >
                        <option value="all">Semua severity</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>

                    <div className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4 xl:col-span-2">
                      <p className="text-sm text-[#d8bc84]">{filterSummaryText}</p>
                      <p className="mt-2 text-sm text-[#d8bc84]">
                        Halaman {effectiveNotificationPage} dari {totalNotificationPages}
                        {isHeadMonitorView
                          ? " • pakai status aktif kalau mau fokus ke keputusan hari ini"
                          : ""}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  {filteredNotifications.length === 0 ? (
                    <div className="clara-empty-state border-dashed p-8 text-center text-sm text-[#d6bb84]">
                      Tidak ada alert yang cocok dengan filter saat ini. Coba ubah status atau severity untuk melihat histori alert lain.
                    </div>
                  ) : isOversightAlertView ? (
                    groupedNotifications.map((group) => (
                      <section
                        key={group.ownerName}
                        className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(27,20,14,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0cb73]/12 pb-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
                              {isHeadMonitorView ? "PIC sales" : "Sales Owner"}
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-[#fff0c9]">
                              {group.ownerName}
                            </h2>
                          </div>
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                            {group.items.length} follow-up
                          </span>
                        </div>

                        <div className="mt-4 space-y-4">
                          {group.items.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                            >
                              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-[#fff0c9]">
                                      {item.lead_name ?? item.title}
                                    </h3>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getSeverityClass(
                                        item.severity
                                      )}`}
                                    >
                                      {item.severity.toUpperCase()}
                                    </span>
                                    <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                      {formatStatusLabel(item.status)}
                                    </span>
                                    <span className="rounded-full border border-[#f0cb73]/18 bg-[#1f170f] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                      Age: {formatStatusLabel(item.age_bucket)}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-sm leading-7 text-[#fff0c9]">
                                    {item.title}
                                  </p>
                                  <p className="mt-2 text-sm leading-7 text-[#d6bb84]">
                                    {item.body}
                                  </p>
                                  <p className="mt-3 text-xs text-[#b89a62]">
                                    Dibuat: {formatDateTime(item.created_at)} | Update:{" "}
                                    {formatDateTime(item.updated_at)}
                                  </p>
                                  {item.resolution_note ? (
                                    <p className="mt-3 rounded-xl border border-[#f0cb73]/16 bg-[#1d150d] p-3 text-sm text-[#f0cb73]">
                                      Resolution note: {item.resolution_note}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex w-full flex-col gap-2 xl:w-64 xl:flex-none">
                                  {resolveNotificationTargetHref(item.target_href, currentUser?.role) ? (
                                    <Link
                                      href={
                                        resolveNotificationTargetHref(
                                          item.target_href,
                                          currentUser?.role,
                                        ) as string
                                      }
                                      className="inline-flex justify-center rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
                                  >
                                      {isHeadMonitorView ? "Buka konteks" : "Buka Follow-up"}
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
                                        className="inline-flex justify-center rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {updatingId === item.id ? "Memproses..." : isHeadMonitorView ? "Tandai dibaca" : "Sudah Dicek"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={updatingId === item.id}
                                        onClick={() => {
                                          void handleResolve(item);
                                        }}
                                        className="inline-flex justify-center rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        {isHeadMonitorView ? "Tandai selesai" : "Tandai Selesai"}
                                      </button>
                                    </>
                                  ) : null}
                                  {item.status === "resolved" ? (
                                    <button
                                      type="button"
                                      disabled={updatingId === item.id}
                                      onClick={() => {
                                        void handleReopen(item);
                                      }}
                                      className="inline-flex justify-center rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      Reopen
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    paginatedNotifications.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.22)]"
                      >
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold text-[#fff0c9]">
                                {item.title}
                              </h2>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getSeverityClass(
                                  item.severity
                                )}`}
                              >
                                {item.severity.toUpperCase()}
                              </span>
                              <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                {formatStatusLabel(item.status)}
                              </span>
                              <span className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                Delivery: {formatStatusLabel(item.delivery_status)}
                              </span>
                              <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                Escalation: {formatStatusLabel(item.escalation_level)}
                              </span>
                              <span className="rounded-full border border-[#f0cb73]/18 bg-[#1f170f] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                Age: {formatStatusLabel(item.age_bucket)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-[#d6bb84]">
                              {item.body}
                            </p>
                            <p className="mt-3 text-xs text-[#b89a62]">
                              Dibuat: {formatDateTime(item.created_at)} | Update:{" "}
                              {formatDateTime(item.updated_at)}
                            </p>
                            {item.resolution_note ? (
                              <p className="mt-3 rounded-xl border border-[#f0cb73]/16 bg-[#1d150d] p-3 text-sm text-[#f0cb73]">
                                Resolution note: {item.resolution_note}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex w-full flex-col gap-2 xl:w-64 xl:flex-none">
                            {resolveNotificationTargetHref(item.target_href, currentUser?.role) ? (
                              <Link
                                href={
                                  resolveNotificationTargetHref(
                                    item.target_href,
                                    currentUser?.role,
                                  ) as string
                                }
                                className="inline-flex justify-center rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
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
                                  className="inline-flex justify-center rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {updatingId === item.id ? "Memproses..." : "Acknowledge"}
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingId === item.id}
                                  onClick={() => {
                                    void handleResolve(item);
                                  }}
                                  className="inline-flex justify-center rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] disabled:cursor-not-allowed disabled:opacity-70"
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
                                    className="inline-flex justify-center rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-4 py-2.5 text-sm font-semibold text-[#f0cb73] disabled:cursor-not-allowed disabled:opacity-70"
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
                                className="inline-flex justify-center rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-70"
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
                  <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[#d8bc84]">Navigasi daftar alert</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationPage((current) => Math.max(1, current - 1))
                          }
                          disabled={effectiveNotificationPage === 1}
                          className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-50"
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
                          disabled={effectiveNotificationPage === totalNotificationPages}
                          className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                  Lanjutkan Dari Sini
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#e3c990]">
                  {isHeadMonitorView
                    ? "Saat Alert Tim kosong, itu artinya follow-up tim sedang relatif aman. Untuk role Head, langkah berikutnya biasanya lanjut ke Head Insight, Lead Tim, lalu cek pipeline yang masih tertahan."
                    : "Saat Alert Center kosong, itu artinya tidak ada sinyal operasional yang sedang meledak. Untuk role manager, langkah berikutnya biasanya memantau tim, review balasan sales, atau cek lead yang masih tertahan."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {isHeadMonitorView ? (
                    <Link
                      href="/dashboard/manager-insights"
                      className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
                    >
                      Buka Head Insight
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/manager-insights"
                      className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
                    >
                      Buka Head Insight
                    </Link>
                  )}
                  <Link
                    href="/dashboard/approvals"
                    className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c]"
                  >
                    {isHeadMonitorView ? "Buka Arahan Tim" : "Buka Review Sales"}
                  </Link>
                  <Link
                    href="/dashboard/crm"
                    className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c]"
                  >
                    Buka Lead Tim
                  </Link>
                  {isHeadMonitorView ? (
                    null
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-[#140f08]">{value}</p>
    </article>
  );
}
