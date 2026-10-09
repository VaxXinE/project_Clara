"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { AUDIT_FILTER_LABEL, auditKind, groupAuditLogs, type AuditFilter } from "@/lib/audit";
import { formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { canAccessAdminPages, getRoleDisplayLabel } from "@/lib/roles";
import { CONVERSATION_STATUS, SNAPSHOT_SCOPE, TABLE_COUNT_LABEL } from "@/lib/vocab";
import type { CurrentUser, ExtensionBuildItem, OpsDatabaseOverview } from "@/types/dashboard";

const LOG_STEP = 10;

export default function AdminOpsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OpsDatabaseOverview | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [logVisible, setLogVisible] = useState(LOG_STEP);
  const [logFilter, setLogFilter] = useState<AuditFilter>("all");
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ok" | "down">("checking");
  const [extension, setExtension] = useState<ExtensionBuildItem | null>(null);

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

      const [health, extensionBuild] = await Promise.allSettled([
        apiFetch<{ status?: string }>("/health"),
        apiFetch<ExtensionBuildItem>("/dashboard/extension-builds"),
      ]);
      setServiceStatus(health.status === "fulfilled" && health.value?.status === "ok" ? "ok" : "down");
      if (extensionBuild.status === "fulfilled") {
        setExtension(extensionBuild.value);
      }
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
  const filteredLogs = logs.filter((log) => logFilter === "all" || auditKind(log.action) === logFilter);
  const groups = groupAuditLogs(filteredLogs);
  const filterCount = (filter: AuditFilter) =>
    filter === "all" ? logs.length : logs.filter((log) => auditKind(log.action) === filter).length;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.audit}
      description="Siapa melakukan apa di Clara, dan seberapa banyak data yang tersimpan. Halaman ini hanya untuk dibaca."
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
            <section aria-labelledby="ops-status" className="clara-card p-5 sm:p-6">
              <h2 id="ops-status" className="text-lg font-bold clara-text-primary">
                Status layanan
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                <li className="clara-card-soft p-3">
                  <p className="text-xs clara-text-muted">Server Clara</p>
                  <p className="mt-1 text-base font-bold">
                    {serviceStatus === "ok" ? (
                      <span className="text-clara-success">Berjalan normal</span>
                    ) : serviceStatus === "down" ? (
                      <span className="text-clara-warning">Tidak merespons</span>
                    ) : (
                      <span className="clara-text-muted">Memeriksa...</span>
                    )}
                  </p>
                </li>
                <li className="clara-card-soft p-3">
                  <p className="text-xs clara-text-muted">Ekstensi Chrome</p>
                  <p className="mt-1 text-base font-bold clara-text-primary">
                    {extension ? (extension.available ? `Versi ${extension.version ?? "-"}` : "Belum diunggah") : "-"}
                  </p>
                  <Link href="/admin/extension" className="text-xs font-semibold text-clara-gold hover:underline">
                    Kelola ekstensi
                  </Link>
                </li>
                <li className="clara-card-soft p-3">
                  <p className="text-xs clara-text-muted">Aktivitas terakhir</p>
                  <p className="mt-1 text-base font-bold clara-text-primary">
                    {logs[0] ? formatRelativeTime(logs[0].created_at) : "Belum ada"}
                  </p>
                </li>
              </ul>
            </section>

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
              <div role="group" aria-label="Jenis aktivitas" className="flex flex-wrap gap-2">
                {(Object.keys(AUDIT_FILTER_LABEL) as AuditFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={logFilter === filter}
                    onClick={() => {
                      setLogFilter(filter);
                      setLogVisible(LOG_STEP);
                    }}
                    className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                      logFilter === filter
                        ? "border-clara-gold bg-clara-gold text-clara-deep"
                        : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
                    }`}
                  >
                    {AUDIT_FILTER_LABEL[filter]} <span className="tabular-nums opacity-70">{filterCount(filter)}</span>
                  </button>
                ))}
              </div>

              {groups.length === 0 ? (
                <EmptyState
                  title="Belum ada aktivitas tercatat"
                  description="Setiap login dan perubahan penting akan muncul di sini."
                />
              ) : (
                <ul className="space-y-2">
                  {groups.slice(0, logVisible).map((group) => (
                    <li key={`${group.key}-${group.latestAt}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold clara-text-primary">
                          {group.label}
                          {group.count > 1 ? ` (${group.count} kali)` : ""}
                        </p>
                        {group.actorRole ? <Tag>{getRoleDisplayLabel(group.actorRole)}</Tag> : null}
                      </div>
                      <p className="mt-1 break-words text-xs clara-text-muted">
                        {group.actorEmail ?? "Sistem"}
                        {group.organizationName ? ` · ${group.organizationName}` : ""} · {formatRelativeTime(group.latestAt)}
                        {group.count > 1 ? ` (mulai ${formatRelativeTime(group.earliestAt)})` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {groups.length > logVisible ? (
                <button type="button" onClick={() => setLogVisible((count) => count + LOG_STEP)} className="clara-button clara-button-ghost">
                  Tampilkan {Math.min(groups.length - logVisible, LOG_STEP)} lagi ({groups.length - logVisible} tersisa)
                </button>
              ) : null}
            </section>

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
