"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  getRoleDisplayLabel,
  isManagerLike,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type { CurrentUser, SalesInboxItem } from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua Channel" },
  { value: "whatsapp", label: "WhatsApp" },
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
  { value: "needs_analysis", label: "Perlu analisis" },
  { value: "needs_draft", label: "Perlu draft" },
  { value: "pending_review", label: "Menunggu review" },
  { value: "high_risk", label: "Risiko tinggi" },
  { value: "archived", label: "Archived" },
] as const;

type QueueBucketKey =
  | "reply_now"
  | "needs_analysis"
  | "needs_draft"
  | "pending_review"
  | "high_risk"
  | "archived";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionConversationId, setActionConversationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInbox() {
    setIsLoading(true);

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
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
      setInboxItems(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load inbox.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
  }, [archiveScope, router, sourceChannelFilter]);

  const canAccessMarketing =
    currentUser !== null && ["superadmin", "head"].includes(currentUser.role);
  const canAccessKnowledge =
    currentUser !== null && currentUser.role === "superadmin";
  const canAccessAdminOps =
    currentUser !== null && ["superadmin", "head"].includes(currentUser.role);

  const analyzedCount = inboxItems.filter(
    (item) => item.latest_ai_extraction !== null,
  ).length;
  const sentCount = inboxItems.filter((item) => item.latest_sent_message).length;
  const highRiskCount = inboxItems.filter(
    (item) => item.latest_ai_extraction?.risk_level === "high",
  ).length;
  const shouldShowOwnership = isManagerLike(currentUser?.role);
  const archivedCount = inboxItems.filter((item) => item.is_archived).length;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredInboxItems = useMemo(() => {
    return inboxItems.filter((item) => {
      if (queueBucketFilter !== "all" && getQueueBucket(item) !== queueBucketFilter) {
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
        : ["high_risk", "needs_analysis", "needs_draft", "pending_review", "reply_now"];

    return orderedBuckets
      .map((bucket) => ({
        bucket,
        config: getQueueBucketConfig(bucket),
        items: filteredInboxItems.filter((item) => getQueueBucket(item) === bucket),
      }))
      .filter((section) => section.items.length > 0);
  }, [archiveScope, filteredInboxItems]);

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
        error instanceof Error ? error.message : "Gagal menjalankan AI analysis.",
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
      description="Semua percakapan penting dikumpulkan di satu tempat. User tidak perlu menebak mana yang harus dibalas dulu karena Clara sudah menyorot prioritas, risiko, dan langkah berikutnya."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          {canAccessMarketing && (
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
            Lead Management
          </Link>
          <Link
            href="/dashboard/follow-up"
            className="clara-button clara-button-ghost"
          >
            Action Center
          </Link>
          <Link
            href="/dashboard/approvals"
            className="clara-button clara-button-ghost"
          >
            Chat Review Center
          </Link>
          {canAccessKnowledge && (
            <Link
              href="/dashboard/knowledge"
              className="clara-button clara-button-ghost"
            >
              Product Knowledge
            </Link>
          )}
          {canAccessAdminOps && (
            <Link
              href="/dashboard/admin/ops"
              className="clara-button clara-button-ghost"
            >
              Admin Ops
            </Link>
          )}
          {canAccessAdminOps && (
            <Link
              href="/dashboard/admin/access"
              className="clara-button clara-button-ghost"
            >
              Manage Users
            </Link>
          )}
          <Link
            href="/dashboard/upload"
            className="clara-button clara-button-primary"
          >
            Lead Capture
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="clara-button clara-button-ghost"
          >
            Logout
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading inbox...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">
            {errorMessage}. Coba login ulang di{" "}
            <Link href="/login" className="font-semibold underline">
              halaman login
            </Link>
            .
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#eff6ff_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {filteredInboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada conversation yang terarsip"
                        : "Inbox masih kosong"
                      : "Kerjakan bucket paling atas lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {filteredInboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada chat yang masuk arsip otomatis. Conversation yang tidak aktif akan muncul di sini setelah melewati batas inactivity."
                        : "Kalau belum ada percakapan, langkah paling masuk akal adalah import chat dulu supaya Clara punya bahan kerja."
                      : "Queue ini sekarang dipisah per jenis pekerjaan. Ambil bucket yang paling kritis dulu, jalankan quick action yang perlu, lalu baru buka detail chat kalau memang butuh konteks penuh."}
                  </p>
                </div>
                <Link
                  href={
                    filteredInboxItems[0]
                      ? `/dashboard/sales/conversations/${filteredInboxItems[0].conversation_id}`
                      : "/dashboard/upload"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {filteredInboxItems[0] ? "Buka Chat Prioritas" : "Buka Lead Capture"}
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Mulai dari bucket kerja"
                  description="Pisahkan chat yang perlu analisis, draft, review, atau langsung dibalas supaya user tidak scan list campur."
                />
                <UsageHint
                  title="2. Pakai quick action dulu"
                  description="Kalau tugasnya hanya analisis atau draft, kerjakan langsung dari queue tanpa wajib buka detail."
                />
                <UsageHint
                  title="3. Buka detail saat perlu konteks"
                  description="Turun ke conversation detail hanya saat butuh membaca transcript, review case, atau update CRM lebih dalam."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <OverviewTile
                label="Total Percakapan"
                value={String(inboxItems.length)}
                tone="slate"
              />
              <OverviewTile
                label="Sudah Dianalisis"
                value={String(analyzedCount)}
                tone="blue"
              />
              <OverviewTile
                label="Sudah Terkirim"
                value={String(sentCount)}
                tone="green"
              />
              <OverviewTile
                label="Risiko Tinggi"
                value={String(highRiskCount)}
                tone="amber"
              />
              <OverviewTile
                label="Archived"
                value={String(archivedCount)}
                tone="slate"
              />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#fff7ed_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <div className="space-y-4 rounded-[24px] border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Kontrol Queue
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                      Atur queue kerja dari satu toolbar
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Atur scope conversation, channel, pencarian, dan bucket kerja dari satu tempat supaya scanning queue lebih cepat.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <QueueMetaPill label="Scope" value={archiveScope === "active" ? "Aktif" : archiveScope === "archived" ? "Archived" : "Semua"} />
                    <QueueMetaPill
                      label="Channel"
                      value={
                        SOURCE_CHANNEL_OPTIONS.find(
                          (option) => option.value === sourceChannelFilter,
                        )?.label ?? "Semua Channel"
                      }
                    />
                    <QueueMetaPill
                      label="Bucket"
                      value={
                        QUEUE_BUCKET_OPTIONS.find(
                          (option) => option.value === queueBucketFilter,
                        )?.label ?? "Semua queue"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr]">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Scope Conversation
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ARCHIVE_SCOPE_OPTIONS.map((option) => {
                        const isActive = archiveScope === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setArchiveScope(option.value);
                            }}
                            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                              isActive
                                ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Filter Cepat
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        <span>Channel</span>
                        <select
                          value={sourceChannelFilter}
                          onChange={(event) => setSourceChannelFilter(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                        >
                          {SOURCE_CHANNEL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        <span>Bucket kerja</span>
                        <select
                          value={queueBucketFilter}
                          onChange={(event) => setQueueBucketFilter(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                        >
                          {QUEUE_BUCKET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    <span>Cari conversation</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari nama, isi pesan, owner, atau next action..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] placeholder:text-slate-400"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-slate-200 shadow-[0_12px_24px_rgba(15,23,42,0.1)]">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  Hasil
                </span>
                <span>
                  Menampilkan <span className="font-semibold text-white">{filteredInboxItems.length}</span> dari{" "}
                  <span className="font-semibold text-white">{inboxItems.length}</span> conversation.
                </span>
              </div>
            </section>

            <section className="grid gap-4">
              {filteredInboxItems.length === 0 ? (
                <div className="clara-empty-state">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada conversation archived"
                        : "Belum ada conversation"
                      : "Tidak ada conversation yang cocok dengan filter ini"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Chat lama yang tidak aktif akan muncul di tab ini setelah melewati batas inactivity yang ditentukan sistem."
                        : "Workspace ini akan mulai terasa hidup setelah chat WhatsApp pertama di-upload dan diparse menjadi conversation."
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
                queueSections.map((section) => (
                  <section key={section.bucket} className="clara-card rounded-[28px] p-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {section.config.label}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-slate-950">
                          {section.items.length} conversation
                        </h2>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-slate-500">
                        {section.config.description}
                      </p>
                    </div>

                    <div className="mt-5 space-y-4">
                      {section.items.map((item) => {
                        const extraction = item.latest_ai_extraction;
                        const canAnalyze = extraction === null;
                        const canGenerateDraft =
                          extraction !== null &&
                          item.latest_reply_suggestion === null &&
                          item.ui_status !== "reply_sent";
                        const isActing = actionConversationId === item.conversation_id;

                        return (
                          <article
                            key={item.conversation_id}
                            className="clara-card rounded-[30px] p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <h3 className="truncate text-lg font-semibold text-slate-950">
                                    {item.title}
                                  </h3>

                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {section.config.label}
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

                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                  {item.latest_message
                                    ? item.latest_message.message_text
                                    : "Belum ada pesan."}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {shouldShowOwnership && item.sales_owner_name ? (
                                    <>
                                      <span>
                                        Owner:{" "}
                                        <span className="font-semibold text-slate-700">
                                          {item.sales_owner_name}
                                        </span>
                                      </span>
                                      <span>&bull;</span>
                                    </>
                                  ) : null}
                                  <span>
                                    Pesan terakhir: {formatDateTime(item.last_message_at)}
                                  </span>
                                  <span>&bull;</span>
                                  <span>Priority: {item.priority_score}</span>
                                  <span>&bull;</span>
                                  <span>{formatStatusLabel(item.ui_status)}</span>
                                  {archiveScope === "all" && (
                                    <>
                                      <span>&bull;</span>
                                      <span>{item.is_archived ? "Arsip" : "Aktif"}</span>
                                    </>
                                  )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {canAnalyze ? (
                                    <button
                                      type="button"
                                      disabled={isActing}
                                      onClick={() => {
                                        void handleAnalyze(item.conversation_id);
                                      }}
                                      className="inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {isActing ? "Analyzing..." : "Analyze"}
                                    </button>
                                  ) : null}

                                  {canGenerateDraft ? (
                                    <button
                                      type="button"
                                      disabled={isActing}
                                      onClick={() => {
                                        void handleGenerateDraft(item.conversation_id);
                                      }}
                                      className="inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {isActing ? "Generating..." : "Generate Draft"}
                                    </button>
                                  ) : null}

                                  <Link
                                    href={`/dashboard/sales/conversations/${item.conversation_id}`}
                                    className="inline-flex rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                  >
                                    Buka Chat
                                  </Link>
                                </div>
                              </div>

                              <div className="clara-card-soft w-full rounded-[24px] p-4 md:w-80">
                                <p className="clara-kicker text-[11px]">
                                  Langkah berikutnya
                                </p>
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                  {extraction?.next_best_action ??
                                    "Belum dianalisis. Jalankan AI analysis dulu."}
                                </p>

                                <p className="clara-kicker mt-5 text-[11px]">
                                  Status balasan
                                </p>
                                <p className="mt-2 text-sm font-medium text-slate-800">
                                  {formatStatusLabel(item.ui_status)}
                                </p>

                                {shouldShowOwnership ? (
                                  <>
                                    <p className="clara-kicker mt-5 text-[11px]">
                                      Kepemilikan
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-slate-800">
                                      {item.sales_owner_name ?? "Belum ada owner"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Visible untuk {getRoleDisplayLabel(currentUser?.role)}
                                    </p>
                                  </>
                                ) : null}

                                <p className="clara-kicker mt-5 text-[11px]">
                                  Status arsip
                                </p>
                                <p className="mt-2 text-sm font-medium text-slate-800">
                                  {item.is_archived ? "Archived otomatis" : "Aktif"}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
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

function QueueMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <span className="ml-2 text-sm font-semibold text-slate-700">{value}</span>
    </div>
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
  const toneClass =
    tone === "blue"
      ? "from-sky-50 to-white text-sky-700"
      : tone === "green"
        ? "from-emerald-50 to-white text-emerald-700"
        : tone === "amber"
          ? "from-amber-50 to-white text-amber-700"
          : "from-slate-50 to-white text-slate-700";

  return (
    <article
      className={`clara-card rounded-[26px] bg-gradient-to-br p-5 ${toneClass}`}
    >
      <p className="clara-kicker text-[11px] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}
