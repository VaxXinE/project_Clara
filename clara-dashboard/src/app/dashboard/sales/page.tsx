"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    currentUser !== null &&
    ["owner", "admin", "marketing"].includes(currentUser.role);
  const canAccessAdminOps =
    currentUser !== null && ["owner", "admin"].includes(currentUser.role);

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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Clara Dashboard
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Sales Inbox
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Pantau conversation, hasil AI analysis, dan draft balasan sales
              dari satu tempat.
            </p>
          </div>

          <div className="flex gap-2">
            {canAccessMarketing && (
              <Link
                href="/dashboard/marketing"
                className="inline-flex w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Marketing Insights
              </Link>
            )}

            {canAccessKnowledge && (
              <Link
                href="/dashboard/knowledge"
                className="inline-flex w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Product Knowledge
              </Link>
            )}

            {canAccessAdminOps && (
              <Link
                href="/dashboard/admin/ops"
                className="inline-flex w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Admin Ops
              </Link>
            )}

            {canAccessAdminOps && (
              <Link
                href="/dashboard/admin/access"
                className="inline-flex w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Manage Users
              </Link>
            )}

            <Link
              href="/dashboard/upload"
              className="inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Upload WhatsApp Chat
            </Link>

            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Logout
            </button>
          </div>
        </section>

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
          <section className="grid gap-4">
            {inboxItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  Belum ada conversation
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Upload file WhatsApp .txt dulu.
                </p>
              </div>
            ) : (
              inboxItems.map((item) => {
                const extraction = item.latest_ai_extraction;
                const suggestion = item.latest_reply_suggestion;

                return (
                  <Link
                    key={item.conversation_id}
                    href={`/dashboard/sales/conversations/${item.conversation_id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold text-slate-950">
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

                          {item.latest_sent_message && (
                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                              SENT
                            </span>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                          {item.latest_message
                            ? item.latest_message.message_text
                            : "Belum ada pesan."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Last message: {formatDateTime(item.last_message_at)}
                          </span>
                          <span>•</span>
                          <span>Priority: {item.priority_score}</span>
                          <span>•</span>
                          <span>{formatStatusLabel(item.ui_status)}</span>
                        </div>
                      </div>

                      <div className="w-full rounded-xl bg-slate-50 p-4 md:w-80">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Next action
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {extraction?.next_best_action ??
                            "Belum dianalisis. Jalankan AI analysis dulu."}
                        </p>

                        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Reply status
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">
                          {item.latest_sent_message
                            ? "sent"
                            : suggestion
                              ? formatStatusLabel(suggestion.approval_status)
                              : "No suggestion"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </section>
        )}
      </div>
    </main>
  );
}
