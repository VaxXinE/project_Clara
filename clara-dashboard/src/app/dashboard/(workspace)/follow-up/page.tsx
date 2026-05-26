"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass, formatStatusLabel } from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  CurrentUser,
  LeadQueueActionRequest,
  SalesWorklistItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

function getWorklistItemKey(item: SalesWorklistItem): string {
  return `${item.lead_id}:${item.task_type}:${item.task_id ?? "derived"}`;
}

const ACTION_BUCKET_OPTIONS = [
  { value: "all", label: "Semua prioritas" },
  { value: "critical", label: "Kritis" },
  { value: "due_today", label: "Hari ini" },
  { value: "ready_to_send", label: "Siap kirim" },
  { value: "needs_analysis", label: "Perlu analisis" },
  { value: "hot_lead", label: "Hot lead" },
  { value: "other", label: "Lainnya" },
] as const;

type ActionBucketKey =
  | "critical"
  | "due_today"
  | "ready_to_send"
  | "needs_analysis"
  | "hot_lead"
  | "other";

function getTimeLabel(value: string | null): string {
  if (!value) {
    return "Belum dijadwalkan";
  }

  const target = new Date(value).getTime();
  const diffMinutes = Math.round((target - Date.now()) / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    if (diffMinutes < 0) {
      return `Telat ${Math.abs(diffMinutes)}m`;
    }
    return `Jatuh tempo ${diffMinutes}m lagi`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    if (diffHours < 0) {
      return `Telat ${Math.abs(diffHours)} jam`;
    }
    return `Jatuh tempo ${diffHours} jam lagi`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 0) {
    return `Telat ${Math.abs(diffDays)} hari`;
  }
  return `Jatuh tempo ${diffDays} hari lagi`;
}

function isOverdue(item: SalesWorklistItem): boolean {
  if (!item.next_follow_up_at) {
    return false;
  }
  return new Date(item.next_follow_up_at).getTime() <= Date.now();
}

function getActionBucket(item: SalesWorklistItem): ActionBucketKey {
  const label = `${item.task_label} ${item.reason} ${item.recommended_action}`.toLowerCase();
  const nextFollowUpTime = item.next_follow_up_at
    ? new Date(item.next_follow_up_at).getTime()
    : null;
  const hoursOverdue =
    nextFollowUpTime !== null ? (Date.now() - nextFollowUpTime) / (1000 * 60 * 60) : 0;

  if (isOverdue(item) && hoursOverdue >= 24) {
    return "critical";
  }

  if (label.includes("ready to send") || label.includes("reply")) {
    return "ready_to_send";
  }

  if (label.includes("analysis") || label.includes("analisis")) {
    return "needs_analysis";
  }

  if (item.lead_temperature === "hot") {
    return "hot_lead";
  }

  if (isOverdue(item) || item.next_follow_up_at) {
    return "due_today";
  }

  return "other";
}

function getActionBucketConfig(bucket: ActionBucketKey) {
  switch (bucket) {
    case "critical":
      return {
        label: "Kritis",
        description: "Item yang sudah telat berat atau perlu intervensi cepat sebelum makin stale.",
      };
    case "due_today":
      return {
        label: "Hari Ini",
        description: "Item yang jatuh tempo hari ini atau baru lewat sedikit dan harus dibersihkan di sesi kerja sekarang.",
      };
    case "ready_to_send":
      return {
        label: "Siap Kirim",
        description: "Item yang paling dekat ke aksi kirim atau follow-up final dan tidak butuh banyak prep lagi.",
      };
    case "needs_analysis":
      return {
        label: "Perlu Analisis",
        description: "Item yang masih butuh pembacaan AI atau konteks tambahan sebelum aman ditindak.",
      };
    case "hot_lead":
      return {
        label: "Hot Lead",
        description: "Lead dengan temperatur tinggi yang harus dijaga momentum komunikasinya.",
      };
    default:
      return {
        label: "Lainnya",
        description: "Item yang tetap aktif, tapi urgensinya di bawah kelompok prioritas utama.",
      };
  }
}

export default function FollowUpPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hiddenItemKeys, setHiddenItemKeys] = useState<string[]>([]);
  const [actionBucketFilter, setActionBucketFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadWorklist() {
    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessQueueAndActionCenter(me.role)) {
        router.replace(
          normalizeWorkspaceRole(me.role) === "head"
            ? "/dashboard/notifications"
            : "/dashboard/manager-insights",
        );
        return;
      }

      const data = await apiFetch<SalesWorklistResponse>("/dashboard/sales/worklist");
      setWorklist(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat worklist follow-up."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadWorklist();
    }, 0);

    return () => clearTimeout(timer);
  }, [router]);

  async function handleTaskAction(
    item: SalesWorklistItem,
    payload: LeadQueueActionRequest
  ) {
    setUpdatingTaskId(item.task_id ?? item.lead_id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/leads/${item.lead_id}/queue-action`, {
        method: "POST",
        body: payload,
      });
      if (payload.action === "done" || payload.action === "dismiss") {
        setHiddenItemKeys((currentKeys) => {
          const nextKey = getWorklistItemKey(item);
          if (currentKeys.includes(nextKey)) {
            return currentKeys;
          }
          return [...currentKeys, nextKey];
        });
      }
      setSuccessMessage(
        payload.action === "done"
          ? `Item ${item.lead_name} ditandai selesai.`
          : payload.action === "dismiss"
            ? `Item ${item.lead_name} disembunyikan dari action center saat ini.`
            : "Task berhasil diperbarui."
      );
      await loadWorklist();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memperbarui task."
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const visibleItems = (worklist?.items ?? []).filter(
    (item) => !hiddenItemKeys.includes(getWorklistItemKey(item))
  );
  const visibleUpcomingItems = (worklist?.upcoming_items ?? []).filter(
    (item) => !hiddenItemKeys.includes(getWorklistItemKey(item))
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredVisibleItems = useMemo(() => {
    return visibleItems.filter((item) => {
      if (actionBucketFilter !== "all" && getActionBucket(item) !== actionBucketFilter) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return [
        item.lead_name,
        item.task_label,
        item.reason,
        item.recommended_action,
        item.assigned_user_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [actionBucketFilter, normalizedSearchQuery, visibleItems]);
  const todaySections = useMemo(() => {
    const orderedBuckets: ActionBucketKey[] = [
      "critical",
      "due_today",
      "ready_to_send",
      "needs_analysis",
      "hot_lead",
      "other",
    ];

    return orderedBuckets
      .map((bucket) => ({
        bucket,
        config: getActionBucketConfig(bucket),
        items: filteredVisibleItems.filter((item) => getActionBucket(item) === bucket),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredVisibleItems]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Action center"
      title="Action Center"
      description="Halaman ini menjawab pertanyaan operasional paling penting: hari ini lead mana yang harus dieksekusi dulu, kenapa, dan tindakan follow-up apa yang harus dilakukan sekarang."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/notifications"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Alert Center
          </Link>
          <Link
            href="/dashboard/sales"
            className="clara-button clara-button-ghost"
          >
            Queue
          </Link>
          <Link
            href="/dashboard/crm"
            className="clara-button clara-button-ghost"
          >
            Lead Management
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading action center...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {!isLoading && worklist && (
          <>
            <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fef2f2_0%,#ffffff_45%,#eef2ff_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {filteredVisibleItems.length === 0
                      ? "Queue sedang relatif aman"
                      : "Kerjakan bucket paling kritis lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {filteredVisibleItems.length === 0
                      ? "Kalau tidak ada item prioritas, kembali cek Queue atau Lead Management. Bisa jadi task aktif Anda memang dijadwalkan untuk besok atau hari berikutnya."
                      : "Action Center ini dipakai untuk triase harian. Bersihkan item kritis dulu, lalu lanjutkan ke task yang jatuh tempo hari ini dan hot lead."}
                  </p>
                </div>
                <Link
                  href={
                    filteredVisibleItems[0]?.conversation_id
                      ? `/dashboard/sales/conversations/${filteredVisibleItems[0].conversation_id}`
                      : "/dashboard/sales"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {filteredVisibleItems[0] ? "Buka Prioritas Teratas" : "Buka Queue"}
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Ambil item paling atas"
                  description="Urutannya sudah diprioritaskan. Anda tidak perlu memilah dari nol kecuali ada konteks khusus."
                />
                <UsageHint
                  title="2. Putuskan lifecycle action"
                  description="Buka conversation kalau perlu konteks, dismiss kalau tidak relevan sementara, dan done kalau task benar-benar selesai."
                />
                <UsageHint
                  title="3. Rapikan lead bila perlu"
                  description="Kalau follow-up mengubah status bisnis lead, rapikan stage, notes, atau deal di halaman Lead Management."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Follow-up Overdue" value={String(worklist.overdue_count)} />
              <MetricCard label="Hot Lead Alert" value={String(worklist.hot_lead_count)} />
              <MetricCard label="Ready to Send" value={String(worklist.ready_to_send_count)} />
              <MetricCard
                label="Needs Analysis"
                value={String(worklist.pending_analysis_count)}
              />
              {/* <MetricCard label="Snoozed Tasks" value={String(worklist.snoozed_count)} /> */}
              <MetricCard
                label="Done Today"
                value={String(worklist.completed_today_count)}
              />
              <MetricCard
                label="Due Today"
                value={String(worklist.due_today_count)}
              />
              <MetricCard
                label="Open Tasks"
                value={String(worklist.open_task_count)}
              />
              <MetricCard
                label="Overdue >24h"
                value={String(worklist.overdue_24h_count)}
              />
              <MetricCard
                label="Overdue >72h"
                value={String(worklist.overdue_72h_count)}
              />
              <MetricCard
                label="Completion Rate"
                value={`${worklist.completion_rate_today.toFixed(1)}%`}
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#fff7ed_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="space-y-4 rounded-[24px] border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Kontrol Action Center
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                      Prioritaskan task harian dari satu toolbar
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Gunakan pencarian dan bucket kerja untuk memisahkan item kritis, due today, dan pekerjaan yang masih butuh analisis.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionMetaPill
                      label="Kritis"
                      value={String(worklist.overdue_24h_count)}
                    />
                    <ActionMetaPill
                      label="Due Today"
                      value={String(worklist.due_today_count)}
                    />
                    <ActionMetaPill
                      label="Hot Lead"
                      value={String(worklist.hot_lead_count)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Cari lead atau alasan task</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari lead, task label, reason, atau recommended action..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Filter bucket kerja</span>
                    <select
                      value={actionBucketFilter}
                      onChange={(event) => setActionBucketFilter(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      {ACTION_BUCKET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-slate-200 shadow-[0_12px_24px_rgba(15,23,42,0.1)]">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  Hasil
                </span>
                <span>
                  Menampilkan <span className="font-semibold text-white">{filteredVisibleItems.length}</span> dari{" "}
                  <span className="font-semibold text-white">{visibleItems.length}</span> item prioritas hari ini.
                </span>
              </div>
            </section>

            <section className="clara-card rounded-[28px] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prioritas Hari Ini
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {filteredVisibleItems.length} item kerja siap ditindak
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Dibuat: {formatDateTime(worklist.generated_at)}
                </p>
              </div>

              <div className="mt-5 space-y-5">
                {filteredVisibleItems.length === 0 ? (
                  <div className="clara-empty-state text-sm text-slate-500">
                    Belum ada task prioritas. Inbox Anda sedang relatif aman.
                  </div>
                ) : (
                  todaySections.map((section) => (
                    <div key={section.bucket} className="space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {section.config.label}
                          </p>
                          <h3 className="mt-1 text-xl font-bold text-slate-950">
                            {section.items.length} item
                          </h3>
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-slate-500">
                          {section.config.description}
                        </p>
                      </div>

                      {section.items.map((item, index) => (
                        <WorklistRow
                          key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}`}
                          item={item}
                          index={index}
                          bucket={section.bucket}
                          isUpdating={
                            updatingTaskId === (item.task_id ?? item.lead_id)
                          }
                          onTaskAction={handleTaskAction}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="clara-card rounded-[28px] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prioritas Berikutnya
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {visibleUpcomingItems.length} item follow-up untuk besok dan seterusnya
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Task ini belum jatuh tempo hari ini, jadi disimpan terpisah supaya queue harian tetap bersih.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {visibleUpcomingItems.length === 0 ? (
                  <div className="clara-empty-state text-sm text-slate-500">
                    Belum ada task future. Semua follow-up aktif Anda sudah masuk prioritas hari ini atau belum dibuat jadwal berikutnya.
                  </div>
                ) : (
                  visibleUpcomingItems.map((item, index) => (
                    <WorklistRow
                      key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}-upcoming`}
                      item={item}
                      index={index}
                      bucket={getActionBucket(item)}
                      isUpdating={
                        updatingTaskId === (item.task_id ?? item.lead_id)
                      }
                      onTaskAction={handleTaskAction}
                    />
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
    <article className="clara-card rounded-[24px] p-5">
      <p className="clara-kicker text-[11px] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function WorklistRow({
  item,
  index,
  bucket,
  isUpdating,
  onTaskAction,
}: {
  item: SalesWorklistItem;
  index: number;
  bucket: ActionBucketKey;
  isUpdating: boolean;
  onTaskAction: (
    item: SalesWorklistItem,
    payload: LeadQueueActionRequest
  ) => Promise<void>;
}) {
  const [reasonTag, setReasonTag] = useState("follow_up_executed");
  const [reasonNote, setReasonNote] = useState("");

  function buildPayload(
    action: LeadQueueActionRequest["action"],
    duration?: LeadQueueActionRequest["duration"]
  ): LeadQueueActionRequest {
    return {
      action,
      duration: duration ?? null,
      reason_tag: reasonTag,
      reason_note: reasonNote.trim() || null,
    };
  }

  const bucketConfig = getActionBucketConfig(bucket);
  const slaLabel = getTimeLabel(item.next_follow_up_at);
  const isItemOverdue = isOverdue(item);

  return (
    <article className="clara-card rounded-[24px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
              #{index + 1}
            </span>
            <h3 className="text-lg font-semibold text-slate-950">{item.lead_name}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {bucketConfig.label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                item.lead_temperature
              )}`}
            >
              {item.lead_temperature.toUpperCase()}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {formatStatusLabel(item.current_stage)}
            </span>
            {item.task_status ? (
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                Task: {formatStatusLabel(item.task_status)}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                isItemOverdue
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {slaLabel}
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-900">{item.task_label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="clara-card-soft rounded-2xl p-4">
              <p className="clara-kicker text-[11px]">Recommended Action</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {item.recommended_action}
              </p>
            </div>

            <div className="clara-card-soft rounded-2xl p-4 text-sm text-slate-600">
              <p>Last contact: {formatDateTime(item.last_contact_at)}</p>
              <p className="mt-2">
                Next follow-up: {formatDateTime(item.next_follow_up_at)}
              </p>
              <p className="mt-2">Assignee: {item.assigned_user_name ?? "Belum ada"}</p>
              <p className="mt-2">Priority score: {item.priority_score}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Reason Tag
              </label>
              <select
                value={reasonTag}
                onChange={(event) => setReasonTag(event.target.value)}
                className="clara-select mt-2"
                disabled={isUpdating}
              >
                <option value="follow_up_executed">follow_up_executed</option>
                <option value="waiting_customer">waiting_customer</option>
                <option value="needs_more_context">needs_more_context</option>
                <option value="not_priority_now">not_priority_now</option>
                <option value="duplicate_or_noise">duplicate_or_noise</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Reason Note
              </label>
              <input
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                className="clara-input mt-2"
                placeholder="Catatan singkat kenapa action ini dipilih"
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-60">
          {item.conversation_id && (
            <Link
              href={`/dashboard/sales/conversations/${item.conversation_id}`}
              className="clara-button clara-button-primary"
            >
              Buka Conversation
            </Link>
          )}
          <Link
            href={`/dashboard/crm/${item.lead_id}`}
            className="clara-button clara-button-ghost"
          >
            Buka Lead Management
          </Link>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              void onTaskAction(item, buildPayload("done"));
            }}
            className="clara-button bg-emerald-600 text-white"
          >
            {isUpdating ? "Memproses..." : "Done"}
          </button>
          {/* Snooze UI disembunyikan sementara, backend state tetap dipertahankan untuk kompatibilitas data lama.
          {item.task_status === "snoozed" ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => {
                void onTaskAction(item, buildPayload("reopen"));
              }}
              className="clara-button clara-button-ghost"
            >
              Reopen
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  void onTaskAction(item, buildPayload("snooze", "30m"));
                }}
                className="clara-button border border-amber-300 bg-amber-50 text-amber-800"
              >
                Snooze 30m
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  void onTaskAction(item, buildPayload("snooze", "2h"));
                }}
                className="clara-button border border-amber-300 bg-amber-50 text-amber-800"
              >
                Snooze 2h
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  void onTaskAction(item, buildPayload("snooze", "tomorrow"));
                }}
                className="clara-button border border-amber-300 bg-amber-50 text-amber-800"
              >
                Snooze Besok
              </button>
            </>
          )} */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              void onTaskAction(item, buildPayload("dismiss"));
            }}
            className="clara-button border border-rose-300 bg-rose-50 text-rose-800"
          >
            Dismiss
          </button>
        </div>
      </div>
    </article>
  );
}

function ActionMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <span className="ml-2 text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}
