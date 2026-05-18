"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel, getLeadBadgeClass, getRiskBadgeClass } from "@/lib/format";
import type {
  CurrentUser,
  SalesApprovalQueueResponse,
} from "@/types/dashboard";

export default function ApprovalQueuePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [queue, setQueue] = useState<SalesApprovalQueueResponse | null>(null);
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [actionModeFilter, setActionModeFilter] = useState("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadQueue() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const query = new URLSearchParams();
      if (riskLevelFilter !== "all") {
        query.set("risk_level", riskLevelFilter);
      }
      if (actionModeFilter !== "all") {
        query.set("action_mode", actionModeFilter);
      }
      if (ageBucketFilter !== "all") {
        query.set("age_bucket", ageBucketFilter);
      }
      const queuePath = query.size
        ? `/dashboard/sales/approval-queue?${query.toString()}`
        : "/dashboard/sales/approval-queue";
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<SalesApprovalQueueResponse>(queuePath),
      ]);
      setCurrentUser(me);
      setQueue(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat approval queue."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [riskLevelFilter, actionModeFilter, ageBucketFilter]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Approval workflow"
      title="Approval Queue"
      description="Antrian ini mengumpulkan draft yang masih pending approval atau escalation, supaya tim tidak perlu membuka conversation satu per satu."
      backHref="/dashboard/sales"
      backLabel="Kembali ke Chat Masuk"
      actions={
        <Link
          href="/dashboard/follow-up"
          className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
        >
          AI Worklist
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading approval queue...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {queue && !isLoading && !errorMessage && (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#f8fafc_100%)] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {queue.items.length === 0
                      ? "Queue sedang bersih"
                      : "Review draft paling berisiko atau paling lama dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {queue.items.length === 0
                      ? "Kalau approval queue kosong, lanjutkan operasional lewat Chat Masuk atau AI Worklist."
                      : "Halaman ini dipakai reviewer untuk mengambil keputusan cepat. Fokus ke item high risk, escalation, atau draft yang sudah terlalu lama menunggu."}
                  </p>
                </div>
                <Link
                  href={
                    queue.items[0]
                      ? `/dashboard/sales/conversations/${queue.items[0].conversation_id}`
                      : "/dashboard/sales"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {queue.items[0] ? "Review Item Teratas" : "Buka Chat Masuk"}
                </Link>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Filter seperlunya"
                  description="Gunakan filter risk, action mode, dan age hanya kalau queue sudah ramai."
                />
                <UsageHint
                  title="2. Baca draft dan recommended action"
                  description="Jangan langsung buka conversation kalau preview draft dan saran tindakan sudah cukup jelas."
                />
                <UsageHint
                  title="3. Naikkan ke lead bila konteks bisnis perlu dicek"
                  description="Gunakan Lead Detail kalau Anda butuh melihat stage, notes, follow-up, atau deal sebelum approve."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <QueueMetric
                label="Pending approvals"
                value={String(queue.pending_count)}
                hint="Semua draft yang menunggu keputusan reviewer."
              />
              <QueueMetric
                label="Escalations"
                value={String(queue.escalation_count)}
                hint="Draft berisiko tinggi atau perlu intervensi manusia."
              />
              <QueueMetric
                label="High Risk"
                value={String(queue.high_risk_count)}
                hint="Jumlah draft high risk dalam queue saat ini."
              />
              <QueueMetric
                label="Stale Items"
                value={String(queue.stale_count)}
                hint="Draft yang sudah mengendap lebih dari 72 jam."
              />
              <QueueMetric
                label="Generated at"
                value={formatDateTime(queue.generated_at)}
                hint="Waktu queue terakhir dibangun dari data terbaru."
              />
            </section>

            <section className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Filter risk</span>
                <select
                  value={riskLevelFilter}
                  onChange={(event) => setRiskLevelFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0"
                >
                  <option value="all">Semua risk</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Filter action mode</span>
                <select
                  value={actionModeFilter}
                  onChange={(event) => setActionModeFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0"
                >
                  <option value="all">Semua mode</option>
                  <option value="escalate_to_human">Escalate to human</option>
                  <option value="human_approval_required">Human approval required</option>
                  <option value="auto_approved">Auto approved</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Filter age</span>
                <select
                  value={ageBucketFilter}
                  onChange={(event) => setAgeBucketFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0"
                >
                  <option value="all">Semua age</option>
                  <option value="fresh">Fresh (&lt;24 jam)</option>
                  <option value="aging">Aging (24-72 jam)</option>
                  <option value="stale">Stale (&gt;72 jam)</option>
                </select>
              </label>
            </section>

            <section className="space-y-4">
              {queue.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Tidak ada draft yang menunggu approval saat ini. Kalau tim masih aktif membalas customer, cek Chat Masuk atau AI Worklist untuk memastikan memang tidak ada item yang tertinggal.
                </div>
              ) : (
                queue.items.map((item) => (
                  <article
                    key={item.reply_suggestion_id}
                    className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-950">
                            {item.lead_name}
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                              item.lead_temperature
                            )}`}
                          >
                            {item.lead_temperature.toUpperCase()}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(
                              item.risk_level
                            )}`}
                          >
                            Risk {item.risk_level}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.conversation_title} • {formatStatusLabel(item.current_stage)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          {formatStatusLabel(item.approval_status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {formatStatusLabel(item.action_mode)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Draft Preview
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {item.suggested_reply_preview ?? "Belum ada preview draft."}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Recommended Action
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-700">
                          {item.recommended_action}
                        </p>
                        <p className="mt-4 text-xs text-slate-500">
                          Draft created: {formatDateTime(item.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/dashboard/sales/conversations/${item.conversation_id}`}
                        className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                      >
                        Review Conversation
                      </Link>
                      {item.lead_id && (
                        <Link
                          href={`/dashboard/crm/${item.lead_id}`}
                          className="inline-flex rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                        >
                          Buka Lead Detail
                        </Link>
                      )}
                    </div>
                  </article>
                ))
              )}
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

function QueueMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </article>
  );
}
