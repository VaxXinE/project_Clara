"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { canAccessAdminPages, getRoleDisplayLabel } from "@/lib/roles";
import { CONVERSATION_STATUS, SNAPSHOT_SCOPE, TABLE_COUNT_LABEL, describeAuditAction } from "@/lib/vocab";
import type { CurrentUser, OpsDatabaseOverview } from "@/types/dashboard";

const LOG_STEP = 10;

export default function AdminOpsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OpsDatabaseOverview | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [logVisible, setLogVisible] = useState(LOG_STEP);

  async function loadOverview() {
    setErrorMessage("");

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessAdminPages(me.role)) {
        router.replace("/workspace");
        return;
      }

      setOverview(await apiFetch<OpsDatabaseOverview>("/dashboard/admin/ops-overview"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Status sistem belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const logs = overview?.recent_audit_logs ?? [];

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.audit}
      description="Siapa melakukan apa di Clara, dan seberapa banyak data yang tersimpan. Halaman ini hanya untuk dibaca."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <Link href="/admin/access" className="clara-button clara-button-secondary">
          Buka Pengguna &amp; Akses
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading ? <LoadingState message="Memuat status sistem..." /> : null}

        {!isLoading && errorMessage ? <ErrorState message={errorMessage} onRetry={() => void loadOverview()} /> : null}

        {overview && !isLoading ? (
          <>
            <section aria-labelledby="ops-counts" className="clara-card p-5 sm:p-6">
              <h2 id="ops-counts" className="text-lg font-bold clara-text-primary">
                Isi sistem saat ini
              </h2>
              <p className="mt-1 text-sm clara-text-secondary">
                Jumlah data yang tersimpan untuk {overview.scope_type === "global" ? "semua organisasi" : "organisasimu"}.
                Pesan chat mentah tidak ditampilkan di sini.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {overview.table_counts.map((item) => (
                  <div key={item.label} className="clara-card-soft min-w-0 p-3">
                    <dt className="text-xs clara-text-muted">{TABLE_COUNT_LABEL[item.label] ?? item.label.replaceAll("_", " ")}</dt>
                    <dd className="mt-1 text-2xl font-bold clara-text-primary">{item.count}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="ops-log" className="space-y-3">
              <h2 id="ops-log" className="text-lg font-bold clara-text-primary">
                Aktivitas terbaru
              </h2>
              {logs.length === 0 ? (
                <EmptyState title="Belum ada aktivitas tercatat" description="Setiap login dan perubahan penting akan muncul di sini." />
              ) : (
                <ul className="space-y-2">
                  {logs.slice(0, logVisible).map((log) => (
                    <li key={log.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold clara-text-primary">{describeAuditAction(log.action)}</p>
                        {log.actor_role ? <Tag>{getRoleDisplayLabel(log.actor_role)}</Tag> : null}
                      </div>
                      <p className="mt-1 break-words text-xs clara-text-muted">
                        {log.actor_email ?? "Sistem"}
                        {log.organization_name ? ` · ${log.organization_name}` : ""} · {formatRelativeTime(log.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {logs.length > logVisible ? (
                <button type="button" onClick={() => setLogVisible((count) => count + LOG_STEP)} className="clara-button clara-button-ghost">
                  Tampilkan {Math.min(logs.length - logVisible, LOG_STEP)} aktivitas lagi ({logs.length - logVisible} tersisa)
                </button>
              ) : null}
            </section>

            <Section title="Pengguna terbaru" count={overview.recent_users.length} empty="Belum ada pengguna.">
              {overview.recent_users.map((user) => (
                <li key={user.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold clara-text-primary">{user.name}</p>
                    <Tag>{getRoleDisplayLabel(user.role)}</Tag>
                  </div>
                  <p className="mt-1 break-words text-xs clara-text-muted">
                    {user.email} · dibuat {formatDateTime(user.created_at)}
                    {user.created_by_user_name ? ` oleh ${user.created_by_user_name}` : ""}
                  </p>
                </li>
              ))}
            </Section>

            <Section title="Organisasi terbaru" count={overview.recent_organizations.length} empty="Belum ada organisasi.">
              {overview.recent_organizations.map((organization) => (
                <li key={organization.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                  <p className="break-words text-sm font-semibold clara-text-primary">{organization.name}</p>
                  <p className="mt-1 text-xs clara-text-muted">Dibuat {formatDateTime(organization.created_at)}</p>
                </li>
              ))}
            </Section>

            <Section title="Percakapan terbaru" count={overview.recent_conversations.length} empty="Belum ada percakapan.">
              {overview.recent_conversations.map((conversation) => (
                <li key={conversation.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold clara-text-primary">{conversation.title}</p>
                    <ValueTag table={CONVERSATION_STATUS} value={conversation.status} />
                  </div>
                  <p className="mt-1 break-words text-xs clara-text-muted">
                    {conversation.organization_name ?? "Tanpa organisasi"}
                    {conversation.sales_owner_name ? ` · Sales: ${conversation.sales_owner_name}` : ""}
                    {conversation.last_message_at ? ` · pesan terakhir ${formatRelativeTime(conversation.last_message_at)}` : ""}
                  </p>
                </li>
              ))}
            </Section>

            <Section title="Pengetahuan produk terbaru" count={overview.recent_product_knowledge.length} empty="Belum ada pengetahuan produk.">
              {overview.recent_product_knowledge.map((item) => (
                <li key={item.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold clara-text-primary">{item.title}</p>
                    <Tag tone={item.is_active ? "good" : "neutral"}>{item.is_active ? "Aktif" : "Nonaktif"}</Tag>
                  </div>
                  <p className="mt-1 break-words text-xs clara-text-muted">
                    {item.organization_name ?? "Semua organisasi"} · diubah {formatRelativeTime(item.updated_at)}
                  </p>
                </li>
              ))}
            </Section>

            <Section title="Catatan insight pasar" count={overview.recent_snapshots.length} empty="Belum ada catatan insight pasar.">
              {overview.recent_snapshots.map((snapshot) => (
                <li key={snapshot.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold clara-text-primary">
                      {snapshot.period_start} s/d {snapshot.period_end}
                    </p>
                    <ValueTag table={SNAPSHOT_SCOPE} value={snapshot.scope_type} />
                  </div>
                  <p className="mt-1 text-xs clara-text-muted">
                    {snapshot.total_conversations} percakapan, {snapshot.total_analyzed_conversations} sudah dibaca Clara
                  </p>
                </li>
              ))}
            </Section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <details className="clara-card p-4 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
        {title} ({count})
      </summary>
      {count === 0 ? <p className="mt-3 text-sm clara-text-secondary">{empty}</p> : <ul className="mt-3 space-y-2">{children}</ul>}
    </details>
  );
}
