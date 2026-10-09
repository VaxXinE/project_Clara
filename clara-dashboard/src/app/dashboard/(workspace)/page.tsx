"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { HeadHome } from "@/components/dashboard/HeadHome";
import { ManagerHome } from "@/components/dashboard/ManagerHome";
import { SalesHome } from "@/components/dashboard/SalesHome";
import { SuperadminHome } from "@/components/dashboard/SuperadminHome";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { ACTIONABLE_BUCKETS, getQueueBucket } from "@/lib/inbox";
import { plainJargon } from "@/lib/vocab";
import { canAccessQueueAndActionCenter } from "@/lib/roles";
import type {
  ChatReviewCenterResponse,
  ExtensionBuildItem,
  KnowledgeUpdateProposalItem,
  OpsDatabaseOverview,
  OpsNotificationItem,
  OpsNotificationResponse,
  CurrentUser,
  KpiCommandCenterResponse,
  ManagerInsightsResponse,
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
    summary: "Pantauan lintas tim dan eskalasi utama.",
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
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [headAlerts, setHeadAlerts] = useState<OpsNotificationItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ChatReviewCenterResponse | null>(null);
  const [managerInsights, setManagerInsights] =
    useState<ManagerInsightsResponse | null>(null);
  const [adminProposals, setAdminProposals] = useState<KnowledgeUpdateProposalItem[] | null>(null);
  const [adminExtension, setAdminExtension] = useState<ExtensionBuildItem | null>(null);
  const [adminOverview, setAdminOverview] = useState<OpsDatabaseOverview | null>(null);
  const [adminUsers, setAdminUsers] = useState<CurrentUser[] | null>(null);
  const [adminAlertCount, setAdminAlertCount] = useState<number | null>(null);
  const [hasLeadershipData, setHasLeadershipData] = useState(false);
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
            setInboxItems(inbox);
            setWorklist(worklistResponse);
          } catch {
            // Some roles do not rely on queue data as their primary workspace.
          }
        }

        if (me.role === "superadmin") {
          const [proposalResult, extensionResult, overviewResult, usersResult, alertResult] = await Promise.allSettled([
            apiFetch<KnowledgeUpdateProposalItem[]>("/product-knowledge/proposals"),
            apiFetch<ExtensionBuildItem>("/dashboard/extension-builds"),
            apiFetch<OpsDatabaseOverview>("/dashboard/admin/ops-overview"),
            apiFetch<CurrentUser[]>("/auth/users"),
            apiFetch<OpsNotificationResponse>("/dashboard/notifications"),
          ]);

          if (proposalResult.status === "fulfilled") setAdminProposals(proposalResult.value);
          if (extensionResult.status === "fulfilled") setAdminExtension(extensionResult.value);
          if (overviewResult.status === "fulfilled") setAdminOverview(overviewResult.value);
          if (usersResult.status === "fulfilled") setAdminUsers(usersResult.value);
          if (alertResult.status === "fulfilled") {
            setAdminAlertCount(
              alertResult.value.items.filter((item) => Boolean(item.alert_type) && item.status === "active").length,
            );
          }
        }

        if (me.role === "head") {
          const [insightsResult, kpiResult] = await Promise.allSettled([
            apiFetch<MarketingInsightsPreview>(
              "/dashboard/marketing/insights-preview",
            ),
            apiFetch<KpiCommandCenterResponse>("/dashboard/kpi/command-center"),
          ]);

          if (insightsResult.status === "fulfilled") {
            nextMetrics.insightConversationCount =
              insightsResult.value.total_conversations;
            nextMetrics.highRiskCount =
              insightsResult.value.kpi_summary.high_risk_conversation_count;
            setHasLeadershipData(true);
          }

          if (kpiResult.status === "fulfilled") {
            setKpi(kpiResult.value);
            setHasLeadershipData(true);
          }

          if (
            insightsResult.status === "rejected" ||
            kpiResult.status === "rejected"
          ) {
            setErrorMessage(
              "Sebagian ringkasan strategis gagal dimuat. Data yang berhasil dimuat tetap ditampilkan.",
            );
          }
        }

        if (me.role === "manager" || me.role === "head") {
          try {
            setReviewQueue(await apiFetch<ChatReviewCenterResponse>("/dashboard/sales/chat-review-center"));
          } catch {
            // Beranda tetap tampil dari data monitor tim kalau antrean review gagal dimuat.
          }
        }

        if (me.role === "head") {
          try {
            const notifications = await apiFetch<OpsNotificationResponse>("/dashboard/notifications");
            setHeadAlerts(
              notifications.items.filter(
                (item) =>
                  Boolean(item.alert_type) &&
                  (item.status === "active" || item.status === "acknowledged") &&
                  (item.target_role === "head" || item.target_role === "all"),
              ),
            );
          } catch {
            // Peringatan hanya pelengkap Beranda.
          }
        }

        if (["manager", "head"].includes(me.role)) {
          try {
            const response = await apiFetch<ManagerInsightsResponse>(
              "/dashboard/manager-insights",
            );
            setManagerInsights(response);
            setHasLeadershipData(true);
          } catch {
            setErrorMessage(
              "Ringkasan monitor tim gagal dimuat. Coba muat ulang halaman.",
            );
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
  const isSalesWorkspace = currentUser?.role === "sales";
  const isManagerWorkspace = currentUser?.role === "manager";
  const isHeadWorkspace = currentUser?.role === "head";
  const isSuperadminWorkspace = currentUser?.role === "superadmin";
  const shouldRenderLeadershipWorkspace =
    !isLoading && (!errorMessage || hasLeadershipData);
  const pendingAiCount = Math.max(metrics.inboxCount - metrics.analyzedCount, 0);
  const openTaskCount = worklist?.items.length ?? 0;
  const managerReviewCount = managerInsights?.open_coaching_case_count ?? 0;
  const managerOverdueCount = managerInsights?.overdue_follow_up_count ?? 0;
  const managerBoundaryAlertCount = managerInsights?.boundary_alerts.length ?? 0;
  const managerScopeTeamCount = managerInsights?.scope_team_count ?? 0;
  const managerScopeMemberCount = managerInsights?.scope_member_count ?? 0;
  const managerNeedsAttentionCount = managerOverdueCount + managerBoundaryAlertCount;
  const managerTopAlert = managerInsights?.boundary_alerts[0] ?? null;
  const actionableChatCount = inboxItems.filter((item) =>
    ACTIONABLE_BUCKETS.includes(getQueueBucket(item)),
  ).length;
  const highRiskChatCount = inboxItems.filter(
    (item) => !item.is_archived && item.latest_ai_extraction?.risk_level === "high",
  ).length;
  const leadershipNext = (() => {
    if (isHeadWorkspace) {
      if (managerBoundaryAlertCount > 0) {
        return {
          title: `${managerBoundaryAlertCount} peringatan lintas tim perlu keputusanmu`,
          description: managerTopAlert?.description
            ? plainJargon(managerTopAlert.description)
            : "Mulai dari Alert Tim untuk melihat area mana yang perlu didorong atau diputuskan.",
          href: "/notifications",
          label: "Lihat Alert Tim",
          secondaryHref: "/manager-insights",
          secondaryLabel: "Lihat Monitor Tim",
        };
      }
      if (managerReviewCount > 0) {
        return {
          title: `${managerReviewCount} kasus menunggu arahanmu`,
          description: "Buka Arahan Tim untuk melihat kasus yang butuh validasi atau keputusan lanjutan.",
          href: "/approvals",
          label: "Buka Arahan Tim",
          secondaryHref: "/manager-insights",
          secondaryLabel: "Lihat Monitor Tim",
        };
      }
      return {
        title: "Tidak ada yang mendesak hari ini",
        description:
          managerOverdueCount > 0
            ? `Ada ${managerOverdueCount} follow-up yang terlambat di seluruh tim. Cek Monitor Tim untuk melihat siapa yang perlu dibantu.`
            : "Pantau Monitor Tim untuk melihat pola hambatan sebelum membesar.",
        href: "/manager-insights",
        label: "Lihat Monitor Tim",
        secondaryHref: "/crm",
        secondaryLabel: "Lihat Lead Tim",
      };
    }

    if (isManagerWorkspace) {
      if (managerReviewCount > 0) {
        return {
          title: `${managerReviewCount} balasan Sales menunggu keputusanmu`,
          description: "Buka Review Sales untuk mengecek balasan, memberi arahan, atau memutuskan apakah Sales boleh lanjut.",
          href: "/approvals",
          label: "Buka Review Sales",
          secondaryHref: "/manager-insights",
          secondaryLabel: "Lihat Monitor Tim",
        };
      }
      if (managerNeedsAttentionCount > 0) {
        return {
          title: `${managerNeedsAttentionCount} hal di timmu perlu didorong`,
          description: managerTopAlert?.description
            ? plainJargon(managerTopAlert.description)
            : "Buka Monitor Tim untuk melihat lead atau Sales mana yang mulai tertinggal.",
          href: "/manager-insights",
          label: "Lihat Monitor Tim",
          secondaryHref: "/crm",
          secondaryLabel: "Lihat Lead Tim",
        };
      }
      return {
        title: "Timmu berjalan lancar",
        description: "Tidak ada yang mendesak. Gunakan waktunya untuk mengecek lead tim atau kualitas balasan.",
        href: "/crm",
        label: "Lihat Lead Tim",
        secondaryHref: "/manager-insights",
        secondaryLabel: "Lihat Monitor Tim",
      };
    }

    return {
      title: pendingAiCount > 0 ? `${pendingAiCount} chat belum dibaca Clara` : "Semua chat sudah dibaca Clara",
      description:
        highRiskChatCount > 0
          ? `${highRiskChatCount} chat berisiko tinggi sedang menunggu. Cek Chat Masuk.`
          : "Lihat Chat Masuk untuk memantau chat yang sedang berjalan.",
      href: "/sales",
      label: "Buka Chat Masuk",
      secondaryHref: "/manager-insights",
      secondaryLabel: "Lihat Monitor Tim",
    };
  })();
  const leadershipCounts: Array<{ label: string; href: string; value: number }> = isHeadWorkspace
    ? [
        { label: "Peringatan lintas tim", href: "/notifications", value: managerBoundaryAlertCount },
        { label: "Kasus menunggu arahan", href: "/approvals", value: managerReviewCount },
        { label: "Follow-up terlambat", href: "/manager-insights", value: managerOverdueCount },
        { label: "Tim yang dipantau", href: "/manager-insights", value: managerScopeTeamCount },
      ]
    : isManagerWorkspace
      ? [
          { label: "Balasan menunggu keputusan", href: "/approvals", value: managerReviewCount },
          { label: "Peringatan tim", href: "/manager-insights", value: managerBoundaryAlertCount },
          { label: "Follow-up terlambat", href: "/manager-insights", value: managerOverdueCount },
          { label: "Sales di timmu", href: "/manager-insights", value: managerScopeMemberCount },
        ]
      : [
          { label: "Chat menunggu", href: "/sales", value: actionableChatCount },
          { label: "Chat berisiko tinggi", href: "/sales", value: highRiskChatCount },
          { label: "Tindak lanjut aktif", href: "/follow-up", value: openTaskCount },
          { label: "Follow-up tim terlambat", href: "/manager-insights", value: managerOverdueCount },
        ];
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
      title={currentUser ? `Halo, ${currentUser.name}.` : PAGE_NAMES.home}
      description={
        isSalesWorkspace
          ? "Ini yang perlu kamu kerjakan hari ini."
          : isSuperadminWorkspace
            ? "Kondisi sistem dan hal yang menunggu keputusanmu."
            : (roleLabel?.summary ?? "Ringkasan kerja hari ini.")
      }
    >
      <div className="space-y-6">
        {errorMessage && (
          <section role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </section>
        )}


        {isSalesWorkspace ? (
          <SalesHome
            userId={currentUser?.id ?? null}
            inboxItems={inboxItems}
            worklistItems={worklist?.items ?? []}
            isLoading={isLoading}
          />
        ) : isManagerWorkspace ? (
          <ManagerHome queue={reviewQueue} insights={managerInsights} isLoading={isLoading} />
        ) : isHeadWorkspace ? (
          <HeadHome
            queue={reviewQueue}
            insights={managerInsights}
            alerts={headAlerts}
            kpi={kpi}
            isLoading={isLoading}
          />
        ) : isSuperadminWorkspace ? (
          <SuperadminHome
            proposals={adminProposals}
            extension={adminExtension}
            overview={adminOverview}
            users={adminUsers}
            activeAlertCount={adminAlertCount}
            isLoading={isLoading}
          />
        ) : !shouldRenderLeadershipWorkspace ? null : (
          <>
            <section
              data-onboarding-id={isManagerWorkspace ? "manager-home-next-action" : isHeadWorkspace ? "head-home-next-action" : undefined}
              aria-labelledby="lead-next-title"
              className="clara-card p-5 sm:p-6"
            >
              <p className="text-sm font-semibold text-clara-gold">Mulai dari sini</p>
              <h2 id="lead-next-title" className="mt-2 break-words text-xl font-bold clara-text-primary sm:text-2xl">
                {leadershipNext.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 clara-text-secondary">{leadershipNext.description}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href={leadershipNext.href} className="clara-button clara-button-primary justify-center">
                  {leadershipNext.label}
                </Link>
                {leadershipNext.secondaryHref ? (
                  <Link href={leadershipNext.secondaryHref} className="clara-button clara-button-secondary justify-center">
                    {leadershipNext.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </section>

            <section
              data-onboarding-id={isManagerWorkspace ? "manager-home-metrics" : isHeadWorkspace ? "head-home-metrics" : undefined}
              aria-label="Ringkasan"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {leadershipCounts.map((item) => (
                <CountLink key={item.label} href={item.href} label={item.label} value={isLoading ? null : item.value} />
              ))}
            </section>

            {(topSales || topOrganization) && !isSalesWorkspace && !isManagerWorkspace && !isHeadWorkspace ? (
              <section aria-label="Yang menonjol" className="clara-card-outline p-5 sm:p-6">
                <h2 className="text-base font-semibold clara-text-primary">Yang menonjol</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
                  {topSales ? (
                    <>
                      <Stat label="Sales teratas" value={topSales.user_name} />
                      <Stat label="Balasan terkirim" value={String(topSales.replies_sent)} />
                      <Stat label="Lead closing" value={String(topSales.closing_leads)} />
                    </>
                  ) : null}
                  {topOrganization ? (
                    <>
                      <Stat label="Organisasi teratas" value={topOrganization.organization_name} />
                      <Stat label="Tingkat balasan" value={`${(topOrganization.reply_sent_rate * 100).toFixed(0)}%`} />
                      <Stat label="Tingkat closing" value={`${(topOrganizationWonRate * 100).toFixed(0)}%`} />
                    </>
                  ) : null}
                </dl>
                {primaryObservation ? (
                  <p className="mt-4 text-sm leading-6 clara-text-secondary">
                    <span className="font-semibold clara-text-primary">Catatan Clara: </span>
                    {primaryObservation}
                  </p>
                ) : null}
              </section>
            ) : null}
          </>
        )}
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

function CountLink({ href, label, value }: { href: string; label: string; value: number | null }) {
  return (
    <Link
      href={href}
      className="clara-card-soft block min-h-11 p-4 hover:border-clara-gold focus-visible:border-clara-gold"
    >
      <p className="text-sm clara-text-secondary">{label}</p>
      {value === null ? (
        <LoadingBar className="mt-2 h-8 w-12" />
      ) : (
        <p className="mt-1 text-3xl font-bold clara-text-primary">{value}</p>
      )}
    </Link>
  );
}

function LoadingBar({ className }: { className: string }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={`inline-block rounded-md bg-[var(--color-surface-overlay)] ${className}`}
    />
  );
}
