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
import type { CurrentUser, SalesInboxItem } from "@/types/dashboard";

export default function SalesInboxPage() {
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadInbox() {
      try {
        const [data, me] = await Promise.all([
          apiFetch<SalesInboxItem[]>("/dashboard/sales/inbox"),
          apiFetch<CurrentUser>("/auth/me"),
        ]);
        setInboxItems(data);
        setCurrentUser(me);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load inbox."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadInbox();
  }, []);

  const canAccessMarketing =
    currentUser !== null && ["owner", "admin"].includes(currentUser.role);
  const canAccessKnowledge =
    currentUser !== null && currentUser.role === "owner";
  const canAccessAdminOps =
    currentUser !== null && ["owner", "admin"].includes(currentUser.role);

  const analyzedCount = inboxItems.filter(
    (item) => item.latest_ai_extraction !== null
  ).length;
  const sentCount = inboxItems.filter((item) => item.latest_sent_message).length;
  const highRiskCount = inboxItems.filter(
    (item) => item.latest_ai_extraction?.risk_level === "high"
  ).length;

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
      title="Conversation Inbox"
      description="Semua percakapan penting dikumpulkan di satu tempat. User tidak perlu menebak mana yang harus dibalas dulu karena Clara sudah menyorot prioritas, risiko, dan langkah berikutnya."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          {canAccessMarketing && (
            <Link
              href="/dashboard/marketing"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Marketing Insights
            </Link>
          )}
          <Link
            href="/dashboard/crm"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Lead Pipeline
          </Link>
          <Link
            href="/dashboard/follow-up"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            AI Worklist
          </Link>
          {canAccessKnowledge && (
            <Link
              href="/dashboard/knowledge"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Product Knowledge
            </Link>
          )}
          {canAccessAdminOps && (
            <Link
              href="/dashboard/admin/ops"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Admin Ops
            </Link>
          )}
          {canAccessAdminOps && (
            <Link
              href="/dashboard/admin/access"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Manage Users
            </Link>
          )}
          <Link
            href="/dashboard/upload"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Upload Chat Baru
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Logout
          </button>
        </>
      }
    >
      <div className="space-y-6">

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading inbox...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}. Coba login ulang di{" "}
            <Link href="/login" className="font-semibold underline">
              halaman login
            </Link>
            .
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
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
            </section>

            <section className="grid gap-4">
            {inboxItems.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <h2 className="text-xl font-semibold text-slate-900">
                  Belum ada conversation
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Workspace ini akan mulai terasa hidup setelah chat WhatsApp pertama
                  di-upload dan diparse menjadi conversation.
                </p>
                <Link
                  href="/dashboard/upload"
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Upload Chat Pertama
                </Link>
              </div>
            ) : (
              inboxItems.map((item) => {
                const extraction = item.latest_ai_extraction;
                const suggestion = item.latest_reply_suggestion;

                return (
                  <Link
                    key={item.conversation_id}
                    href={`/dashboard/sales/conversations/${item.conversation_id}`}
                    className="group block rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
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
                                extraction.lead_temperature
                              )}`}
                            >
                              {extraction.lead_temperature.toUpperCase()}
                            </span>
                          )}

                          {extraction && (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(
                                extraction.risk_level
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
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                          {item.latest_message
                            ? item.latest_message.message_text
                            : "Belum ada pesan."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Pesan terakhir: {formatDateTime(item.last_message_at)}
                          </span>
                          <span>•</span>
                          <span>Priority: {item.priority_score}</span>
                          <span>•</span>
                          <span>{formatStatusLabel(item.ui_status)}</span>
                        </div>
                      </div>

                      <div className="w-full rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 md:w-80">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Langkah berikutnya
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {extraction?.next_best_action ??
                            "Belum dianalisis. Jalankan AI analysis dulu."}
                        </p>

                        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Status balasan
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">
                          {formatStatusLabel(item.ui_status)}
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
      className={`rounded-[24px] border border-slate-200 bg-gradient-to-br p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${toneClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}
