"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass, formatStatusLabel } from "@/lib/format";
import type {
  CurrentUser,
  SalesWorklistItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

export default function FollowUpPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
    void loadWorklist();
  }, []);

  async function handleTaskAction(
    item: SalesWorklistItem,
    action: "done" | "snooze" | "reopen"
  ) {
    if (!item.task_id) {
      return;
    }

    setUpdatingTaskId(item.task_id);
    setErrorMessage("");

    try {
      const body =
        action === "done"
          ? { status: "done", notes: "Task diselesaikan dari AI Follow-up Worklist." }
          : action === "reopen"
            ? { status: "open", notes: "Task dibuka lagi dari AI Follow-up Worklist." }
            : {
                status: "snoozed",
                due_at: new Date(
                  (item.next_follow_up_at
                    ? new Date(item.next_follow_up_at).getTime()
                    : Date.now()) +
                    24 * 60 * 60 * 1000
                ).toISOString(),
                notes: "Task di-snooze 1 hari dari AI Follow-up Worklist.",
              };

      await apiFetch(`/leads/${item.lead_id}/tasks/${item.task_id}`, {
        method: "PATCH",
        body,
      });
      await loadWorklist();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memperbarui task."
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Daily workflow"
      title="AI Follow-up Worklist"
      description="Halaman ini menjawab pertanyaan operasional paling penting: hari ini siapa yang harus dihubungi dulu, kenapa, dan langkah konkret apa yang harus dilakukan."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/sales"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Conversation Inbox
          </Link>
          <Link
            href="/dashboard/crm"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Lead Pipeline
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading worklist...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!isLoading && worklist && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Follow-up Overdue" value={String(worklist.overdue_count)} />
              <MetricCard label="Hot Lead Alert" value={String(worklist.hot_lead_count)} />
              <MetricCard label="Ready to Send" value={String(worklist.ready_to_send_count)} />
              <MetricCard
                label="Needs Analysis"
                value={String(worklist.pending_analysis_count)}
              />
              <MetricCard label="Snoozed Tasks" value={String(worklist.snoozed_count)} />
              <MetricCard
                label="Done Today"
                value={String(worklist.completed_today_count)}
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prioritas Hari Ini
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {worklist.items.length} item kerja siap ditindak
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  Dibuat: {formatDateTime(worklist.generated_at)}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {worklist.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Belum ada task prioritas. Inbox Anda sedang relatif aman.
                  </div>
                ) : (
                    worklist.items.map((item, index) => (
                      <WorklistRow
                        key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}`}
                        item={item}
                        index={index}
                        isUpdating={updatingTaskId === item.task_id}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
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
    action: "done" | "snooze" | "reopen"
  ) => Promise<void>;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommended Action
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {item.recommended_action}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p>Last contact: {formatDateTime(item.last_contact_at)}</p>
              <p className="mt-2">
                Next follow-up: {formatDateTime(item.next_follow_up_at)}
              </p>
              <p className="mt-2">Assignee: {item.assigned_user_name ?? "Belum ada"}</p>
              <p className="mt-2">Priority score: {item.priority_score}</p>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-60">
          {item.conversation_id && (
            <Link
              href={`/dashboard/sales/conversations/${item.conversation_id}`}
              className="inline-flex justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Buka Conversation
            </Link>
          )}
          <Link
            href="/dashboard/crm"
            className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Buka Lead Pipeline
          </Link>
          {item.task_id ? (
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  void onTaskAction(item, "done");
                }}
                className="inline-flex justify-center rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdating ? "Memproses..." : "Mark Done"}
              </button>
              {item.task_status === "snoozed" ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    void onTaskAction(item, "reopen");
                  }}
                  className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Reopen Task
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    void onTaskAction(item, "snooze");
                  }}
                  className="inline-flex justify-center rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Snooze 1 Hari
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
