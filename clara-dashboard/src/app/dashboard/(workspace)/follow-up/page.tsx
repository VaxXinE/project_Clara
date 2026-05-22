"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass, formatStatusLabel } from "@/lib/format";
import type {
  CurrentUser,
  LeadQueueActionRequest,
  SalesWorklistItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

function getWorklistItemKey(item: SalesWorklistItem): string {
  return `${item.lead_id}:${item.task_type}:${item.task_id ?? "derived"}`;
}

export default function FollowUpPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hiddenItemKeys, setHiddenItemKeys] = useState<string[]>([]);

  async function loadWorklist() {
    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<SalesWorklistResponse>("/dashboard/sales/worklist"),
      ]);
      setCurrentUser(me);
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
  }, []);

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

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Action center"
      title="Queue Action Center"
      description="Halaman ini menjawab pertanyaan operasional paling penting: hari ini lead mana yang harus dieksekusi dulu, kenapa, dan lifecycle action apa yang harus dilakukan sekarang."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/notifications"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Notifications
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
                    {visibleItems.length === 0
                      ? "Queue sedang relatif aman"
                      : "Kerjakan item urutan teratas lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {visibleItems.length === 0
                      ? "Kalau tidak ada item prioritas, kembali cek Queue atau Lead Management. Bisa jadi task aktif Anda memang dijadwalkan untuk besok atau hari berikutnya."
                      : "Halaman ini bukan untuk membaca semua detail dari awal. Fungsinya adalah memilih tindakan harian tercepat: buka conversation, dismiss, atau tandai done."}
                  </p>
                </div>
                <Link
                  href={
                    visibleItems[0]?.conversation_id
                      ? `/dashboard/sales/conversations/${visibleItems[0].conversation_id}`
                      : "/dashboard/sales"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {visibleItems[0] ? "Buka Prioritas Teratas" : "Buka Queue"}
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

            <section className="clara-card rounded-[28px] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prioritas Hari Ini
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {visibleItems.length} item kerja siap ditindak
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Dibuat: {formatDateTime(worklist.generated_at)}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {visibleItems.length === 0 ? (
                  <div className="clara-empty-state text-sm text-slate-500">
                    Belum ada task prioritas. Inbox Anda sedang relatif aman.
                  </div>
                ) : (
                    visibleItems.map((item, index) => (
                      <WorklistRow
                        key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}`}
                        item={item}
                        index={index}
                        isUpdating={
                          updatingTaskId === (item.task_id ?? item.lead_id)
                        }
                        onTaskAction={handleTaskAction}
                      />
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
  isUpdating,
  onTaskAction,
}: {
  item: SalesWorklistItem;
  index: number;
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

  return (
    <article className="clara-card rounded-[24px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
              #{index + 1}
            </span>
            <h3 className="text-lg font-semibold text-slate-950">{item.lead_name}</h3>
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
