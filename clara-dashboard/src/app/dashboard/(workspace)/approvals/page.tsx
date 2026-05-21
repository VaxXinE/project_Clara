"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getLeadBadgeClass,
  getRiskBadgeClass,
} from "@/lib/format";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  CurrentUser,
} from "@/types/dashboard";

export default function ChatReviewCenterPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [queue, setQueue] = useState<ChatReviewCenterResponse | null>(null);
  const [reviewBucketFilter, setReviewBucketFilter] = useState("all");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState("all");
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  function buildQueuePath(filters?: {
    reviewBucket?: string;
    riskLevel?: string;
    ageBucket?: string;
    sourceChannel?: string;
  }) {
    const resolvedFilters = {
      reviewBucket: filters?.reviewBucket ?? reviewBucketFilter,
      riskLevel: filters?.riskLevel ?? riskLevelFilter,
      ageBucket: filters?.ageBucket ?? ageBucketFilter,
      sourceChannel: filters?.sourceChannel ?? sourceChannelFilter,
    };

    const query = new URLSearchParams();
    if (resolvedFilters.reviewBucket !== "all") {
      query.set("review_bucket", resolvedFilters.reviewBucket);
    }
    if (resolvedFilters.riskLevel !== "all") {
      query.set("risk_level", resolvedFilters.riskLevel);
    }
    if (resolvedFilters.ageBucket !== "all") {
      query.set("age_bucket", resolvedFilters.ageBucket);
    }
    if (resolvedFilters.sourceChannel !== "all") {
      query.set("source_channel", resolvedFilters.sourceChannel);
    }

    return query.size
      ? `/dashboard/sales/chat-review-center?${query.toString()}`
      : "/dashboard/sales/chat-review-center";
  }

  async function loadQueue(filters?: {
    reviewBucket?: string;
    riskLevel?: string;
    ageBucket?: string;
    sourceChannel?: string;
  }) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<ChatReviewCenterResponse>(buildQueuePath(filters)),
      ]);

      setCurrentUser(me);
      setQueue(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat chat review center.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadQueue();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnalyze(conversationId: string) {
    const nextActionKey = `${conversationId}:analyze`;
    setActionKey(nextActionKey);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/analyze`, {
        method: "POST",
      });
      await loadQueue();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menjalankan AI analysis.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function handleGenerateReply(conversationId: string) {
    const nextActionKey = `${conversationId}:reply`;
    setActionKey(nextActionKey);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/reply-suggestions`, {
        method: "POST",
      });
      await loadQueue();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal membuat draft balasan.",
      );
    } finally {
      setActionKey(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Review workflow"
      title="Chat Review Center"
      description="Satu layar untuk membaca chat yang perlu analisis ulang, butuh draft baru, menunggu approval, atau harus dinaikkan ke reviewer manusia."
      backHref="/dashboard/sales"
      backLabel="Kembali ke Queue"
      actions={
        <Link
          href="/dashboard/follow-up"
          className="clara-button clara-button-primary"
        >
          Buka Action Center
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading chat review center...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {queue && !isLoading && !errorMessage && (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_42%,#f8fafc_100%)] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {queue.items.length === 0
                      ? "Tidak ada chat yang macet saat ini"
                      : "Ambil item paling berisiko atau paling lama menunggu dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {queue.items.length === 0
                      ? "Kalau review center kosong, lanjutkan eksekusi lewat queue dan action center."
                      : "Halaman ini dipakai untuk triase cepat. Utamakan escalation, chat high risk, atau item stale sebelum Anda turun ke item yang lebih ringan."}
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
                  {queue.items[0] ? "Buka Item Teratas" : "Kembali ke Queue"}
                </Link>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Kelompokkan bottleneck"
                  description="Filter berdasarkan bucket review agar item yang perlu AI, draft, approval, atau escalation tidak tercampur."
                />
                <UsageHint
                  title="2. Ambil quick action di sini"
                  description="Untuk item yang hanya perlu analisis atau draft baru, eksekusi langsung tanpa masuk ke detail chat."
                />
                <UsageHint
                  title="3. Turun ke detail saat butuh konteks"
                  description="Buka conversation atau lead detail kalau keputusan perlu membaca timeline penuh, draft, atau histori follow-up."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <QueueMetric
                label="Total Review"
                value={String(queue.total_items)}
                hint="Semua chat yang sedang muncul di pusat review."
              />
              <QueueMetric
                label="Needs Analysis"
                value={String(queue.needs_analysis_count)}
                hint="Chat yang perlu dibaca ulang AI."
              />
              <QueueMetric
                label="Needs Draft"
                value={String(queue.needs_reply_suggestion_count)}
                hint="Chat yang belum punya draft terbaru."
              />
              <QueueMetric
                label="Pending Review"
                value={String(queue.pending_approval_count)}
                hint="Draft yang masih butuh keputusan reviewer."
              />
              <QueueMetric
                label="Escalations"
                value={String(queue.escalation_count)}
                hint="Chat yang harus diangkat ke manusia."
              />
              <QueueMetric
                label="Stale"
                value={String(queue.stale_count)}
                hint="Item yang sudah menunggu lebih dari 72 jam."
              />
            </section>

            <section className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:grid-cols-4">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Filter bucket</span>
                <select
                  value={reviewBucketFilter}
                  onChange={(event) => setReviewBucketFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0"
                >
                  <option value="all">Semua bucket</option>
                  <option value="needs_analysis">Butuh AI analysis</option>
                  <option value="needs_reply_suggestion">Butuh draft baru</option>
                  <option value="pending_approval">Pending approval</option>
                  <option value="draft_review">Draft siap direview</option>
                  <option value="human_escalation">Human escalation</option>
                  <option value="ready_to_send">Siap dikirim</option>
                  <option value="needs_rework">Perlu rework</option>
                </select>
              </label>

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

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Filter channel</span>
                <select
                  value={sourceChannelFilter}
                  onChange={(event) => setSourceChannelFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0"
                >
                  <option value="all">Semua channel</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="instagram">Instagram</option>
                  <option value="email">Email</option>
                  <option value="import">Import</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>

              <div className="md:col-span-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadQueue()}
                  className="clara-button clara-button-primary"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewBucketFilter("all");
                    setRiskLevelFilter("all");
                    setAgeBucketFilter("all");
                    setSourceChannelFilter("all");
                    void loadQueue({
                      reviewBucket: "all",
                      riskLevel: "all",
                      ageBucket: "all",
                      sourceChannel: "all",
                    });
                  }}
                  className="clara-button clara-button-ghost"
                >
                  Reset
                </button>
              </div>
            </section>

            <section className="space-y-4">
              {queue.items.length === 0 ? (
                <div className="clara-empty-state text-sm text-slate-500">
                  Tidak ada item chat review yang cocok dengan filter saat ini.
                </div>
              ) : (
                queue.items.map((item) => (
                  <ReviewCard
                    key={item.conversation_id}
                    item={item}
                    actionKey={actionKey}
                    onAnalyze={handleAnalyze}
                    onGenerateReply={handleGenerateReply}
                  />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function ReviewCard({
  item,
  actionKey,
  onAnalyze,
  onGenerateReply,
}: {
  item: ChatReviewQueueItem;
  actionKey: string | null;
  onAnalyze: (conversationId: string) => Promise<void>;
  onGenerateReply: (conversationId: string) => Promise<void>;
}) {
  const isAnalyzing = actionKey === `${item.conversation_id}:analyze`;
  const isGeneratingReply = actionKey === `${item.conversation_id}:reply`;
  const showAnalyzeAction = item.review_bucket === "needs_analysis";
  const showGenerateReplyAction =
    item.review_bucket === "needs_reply_suggestion" ||
    item.review_bucket === "needs_rework";

  return (
    <article className="clara-card rounded-[28px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              {item.lead_name}
            </h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                item.lead_temperature,
              )}`}
            >
              {item.lead_temperature.toUpperCase()}
            </span>
            {item.risk_level && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(
                  item.risk_level,
                )}`}
              >
                Risk {item.risk_level}
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getReviewBucketBadgeClass(
                item.review_bucket,
              )}`}
            >
              {item.review_label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAgeBucketBadgeClass(
                item.age_bucket,
              )}`}
            >
              {formatStatusLabel(item.age_bucket)}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {item.conversation_title} &bull; {formatStatusLabel(item.current_stage)}{" "}
            &bull; {item.source_label}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Owner: {item.sales_owner_name ?? "-"} &bull; Queue since:{" "}
            {formatDateTime(item.queue_since_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.latest_reply_suggestion && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatStatusLabel(item.latest_reply_suggestion.approval_status)}
            </span>
          )}
          {item.latest_reply_suggestion && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {formatStatusLabel(item.latest_reply_suggestion.action_mode)}
            </span>
          )}
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Score {item.priority_score}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="clara-card-soft rounded-2xl p-4">
          <p className="clara-kicker text-xs">Latest Customer Context</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {item.latest_message_preview ?? "Belum ada preview pesan terbaru."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Last message: {formatDateTime(item.latest_message_at)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="clara-card-soft rounded-2xl p-4">
            <p className="clara-kicker text-xs">Recommended Action</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {item.recommended_action}
            </p>
          </div>

          {item.active_review_case_id ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="clara-kicker text-xs text-amber-700">
                Active Coaching Case
              </p>
              <p className="mt-3 text-sm font-semibold text-amber-900">
                {formatStatusLabel(item.active_review_status ?? "draft")} ·{" "}
                {(item.active_review_label ?? "unik").replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Reviewer: {item.active_review_reviewer_name ?? "Belum ditunjuk"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <MetaCard
              label="AI Status"
              value={item.latest_ai_extraction ? "Ready" : "Pending"}
            />
            <MetaCard
              label="Draft Status"
              value={
                item.latest_reply_suggestion
                  ? formatStatusLabel(item.latest_reply_suggestion.approval_status)
                  : "Belum ada"
              }
            />
            <MetaCard
              label="Sent Status"
              value={item.latest_sent_message ? "Sent" : "Belum terkirim"}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {showAnalyzeAction && (
          <button
            type="button"
            onClick={() => void onAnalyze(item.conversation_id)}
            disabled={isAnalyzing}
            className="clara-button clara-button-primary"
          >
            {isAnalyzing ? "Analyzing..." : "Run AI Analysis"}
          </button>
        )}

        {showGenerateReplyAction && (
          <button
            type="button"
            onClick={() => void onGenerateReply(item.conversation_id)}
            disabled={isGeneratingReply}
            className="clara-button clara-button-primary"
          >
            {isGeneratingReply ? "Generating..." : "Generate Draft"}
          </button>
        )}

        <Link
          href={`/dashboard/sales/conversations/${item.conversation_id}`}
          className="clara-button clara-button-ghost"
        >
          Review Conversation
        </Link>

        {item.lead_id && (
          <Link
            href={`/dashboard/crm/${item.lead_id}`}
            className="clara-button clara-button-ghost"
          >
            Buka Lead Detail
          </Link>
        )}
      </div>
    </article>
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
    <article className="clara-card rounded-[28px] p-6">
      <p className="clara-kicker text-xs text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </article>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="clara-kicker text-[11px]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getReviewBucketBadgeClass(reviewBucket: string) {
  switch (reviewBucket) {
    case "human_escalation":
      return "bg-red-100 text-red-700";
    case "pending_approval":
    case "draft_review":
      return "bg-amber-100 text-amber-700";
    case "needs_analysis":
      return "bg-blue-100 text-blue-700";
    case "needs_reply_suggestion":
    case "needs_rework":
      return "bg-violet-100 text-violet-700";
    case "ready_to_send":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getAgeBucketBadgeClass(ageBucket: string) {
  switch (ageBucket) {
    case "stale":
      return "bg-red-100 text-red-700";
    case "aging":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
