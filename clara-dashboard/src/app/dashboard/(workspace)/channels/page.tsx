"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { isAdminLike } from "@/lib/roles";
import { CHANNEL_DESCRIPTION, describeSource } from "@/lib/vocab";
import type { ChannelOverviewResponse, CurrentUser } from "@/types/dashboard";

export default function ChannelsOverviewPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [overview, setOverview] = useState<ChannelOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadOverview() {
    setErrorMessage("");

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!isAdminLike(me.role)) {
        router.replace("/dashboard");
        return;
      }

      setOverview(await apiFetch<ChannelOverviewResponse>("/dashboard/channels"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Daftar channel belum bisa dimuat.");
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

  const items = overview?.items ?? [];

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.channels}
      description="Dari mana chat customer masuk ke Clara, dan berapa banyak yang sudah masuk lewat tiap jalur."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <Link href="/upload" className="clara-button clara-button-primary">
          Buka Input Chat
        </Link>
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat daftar channel..." /> : null}

        {!isLoading && errorMessage ? <ErrorState message={errorMessage} onRetry={() => void loadOverview()} /> : null}

        {overview && !isLoading ? (
          <>
            <section className="clara-card p-5 sm:p-6">
              <h2 className="text-xl font-bold clara-text-primary sm:text-2xl">{items.length} channel dikenali Clara</h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Halaman ini hanya untuk dibaca. Untuk memasukkan chat baru, buka Input Chat.
              </p>
            </section>

            {items.length === 0 ? (
              <EmptyState title="Belum ada channel" description="Channel muncul setelah ada chat yang masuk." />
            ) : (
              <ul className="grid gap-4 xl:grid-cols-2">
                {items.map((item) => (
                  <li key={item.key} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold clara-text-primary">{item.label}</h2>
                      <Tag tone={item.supports_live_sync ? "good" : "neutral"}>
                        {item.supports_live_sync ? "Masuk otomatis" : "Dimasukkan manual"}
                      </Tag>
                    </div>
                    <p className="mt-2 text-sm leading-6 clara-text-secondary">
                      {CHANNEL_DESCRIPTION[item.key] ?? item.description}
                    </p>

                    <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <Stat label="Percakapan" value={String(item.conversation_count)} />
                      <Stat label="Lead" value={String(item.lead_count)} />
                      <Stat label="Terakhir aktif" value={item.latest_activity_at ? formatRelativeTime(item.latest_activity_at) : "Belum ada"} />
                    </dl>

                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold clara-text-muted">Cara memasukkan chat</p>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {item.supports_file_upload ? <Tag>Unggah berkas chat</Tag> : null}
                          {item.supports_text_paste ? <Tag>Tempel teks chat</Tag> : null}
                          {item.supports_live_sync ? <Tag tone="good">Otomatis</Tag> : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold clara-text-muted">Jalur yang dikenali</p>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {item.supported_sources.map((source) => (
                            <li key={source}>
                              <Tag>{describeSource(source)}</Tag>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}
