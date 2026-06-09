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
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  CurrentUser,
} from "@/types/dashboard";

function formatAccountCategory(value: string): string {
  switch (value) {
    case "mini":
      return "Mini";
    case "reguler":
      return "Reguler";
    case "unknown":
      return "Belum ditentukan";
    default:
      return value.replaceAll("_", " ");
  }
}

function getAccountCategoryBadgeClass(value: string): string {
  switch (value) {
    case "mini":
      return "bg-emerald-100 text-emerald-700";
    case "reguler":
      return "bg-amber-100 text-amber-700";
    default:
      return "border border-[#d9bf87] bg-[#f7ebc9] text-[#6a4a17]";
  }
}

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

  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const isHeadView = normalizedRole === "head";
  const fallbackHref = canAccessQueue
    ? "/dashboard/sales"
    : isHeadView
      ? "/dashboard/notifications"
      : "/dashboard/manager-insights";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={isHeadView ? "Head follow-up" : "Review workflow"}
      title={isHeadView ? "Follow-up ke Sales" : "Chat Review Center"}
      description={
        isHeadView
          ? "Satu layar untuk membaca conversation yang berisiko, menilai bottleneck follow-up, lalu memberi arahan yang jelas ke Sales."
          : "Satu layar untuk membaca chat yang perlu analisis ulang, butuh draft baru, menunggu approval, atau harus dinaikkan ke reviewer manusia."
      }
      backHref={fallbackHref}
      backLabel={
        canAccessQueue
          ? "Kembali ke Queue"
          : isHeadView
            ? "Kembali ke Alert Center"
            : "Kembali ke Manager Insights"
      }
      actions={
        <Link
          href={
            canAccessQueue
              ? "/dashboard/follow-up"
              : isHeadView
                ? "/dashboard/crm"
                : "/dashboard/manager-insights"
          }
          className="clara-button clara-button-primary"
        >
          {canAccessQueue
            ? "Buka Action Center"
            : isHeadView
              ? "Buka Lead Management"
              : "Buka Manager Insights"}
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading chat review center...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {queue && !isLoading && !errorMessage && (
          <>
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

            <section className="grid gap-3 rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.22)] md:grid-cols-4">
              <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                <span>Filter bucket</span>
                <select
                  value={reviewBucketFilter}
                  onChange={(event) => setReviewBucketFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
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

              <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                <span>Filter risk</span>
                <select
                  value={riskLevelFilter}
                  onChange={(event) => setRiskLevelFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                >
                  <option value="all">Semua risk</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                <span>Filter age</span>
                <select
                  value={ageBucketFilter}
                  onChange={(event) => setAgeBucketFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                >
                  <option value="all">Semua age</option>
                  <option value="fresh">Fresh (&lt;24 jam)</option>
                  <option value="aging">Aging (24-72 jam)</option>
                  <option value="stale">Stale (&gt;72 jam)</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                <span>Filter channel</span>
                <select
                  value={sourceChannelFilter}
                  onChange={(event) => setSourceChannelFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
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
                <div className="clara-empty-state text-sm text-[#d6bb84]">
                  Tidak ada item review yang cocok dengan filter saat ini. Halaman ini hanya memuat chat yang benar-benar perlu analisis, draft, approval, escalation, atau sudah stale.
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
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountCategoryBadgeClass(
                item.account_category,
              )}`}
            >
              {formatAccountCategory(item.account_category)}
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

          <p className="mt-2 text-sm text-[#d6bb84]">
            {item.conversation_title} &bull; {formatStatusLabel(item.current_stage)}{" "}
            &bull; {item.source_label}
          </p>
          <p className="mt-2 text-xs text-[#b89a62]">
            Owner: {item.sales_owner_name ?? "-"} &bull; Queue since:{" "}
            {formatDateTime(item.queue_since_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.latest_reply_suggestion && (
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
              {formatStatusLabel(item.latest_reply_suggestion.approval_status)}
            </span>
          )}
          {item.latest_reply_suggestion && (
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
              {formatStatusLabel(item.latest_reply_suggestion.action_mode)}
            </span>
          )}
          <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
            Score {item.priority_score}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="clara-card-soft rounded-2xl p-4">
          <p className="clara-kicker text-xs">Latest Customer Context</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#fff0c9]">
            {item.latest_message_preview ?? "Belum ada preview pesan terbaru."}
          </p>
          <p className="mt-3 text-xs text-[#b89a62]">
            Last message: {formatDateTime(item.latest_message_at)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="clara-card-soft rounded-2xl p-4">
            <p className="clara-kicker text-xs">Recommended Action</p>
            <p className="mt-3 text-sm leading-7 text-[#fff0c9]">
              {item.recommended_action}
            </p>
          </div>

          {item.active_review_case_id ? (
            <div className="rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
              <p className="clara-kicker text-xs text-[#f0cb73]">
                Active Coaching Case
              </p>
              <p className="mt-3 text-sm font-semibold text-[#fff0c9]">
                {formatStatusLabel(item.active_review_status ?? "draft")} ·{" "}
                {(item.active_review_label ?? "unik").replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
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
    <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#140f08]">{value}</p>
      <p className="mt-2 text-sm text-[#2f210f]">{hint}</p>
    </article>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="clara-kicker text-[11px]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#fff0c9]">{value}</p>
    </div>
  );
}

function getReviewBucketBadgeClass(reviewBucket: string) {
  switch (reviewBucket) {
    case "human_escalation":
      return "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]";
    case "pending_approval":
    case "draft_review":
      return "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]";
    case "needs_analysis":
      return "border border-[#f0cb73]/18 bg-[#241a10] text-[#f0cb73]";
    case "needs_reply_suggestion":
    case "needs_rework":
      return "border border-[#f0cb73]/18 bg-[#2b2013] text-[#f0cb73]";
    case "ready_to_send":
      return "border border-[#f0cb73]/18 bg-[#1f170f] text-[#f0cb73]";
    default:
      return "border border-[#f0cb73]/18 bg-[#1d150d] text-[#f0cb73]";
  }
}

function getAgeBucketBadgeClass(ageBucket: string) {
  switch (ageBucket) {
    case "stale":
      return "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]";
    case "aging":
      return "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]";
    default:
      return "border border-[#f0cb73]/18 bg-[#1d150d] text-[#f0cb73]";
  }
}
