"use client";

import Link from "next/link";

import { Tag } from "@/components/dashboard/Tag";
import { groupAuditLogs } from "@/lib/audit";
import { formatRelativeTime } from "@/lib/format";
import { getRoleDisplayLabel } from "@/lib/roles";
import type {
  CurrentUser,
  ExtensionBuildItem,
  KnowledgeUpdateProposalItem,
  OpsDatabaseOverview,
} from "@/types/dashboard";

const RECENT_LIMIT = 5;

type Props = {
  proposals: KnowledgeUpdateProposalItem[] | null;
  extension: ExtensionBuildItem | null;
  overview: OpsDatabaseOverview | null;
  users: CurrentUser[] | null;
  activeAlertCount: number | null;
  isLoading: boolean;
};

type Attention = {
  key: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

/**
 * Beranda Superadmin: apa yang menunggu keputusannya, bagaimana kondisi sistem, dan apa yang baru berubah.
 * Kerja harian Sales dan Manager tidak ditampilkan di sini.
 */
export function SuperadminHome({ proposals, extension, overview, users, activeAlertCount, isLoading }: Props) {
  const pending = (proposals ?? []).filter((item) => item.status === "pending_approval");
  const attention: Attention[] = [];

  if (pending.length > 0) {
    attention.push({
      key: "proposals",
      title: `${pending.length} usulan knowledge menunggu persetujuanmu`,
      description: `Terbaru: ${pending[0].title}. Diusulkan oleh ${pending[0].proposed_by_user_name ?? "tim"}.`,
      href: "/knowledge",
      label: "Tinjau usulan",
    });
  }
  if (extension && !extension.available) {
    attention.push({
      key: "extension",
      title: "Ekstensi belum bisa diunduh pengguna",
      description: "Belum ada berkas ekstensi di server. Unggah supaya Sales bisa memasangnya.",
      href: "/admin/extension",
      label: "Unggah ekstensi",
    });
  }
  if ((activeAlertCount ?? 0) > 0) {
    attention.push({
      key: "alerts",
      title: `${activeAlertCount} alert operasional masih aktif`,
      description: "Alert dari tim yang belum ditandai selesai.",
      href: "/notifications",
      label: "Lihat alert",
    });
  }

  const totalUsers = users?.length ?? null;
  const activeUsers = users ? users.filter((user) => user.is_active).length : null;
  const count = (label: string) => overview?.table_counts.find((item) => item.label === label)?.count ?? null;
  const recent = groupAuditLogs(overview?.recent_audit_logs ?? [])
    .filter((group) => group.kind !== "usage")
    .slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-6">
      <section aria-labelledby="sa-attention" className="clara-card p-5 sm:p-6">
        <p className="text-sm font-semibold text-clara-gold">Perlu keputusanmu</p>

        {isLoading ? (
          <p role="status" className="mt-3 text-sm clara-text-secondary">
            Memuat...
          </p>
        ) : attention.length > 0 ? (
          <>
            <h2 id="sa-attention" className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl">
              {attention.length} hal menunggu keputusanmu
            </h2>
            <ul className="mt-4 space-y-2">
              {attention.map((item) => (
                <li
                  key={item.key}
                  className="clara-card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold clara-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 clara-text-secondary">{item.description}</p>
                  </div>
                  <Link href={item.href} className="clara-button clara-button-primary shrink-0">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 id="sa-attention" className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl">
              Tidak ada yang menunggu keputusanmu
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              Tidak ada usulan knowledge yang menunggu, ekstensi sudah tersedia, dan tidak ada alert aktif.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="sa-status" className="space-y-3">
        <h2 id="sa-status" className="text-base font-semibold clara-text-primary">
          Kondisi sistem
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile
            href="/admin/extension"
            label="Ekstensi Chrome"
            value={isLoading || !extension ? null : extension.available ? `Versi ${extension.version ?? "-"}` : "Belum tersedia"}
            note={
              extension?.available && extension.uploaded_at
                ? `Diunggah ${formatRelativeTime(extension.uploaded_at)}`
                : extension && !extension.available
                  ? "Pengguna belum bisa mengunduh"
                  : undefined
            }
            warn={Boolean(extension && !extension.available)}
          />
          <StatusTile
            href="/admin/access"
            label="Pengguna aktif"
            value={isLoading || activeUsers === null ? null : `${activeUsers} dari ${totalUsers}`}
            note={totalUsers !== null && activeUsers !== null && totalUsers > activeUsers ? `${totalUsers - activeUsers} nonaktif` : undefined}
          />
          <StatusTile
            href="/admin/ops"
            label="Percakapan tersimpan"
            value={isLoading ? null : count("conversations")?.toString() ?? "-"}
            note={count("ai_extractions") !== null ? `${count("ai_extractions")} sudah dibaca Clara` : undefined}
          />
          <StatusTile
            href="/knowledge"
            label="Pengetahuan produk"
            value={isLoading ? null : count("product_knowledge")?.toString() ?? "-"}
            note={pending.length > 0 ? `${pending.length} usulan menunggu` : undefined}
          />
        </div>
      </section>

      <section aria-labelledby="sa-recent" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sa-recent" className="text-base font-semibold clara-text-primary">
            Perubahan terbaru
          </h2>
          <Link href="/admin/ops" className="text-sm font-semibold text-clara-gold hover:underline">
            Lihat semua aktivitas
          </Link>
        </div>

        {isLoading ? null : recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-clara-line p-4 text-sm clara-text-secondary">
            Belum ada perubahan tercatat.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((group) => (
              <li key={`${group.key}-${group.latestAt}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-semibold clara-text-primary">
                    {group.label}
                    {group.count > 1 ? ` (${group.count} kali)` : ""}
                  </p>
                  {group.actorRole ? <Tag>{getRoleDisplayLabel(group.actorRole)}</Tag> : null}
                </div>
                <p className="mt-1 break-words text-xs clara-text-muted">
                  {group.actorEmail ?? "Sistem"} · {formatRelativeTime(group.latestAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusTile({
  href,
  label,
  value,
  note,
  warn = false,
}: {
  href: string;
  label: string;
  value: string | null;
  note?: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="clara-card-soft block min-h-11 p-4 hover:border-clara-gold focus-visible:border-clara-gold"
    >
      <p className="text-sm clara-text-secondary">{label}</p>
      {value === null ? (
        <span
          role="status"
          aria-label="Memuat"
          className="mt-2 inline-block h-7 w-20 rounded-md bg-[var(--color-surface-overlay)]"
        />
      ) : (
        <p className={`mt-1 text-xl font-bold ${warn ? "text-clara-warning" : "clara-text-primary"}`}>{value}</p>
      )}
      {note ? <p className="mt-0.5 text-xs clara-text-muted">{note}</p> : null}
    </Link>
  );
}
