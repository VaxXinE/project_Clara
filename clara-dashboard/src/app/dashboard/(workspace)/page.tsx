"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faBullseye,
  faChartLine,
  faComments,
  faTriangleExclamation,
  faWandSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessQueueAndActionCenter, isAdminLike } from "@/lib/roles";
import type {
  CurrentUser,
  KpiCommandCenterResponse,
  MarketingInsightsPreview,
  SalesInboxItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

type OverviewMetrics = {
  inboxCount: number;
  analyzedCount: number;
  insightConversationCount: number;
  highRiskCount: number;
};

const EMPTY_METRICS: OverviewMetrics = {
  inboxCount: 0,
  analyzedCount: 0,
  insightConversationCount: 0,
  highRiskCount: 0,
};

const roleCopy: Record<string, { title: string; summary: string }> = {
  superadmin: {
    title: "Superadmin Command Center",
    summary: "Ringkasan operasional dan insight.",
  },
  head: {
    title: "Head Control Room",
    summary: "Ringkasan follow-up dan prioritas tim.",
  },
  manager: {
    title: "Manager Action Room",
    summary: "Ringkasan review dan progres Sales.",
  },
  sales: {
    title: "Sales Workspace",
    summary: "Ringkasan chat aktif dan follow-up.",
  },
};

export default function DashboardHomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics>(EMPTY_METRICS);
  const [latestConversation, setLatestConversation] =
    useState<SalesInboxItem | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardHome() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        const nextMetrics: OverviewMetrics = { ...EMPTY_METRICS };

        if (canAccessQueueAndActionCenter(me.role)) {
          try {
            const [inbox, worklistResponse] = await Promise.all([
              apiFetch<SalesInboxItem[]>("/dashboard/sales/inbox"),
              apiFetch<SalesWorklistResponse>("/dashboard/sales/worklist"),
            ]);
            nextMetrics.inboxCount = inbox.length;
            nextMetrics.analyzedCount = inbox.filter(
              (item) => item.latest_ai_extraction !== null,
            ).length;
            setLatestConversation(inbox[0] ?? null);
            setWorklist(worklistResponse);
          } catch {
            // Some roles do not rely on queue data as their primary workspace.
          }
        }

        if (["superadmin", "head"].includes(me.role)) {
          try {
            const [insights, kpiResponse] = await Promise.all([
              apiFetch<MarketingInsightsPreview>(
                "/dashboard/marketing/insights-preview",
              ),
              apiFetch<KpiCommandCenterResponse>("/dashboard/kpi/command-center"),
            ]);
            nextMetrics.insightConversationCount = insights.total_conversations;
            nextMetrics.highRiskCount =
              insights.kpi_summary.high_risk_conversation_count;
            setKpi(kpiResponse);
          } catch {
            // Keep homepage usable even if insight snapshots are not available yet.
          }
        }

        setMetrics(nextMetrics);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat dashboard overview.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboardHome();
  }, []);

  const roleLabel = currentUser ? roleCopy[currentUser.role] : null;
  const canAccessInsights = currentUser !== null && isAdminLike(currentUser.role);
  const aiCoverage =
    metrics.inboxCount > 0
      ? `${metrics.analyzedCount}/${metrics.inboxCount}`
      : "0/0";
  const pendingAiCount = Math.max(metrics.inboxCount - metrics.analyzedCount, 0);
  const openTaskCount = worklist?.items.length ?? 0;
  const latestActivityHref = latestConversation
    ? `/sales/conversations/${latestConversation.conversation_id}`
    : "/upload";
  const latestActivityLabel = latestConversation
    ? "Buka Conversation"
    : "Buka Lead Capture";
  const topSales = kpi?.sales_performance[0] ?? null;
  const topOrganization = kpi?.organization_performance[0] ?? null;
  const primaryObservation = kpi?.key_observations[0] ?? null;
  const topOrganizationWonRate =
    topOrganization && topOrganization.total_leads > 0
      ? topOrganization.won_leads / topOrganization.total_leads
      : 0;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Workspace overview"
      title={currentUser ? `Halo, ${currentUser.name}.` : "SCC Workspace"}
      description={roleLabel?.summary ?? "Ringkasan kerja hari ini."}
    >
      <div className="space-y-6">
        {errorMessage && (
          <section className="clara-alert clara-alert-danger">
            {errorMessage}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Percakapan Aktif"
            value={isLoading ? "..." : String(metrics.inboxCount)}
            hint="Chat aktif saat ini."
            icon={faComments}
            accent="from-[#f7dfa2] to-[#be8d2f]"
          />
          <MetricCard
            label="Sudah Dianalisis"
            value={isLoading ? "..." : String(metrics.analyzedCount)}
            hint="Chat yang sudah dibaca AI."
            icon={faWandSparkles}
            accent="from-[#f3d48a] to-[#9f7121]"
          />
          <MetricCard
            label="Cakupan Insight"
            value={isLoading ? "..." : String(metrics.insightConversationCount)}
            hint="Chat yang masuk insight."
            icon={faChartLine}
            accent="from-[#f1cf7a] to-[#7f5a1a]"
          />
          <MetricCard
            label="Risiko Tinggi"
            value={isLoading ? "..." : String(metrics.highRiskCount)}
            hint="Chat yang perlu perhatian."
            icon={faTriangleExclamation}
            accent="from-[#f6dc9d] to-[#b67d27]"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <PanelFrame eyebrow="Summary Data" title="Snapshot hari ini">
            <div className="grid gap-4 md:grid-cols-2">
              <MiniInsightCard
                label="Role aktif"
                title={roleLabel?.title ?? "Workspace"}
                description={
                  roleLabel?.summary ??
                  "Pusat kerja sesuai role."
                }
              />
              <MiniInsightCard
                label="Tekanan operasional"
                title={
                  openTaskCount > 0
                    ? `${openTaskCount} follow-up aktif`
                    : "Belum ada follow-up aktif"
                }
                description={
                  pendingAiCount > 0
                    ? `${pendingAiCount} chat menunggu analisis AI.`
                    : "Semua chat aktif sudah dibaca AI."
                }
                icon={faBullseye}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <PulseRow label="Coverage AI" value={isLoading ? "..." : aiCoverage} />
              <PulseRow
                label="Workspace view"
                value={canAccessInsights ? "Extended" : "Operational"}
              />
              <PulseRow
                label="Last update"
                value={
                  latestConversation?.last_message_at
                    ? formatDateTime(latestConversation.last_message_at)
                    : "-"
                }
              />
            </div>

            {primaryObservation ? (
              <div className="mt-4 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(30,22,14,0.98)_0%,rgba(17,12,8,0.98)_100%)] p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cb73]">
                  Observation
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7e7b7]">
                  {primaryObservation}
                </p>
              </div>
            ) : null}
          </PanelFrame>

          <PanelFrame
            eyebrow="Aktivitas"
            title="Conversation terbaru"
            actionLabel={latestActivityLabel}
            actionHref={latestActivityHref}
          >
            {latestConversation ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4">
                  <p className="text-base font-semibold text-slate-950">
                    {latestConversation.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {latestConversation.latest_message?.message_text ??
                      "Belum ada pesan terakhir yang bisa ditampilkan."}
                  </p>
                </div>
                <div className="space-y-3">
                  <PulseRow
                    label="Status"
                    value={formatStatusLabel(latestConversation.ui_status)}
                  />
                  <PulseRow
                    label="Update terakhir"
                    value={formatDateTime(latestConversation.last_message_at)}
                  />
                  <PulseRow
                    label="Insight"
                    value={
                      latestConversation.latest_ai_extraction
                        ? "Sudah dibaca AI"
                        : "Belum dibaca AI"
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#f0cb73]/26 bg-[linear-gradient(180deg,rgba(33,24,17,0.9)_0%,rgba(18,13,10,0.9)_100%)] p-5 text-sm text-slate-600">
                Belum ada conversation yang tampil. Upload chat pertama untuk
                mulai mengisi summary operasional di beranda ini.
              </div>
            )}
          </PanelFrame>
        </section>

        {(topSales || topOrganization) && (
          <section className="grid gap-6 xl:grid-cols-2">
            {topSales ? (
              <PanelFrame eyebrow="Top Sales" title={topSales.user_name}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PulseRow
                    label="Replies Sent"
                    value={String(topSales.replies_sent)}
                  />
                  <PulseRow
                    label="Closing Leads"
                    value={String(topSales.closing_leads)}
                  />
                  <PulseRow
                    label="Hot Leads"
                    value={String(topSales.hot_leads)}
                  />
                </div>
              </PanelFrame>
            ) : null}

            {topOrganization ? (
              <PanelFrame
                eyebrow="Top Organization"
                title={topOrganization.organization_name}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <PulseRow
                    label="Hot Leads"
                    value={String(topOrganization.hot_leads)}
                  />
                  <PulseRow
                    label="Reply Rate"
                    value={`${(topOrganization.reply_sent_rate * 100).toFixed(0)}%`}
                  />
                  <PulseRow
                    label="Won Rate"
                    value={`${(topOrganizationWonRate * 100).toFixed(0)}%`}
                  />
                </div>
              </PanelFrame>
            ) : null}
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: IconDefinition;
  accent: string;
}) {
  return (
    <article className="clara-card rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-slate-900`}
        >
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function PanelFrame({
  eyebrow,
  title,
  children,
  actionHref,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="clara-card rounded-[32px] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="clara-kicker text-xs">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            {title}
          </h2>
        </div>

        {actionHref && actionLabel ? (
          <Link href={actionHref} className="clara-button clara-button-ghost">
            {actionLabel}
            <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
          </Link>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function PulseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function MiniInsightCard({
  label,
  title,
  description,
  icon = faBullseye,
}: {
  label: string;
  title: string;
  description: string;
  icon?: IconDefinition;
}) {
  return (
    <div className="clara-card-soft rounded-[24px] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
