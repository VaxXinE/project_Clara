"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatRelativeTime,
  isExperimentalChannel,
} from "@/lib/format";
import { isDecisionBucket, WAITING_FOR_SALES_TEXT } from "@/lib/review";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import {
  AGE,
  REVIEW_BUCKET,
  REVIEW_NEXT_STEP,
  STAGE,
  TEMPERATURE,
} from "@/lib/vocab";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  CurrentUser,
} from "@/types/dashboard";

/** Penyaring yang dikirim ke server. Pembagian "perlu keputusanmu" dan "menunggu Sales" dilakukan di halaman ini. */
type Filters = { riskLevel: string; ageBucket: string; sourceChannel: string };

const NO_FILTERS: Filters = {
  riskLevel: "all",
  ageBucket: "all",
  sourceChannel: "all",
};

type Group = "decide" | "waiting" | "all";

function buildQueuePath(filters: Filters) {
  const query = new URLSearchParams();
  if (filters.riskLevel !== "all") query.set("risk_level", filters.riskLevel);
  if (filters.ageBucket !== "all") query.set("age_bucket", filters.ageBucket);
  if (filters.sourceChannel !== "all")
    query.set("source_channel", filters.sourceChannel);

  return query.size
    ? `/dashboard/sales/chat-review-center?${query.toString()}`
    : "/dashboard/sales/chat-review-center";
}

export default function ChatReviewCenterPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [queue, setQueue] = useState<ChatReviewCenterResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // Kosong berarti otomatis: buka di kelompok yang paling penting.
  const [chosenGroup, setChosenGroup] = useState<Group | null>(null);
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Antrean review belum bisa dimuat.",
      );
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

  // Tombol baca dan susun jawaban adalah pekerjaan Sales. Hanya peran yang ikut mengoperasikan chat yang melihatnya.
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
      setActionError(
        error instanceof Error
          ? error.message
          : "Permintaan ke Clara belum berhasil. Coba lagi.",
      );
    } finally {
      setActionKey(null);
    }
  }

  const canOperate = canAccessQueueAndActionCenter(currentUser?.role);
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const isHeadView = normalizedRole === "head";
  const items = useMemo(() => queue?.items ?? [], [queue]);
  const decisionItems = useMemo(
    () => items.filter((item) => isDecisionBucket(item.review_bucket)),
    [items],
  );
  const waitingItems = useMemo(
    () => items.filter((item) => !isDecisionBucket(item.review_bucket)),
    [items],
  );
  const staleDecisionCount = decisionItems.filter(
    (item) => item.age_bucket === "stale",
  ).length;
  const group: Group =
    chosenGroup ?? (decisionItems.length > 0 ? "decide" : "all");
  const visibleItems =
    group === "decide"
      ? decisionItems
      : group === "waiting"
        ? waitingItems
        : items;
  const hasFilters = Object.values(filters).some((value) => value !== "all");

  const summaryTitle = !queue
    ? ""
    : decisionItems.length > 0
      ? `${decisionItems.length} kasus menunggu keputusanmu`
      : waitingItems.length > 0
        ? "Tidak ada yang menunggu keputusanmu"
        : "Tidak ada kasus yang menunggu";
  const summaryHelper = !queue
    ? ""
    : decisionItems.length > 0
      ? staleDecisionCount > 0
        ? `${staleDecisionCount} sudah menunggu lebih dari 3 hari. Mulai dari yang paling atas.`
        : "Sales menunggu kamu menyetujui, menolak, atau mengarahkan balasan. Daftarnya sudah diurutkan dari yang paling mendesak."
      : waitingItems.length > 0
        ? isHeadView
          ? `${waitingItems.length} chat sedang ditangani manager dan Sales. Kamu cukup memantaunya.`
          : `${waitingItems.length} chat sedang menunggu Sales bertindak. Kamu cukup memantaunya.`
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
          : "Balasan Sales yang perlu kamu putuskan, dan chat yang sedang menunggu Sales."
      }
      actions={
        <Link
          href={
            canOperate
              ? "/follow-up"
              : isHeadView
                ? "/crm"
                : "/manager-insights"
          }
          className="clara-button clara-button-secondary"
        >
          {canOperate
            ? "Lihat Tindak Lanjut"
            : isHeadView
              ? "Lihat Lead Tim"
              : "Lihat Monitor Tim"}
        </Link>
      }
    >
      <div className="space-y-5">
        {isLoading && !queue ? (
          <LoadingState message="Memuat antrean review..." />
        ) : null}

        {!isLoading && errorMessage && !queue ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => void loadQueue(filters)}
          />
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
              <h2
                id="review-summary"
                className="text-xl font-bold clara-text-primary sm:text-2xl"
              >
                {summaryTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                {summaryHelper}
              </p>
            </section>

            <section
              data-onboarding-id="manager-approvals-filters"
              aria-label="Saring antrean review"
              className="clara-card space-y-4 p-4 sm:p-5"
            >
              <div
                data-onboarding-id="manager-approvals-metrics"
                role="group"
                aria-label="Kelompok kasus"
                className="flex flex-wrap gap-2"
              >
                <FilterChip
                  active={group === "decide"}
                  onClick={() => setChosenGroup("decide")}
                  label={`Perlu keputusanmu (${decisionItems.length})`}
                />
                <FilterChip
                  active={group === "waiting"}
                  onClick={() => setChosenGroup("waiting")}
                  label={`${isHeadView ? "Ditangani tim" : "Menunggu Sales"} (${waitingItems.length})`}
                />
                <FilterChip
                  active={group === "all"}
                  onClick={() => setChosenGroup("all")}
                  label={`Semua (${items.length})`}
                />
              </div>

              <details>
                <summary className="clara-disclosure">
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
                      onChange={(event) =>
                        updateFilters({ riskLevel: event.target.value })
                      }
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
                      onChange={(event) =>
                        updateFilters({ ageBucket: event.target.value })
                      }
                      className="clara-select mt-2 w-full"
                    >
                      <option value="all">Semua</option>
                      <option value="fresh">Baru (kurang dari 1 hari)</option>
                      <option value="aging">
                        Mulai lama (1 sampai 3 hari)
                      </option>
                      <option value="stale">
                        Terlalu lama (lebih dari 3 hari)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="review-channel" className="clara-label">
                      Channel
                    </label>
                    <select
                      id="review-channel"
                      value={filters.sourceChannel}
                      onChange={(event) =>
                        updateFilters({ sourceChannel: event.target.value })
                      }
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

              {hasFilters ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-sm clara-text-secondary"
                  >
                    {isLoading
                      ? "Memuat..."
                      : `${visibleItems.length} kasus sesuai saringan`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(NO_FILTERS);
                      void loadQueue(NO_FILTERS);
                    }}
                    className="clara-button clara-button-ghost"
                  >
                    Hapus saringan
                  </button>
                </div>
              ) : null}
            </section>

            {visibleItems.length === 0 ? (
              <EmptyState
                title={
                  hasFilters
                    ? "Tidak ada kasus yang cocok"
                    : group === "decide"
                      ? "Tidak ada yang menunggu keputusanmu"
                      : group === "waiting"
                        ? isHeadView
                        ? "Tidak ada chat yang sedang ditangani tim"
                        : "Tidak ada chat yang menunggu Sales"
                        : "Tidak ada kasus yang menunggu"
                }
                description={
                  hasFilters
                    ? "Hapus saringan atau pilih kelompok lain."
                    : group === "decide"
                      ? "Draf yang perlu kamu setujui atau topik yang perlu keputusanmu akan muncul di sini."
                      : "Chat yang perlu dibaca ulang, disusun jawabannya, atau sudah lama menunggu akan muncul di sini."
                }
              />
            ) : (
              <ul
                data-onboarding-id="manager-approvals-queue"
                className="space-y-3"
              >
                {visibleItems.map((item) => (
                  <ReviewRow
                    key={item.conversation_id}
                    item={item}
                    isHeadView={isHeadView}
                    canOperate={canOperate}
                    actionKey={actionKey}
                    onAnalyze={() =>
                      void runAction(item.conversation_id, "analyze")
                    }
                    onGenerateReply={() =>
                      void runAction(item.conversation_id, "reply")
                    }
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

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
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
  canOperate,
  actionKey,
  onAnalyze,
  onGenerateReply,
}: {
  item: ChatReviewQueueItem;
  isHeadView: boolean;
  /** Superadmin ikut mengoperasikan chat. Manager dan Head hanya memutuskan dan memantau. */
  canOperate: boolean;
  actionKey: string | null;
  onAnalyze: () => void;
  onGenerateReply: () => void;
}) {
  const isAnalyzing = actionKey === `${item.conversation_id}:analyze`;
  const isGenerating = actionKey === `${item.conversation_id}:reply`;
  const needsDecision = isDecisionBucket(item.review_bucket);
  const showAnalyze = canOperate && item.review_bucket === "needs_analysis";
  const showGenerate =
    canOperate &&
    (item.review_bucket === "needs_reply_suggestion" ||
      item.review_bucket === "needs_rework");
  const detailHref = `/sales/conversations/${item.conversation_id}`;
  const nextStep = needsDecision
    ? (REVIEW_NEXT_STEP[item.review_bucket]?.[isHeadView ? "head" : "sales"] ??
      "Buka chat untuk melihat detailnya.")
    : (WAITING_FOR_SALES_TEXT[item.review_bucket] ??
      "Menunggu Sales bertindak.");

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">
            {item.lead_name}
          </h3>
          <p className="mt-0.5 text-xs clara-text-muted">
            Sales: {item.sales_owner_name ?? "belum ada"} ·{" "}
            {formatChannelLabel(item.source_channel)} · menunggu{" "}
            {formatRelativeTime(item.queue_since_at).replace(" lalu", "")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {showAnalyze ? (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="clara-button clara-button-primary"
            >
              {isAnalyzing ? "Clara sedang membaca..." : "Baca dengan Clara"}
            </button>
          ) : showGenerate ? (
            <button
              type="button"
              onClick={onGenerateReply}
              disabled={isGenerating}
              className="clara-button clara-button-primary"
            >
              {isGenerating ? "Menyusun draft..." : "Susun draft jawaban"}
            </button>
          ) : null}
          <Link
            href={detailHref}
            className={`clara-button ${needsDecision && !showAnalyze && !showGenerate ? "clara-button-primary" : "clara-button-secondary"}`}
          >
            {needsDecision ? "Tinjau dan putuskan" : "Tinjau chat"}
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ValueTag table={REVIEW_BUCKET} value={item.review_bucket} />
        {item.risk_level === "high" ? (
          <Tag tone="danger">Risiko tinggi</Tag>
        ) : null}
        {item.risk_level === "medium" ? (
          <Tag tone="warn">Risiko sedang</Tag>
        ) : null}
        {item.lead_temperature !== "unknown" ? (
          <ValueTag table={TEMPERATURE} value={item.lead_temperature} />
        ) : null}
        {item.current_stage !== "unknown" ? (
          <ValueTag table={STAGE} value={item.current_stage} />
        ) : null}
        {item.age_bucket !== "fresh" ? (
          <ValueTag table={AGE} value={item.age_bucket} />
        ) : null}
        {isExperimentalChannel(item.source_channel) ? (
          <Tag tone="warn">Eksperimental</Tag>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 clara-text-secondary">
        {item.latest_message_preview ?? "Belum ada pesan."}
      </p>

      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        <span className="font-semibold clara-text-primary">
          {needsDecision ? "Yang perlu kamu lakukan: " : "Status: "}
        </span>
        {nextStep}
      </p>

      {needsDecision && item.recommended_action ? (
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          <span className="font-semibold clara-text-primary">
            Saran Clara:{" "}
          </span>
          {item.recommended_action}
        </p>
      ) : null}

      {item.active_review_case_id ? (
        <p className="mt-2 text-xs clara-text-muted">
          Sedang dibina oleh{" "}
          {item.active_review_reviewer_name ?? "reviewer yang belum ditunjuk"}.
        </p>
      ) : null}
    </li>
  );
}
