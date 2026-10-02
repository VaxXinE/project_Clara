"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatChannelLabel, formatRelativeTime, isExperimentalChannel } from "@/lib/format";
import { canAccessQueueAndActionCenter, normalizeWorkspaceRole } from "@/lib/roles";
import { AGE, REVIEW_BUCKET, REVIEW_NEXT_STEP, STAGE, TEMPERATURE, labelOf } from "@/lib/vocab";
import type { ChatReviewCenterResponse, ChatReviewQueueItem, CurrentUser } from "@/types/dashboard";

type Filters = { reviewBucket: string; riskLevel: string; ageBucket: string; sourceChannel: string };

const NO_FILTERS: Filters = { reviewBucket: "all", riskLevel: "all", ageBucket: "all", sourceChannel: "all" };

const BUCKET_CHIPS = [
  "human_escalation",
  "pending_approval",
  "draft_review",
  "needs_rework",
  "needs_reply_suggestion",
  "needs_analysis",
  "ready_to_send",
] as const;

function buildQueuePath(filters: Filters) {
  const query = new URLSearchParams();
  if (filters.reviewBucket !== "all") query.set("review_bucket", filters.reviewBucket);
  if (filters.riskLevel !== "all") query.set("risk_level", filters.riskLevel);
  if (filters.ageBucket !== "all") query.set("age_bucket", filters.ageBucket);
  if (filters.sourceChannel !== "all") query.set("source_channel", filters.sourceChannel);

  return query.size
    ? `/dashboard/sales/chat-review-center?${query.toString()}`
    : "/dashboard/sales/chat-review-center";
}

export default function ChatReviewCenterPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [queue, setQueue] = useState<ChatReviewCenterResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadQueue = useCallback(async (next: Filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<ChatReviewCenterResponse>(buildQueuePath(next)),
      ]);
      setCurrentUser(me);
      setQueue(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Antrean review belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadQueue(NO_FILTERS);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadQueue]);

  function updateFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    void loadQueue(next);
  }

  async function runAction(conversationId: string, kind: "analyze" | "reply") {
    setActionKey(`${conversationId}:${kind}`);
    setActionError("");

    try {
      await apiFetch(
        kind === "analyze"
          ? `/conversations/${conversationId}/analyze`
          : `/conversations/${conversationId}/reply-suggestions`,
        { method: "POST" },
      );
      await loadQueue(filters);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Permintaan ke Clara belum berhasil. Coba lagi.");
    } finally {
      setActionKey(null);
    }
  }

  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const isHeadView = normalizedRole === "head";
  const fallbackHref = canAccessQueue ? "/sales" : isHeadView ? "/notifications" : "/manager-insights";
  const items = queue?.items ?? [];
  const hasFilters = Object.values(filters).some((value) => value !== "all");

  const summaryTitle = !queue
    ? ""
    : queue.escalation_count > 0
      ? `${queue.escalation_count} kasus perlu keputusan manusia`
      : queue.pending_approval_count > 0
        ? `${queue.pending_approval_count} draft menunggu keputusan`
        : queue.total_items > 0
          ? `${queue.total_items} kasus perlu dilihat`
          : "Tidak ada kasus yang menunggu";
  const summaryHelper = !queue
    ? ""
    : queue.stale_count > 0
      ? `${queue.stale_count} di antaranya sudah menunggu lebih dari 3 hari.`
      : queue.total_items > 0
        ? "Mulai dari yang paling atas, daftarnya sudah diurutkan dari yang paling mendesak."
        : isHeadView
          ? "Antrean arahan tim aman. Cek Monitor Tim kalau ingin melihat pola hambatan."
          : "Antrean review aman. Cek Monitor Tim untuk melihat progres Sales.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={isHeadView ? PAGE_NAMES.teamDirection : PAGE_NAMES.reviewSales}
      description={
        isHeadView
          ? "Kasus yang perlu keputusanmu dan arahan yang bisa diturunkan ke tim."
          : "Balasan Sales yang perlu kamu putuskan, perbaiki, atau eskalasikan."
      }
      backHref={fallbackHref}
      backLabel={canAccessQueue ? "Kembali ke Chat Masuk" : isHeadView ? "Kembali ke Alert Tim" : "Kembali ke Monitor Tim"}
      actions={
        <Link
          href={canAccessQueue ? "/follow-up" : isHeadView ? "/crm" : "/manager-insights"}
          className="clara-button clara-button-secondary"
        >
          {canAccessQueue ? "Lihat Tindak Lanjut" : isHeadView ? "Lihat Lead Tim" : "Lihat Monitor Tim"}
        </Link>
      }
    >
      <div className="space-y-5">
        {isLoading && !queue ? <LoadingState message="Memuat antrean review..." /> : null}

        {!isLoading && errorMessage && !queue ? (
          <ErrorState message={errorMessage} onRetry={() => void loadQueue(filters)} />
        ) : null}

        {actionError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionError}
          </div>
        ) : null}

        {queue ? (
          <>
            <section
              data-onboarding-id="manager-approvals-summary"
              aria-labelledby="review-summary"
              className="clara-card p-5 sm:p-6"
            >
              <h2 id="review-summary" className="text-xl font-bold clara-text-primary sm:text-2xl">
                {summaryTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">{summaryHelper}</p>
            </section>

            <section
              data-onboarding-id="manager-approvals-filters"
              aria-label="Saring antrean review"
              className="clara-card space-y-4 p-4 sm:p-5"
            >
              <div data-onboarding-id="manager-approvals-metrics" role="group" aria-label="Kelompok kasus" className="flex flex-wrap gap-2">
                <FilterChip
                  active={filters.reviewBucket === "all"}
                  onClick={() => updateFilters({ reviewBucket: "all" })}
                  label="Semua"
                />
                {BUCKET_CHIPS.map((bucket) => (
                  <FilterChip
                    key={bucket}
                    active={filters.reviewBucket === bucket}
                    onClick={() => updateFilters({ reviewBucket: bucket })}
                    label={labelOf(REVIEW_BUCKET, bucket)}
                  />
                ))}
              </div>

              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-clara-gold">
                  Saring lebih lanjut (risiko, lama menunggu, channel)
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="review-risk" className="clara-label">
                      Tingkat risiko
                    </label>
                    <select
                      id="review-risk"
                      value={filters.riskLevel}
                      onChange={(event) => updateFilters({ riskLevel: event.target.value })}
                      className="clara-select mt-2 w-full"
                    >
                      <option value="all">Semua</option>
                      <option value="high">Tinggi</option>
                      <option value="medium">Sedang</option>
                      <option value="low">Rendah</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="review-age" className="clara-label">
                      Lama menunggu
                    </label>
                    <select
                      id="review-age"
                      value={filters.ageBucket}
                      onChange={(event) => updateFilters({ ageBucket: event.target.value })}
                      className="clara-select mt-2 w-full"
                    >
                      <option value="all">Semua</option>
                      <option value="fresh">Baru (kurang dari 1 hari)</option>
                      <option value="aging">Mulai lama (1 sampai 3 hari)</option>
                      <option value="stale">Terlalu lama (lebih dari 3 hari)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="review-channel" className="clara-label">
                      Channel
                    </label>
                    <select
                      id="review-channel"
                      value={filters.sourceChannel}
                      onChange={(event) => updateFilters({ sourceChannel: event.target.value })}
                      className="clara-select mt-2 w-full"
                    >
                      <option value="all">Semua</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="instagram">Instagram DM</option>
                      <option value="tiktok">TikTok DM</option>
                      <option value="email">Email</option>
                      <option value="import">Impor</option>
                    </select>
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
                  {isLoading ? "Memuat..." : `${items.length} kasus`}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(NO_FILTERS);
                      void loadQueue(NO_FILTERS);
                    }}
                    className="clara-button clara-button-ghost"
                  >
                    Hapus filter
                  </button>
                ) : null}
              </div>
            </section>

            {items.length === 0 ? (
              <EmptyState
                title={hasFilters ? "Tidak ada kasus yang cocok" : "Tidak ada kasus yang menunggu"}
                description={
                  hasFilters
                    ? "Hapus filter atau pilih kelompok lain."
                    : "Halaman ini hanya berisi chat yang perlu dibaca ulang, disusun drafnya, diputuskan, atau sudah lama menunggu."
                }
              />
            ) : (
              <ul data-onboarding-id="manager-approvals-queue" className="space-y-3">
                {items.map((item) => (
                  <ReviewRow
                    key={item.conversation_id}
                    item={item}
                    isHeadView={isHeadView}
                    actionKey={actionKey}
                    onAnalyze={() => void runAction(item.conversation_id, "analyze")}
                    onGenerateReply={() => void runAction(item.conversation_id, "reply")}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
        active
          ? "border-clara-gold bg-clara-gold text-clara-deep"
          : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ReviewRow({
  item,
  isHeadView,
  actionKey,
  onAnalyze,
  onGenerateReply,
}: {
  item: ChatReviewQueueItem;
  isHeadView: boolean;
  actionKey: string | null;
  onAnalyze: () => void;
  onGenerateReply: () => void;
}) {
  const isAnalyzing = actionKey === `${item.conversation_id}:analyze`;
  const isGenerating = actionKey === `${item.conversation_id}:reply`;
  const showAnalyze = item.review_bucket === "needs_analysis";
  const showGenerate = item.review_bucket === "needs_reply_suggestion" || item.review_bucket === "needs_rework";
  const detailHref = `/sales/conversations/${item.conversation_id}`;
  const nextStep = REVIEW_NEXT_STEP[item.review_bucket]?.[isHeadView ? "head" : "sales"] ?? "Buka chat untuk melihat detailnya.";

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">{item.lead_name}</h3>
          <p className="mt-0.5 text-xs clara-text-muted">
            Sales: {item.sales_owner_name ?? "belum ada"} · {formatChannelLabel(item.source_channel)} · menunggu{" "}
            {formatRelativeTime(item.queue_since_at).replace(" lalu", "")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {showAnalyze ? (
            <button type="button" onClick={onAnalyze} disabled={isAnalyzing} className="clara-button clara-button-primary">
              {isAnalyzing ? "Clara sedang membaca..." : "Baca dengan Clara"}
            </button>
          ) : showGenerate ? (
            <button type="button" onClick={onGenerateReply} disabled={isGenerating} className="clara-button clara-button-primary">
              {isGenerating ? "Menyusun draft..." : "Susun draft jawaban"}
            </button>
          ) : null}
          <Link href={detailHref} className={`clara-button ${showAnalyze || showGenerate ? "clara-button-secondary" : "clara-button-primary"}`}>
            Buka chat
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ValueTag table={REVIEW_BUCKET} value={item.review_bucket} />
        {item.risk_level === "high" ? <Tag tone="danger">Risiko tinggi</Tag> : null}
        {item.risk_level === "medium" ? <Tag tone="warn">Risiko sedang</Tag> : null}
        {item.lead_temperature !== "unknown" ? <ValueTag table={TEMPERATURE} value={item.lead_temperature} /> : null}
        {item.current_stage !== "unknown" ? <ValueTag table={STAGE} value={item.current_stage} /> : null}
        {item.age_bucket !== "fresh" ? <ValueTag table={AGE} value={item.age_bucket} /> : null}
        {isExperimentalChannel(item.source_channel) ? <Tag tone="warn">Eksperimental</Tag> : null}
      </div>

      <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 clara-text-secondary">
        {item.latest_message_preview ?? "Belum ada pesan."}
      </p>

      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        <span className="font-semibold clara-text-primary">Yang perlu kamu lakukan: </span>
        {nextStep}
      </p>

      {item.recommended_action ? (
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          <span className="font-semibold clara-text-primary">Saran Clara: </span>
          {item.recommended_action}
        </p>
      ) : null}

      {item.active_review_case_id ? (
        <p className="mt-2 text-xs clara-text-muted">
          Sedang dibina oleh {item.active_review_reviewer_name ?? "reviewer yang belum ditunjuk"}.
        </p>
      ) : null}
    </li>
  );
}
