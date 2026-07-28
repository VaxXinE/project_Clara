"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatDateTime,
  formatProviderLabel,
  formatStatusLabel,
  getChannelBadgeClass,
  getLeadBadgeClass,
  getProviderBadgeClass,
  getRiskBadgeClass,
  inferProviderFromSource,
  isExperimentalChannel,
} from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  isManagerLike,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type { CurrentUser, SalesInboxItem } from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua Channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "tiktok", label: "TikTok DM" },
  { value: "telegram", label: "Telegram" },
] as const;

const ARCHIVE_SCOPE_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "Semua" },
] as const;

const QUEUE_BUCKET_OPTIONS = [
  { value: "all", label: "Semua queue" },
  { value: "reply_now", label: "Perlu dibalas" },
  { value: "waiting_customer", label: "Menunggu customer" },
  { value: "needs_analysis", label: "Perlu analisis" },
  { value: "needs_draft", label: "Perlu draft" },
  { value: "pending_review", label: "Menunggu review" },
  { value: "high_risk", label: "Risiko tinggi" },
  { value: "archived", label: "Archived" },
] as const;

const QUEUE_SECTION_PAGE_SIZE = 8;

type QueueBucketKey =
  | "reply_now"
  | "waiting_customer"
  | "needs_analysis"
  | "needs_draft"
  | "pending_review"
  | "high_risk"
  | "archived";

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

function buildInboxPath(
  sourceChannelFilter: string,
  archiveScope: string,
): string {
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

function getQueueBucket(item: SalesInboxItem): QueueBucketKey {
  if (item.is_archived) {
    return "archived";
  }

  if (item.latest_ai_extraction?.risk_level === "high") {
    return "high_risk";
  }

  if (!item.latest_ai_extraction) {
    return "needs_analysis";
  }

  if (item.latest_reply_suggestion?.approval_status === "pending_approval") {
    return "pending_review";
  }

  if (!item.latest_reply_suggestion && item.ui_status !== "reply_sent") {
    return "needs_draft";
  }

  if (item.ui_status === "reply_sent") {
    return "waiting_customer";
  }

  return "reply_now";
}

function getQueueBucketConfig(bucket: QueueBucketKey) {
  switch (bucket) {
    case "needs_analysis":
      return {
        label: "Perlu Analisis",
        description:
          "Chat ini belum punya ringkasan AI. Analisis dulu sebelum memutuskan balas, approval, atau follow-up.",
      };
    case "needs_draft":
      return {
        label: "Perlu Draft",
        description:
          "Analisis sudah ada, tapi balasan belum dibuat. Generate draft agar user tidak mulai dari nol.",
      };
    case "waiting_customer":
      return {
        label: "Menunggu Customer",
        description:
          "Balasan sales sudah dikirim. Untuk sementara tidak perlu membalas lagi sampai customer merespons atau ada konteks baru.",
      };
    case "pending_review":
      return {
        label: "Menunggu Review",
        description:
          "Draft atau kasusnya masih perlu keputusan reviewer manusia sebelum dianggap aman ditindaklanjuti.",
      };
    case "high_risk":
      return {
        label: "Risiko Tinggi",
        description:
          "Prioritaskan item berisiko tinggi lebih dulu supaya tidak terjadi mis-selling atau jawaban sensitif tanpa review.",
      };
    case "archived":
      return {
        label: "Archived",
        description:
          "Conversation yang sudah keluar dari ritme kerja aktif dan biasanya hanya dibuka saat ada konteks lanjutan.",
      };
    default:
      return {
        label: "Perlu Dibalas",
        description:
          "Conversation yang relatif siap ditindaklanjuti tanpa langkah persiapan yang panjang.",
      };
  }
}

export default function SalesInboxPage() {
  const router = useRouter();
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [archiveScope, setArchiveScope] = useState("active");
  const [queueBucketFilter, setQueueBucketFilter] = useState("all");
  const [queueSectionPages, setQueueSectionPages] = useState<
    Partial<Record<QueueBucketKey, number>>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionConversationId, setActionConversationId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");

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
            error instanceof Error ? error.message : "Failed to load inbox.",
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
  }, [archiveScope, router, sourceChannelFilter]);

  const canAccessMarketing =
    currentUser !== null && ["superadmin", "head"].includes(currentUser.role);
  const canAccessKnowledge =
    currentUser !== null && currentUser.role === "superadmin";
  const canAccessAdminOps =
    currentUser !== null && currentUser.role === "superadmin";
  const isSalesWorkspace = currentUser?.role === "sales";

  const analyzedCount = inboxItems.filter(
    (item) => item.latest_ai_extraction !== null,
  ).length;
  const sentCount = inboxItems.filter(
    (item) => item.latest_sent_message,
  ).length;
  const highRiskCount = inboxItems.filter(
    (item) => item.latest_ai_extraction?.risk_level === "high",
  ).length;
  const shouldShowOwnership = isManagerLike(currentUser?.role);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredInboxItems = useMemo(() => {
    return inboxItems.filter((item) => {
      if (
        queueBucketFilter !== "all" &&
        getQueueBucket(item) !== queueBucketFilter
      ) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return [
        item.title,
        item.latest_message?.message_text ?? "",
        item.sales_owner_name ?? "",
        item.source_label,
        item.latest_ai_extraction?.next_best_action ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [inboxItems, normalizedSearchQuery, queueBucketFilter]);

  const queueSections = useMemo(() => {
    const orderedBuckets: QueueBucketKey[] =
      archiveScope === "archived"
        ? ["archived"]
        : [
            "high_risk",
            "needs_analysis",
            "needs_draft",
            "pending_review",
            "reply_now",
            "waiting_customer",
          ];

    return orderedBuckets
      .map((bucket) => ({
        bucket,
        config: getQueueBucketConfig(bucket),
        items: filteredInboxItems.filter(
          (item) => getQueueBucket(item) === bucket,
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [archiveScope, filteredInboxItems]);

  function handleQueueSectionPageChange(
    bucket: QueueBucketKey,
    nextPage: number,
  ) {
    setQueueSectionPages((current) => ({
      ...current,
      [bucket]: nextPage,
    }));
  }

  async function handleLogout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API error and still force the user back to login.
    } finally {
      window.location.href = "/login";
    }
  }

  async function handleAnalyze(conversationId: string) {
    setActionConversationId(conversationId);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/analyze`, {
        method: "POST",
      });
      const data = await apiFetch<SalesInboxItem[]>(
        buildInboxPath(sourceChannelFilter, archiveScope),
      );
      setInboxItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menjalankan AI analysis.",
      );
    } finally {
      setActionConversationId(null);
    }
  }

  async function handleGenerateDraft(conversationId: string) {
    setActionConversationId(conversationId);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/reply-suggestions`, {
        method: "POST",
      });
      const data = await apiFetch<SalesInboxItem[]>(
        buildInboxPath(sourceChannelFilter, archiveScope),
      );
      setInboxItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat draft balasan.",
      );
    } finally {
      setActionConversationId(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Operational inbox"
      title="Chat Masuk"
      description="Tempat paling cepat untuk lihat chat yang harus dibaca, dianalisis, lalu dibalas."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <>
          {canAccessMarketing && !isSalesWorkspace && (
            <Link
              href="/dashboard/marketing"
              className="clara-button clara-button-ghost"
            >
              Marketing Insights
            </Link>
          )}
          <Link
            href="/dashboard/crm"
            className="clara-button clara-button-ghost"
          >
            Leads
          </Link>
          <Link
            href="/dashboard/follow-up"
            className="clara-button clara-button-ghost"
          >
            Tindak Lanjut
          </Link>
          {!isSalesWorkspace && (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Chat Review Center
            </Link>
          )}
          {canAccessKnowledge && !isSalesWorkspace && (
            <Link
              href="/dashboard/knowledge"
              className="clara-button clara-button-ghost"
            >
              Product Knowledge
            </Link>
          )}
          {canAccessAdminOps && (
            <Link href="/admin/ops" className="clara-button clara-button-ghost">
              Admin Ops
            </Link>
          )}
          {canAccessAdminOps && (
            <Link
              href="/admin/access"
              className="clara-button clara-button-ghost"
            >
              Manage Users
            </Link>
          )}
          <Link
            href="/dashboard/upload"
            className="clara-button clara-button-primary"
          >
            Input Chat
          </Link>
          {!isSalesWorkspace && (
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              className="clara-button clara-button-ghost"
            >
              Logout
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="clara-empty-state text-sm clara-text-secondary"
          >
            Memuat antrean chat...
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="clara-alert clara-alert-danger">
            <p>{errorMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="clara-button clara-button-secondary"
              >
                Coba lagi
              </button>
              <Link href="/login" className="clara-button clara-button-ghost">
                Login ulang
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section
              data-onboarding-id="sales-inbox-hero"
              className="clara-card p-5 sm:p-6"
            >
              <p className="clara-kicker text-xs">Status antrean</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] clara-text-primary sm:text-2xl">
                Kerjakan chat yang paling butuh respons
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 clara-text-secondary">
                {highRiskCount > 0
                  ? `${highRiskCount} chat risiko tinggi berada di urutan pertama.`
                  : analyzedCount < inboxItems.length
                    ? `${inboxItems.length - analyzedCount} chat masih perlu dianalisis sebelum dibalas.`
                    : "Antrean aktif sudah siap diproses berdasarkan prioritas di bawah."}
              </p>
            </section>

            <section
              data-onboarding-id="sales-inbox-metrics"
              className="grid gap-3 sm:grid-cols-3"
            >
              <OverviewTile
                label="Perlu Analisis"
                value={String(inboxItems.length - analyzedCount)}
                tone="blue"
              />
              <OverviewTile
                label="Risiko Tinggi"
                value={String(highRiskCount)}
                tone="amber"
              />
              <OverviewTile
                label="Menunggu Customer"
                value={String(sentCount)}
                tone="green"
              />
            </section>

            <section
              data-onboarding-id="sales-inbox-filters"
              className="clara-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold clara-text-primary">
                  Cari dan filter
                </h2>
                <p className="text-sm clara-text-secondary">
                  {filteredInboxItems.length} dari {inboxItems.length} chat
                </p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
                <div>
                  <label htmlFor="sales-search" className="clara-label">
                    Cari chat
                  </label>
                  <input
                    id="sales-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari nama atau isi pesan..."
                    className="clara-input mt-2 w-full"
                  />
                </div>

                <div>
                  <label htmlFor="sales-archive" className="clara-label">
                    Status chat
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
                  <label htmlFor="sales-priority" className="clara-label">
                    Prioritas
                  </label>
                  <select
                    id="sales-priority"
                    value={queueBucketFilter}
                    onChange={(event) => setQueueBucketFilter(event.target.value)}
                    className="clara-select mt-2 w-full"
                  >
                    {QUEUE_BUCKET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="grid gap-4">
              {filteredInboxItems.length === 0 ? (
                <div className="clara-empty-state">
                  <h2 className="text-xl font-semibold clara-text-primary">
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada conversation archived"
                        : "Belum ada conversation"
                      : "Tidak ada conversation yang cocok dengan filter ini"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 clara-text-secondary">
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Chat lama yang tidak aktif akan muncul di tab ini setelah melewati batas inactivity yang ditentukan sistem."
                        : "Workspace ini akan mulai terasa hidup setelah chat pertama dari WhatsApp, Instagram, TikTok, atau upload manual masuk ke conversation."
                      : "Coba longgarkan pencarian atau ganti bucket kerja supaya conversation yang relevan muncul lagi."}
                  </p>
                  {inboxItems.length === 0 && archiveScope !== "archived" && (
                    <Link
                      href="/dashboard/upload"
                      className="clara-button clara-button-primary mt-5"
                    >
                      Upload Chat Pertama
                    </Link>
                  )}
                </div>
              ) : (
                queueSections.map((section, sectionIndex) => {
                  const requestedPage = queueSectionPages[section.bucket] ?? 1;
                  const totalPages = Math.max(
                    1,
                    Math.ceil(section.items.length / QUEUE_SECTION_PAGE_SIZE),
                  );
                  const currentPage = Math.min(
                    Math.max(requestedPage, 1),
                    totalPages,
                  );
                  const paginatedItems = section.items.slice(
                    (currentPage - 1) * QUEUE_SECTION_PAGE_SIZE,
                    currentPage * QUEUE_SECTION_PAGE_SIZE,
                  );

                  return (
                    <section
                      key={section.bucket}
                      data-onboarding-id={
                        sectionIndex === 0 ? "sales-inbox-queue" : undefined
                      }
                      className="clara-card p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-sm font-semibold clara-text-primary">
                            {section.config.label}
                          </p>
                          <h2 className="mt-1 text-lg font-bold clara-text-primary">
                            {section.items.length} chat
                          </h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 clara-text-secondary">
                          {section.config.description}
                        </p>
                      </div>

                      {totalPages > 1 ? (
                        <div className="clara-card-soft mt-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm clara-text-secondary">
                            Menampilkan{" "}
                            <span className="font-semibold clara-text-primary">
                              {paginatedItems.length}
                            </span>{" "}
                            dari{" "}
                            <span className="font-semibold clara-text-primary">
                              {section.items.length}
                            </span>{" "}
                            conversation
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={currentPage === 1}
                              onClick={() =>
                                handleQueueSectionPageChange(
                                  section.bucket,
                                  currentPage - 1,
                                )
                              }
                              className="clara-button clara-button-ghost disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Sebelumnya
                            </button>
                            <span className="px-1 text-sm clara-text-secondary">
                              Halaman {currentPage} / {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={currentPage === totalPages}
                              onClick={() =>
                                handleQueueSectionPageChange(
                                  section.bucket,
                                  currentPage + 1,
                                )
                              }
                              className="clara-button clara-button-ghost disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3">
                        {paginatedItems.map((item, itemIndex) => {
                          const extraction = item.latest_ai_extraction;
                          const provider = inferProviderFromSource(item.source);
                          const canAnalyze = extraction === null;
                          const canGenerateDraft =
                            extraction !== null &&
                            item.latest_reply_suggestion === null &&
                            item.ui_status !== "reply_sent";
                          const isActing =
                            actionConversationId === item.conversation_id;

                          return (
                            <article
                              key={item.conversation_id}
                              data-onboarding-id={
                                sectionIndex === 0 && itemIndex === 0
                                  ? "sales-inbox-upcoming-actions"
                                  : undefined
                              }
                              className="clara-card-outline p-4 sm:p-5"
                            >
                              <div className="flex h-full flex-col gap-4">
                                <div className="min-w-0 space-y-4">
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <h3 className="min-w-0 break-words text-lg font-semibold leading-6 clara-text-primary">
                                      {item.title}
                                    </h3>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getChannelBadgeClass(
                                        item.source_channel,
                                      )}`}
                                    >
                                      {formatChannelLabel(item.source_channel)}
                                    </span>

                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProviderBadgeClass(
                                        provider,
                                      )}`}
                                    >
                                      {formatProviderLabel(provider)}
                                    </span>

                                    {isExperimentalChannel(item.source_channel) ? (
                                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                        Experimental
                                      </span>
                                    ) : null}

                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      {section.config.label}
                                    </span>

                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountCategoryBadgeClass(
                                        item.account_category,
                                      )}`}
                                    >
                                      {formatAccountCategory(
                                        item.account_category,
                                      )}
                                    </span>

                                    {extraction && (
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                                          extraction.lead_temperature,
                                        )}`}
                                      >
                                        {extraction.lead_temperature.toUpperCase()}
                                      </span>
                                    )}

                                    {extraction && (
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(
                                          extraction.risk_level,
                                        )}`}
                                      >
                                        Risk {extraction.risk_level}
                                      </span>
                                    )}

                                    {item.ui_status === "reply_sent" && (
                                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                        SENT
                                      </span>
                                    )}

                                    {item.is_archived && (
                                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                        ARCHIVED
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-sm leading-6 text-slate-600 line-clamp-3">
                                    {item.latest_message
                                      ? item.latest_message.message_text
                                      : "Belum ada pesan."}
                                  </p>

                                  <div className="grid gap-2 text-xs text-slate-500">
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                      <span>
                                        Sumber:{" "}
                                        <span className="font-semibold text-slate-700">
                                          {item.source_label}
                                        </span>
                                      </span>
                                      {shouldShowOwnership ? (
                                        <span>
                                          Owner:{" "}
                                          <span className="font-semibold text-slate-700">
                                            {item.sales_owner_name ??
                                              "Belum ada owner"}
                                          </span>
                                        </span>
                                      ) : null}
                                      <span>
                                        Pesan terakhir:{" "}
                                        {formatDateTime(item.last_message_at)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                      <span>Priority: {item.priority_score}</span>
                                      <span>
                                        Status:{" "}
                                        {formatStatusLabel(item.ui_status)}
                                      </span>
                                      {archiveScope === "all" ? (
                                        <span>
                                          {item.is_archived ? "Arsip" : "Aktif"}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                <div className="clara-card-soft p-4">
                                  <p className="clara-kicker text-[11px]">
                                    Langkah berikutnya
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-700 line-clamp-3">
                                    {extraction?.next_best_action ??
                                      "Belum dianalisis. Jalankan AI analysis dulu."}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      {formatStatusLabel(item.ui_status)}
                                    </span>
                                    {shouldShowOwnership &&
                                    item.sales_owner_name ? (
                                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                        {item.sales_owner_name}
                                      </span>
                                    ) : null}
                                    {archiveScope === "all" ? (
                                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                        {item.is_archived ? "Arsip" : "Aktif"}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                                  {canAnalyze ? (
                                    <button
                                      type="button"
                                      disabled={isActing}
                                      onClick={() => {
                                        void handleAnalyze(
                                          item.conversation_id,
                                        );
                                      }}
                                      className="clara-button clara-button-secondary disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {isActing ? "Menganalisis..." : "Analisis AI"}
                                    </button>
                                  ) : null}

                                  {canGenerateDraft ? (
                                    <button
                                      type="button"
                                      disabled={isActing}
                                      onClick={() => {
                                        void handleGenerateDraft(
                                          item.conversation_id,
                                        );
                                      }}
                                      className="clara-button clara-button-secondary disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {isActing
                                        ? "Membuat..."
                                        : "Buat Draft"}
                                    </button>
                                  ) : null}

                                  <Link
                                    href={`/dashboard/sales/conversations/${item.conversation_id}`}
                                    className="clara-button clara-button-primary"
                                  >
                                    Buka Percakapan
                                  </Link>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function OverviewTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "blue" | "green" | "amber";
}) {
  return (
    <article data-tone={tone} className="clara-card-soft p-4">
      <p className="text-sm clara-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight clara-text-primary">
        {value}
      </p>
    </article>
  );
}
