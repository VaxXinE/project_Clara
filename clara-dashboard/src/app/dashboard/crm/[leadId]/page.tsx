"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import type {
  CurrentUser,
  LeadDetail,
  LeadTaskCreateRequest,
  LeadTaskItem,
  LeadTaskUpdateRequest,
  LeadUpdateRequest,
} from "@/types/dashboard";

const STAGE_OPTIONS = [
  "new_lead",
  "qualification",
  "education",
  "objection",
  "negotiation",
  "closing",
  "won",
  "lost",
  "unknown",
];

const TEMPERATURE_OPTIONS = ["cold", "warm", "hot", "unknown"];

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return new Date(value).toISOString();
}

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [taskErrorMessage, setTaskErrorMessage] = useState("");

  const [summaryInput, setSummaryInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [stageInput, setStageInput] = useState("new_lead");
  const [temperatureInput, setTemperatureInput] = useState("unknown");
  const [followUpInput, setFollowUpInput] = useState("");
  const [assignedUserInput, setAssignedUserInput] = useState("");

  const [taskTitleInput, setTaskTitleInput] = useState("");
  const [taskDescriptionInput, setTaskDescriptionInput] = useState("");
  const [taskDueAtInput, setTaskDueAtInput] = useState("");

  const canReassignLead = currentUser?.role === "admin" || currentUser?.role === "owner";

  async function loadLeadDetail() {
    if (!leadId) {
      setErrorMessage("Lead ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, leadDetail, scopedUsers] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<LeadDetail>(`/leads/${leadId}`),
        apiFetch<CurrentUser[]>("/auth/users"),
      ]);

      setCurrentUser(me);
      setUsers(scopedUsers.filter((user) => user.is_active));
      setLead(leadDetail);
      setSummaryInput(leadDetail.summary ?? "");
      setNotesInput(leadDetail.notes ?? "");
      setStageInput(leadDetail.current_stage);
      setTemperatureInput(leadDetail.lead_temperature);
      setFollowUpInput(toDateTimeLocalValue(leadDetail.next_follow_up_at));
      setAssignedUserInput(leadDetail.assigned_user_id ?? "");
      setSuccessMessage("");
    } catch (error) {
      setLead(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat detail lead."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLeadDetail();
  }, [leadId]);

  const openTasks = useMemo(
    () => (lead?.tasks ?? []).filter((task) => task.status === "open" || task.status === "snoozed"),
    [lead]
  );

  async function handleSaveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: LeadUpdateRequest = {
        summary: summaryInput || null,
        notes: notesInput || null,
        current_stage: stageInput,
        lead_temperature: temperatureInput,
        next_follow_up_at: fromDateTimeLocalValue(followUpInput),
      };

      if (canReassignLead) {
        payload.assigned_user_id = assignedUserInput || null;
      }

      const updatedLead = await apiFetch<LeadDetail>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: payload,
      });

      setLead(updatedLead);
      setSummaryInput(updatedLead.summary ?? "");
      setNotesInput(updatedLead.notes ?? "");
      setStageInput(updatedLead.current_stage);
      setTemperatureInput(updatedLead.lead_temperature);
      setFollowUpInput(toDateTimeLocalValue(updatedLead.next_follow_up_at));
      setAssignedUserInput(updatedLead.assigned_user_id ?? "");
      setSuccessMessage("Lead berhasil diperbarui.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan perubahan lead."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !taskTitleInput.trim()) {
      return;
    }

    setIsCreatingTask(true);
    setTaskErrorMessage("");

    try {
      const payload: LeadTaskCreateRequest = {
        task_type: "manual_follow_up",
        title: taskTitleInput.trim(),
        description: taskDescriptionInput.trim() || null,
        due_at: fromDateTimeLocalValue(taskDueAtInput),
      };

      const newTask = await apiFetch<LeadTaskItem>(`/leads/${lead.id}/tasks`, {
        method: "POST",
        body: payload,
      });

      setLead((previous) =>
        previous
          ? {
              ...previous,
              tasks: [...previous.tasks, newTask],
            }
          : previous
      );
      setTaskTitleInput("");
      setTaskDescriptionInput("");
      setTaskDueAtInput("");
    } catch (error) {
      setTaskErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat task."
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, status: string) {
    if (!lead) {
      return;
    }

    setTaskErrorMessage("");

    try {
      const payload: LeadTaskUpdateRequest = { status };
      const updatedTask = await apiFetch<LeadTaskItem>(
        `/leads/${lead.id}/tasks/${taskId}`,
        {
          method: "PATCH",
          body: payload,
        }
      );

      setLead((previous) =>
        previous
          ? {
              ...previous,
              tasks: previous.tasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task
              ),
            }
          : previous
      );
    } catch (error) {
      setTaskErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah status task."
      );
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="CRM maturity"
      title={lead?.display_name ?? "Lead Detail"}
      description="Halaman ini dipakai untuk merapikan konteks lead, menyetel follow-up berikutnya, dan membuat task yang benar-benar persisten."
      backHref="/dashboard/crm"
      backLabel="Kembali ke Lead Pipeline"
      actions={
        lead?.latest_conversation_id ? (
          <Link
            href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Buka Conversation
          </Link>
        ) : null
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading lead detail...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {lead && !isLoading && !errorMessage && (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                      lead.lead_temperature
                    )}`}
                  >
                    {lead.lead_temperature.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {lead.current_stage.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Owner: {lead.assigned_user_name ?? "Belum ada"}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 md:grid-cols-3">
                  <Metric label="Last contact" value={formatDateTime(lead.last_contact_at)} />
                  <Metric
                    label="Next follow-up"
                    value={formatDateTime(lead.next_follow_up_at)}
                  />
                  <Metric
                    label="Conversation count"
                    value={String(lead.conversation_count)}
                  />
                </dl>
              </div>

              <form
                onSubmit={(event) => void handleSaveLead(event)}
                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      Lead Context
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Update summary, notes, follow-up date, dan ownership lead.
                    </p>
                  </div>
                  {successMessage && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {successMessage}
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <Field label="Stage">
                    <select
                      value={stageInput}
                      onChange={(event) => setStageInput(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                      {STAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Lead temperature">
                    <select
                      value={temperatureInput}
                      onChange={(event) => setTemperatureInput(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    >
                      {TEMPERATURE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Next follow-up">
                    <input
                      type="datetime-local"
                      value={followUpInput}
                      onChange={(event) => setFollowUpInput(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Assigned user">
                    <select
                      value={assignedUserInput}
                      onChange={(event) => setAssignedUserInput(event.target.value)}
                      disabled={!canReassignLead}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-100"
                    >
                      <option value="">Belum ada assignee</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} • {user.role}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-5 grid gap-5">
                  <Field label="Lead summary">
                    <textarea
                      value={summaryInput}
                      onChange={(event) => setSummaryInput(event.target.value)}
                      rows={4}
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Internal notes">
                    <textarea
                      value={notesInput}
                      onChange={(event) => setNotesInput(event.target.value)}
                      rows={5}
                      className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </section>

            <aside className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    Follow-up Tasks
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Task disimpan permanen, jadi worklist sales sekarang tidak hanya derived dari conversation.
                  </p>
                </div>

                {taskErrorMessage && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {taskErrorMessage}
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {openTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Belum ada task terbuka untuk lead ini.
                    </div>
                  ) : (
                    openTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">
                              {task.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Due: {formatDateTime(task.due_at)}
                            </p>
                          </div>
                          <select
                            value={task.status}
                            onChange={(event) =>
                              void handleTaskStatusChange(task.id, event.target.value)
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400"
                          >
                            <option value="open">Open</option>
                            <option value="snoozed">Snoozed</option>
                            <option value="done">Done</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        {task.description && (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {task.description}
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <form
                  onSubmit={(event) => void handleCreateTask(event)}
                  className="mt-6 space-y-4 rounded-[24px] border border-slate-200 bg-white p-4"
                >
                  <Field label="Task title">
                    <input
                      value={taskTitleInput}
                      onChange={(event) => setTaskTitleInput(event.target.value)}
                      placeholder="Contoh: Follow up soal legalitas"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Task description">
                    <textarea
                      value={taskDescriptionInput}
                      onChange={(event) => setTaskDescriptionInput(event.target.value)}
                      rows={3}
                      placeholder="Tulis konteks singkat supaya sales berikutnya tidak kehilangan arah."
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <Field label="Due at">
                    <input
                      type="datetime-local"
                      value={taskDueAtInput}
                      onChange={(event) => setTaskDueAtInput(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={isCreatingTask}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isCreatingTask ? "Membuat task..." : "Tambah Task"}
                  </button>
                </form>
              </section>
            </aside>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
