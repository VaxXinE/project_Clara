"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { NAV_GROUP_NAMES, PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { isAdminLike } from "@/lib/roles";
import type {
  ChannelOverviewResponse,
  CurrentUser,
} from "@/types/dashboard";

export default function ChannelsOverviewPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [overview, setOverview] = useState<ChannelOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadOverview() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isAdminLike(me.role)) {
          router.replace("/dashboard");
          return;
        }

        const data = await apiFetch<ChannelOverviewResponse>("/dashboard/channels");
        setOverview(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat overview channel."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadOverview();
  }, [router]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.daily}
      title={PAGE_NAMES.channels}
      description="Satu tempat untuk membaca kesiapan operasional tiap channel: mana yang sudah live sync, mana yang masih import-based, dan berapa banyak lead serta conversation yang datang dari masing-masing channel."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <>
          <Link
            href="/dashboard/upload"
            className="clara-button clara-button-primary"
          >
            Buka Input Chat
          </Link>
          <Link
            href="/dashboard/kpi"
            className="clara-button clara-button-secondary"
          >
            Dashboard Operasional
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div role="status" className="rounded-2xl border border-clara-line bg-clara-raised p-8 text-center text-sm text-clara-ink-2">
            Memuat ringkasan channel...
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="rounded-2xl border border-clara-danger-line bg-clara-danger-surface p-5 text-sm text-clara-danger">
            {errorMessage}
          </div>
        ) : null}

        {overview && !isLoading ? (
          <>
            <p className="text-sm text-clara-ink-2">
              Read-only: status ini hanya memantau kesiapan channel dan tidak
              mengubah konfigurasi integrasi.
            </p>
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Scope"
                value={overview.scope_type}
                hint="Superadmin membaca scope global, sedangkan head/manager/sales membaca scope organization."
              />
              <MetricCard
                label="Active Channels"
                value={String(overview.items.length)}
                hint="Jumlah channel yang saat ini dikenali Clara sebagai jalur ingestion/operasional."
              />
              <MetricCard
                label="Generated"
                value={formatDateTime(overview.generated_at)}
                hint="Waktu snapshot overview channel terakhir dibangun."
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              {overview.items.map((item) => (
                <article
                  key={item.key}
                  className="rounded-3xl border border-clara-line bg-clara-raised p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold clara-text-primary">
                      {item.label}
                    </h2>
                    <span className="rounded-full bg-clara-raised px-3 py-1 text-xs font-semibold text-clara-ink-2">
                      {item.key}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.supports_live_sync
                          ? "bg-clara-success-surface text-clara-success"
                          : "bg-clara-tint text-clara-gold"
                      }`}
                    >
                      {item.supports_live_sync ? "Live Sync Ready" : "Import Driven"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-clara-ink-2">
                    {item.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Conversations" value={String(item.conversation_count)} />
                    <MiniMetric label="Lead" value={String(item.lead_count)} />
                    <MiniMetric
                      label="Last Activity"
                      value={formatDateTime(item.latest_activity_at)}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-2xl bg-clara-raised p-4">
                      <p className="text-xs font-semibold text-clara-ink-3">
                        Capabilities
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-clara-ink-2">
                        <li>{item.supports_file_upload ? "Ya" : "Tidak"}: Upload file</li>
                        <li>{item.supports_text_paste ? "Ya" : "Tidak"}: Paste chat</li>
                        <li>{item.supports_live_sync ? "Ya" : "Tidak"}: Live sync</li>
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-clara-raised p-4">
                      <p className="text-xs font-semibold text-clara-ink-3">
                        Supported Sources
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.supported_sources.map((source) => (
                          <span
                            key={source}
                            className="rounded-full bg-clara-raised px-3 py-1 text-xs font-semibold text-clara-ink-2 shadow-sm"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-3xl border border-clara-line bg-clara-raised p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold text-clara-ink-3">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold clara-text-primary">{value}</p>
      <p className="mt-2 text-sm leading-6 text-clara-ink-2">{hint}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-clara-raised p-4">
      <p className="text-xs font-semibold text-clara-ink-3">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold clara-text-primary">{value}</p>
    </div>
  );
}
