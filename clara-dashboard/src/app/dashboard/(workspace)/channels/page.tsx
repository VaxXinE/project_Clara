"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
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
      eyebrow="Live channel maturity"
      title="Channels"
      description="Satu tempat untuk membaca kesiapan operasional tiap channel: mana yang sudah live sync, mana yang masih import-based, dan berapa banyak lead serta conversation yang datang dari masing-masing channel."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/upload"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Buka Lead Capture
          </Link>
          <Link
            href="/dashboard/kpi"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Ops Dashboard
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading channel overview...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {overview && !isLoading && !errorMessage ? (
          <>
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
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">
                      {item.label}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.key}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.supports_live_sync
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.supports_live_sync ? "Live Sync Ready" : "Import Driven"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {item.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Conversations" value={String(item.conversation_count)} />
                    <MiniMetric label="Leads" value={String(item.lead_count)} />
                    <MiniMetric
                      label="Last Activity"
                      value={formatDateTime(item.latest_activity_at)}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Capabilities
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        <li>{item.supports_file_upload ? "Ya" : "Tidak"}: Upload file</li>
                        <li>{item.supports_text_paste ? "Ya" : "Tidak"}: Paste chat</li>
                        <li>{item.supports_live_sync ? "Ya" : "Tidak"}: Live sync</li>
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Supported Sources
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.supported_sources.map((source) => (
                          <span
                            key={source}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
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
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
