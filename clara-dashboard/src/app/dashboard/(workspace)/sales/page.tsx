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
import { getRoleDisplayLabel, isManagerLike } from "@/lib/roles";
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

export default function SalesInboxPage() {
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [archiveScope, setArchiveScope] = useState("active");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadInbox() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (sourceChannelFilter !== "all") {
          params.set("source_channel", sourceChannelFilter);
        }
        if (archiveScope !== "active") {
          params.set("archive_scope", archiveScope);
        }
        const inboxPath = params.size
          ? `/dashboard/sales/inbox?${params.toString()}`
          : "/dashboard/sales/inbox";
        const [data, me] = await Promise.all([
          apiFetch<SalesInboxItem[]>(inboxPath),
          apiFetch<CurrentUser>("/auth/me"),
        ]);
        setInboxItems(data);
        setCurrentUser(me);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load inbox.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInbox();
  }, [archiveScope, sourceChannelFilter]);

  const canAccessMarketing =
    currentUser !== null && ["superadmin", "head"].includes(currentUser.role);
  const canAccessKnowledge =
    currentUser !== null && currentUser.role === "superadmin";
  const canAccessAdminOps =
    currentUser !== null && ["superadmin", "head"].includes(currentUser.role);

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
  const archivedCount = inboxItems.filter((item) => item.is_archived).length;

  async function handleLogout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API error and still force the user back to login.
    } finally {
      window.location.href = "/login";
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
            Lead Pipeline
          </Link>
          <Link
            href="/dashboard/follow-up"
            className="clara-button clara-button-ghost"
          >
            AI Worklist
          </Link>
          <Link
            href="/dashboard/approvals"
            className="clara-button clara-button-ghost"
          >
            Approval Queue
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
            Upload Chat Baru
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
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada conversation yang terarsip"
                        : "Inbox masih kosong"
                      : "Buka conversation paling atas lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {inboxItems.length === 0
                      ? archiveScope === "archived"
                        ? "Belum ada chat yang masuk arsip otomatis. Conversation yang tidak aktif akan muncul di sini setelah melewati batas inactivity."
                        : "Kalau belum ada percakapan, langkah paling masuk akal adalah import chat dulu supaya Clara punya bahan kerja."
                      : "Urutan di inbox ini sudah cukup dekat dengan prioritas operasional. Setelah membuka conversation, pastikan AI analysis tersedia sebelum Anda memutuskan reply, approval, atau pindah ke lead detail."}
                  </p>
                </div>
                <Link
                  href={
                    inboxItems[0]
                      ? `/dashboard/sales/conversations/${inboxItems[0].conversation_id}`
                      : "/dashboard/upload"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {inboxItems[0] ? "Buka Chat Prioritas" : "Import Chat"}
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Buka chat paling atas"
                  description="Biasanya item teratas sudah diprioritaskan Clara dari status dan konteks terbaru."
                />
                <UsageHint
                  title="2. Jalankan AI analysis"
                  description="Kalau belum ada insight, analisis dulu sebelum membuat keputusan reply atau follow-up."
                />
                <UsageHint
                  title="3. Lanjutkan ke lead"
                  description="Kalau chat sudah jelas arahnya, buka lead detail untuk atur stage dan follow-up."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Scope Conversation
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Pisahkan chat aktif dan arsip agar queue harian tetap bersih.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Filter Channel
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Pisahkan inbox berdasarkan WhatsApp atau Telegram.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SOURCE_CHANNEL_OPTIONS.map((option) => {
                    const isActive = sourceChannelFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSourceChannelFilter(option.value);
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
            </section>

            <section className="grid gap-4">
              {inboxItems.length === 0 ? (
                <div className="clara-empty-state">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {archiveScope === "archived"
                      ? "Belum ada conversation archived"
                      : "Belum ada conversation"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {archiveScope === "archived"
                      ? "Chat lama yang tidak aktif akan muncul di tab ini setelah melewati batas inactivity yang ditentukan sistem."
                      : "Workspace ini akan mulai terasa hidup setelah chat WhatsApp pertama di-upload dan diparse menjadi conversation."}
                  </p>
                  {archiveScope !== "archived" && (
                    <Link
                      href="/dashboard/upload"
                      className="clara-button clara-button-primary mt-5"
                    >
                      Upload Chat Pertama
                    </Link>
                  )}
                </div>
              ) : (
                inboxItems.map((item) => {
                  const extraction = item.latest_ai_extraction;

                  return (
                    <Link
                      key={item.conversation_id}
                      href={`/dashboard/sales/conversations/${item.conversation_id}`}
                      className="clara-card group block rounded-[30px] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,23,42,0.09)]"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="truncate text-lg font-semibold text-slate-950 group-hover:text-slate-800">
                              {item.title}
                            </h2>

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
                              Pesan terakhir:{" "}
                              {formatDateTime(item.last_message_at)}
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
                    </Link>
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
