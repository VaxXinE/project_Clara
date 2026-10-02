"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { BUCKETS, BUCKET_ORDER, getQueueBucket, type QueueBucketKey } from "@/lib/inbox";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatProviderLabel,
  formatRelativeTime,
  inferProviderFromSource,
  isExperimentalChannel,
} from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  isManagerLike,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import { ACCOUNT_CATEGORY, REPLY_STATE, TEMPERATURE, labelOf } from "@/lib/vocab";
import type { CurrentUser, SalesInboxItem } from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "tiktok", label: "TikTok DM" },
  { value: "telegram", label: "Telegram" },
] as const;

const ARCHIVE_SCOPE_OPTIONS = [
  { value: "active", label: "Chat aktif" },
  { value: "archived", label: "Chat lama (arsip)" },
  { value: "all", label: "Semua chat" },
] as const;

const VISIBLE_STEP = 8;

function buildInboxPath(sourceChannelFilter: string, archiveScope: string): string {
  const params = new URLSearchParams();

  if (sourceChannelFilter !== "all") {
    params.set("source_channel", sourceChannelFilter);
  }

  if (archiveScope !== "active") {
    params.set("archive_scope", archiveScope);
  }

  return params.size
    ? `/dashboard/sales/inbox?${params.toString()}`
    : "/dashboard/sales/inbox";
}

function emptyMessage(
  totalItems: number,
  archiveScope: string,
  channel: string,
): { title: string; body: string; showIntake: boolean } {
  if (totalItems > 0) {
    return {
      title: "Tidak ada chat yang cocok",
      body: "Ubah kata pencarian atau filter supaya chat yang kamu cari muncul lagi.",
      showIntake: false,
    };
  }

  if (channel === "instagram" || channel === "tiktok") {
    const name = channel === "instagram" ? "Instagram DM" : "TikTok DM";
    const page = channel === "instagram" ? "Instagram DM" : "TikTok Messages";

    return {
      title: `Belum ada percakapan dari ${name}`,
      body: `Buka Clara Extension di halaman ${page} untuk mulai menyinkronkan chat.`,
      showIntake: false,
    };
  }

  if (archiveScope === "archived") {
    return {
      title: "Belum ada chat di arsip",
      body: "Chat yang lama tidak aktif dipindahkan ke sini. Datanya tidak hilang.",
      showIntake: false,
    };
  }

  return {
    title: "Belum ada chat",
    body: "Chat dari WhatsApp, Instagram, TikTok, atau input manual akan muncul di sini.",
    showIntake: true,
  };
}

export default function SalesInboxPage() {
  const router = useRouter();
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [archiveScope, setArchiveScope] = useState("active");
  const [bucketFilter, setBucketFilter] = useState<"all" | QueueBucketKey>("all");
  const [visibleCounts, setVisibleCounts] = useState<Partial<Record<QueueBucketKey, number>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionConversationId, setActionConversationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapInbox() {
      setIsLoading(true);

      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        if (isCancelled) {
          return;
        }
        setCurrentUser(me);

        if (!canAccessQueueAndActionCenter(me.role)) {
          router.replace(
            normalizeWorkspaceRole(me.role) === "head"
              ? "/dashboard/approvals"
              : "/dashboard/manager-insights",
          );
          return;
        }

        const data = await apiFetch<SalesInboxItem[]>(
          buildInboxPath(sourceChannelFilter, archiveScope),
        );
        if (isCancelled) {
          return;
        }
        setInboxItems(data);
        setErrorMessage("");
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Daftar chat belum bisa dimuat.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapInbox();

    return () => {
      isCancelled = true;
    };
  }, [archiveScope, reloadKey, router, sourceChannelFilter]);

  const shouldShowOwnership = isManagerLike(currentUser?.role);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const bucketCounts = useMemo(() => {
    const counts: Partial<Record<QueueBucketKey, number>> = {};

    for (const item of inboxItems) {
      const bucket = getQueueBucket(item);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }

    return counts;
  }, [inboxItems]);

  const filteredInboxItems = useMemo(() => {
    return inboxItems.filter((item) => {
      if (bucketFilter !== "all" && getQueueBucket(item) !== bucketFilter) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return [
        item.title,
        item.latest_message?.message_text ?? "",
        item.sales_owner_name ?? "",
        item.latest_ai_extraction?.next_best_action ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [bucketFilter, inboxItems, normalizedSearchQuery]);

  const sections = useMemo(() => {
    const order: QueueBucketKey[] = archiveScope === "archived" ? ["archived"] : BUCKET_ORDER;

    return order
      .map((bucket) => ({
        bucket,
        items: filteredInboxItems.filter((item) => getQueueBucket(item) === bucket),
      }))
      .filter((section) => section.items.length > 0);
  }, [archiveScope, filteredInboxItems]);

  async function refreshInbox() {
    const data = await apiFetch<SalesInboxItem[]>(
      buildInboxPath(sourceChannelFilter, archiveScope),
    );
    setInboxItems(data);
  }

  async function runAction(conversationId: string, path: string, failureMessage: string) {
    setActionConversationId(conversationId);
    setActionError("");

    try {
      await apiFetch(path, { method: "POST" });
      await refreshInbox();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : failureMessage);
    } finally {
      setActionConversationId(null);
    }
  }

  const chipBuckets = BUCKET_ORDER.filter(
    (bucket) => (bucketCounts[bucket] ?? 0) > 0 || bucket === bucketFilter,
  );
  const empty = emptyMessage(inboxItems.length, archiveScope, sourceChannelFilter);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.inbox}
      description="Chat customer yang perlu kamu tangani. Buka satu chat, baca ringkasan Clara, lalu kirim jawaban yang disarankan dari WhatsApp."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <Link href="/upload" className="clara-button clara-button-primary">
          {PAGE_NAMES.intake}
        </Link>
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat daftar chat..." /> : null}

        {!isLoading && errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <section
              data-onboarding-id="sales-inbox-filters"
              aria-label="Cari dan saring chat"
              className="clara-card space-y-4 p-4 sm:p-5"
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor="sales-search" className="clara-label">
                    Cari chat
                  </label>
                  <input
                    id="sales-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nama customer atau isi pesan"
                    className="clara-input mt-2 w-full"
                  />
                </div>
                <div>
                  <label htmlFor="sales-channel" className="clara-label">
                    Channel
                  </label>
                  <select
                    id="sales-channel"
                    value={sourceChannelFilter}
                    onChange={(event) => setSourceChannelFilter(event.target.value)}
                    className="clara-select mt-2 w-full"
                  >
                    {SOURCE_CHANNEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sales-archive" className="clara-label">
                    Tampilkan
                  </label>
                  <select
                    id="sales-archive"
                    value={archiveScope}
                    onChange={(event) => setArchiveScope(event.target.value)}
                    className="clara-select mt-2 w-full"
                  >
                    {ARCHIVE_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {archiveScope !== "archived" && inboxItems.length > 0 ? (
                <div
                  data-onboarding-id="sales-inbox-metrics"
                  role="group"
                  aria-label="Kelompok chat"
                  className="flex flex-wrap gap-2"
                >
                  <GroupChip
                    active={bucketFilter === "all"}
                    onClick={() => setBucketFilter("all")}
                    label={`Semua (${inboxItems.length})`}
                  />
                  {chipBuckets.map((bucket) => (
                    <GroupChip
                      key={bucket}
                      active={bucketFilter === bucket}
                      onClick={() => setBucketFilter(bucket)}
                      label={`${BUCKETS[bucket].chip} (${bucketCounts[bucket] ?? 0})`}
                    />
                  ))}
                </div>
              ) : null}

              <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
                {filteredInboxItems.length === inboxItems.length
                  ? `${inboxItems.length} chat`
                  : `${filteredInboxItems.length} dari ${inboxItems.length} chat`}
              </p>
            </section>

            {actionError ? (
              <div role="alert" className="clara-alert clara-alert-danger">
                <p>{actionError}</p>
              </div>
            ) : null}

            {filteredInboxItems.length === 0 ? (
              <EmptyState
                title={empty.title}
                description={empty.body}
                actionHref={empty.showIntake ? "/upload" : undefined}
                actionLabel={empty.showIntake ? "Masukkan chat pertama" : undefined}
              />
            ) : (
              sections.map((section, sectionIndex) => {
                const visible = visibleCounts[section.bucket] ?? VISIBLE_STEP;
                const shownItems = section.items.slice(0, visible);
                const hiddenCount = section.items.length - shownItems.length;
                const config = BUCKETS[section.bucket];

                return (
                  <section
                    key={section.bucket}
                    aria-labelledby={`bucket-${section.bucket}`}
                    data-onboarding-id={sectionIndex === 0 ? "sales-inbox-queue" : undefined}
                    className="space-y-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h2
                        id={`bucket-${section.bucket}`}
                        className="text-base font-semibold clara-text-primary"
                      >
                        {config.label}{" "}
                        <span className="font-normal clara-text-muted">({section.items.length})</span>
                      </h2>
                      <p className="text-sm clara-text-secondary">{config.description}</p>
                    </div>

                    <ul className="space-y-3">
                      {shownItems.map((item, itemIndex) => (
                        <InboxRow
                          key={item.conversation_id}
                          item={item}
                          bucket={section.bucket}
                          showOwner={shouldShowOwnership}
                          isActing={actionConversationId === item.conversation_id}
                          markFirst={sectionIndex === 0 && itemIndex === 0}
                          onAnalyze={() =>
                            void runAction(
                              item.conversation_id,
                              `/conversations/${item.conversation_id}/analyze`,
                              "Clara belum bisa membaca chat ini. Coba lagi sebentar lagi.",
                            )
                          }
                          onDraft={() =>
                            void runAction(
                              item.conversation_id,
                              `/conversations/${item.conversation_id}/reply-suggestions`,
                              "Clara belum bisa menyusun draft. Coba lagi sebentar lagi.",
                            )
                          }
                        />
                      ))}
                    </ul>

                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleCounts((current) => ({
                            ...current,
                            [section.bucket]: visible + VISIBLE_STEP,
                          }))
                        }
                        className="clara-button clara-button-ghost"
                      >
                        Tampilkan {Math.min(hiddenCount, VISIBLE_STEP)} chat lagi ({hiddenCount} tersisa)
                      </button>
                    ) : null}
                  </section>
                );
              })
            )}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function GroupChip({
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

type InboxRowProps = {
  item: SalesInboxItem;
  bucket: QueueBucketKey;
  showOwner: boolean;
  isActing: boolean;
  markFirst: boolean;
  onAnalyze: () => void;
  onDraft: () => void;
};

function InboxRow({ item, bucket, showOwner, isActing, markFirst, onAnalyze, onDraft }: InboxRowProps) {
  const extraction = item.latest_ai_extraction;
  const provider = inferProviderFromSource(item.source);
  const canAnalyze = extraction === null;
  const canGenerateDraft =
    extraction !== null && item.latest_reply_suggestion === null && item.ui_status !== "reply_sent";
  const detailHref = `/sales/conversations/${item.conversation_id}`;
  const channelLabel = formatChannelLabel(item.source_channel);
  const sourceText = provider === "manual" || provider === "unknown"
    ? channelLabel
    : `${channelLabel} · ${formatProviderLabel(provider)}`;
  const category = item.account_category && item.account_category !== "unknown"
    ? labelOf(ACCOUNT_CATEGORY, item.account_category)
    : null;

  return (
    <li
      data-onboarding-id={markFirst ? "sales-inbox-upcoming-actions" : undefined}
      className="relative rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 hover:border-clara-line focus-within:border-clara-gold sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">
            <Link
              href={detailHref}
              className="rounded after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {item.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs clara-text-muted">
            {sourceText} · {formatRelativeTime(item.last_message_at)}
            {showOwner ? ` · ${item.sales_owner_name ?? "Belum ada owner"}` : ""}
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          {canAnalyze ? (
            <button
              type="button"
              disabled={isActing}
              onClick={onAnalyze}
              className="clara-button clara-button-secondary w-full sm:w-auto"
            >
              {isActing ? "Clara sedang membaca..." : "Baca dengan Clara"}
            </button>
          ) : canGenerateDraft ? (
            <button
              type="button"
              disabled={isActing}
              onClick={onDraft}
              className="clara-button clara-button-secondary w-full sm:w-auto"
            >
              {isActing ? "Menyusun draft..." : "Buat draft jawaban"}
            </button>
          ) : (
            <Link
              href={detailHref}
              className={`clara-button w-full sm:w-auto ${
                bucket === "waiting_customer" || bucket === "archived"
                  ? "clara-button-secondary"
                  : "clara-button-primary"
              }`}
            >
              {bucket === "waiting_customer" || bucket === "archived" ? "Buka chat" : "Buka dan balas"}
            </Link>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm clara-text-secondary">
        {item.latest_message ? item.latest_message.message_text : "Belum ada pesan."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {extraction ? <ValueTag table={TEMPERATURE} value={extraction.lead_temperature} /> : null}
        {extraction && extraction.risk_level !== "low" ? (
          <Tag tone={extraction.risk_level === "high" ? "danger" : "warn"}>
            {extraction.risk_level === "high" ? "Risiko tinggi" : "Risiko sedang"}
          </Tag>
        ) : null}
        <ValueTag table={REPLY_STATE} value={item.ui_status} />
        {category ? <Tag>{category}</Tag> : null}
        {isExperimentalChannel(item.source_channel) ? <Tag tone="warn">Eksperimental</Tag> : null}
      </div>

      {extraction?.next_best_action ? (
        <p className="mt-3 text-sm clara-text-secondary">
          <span className="font-semibold clara-text-primary">Langkah berikutnya: </span>
          {extraction.next_best_action}
        </p>
      ) : null}
    </li>
  );
}
