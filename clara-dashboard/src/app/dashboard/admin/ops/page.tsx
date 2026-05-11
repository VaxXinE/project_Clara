"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import type { CurrentUser, OpsDatabaseOverview } from "@/types/dashboard";

export default function AdminOpsPage() {
  const [overview, setOverview] = useState<OpsDatabaseOverview | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadOverview() {
      try {
        const [overviewData, me] = await Promise.all([
          apiFetch<OpsDatabaseOverview>("/dashboard/admin/ops-overview"),
          apiFetch<CurrentUser>("/auth/me"),
        ]);
        setOverview(overviewData);
        setCurrentUser(me);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat admin ops overview."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadOverview();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/dashboard/sales"
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              ← Back to Sales Inbox
            </Link>
            <div className="mt-4">
              <Link
                href="/dashboard/admin/access"
                className="inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Manage Users & Organizations
              </Link>
            </div>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Clara Admin Operations
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Database Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Tampilan read-only untuk melihat metadata database penting tanpa
              membuka client PostgreSQL langsung. Halaman ini sengaja tidak
              menampilkan password hash atau raw chat penuh.
            </p>
          </div>

          {currentUser && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <p>
                Login as: <span className="font-semibold">{currentUser.email}</span>
              </p>
              <p className="mt-1">
                Role:{" "}
                <span className="font-semibold">
                  {formatStatusLabel(currentUser.role)}
                </span>
              </p>
              {overview && (
                <p className="mt-1">
                  Scope:{" "}
                  <span className="font-semibold">
                    {formatStatusLabel(overview.scope_type)}
                  </span>
                </p>
              )}
            </div>
          )}
        </section>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading database overview...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {overview && !isLoading && !errorMessage && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overview.table_counts.map((item) => (
                <MetricCard
                  key={item.label}
                  label={item.label}
                  value={String(item.count)}
                />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Recent Users"
                description="User terbaru berikut role dan organization_id."
              >
                {overview.recent_users.length === 0 ? (
                  <EmptyText text="Belum ada user yang bisa ditampilkan." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_users.map((user) => (
                      <div
                        key={user.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {user.email}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatStatusLabel(user.role)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{user.name}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          org: {user.organization_id ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          created by: {user.created_by_user_name ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          created: {formatDateTime(user.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Recent Organizations"
                description="Daftar organization terbaru yang ada di sistem."
              >
                {overview.recent_organizations.length === 0 ? (
                  <EmptyText text="Belum ada organization." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_organizations.map((organization) => (
                      <div
                        key={organization.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <p className="text-sm font-semibold text-slate-950">
                          {organization.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          slug: {organization.slug}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          created: {formatDateTime(organization.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Recent Conversations"
                description="Metadata conversation terbaru tanpa raw message penuh."
              >
                {overview.recent_conversations.length === 0 ? (
                  <EmptyText text="Belum ada conversation." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {conversation.title}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatStatusLabel(conversation.status)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-slate-500">
                          <p>org: {conversation.organization_id ?? "-"}</p>
                          <p>
                            sales owner: {conversation.sales_owner_name ?? "-"}
                          </p>
                          <p>source: {conversation.source}</p>
                          <p>file: {conversation.raw_filename ?? "-"}</p>
                          <p>
                            last message:{" "}
                            {formatDateTime(conversation.last_message_at)}
                          </p>
                          <p>created: {formatDateTime(conversation.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Recent Audit Logs"
                description="Aksi terbaru yang tercatat di sistem."
              >
                {overview.recent_audit_logs.length === 0 ? (
                  <EmptyText text="Belum ada audit log." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_audit_logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <p className="text-sm font-semibold text-slate-950">
                          {log.action}
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-slate-500">
                          <p>actor: {log.actor_email ?? "-"}</p>
                          <p>role: {log.actor_role ?? "-"}</p>
                          <p>resource: {log.resource_type}</p>
                          <p>resource id: {log.resource_id ?? "-"}</p>
                          <p>org: {log.organization_id ?? "-"}</p>
                          <p>created: {formatDateTime(log.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Recent Product Knowledge"
                description="Knowledge base terbaru yang aktif/nonaktif."
              >
                {overview.recent_product_knowledge.length === 0 ? (
                  <EmptyText text="Belum ada product knowledge." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_product_knowledge.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.is_active ? "active" : "inactive"}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-slate-500">
                          <p>category: {item.category}</p>
                          <p>source type: {item.source_type}</p>
                          <p>org: {item.organization_id}</p>
                          <p>updated: {formatDateTime(item.updated_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Recent Marketing Snapshots"
                description="Snapshot insight terbaru untuk tracking tren."
              >
                {overview.recent_snapshots.length === 0 ? (
                  <EmptyText text="Belum ada marketing snapshot." />
                ) : (
                  <div className="space-y-3">
                    {overview.recent_snapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {snapshot.period_start} s/d {snapshot.period_end}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatStatusLabel(snapshot.scope_type)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-slate-500">
                          <p>org: {snapshot.organization_id ?? "-"}</p>
                          <p>conversations: {snapshot.total_conversations}</p>
                          <p>
                            analyzed conversations:{" "}
                            {snapshot.total_analyzed_conversations}
                          </p>
                          <p>created: {formatDateTime(snapshot.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}
