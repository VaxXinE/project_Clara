"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faBullseye,
  faChartLine,
  faComments,
  faListCheck,
  faMessage,
  faTriangleExclamation,
  faWandSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatDateTime,
  formatStatusLabel,
  getChannelBadgeClass,
  isExperimentalChannel,
} from "@/lib/format";
import { canAccessQueueAndActionCenter, isAdminLike } from "@/lib/roles";
import type {
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
  const [latestConversation, setLatestConversation] =
    useState<SalesInboxItem | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [managerInsights, setManagerInsights] =
    useState<ManagerInsightsResponse | null>(null);
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

        if (["manager", "head"].includes(me.role)) {
          try {
            const response = await apiFetch<ManagerInsightsResponse>(
              "/dashboard/manager-insights",
            );
            setManagerInsights(response);
          } catch {
            // Manager homepage should still render even if monitoring snapshot fails.
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
  const canAccessInsights = currentUser !== null && isAdminLike(currentUser.role);
  const aiCoverage =
    metrics.inboxCount > 0
      ? `${metrics.analyzedCount}/${metrics.inboxCount}`
      : "0/0";
  const pendingAiCount = Math.max(metrics.inboxCount - metrics.analyzedCount, 0);
  const openTaskCount = worklist?.items.length ?? 0;
  const nextWorkItem = worklist?.items[0] ?? null;
  const managerReviewCount = managerInsights?.open_coaching_case_count ?? 0;
  const managerOverdueCount = managerInsights?.overdue_follow_up_count ?? 0;
  const managerBoundaryAlertCount = managerInsights?.boundary_alerts.length ?? 0;
  const managerScopeTeamCount = managerInsights?.scope_team_count ?? 0;
  const managerScopeMemberCount = managerInsights?.scope_member_count ?? 0;
  const managerComplianceValue = managerInsights
    ? `${(managerInsights.follow_up_compliance_rate * 100).toFixed(0)}%`
    : "-";
  const managerStaleValue = managerInsights
    ? `${(managerInsights.stale_lead_ratio * 100).toFixed(0)}%`
    : "-";
  const managerNeedsAttentionCount = managerOverdueCount + managerBoundaryAlertCount;
  const managerTopAlert = managerInsights?.boundary_alerts[0] ?? null;
  const managerDailySummary = isLoading
    ? "Clara sedang menyiapkan ringkasan tim untuk manager."
    : managerReviewCount > 0 && managerNeedsAttentionCount > 0
      ? `Hari ini ada ${managerReviewCount} review sales yang perlu dicek dan ${managerNeedsAttentionCount} sinyal tim yang perlu perhatian.`
      : managerReviewCount > 0
        ? `Hari ini fokus utama ada di ${managerReviewCount} review sales yang perlu Anda cek.`
        : managerNeedsAttentionCount > 0
          ? `Hari ini ada ${managerNeedsAttentionCount} sinyal tim yang perlu Anda dorong lebih dulu.`
          : "Kondisi tim relatif aman. Anda bisa lanjut cek kualitas follow-up dan progres lead tanpa tekanan besar.";
  const managerNextAction =
    managerReviewCount > 0
      ? {
          eyebrow: "Mulai dari sini",
          title: `${managerReviewCount} review sales menunggu keputusan`,
          description:
            "Buka Review Sales dulu untuk cek balasan, kasih arahan, atau putuskan apakah sales sudah bisa lanjut.",
          href: "/dashboard/approvals",
          label: "Buka Review Sales",
        }
      : managerNeedsAttentionCount > 0
        ? {
            eyebrow: "Mulai dari sini",
            title: `${managerNeedsAttentionCount} sinyal tim perlu ditekan`,
            description:
              managerTopAlert?.description ||
              "Masuk ke Monitor Tim untuk lihat lead atau sales mana yang mulai macet, lalu tentukan tindak lanjutnya.",
            href: "/dashboard/manager-insights",
            label: "Buka Monitor Tim",
          }
        : {
            eyebrow: "Mulai dari sini",
            title: "Kondisi tim cukup stabil",
            description:
              "Gunakan beranda ini untuk memilih jalur kerja berikutnya: review sales, monitor tim, atau cek lead yang masih aktif.",
            href: "/dashboard/crm",
            label: "Buka Lead Tim",
          };
  const headPriorityCount =
    (managerInsights?.boundary_alerts.length ?? 0) +
    (managerInsights?.open_coaching_case_count ?? 0);
  const headDailySummary = isLoading
    ? "Clara sedang menyiapkan ringkasan lintas tim untuk Head."
    : headPriorityCount > 0 && managerOverdueCount > 0
      ? `Hari ini ada ${headPriorityCount} area yang perlu eskalasi dan ${managerOverdueCount} follow-up lintas tim yang mulai terlambat.`
      : headPriorityCount > 0
        ? `Hari ini ada ${headPriorityCount} area yang perlu Anda putuskan atau dorong lebih dulu.`
        : managerOverdueCount > 0
          ? `Alert belum besar, tapi ada ${managerOverdueCount} follow-up lintas tim yang mulai bocor.`
          : "Kondisi lintas tim relatif stabil. Fokus Head bisa bergeser ke pola hambatan dan kualitas eksekusi manager.";
  const headNextAction =
    managerBoundaryAlertCount > 0
      ? {
          eyebrow: "Prioritas Head",
          title: `${managerBoundaryAlertCount} alert lintas tim perlu keputusan`,
          description:
            managerTopAlert?.description ||
            "Mulai dari Alert Tim untuk lihat area mana yang perlu dinaikkan tekanannya atau butuh keputusan level Head.",
          href: "/dashboard/notifications",
          label: "Buka Alert Tim",
        }
      : managerReviewCount > 0
        ? {
            eyebrow: "Prioritas Head",
            title: `${managerReviewCount} case arahan masih terbuka`,
            description:
              "Masuk ke Arahan Tim untuk lihat case yang masih butuh validasi, dorongan, atau keputusan lanjutan.",
            href: "/dashboard/approvals",
            label: "Buka Arahan Tim",
          }
        : {
            eyebrow: "Prioritas Head",
            title: "Pantau ritme lintas tim dulu",
            description:
              "Kalau belum ada alert besar, mulai dari Monitor Tim untuk membaca pola lambat, bottleneck manager, dan lead yang mulai macet.",
            href: "/dashboard/manager-insights",
            label: "Buka Monitor Tim",
          };
  const latestActivityHref = latestConversation
    ? `/sales/conversations/${latestConversation.conversation_id}`
    : "/upload";
  const latestActivityLabel = latestConversation
    ? "Buka Conversation"
    : "Buka Lead Capture";
  const salesDailySummary = isLoading
    ? "Clara sedang menyiapkan ringkasan kerja hari ini."
    : pendingAiCount > 0 && openTaskCount > 0
      ? `Hari ini ada ${pendingAiCount} chat yang perlu langkah berikutnya dan ${openTaskCount} follow-up yang masih berjalan.`
      : pendingAiCount > 0
        ? `Hari ini ada ${pendingAiCount} chat yang perlu langkah berikutnya.`
        : openTaskCount > 0
          ? `Hari ini ada ${openTaskCount} follow-up yang masih perlu dibereskan.`
          : "Saat ini belum ada tekanan besar. Kamu bisa lanjut cek lead atau input chat baru.";
  const salesNextAction = pendingAiCount > 0
    ? {
        eyebrow: "Kerja berikutnya",
        title: `${pendingAiCount} chat perlu dibalas atau dicek dulu`,
        description:
          "Mulai dari Chat Masuk untuk baca konteks, lihat draft Clara, lalu lanjutkan balasan ke customer.",
        href: "/dashboard/sales",
        label: "Lanjut ke Chat Masuk",
      }
    : nextWorkItem
      ? {
          eyebrow: "Kerja berikutnya",
          title: `${nextWorkItem.lead_name} butuh tindak lanjut`,
          description:
            nextWorkItem.reason ||
            "Ada follow-up aktif yang perlu segera dirapikan supaya ritme lead tetap jalan.",
          href: nextWorkItem.conversation_id
            ? `/dashboard/sales/conversations/${nextWorkItem.conversation_id}`
            : "/dashboard/follow-up",
          label: nextWorkItem.conversation_id
            ? "Buka Percakapan"
            : "Buka Tindak Lanjut",
        }
      : latestConversation
        ? {
            eyebrow: "Kerja berikutnya",
            title: `Lanjut cek percakapan ${latestConversation.title}`,
            description:
              "Tidak ada antrean mendesak. Kamu bisa lanjut dari percakapan terakhir atau cek lead yang sedang aktif.",
            href: latestActivityHref,
            label: latestActivityLabel,
          }
        : {
            eyebrow: "Kerja berikutnya",
            title: "Belum ada chat aktif saat ini",
            description:
              "Kalau ada chat baru dari luar extension, masukkan lewat Input Chat supaya pipeline sales tetap rapi.",
            href: "/dashboard/upload",
            label: "Buka Input Chat",
          };
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

        {isSalesWorkspace ? (
          <>
            <section
              data-onboarding-id="sales-home-summary"
              className="clara-card rounded-[32px] p-6"
            >
              <p className="clara-kicker text-xs">Ringkasan hari ini</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    Mulai dari pekerjaan yang paling dekat ke customer
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {salesDailySummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/sales"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Buka Chat Masuk
                  </Link>
                  <Link
                    href="/dashboard/follow-up"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Tindak Lanjut
                  </Link>
                </div>
              </div>
            </section>

            <section
              data-onboarding-id="sales-home-metrics"
              className="grid gap-4 md:grid-cols-2"
            >
              <MetricCard
                label="Chat Perlu Dibalas"
                value={isLoading ? "..." : String(pendingAiCount)}
                hint="Chat yang masih perlu dibaca, dicek, atau dibalas."
                icon={faMessage}
                accent="from-[#f7dfa2] to-[#be8d2f]"
              />
              <MetricCard
                label="Follow-up Aktif"
                value={isLoading ? "..." : String(openTaskCount)}
                hint="Pekerjaan tindak lanjut yang masih berjalan."
                icon={faListCheck}
                accent="from-[#f3d48a] to-[#9f7121]"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div data-onboarding-id="sales-home-next-action">
                <PanelFrame
                eyebrow={salesNextAction.eyebrow}
                title={salesNextAction.title}
                actionLabel={salesNextAction.label}
                actionHref={salesNextAction.href}
              >
                <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5">
                  <p className="text-sm leading-7 text-slate-600">
                    {salesNextAction.description}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <MiniInsightCard
                    label="Status AI"
                    title={
                      metrics.analyzedCount > 0
                        ? `${metrics.analyzedCount} chat sudah siap dibantu Clara`
                        : "Belum ada chat yang selesai dibaca AI"
                    }
                    description={
                      metrics.analyzedCount > 0
                        ? "Kalau butuh balasan cepat, mulai dari chat yang konteksnya sudah siap dipakai Clara."
                        : "Kalau belum ada konteks AI yang siap, buka chat terbaru dulu lalu jalankan proses bacanya."
                    }
                    icon={faWandSparkles}
                  />
                  <MiniInsightCard
                    label="Tekanan follow-up"
                    title={
                      metrics.highRiskCount > 0
                        ? `${metrics.highRiskCount} percakapan masuk perhatian cepat`
                        : "Belum ada percakapan risiko tinggi"
                    }
                    description={
                      metrics.highRiskCount > 0
                        ? "Setelah chat utama beres, cek juga percakapan yang ritmenya mulai turun supaya tidak bocor."
                        : "Ritme follow-up masih aman. Fokus ke chat aktif dan lead yang sedang jalan dulu."
                    }
                    icon={faTriangleExclamation}
                  />
                </div>
                </PanelFrame>
              </div>

              <div data-onboarding-id="sales-home-latest-conversation">
                <PanelFrame eyebrow="Aktivitas terakhir" title="Percakapan terbaru">
                {latestConversation ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getChannelBadgeClass(
                            latestConversation.source_channel,
                          )}`}
                        >
                          {formatChannelLabel(latestConversation.source_channel)}
                        </span>
                        {isExperimentalChannel(latestConversation.source_channel) ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Experimental
                          </span>
                        ) : null}
                      </div>
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
                    </div>
                    <Link
                      href={latestActivityHref}
                      className="clara-button clara-button-ghost w-full justify-center"
                    >
                      {latestActivityLabel}
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[#f0cb73]/26 bg-[linear-gradient(180deg,rgba(33,24,17,0.9)_0%,rgba(18,13,10,0.9)_100%)] p-5 text-sm text-slate-600">
                    Belum ada percakapan yang tampil. Mulai dari Chat Masuk atau
                    Input Chat untuk mengisi pipeline kerja Sales.
                  </div>
                )}
                </PanelFrame>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <div data-onboarding-id="sales-home-quick-nav">
                <PanelFrame eyebrow="Navigasi cepat" title="Masuk ke area kerja">
                <div className="grid gap-3">
                  <Link
                    href="/dashboard/sales"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Chat Masuk
                  </Link>
                  <Link
                    href="/dashboard/follow-up"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Tindak Lanjut
                  </Link>
                  <Link
                    href="/dashboard/crm"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Leads
                  </Link>
                  <Link
                    href="/dashboard/upload"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Input Chat
                  </Link>
                </div>
                </PanelFrame>
              </div>

              <div data-onboarding-id="sales-home-focus">
                <PanelFrame eyebrow="Mulai kerja" title="Fokus kerja Sales hari ini">
                <div className="grid gap-4 md:grid-cols-2">
                  <MiniInsightCard
                    label="Prioritas utama"
                    title={
                      pendingAiCount > 0
                        ? `${pendingAiCount} chat perlu langkah berikutnya`
                        : "Inbox relatif aman"
                    }
                    description={
                      pendingAiCount > 0
                        ? "Mulai dari Chat Masuk untuk melihat percakapan yang harus dibalas atau butuh draft."
                        : "Kalau tidak ada chat mendesak, cek Leads dan Tindak Lanjut untuk bersihkan pekerjaan lain."
                    }
                    icon={faComments}
                  />
                  <MiniInsightCard
                    label="Tindak lanjut"
                    title={
                      openTaskCount > 0
                        ? `${openTaskCount} follow-up masih terbuka`
                        : "Belum ada follow-up aktif"
                    }
                    description={
                      openTaskCount > 0
                        ? "Buka Tindak Lanjut untuk lihat mana yang overdue, hot lead, atau siap dikirim."
                        : "Belum ada pekerjaan follow-up yang mendesak saat ini."
                    }
                    icon={faBullseye}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Link href="/dashboard/sales" className="clara-button clara-button-primary justify-center">
                    Buka Chat Masuk
                  </Link>
                  <Link href="/dashboard/follow-up" className="clara-button clara-button-ghost justify-center">
                    Buka Tindak Lanjut
                  </Link>
                  <Link href="/dashboard/crm" className="clara-button clara-button-ghost justify-center">
                    Buka Leads
                  </Link>
                </div>
                </PanelFrame>
              </div>

              <div data-onboarding-id="sales-home-health">
                <PanelFrame eyebrow="Kondisi kerja" title="Angka penting hari ini">
                <div className="space-y-3">
                  <PulseRow label="Sudah dibaca AI" value={String(metrics.analyzedCount)} />
                  <PulseRow label="Risiko tinggi" value={String(metrics.highRiskCount)} />
                  <PulseRow label="Coverage AI" value={aiCoverage} />
                </div>
                </PanelFrame>
              </div>
            </section>
          </>
        ) : isManagerWorkspace ? (
          <>
            <section className="clara-card rounded-[32px] p-6">
              <p className="clara-kicker text-xs">Ringkasan hari ini</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    Mulai dari bottleneck tim, lalu turun ke review sales
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {managerDailySummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/approvals"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Buka Review Sales
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Monitor Tim
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <PanelFrame
                eyebrow={managerNextAction.eyebrow}
                title={managerNextAction.title}
                actionLabel={managerNextAction.label}
                actionHref={managerNextAction.href}
              >
                <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5">
                  <p className="text-sm leading-7 text-slate-600">
                    {managerNextAction.description}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MiniInsightCard
                    label="Review sales"
                    title={
                      managerReviewCount > 0
                        ? `${managerReviewCount} review perlu dicek`
                        : "Belum ada review sales yang menumpuk"
                    }
                    description={
                      managerReviewCount > 0
                        ? "Mulai dari balasan sales yang paling perlu arahan supaya eksekusi tim tidak tertahan."
                        : "Kalau review aman, fokus bisa digeser ke monitor ritme follow-up tim."
                    }
                    icon={faWandSparkles}
                  />
                  <MiniInsightCard
                    label="Pantauan tim"
                    title={
                      managerNeedsAttentionCount > 0
                        ? `${managerNeedsAttentionCount} sinyal tim perlu dicek`
                        : "Follow-up tim relatif aman"
                    }
                    description={
                      managerNeedsAttentionCount > 0
                        ? "Pantau follow-up terlambat dan alert tim dulu supaya manager tahu siapa yang harus segera didorong."
                        : "Tidak ada tekanan besar saat ini, jadi Anda bisa fokus ke kualitas review dan progres lead."
                    }
                    icon={faChartLine}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Link
                    href="/dashboard/approvals"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Buka Review Sales
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Monitor Tim
                  </Link>
                  <Link
                    href="/dashboard/crm"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Lead Tim
                  </Link>
                </div>
              </PanelFrame>

              <PanelFrame
                eyebrow="Kondisi tim"
                title="Ringkasan singkat manager"
                actionLabel="Buka Monitor Tim"
                actionHref="/dashboard/manager-insights"
              >
                <div className="space-y-3">
                  <PulseRow
                    label="Tim dipantau"
                    value={
                      isLoading
                        ? "..."
                        : `${managerScopeTeamCount} tim • ${managerScopeMemberCount} sales`
                    }
                  />
                  <PulseRow
                    label="Kepatuhan follow-up"
                    value={managerComplianceValue}
                  />
                  <PulseRow
                    label="Lead mulai macet"
                    value={managerStaleValue}
                  />
                  <PulseRow
                    label="Catatan yang hilang/lama"
                    value={String(managerInsights?.missing_or_stale_log_count ?? 0)}
                  />
                </div>
                <div className="mt-4 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4 text-sm leading-6 text-slate-600">
                  {managerBoundaryAlertCount > 0
                    ? `Ada ${managerBoundaryAlertCount} alert tim yang perlu Anda lihat lebih dulu.`
                    : managerOverdueCount > 0
                      ? `${managerOverdueCount} follow-up mulai terlambat meskipun belum muncul banyak alert besar.`
                      : "Belum ada alert tim yang menonjol saat ini."}
                </div>
              </PanelFrame>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <PanelFrame eyebrow="Navigasi cepat" title="Masuk ke area kerja">
                <div className="grid gap-3">
                  <Link
                    href="/dashboard/approvals"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Review Sales
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Monitor Tim
                  </Link>
                  <Link
                    href="/dashboard/crm"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Lead Tim
                  </Link>
                </div>
              </PanelFrame>

              <PanelFrame eyebrow="Prioritas kerja" title="Urutan kerja manager">
                <div className="space-y-3">
                  <ActionChecklistRow
                    step="1"
                    title="Cek review sales yang menunggu"
                    description="Putuskan dulu balasan yang perlu arahan atau revisi."
                  />
                  <ActionChecklistRow
                    step="2"
                    title="Lihat monitor tim"
                    description="Cari sales atau lead yang ritmenya mulai melambat."
                  />
                  <ActionChecklistRow
                    step="3"
                    title="Turun ke lead kalau perlu"
                    description="Buka lead spesifik kalau butuh konteks lebih detail."
                  />
                </div>
              </PanelFrame>

              <PanelFrame eyebrow="Angka penting" title="Yang perlu dibaca cepat">
                <div className="space-y-3">
                  <PulseRow
                    label="Lead aktif"
                    value={isLoading ? "..." : String(managerInsights?.total_leads ?? 0)}
                  />
                  <PulseRow
                    label="Perlu review"
                    value={isLoading ? "..." : String(managerReviewCount)}
                  />
                  <PulseRow
                    label="Follow-up terlambat"
                    value={isLoading ? "..." : String(managerOverdueCount)}
                  />
                </div>
              </PanelFrame>
            </section>
          </>
        ) : isHeadWorkspace ? (
          <>
            <section className="clara-card rounded-[32px] p-6">
              <p className="clara-kicker text-xs">Ringkasan hari ini</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    Mulai dari sinyal lintas tim yang butuh keputusan Head
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {headDailySummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/notifications"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Buka Alert Tim
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Monitor Tim
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Tim Dipantau"
                value={isLoading ? "..." : String(managerInsights?.scope_team_count ?? 0)}
                hint="Jumlah tim yang sedang masuk area pantau Head."
                icon={faComments}
                accent="from-[#f7dfa2] to-[#be8d2f]"
              />
              <MetricCard
                label="Lead Aktif"
                value={isLoading ? "..." : String(managerInsights?.total_leads ?? 0)}
                hint="Lead lintas tim yang masih perlu dijaga ritmenya."
                icon={faBullseye}
                accent="from-[#f3d48a] to-[#9f7121]"
              />
              <MetricCard
                label="Perlu Intervensi"
                value={
                  isLoading
                    ? "..."
                    : String(
                        (managerInsights?.boundary_alerts.length ?? 0) +
                          (managerInsights?.open_coaching_case_count ?? 0),
                      )
                }
                hint="Area tim yang perlu arahan atau tekanan lebih dulu."
                icon={faWandSparkles}
                accent="from-[#f1cf7a] to-[#7f5a1a]"
              />
              <MetricCard
                label="Follow-up Terlambat"
                value={
                  isLoading ? "..." : String(managerInsights?.overdue_follow_up_count ?? 0)
                }
                hint="Follow-up yang mulai bocor dan perlu segera dikawal."
                icon={faTriangleExclamation}
                accent="from-[#f6dc9d] to-[#b67d27]"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <PanelFrame
                eyebrow={headNextAction.eyebrow}
                title={headNextAction.title}
                actionLabel={headNextAction.label}
                actionHref={headNextAction.href}
              >
                <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5">
                  <p className="text-sm leading-7 text-slate-600">
                    {headNextAction.description}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MiniInsightCard
                    label="Alert lintas tim"
                    title={
                      (managerInsights?.boundary_alerts.length ?? 0) > 0
                        ? `${managerInsights?.boundary_alerts.length ?? 0} area mulai butuh tekanan`
                        : "Belum ada alert lintas tim yang besar"
                    }
                    description={
                      (managerInsights?.boundary_alerts.length ?? 0) > 0
                        ? "Mulai dari Alert Tim untuk lihat area mana yang ritmenya bocor dan perlu keputusan level Head."
                        : "Kalau alert aman, gunakan Monitor Tim untuk membaca pola hambatan sebelum masalah membesar."
                    }
                    icon={faTriangleExclamation}
                  />
                  <MiniInsightCard
                    label="Arahan terbuka"
                    title={
                      (managerInsights?.open_coaching_case_count ?? 0) > 0
                        ? `${managerInsights?.open_coaching_case_count ?? 0} case masih menunggu arahan`
                        : "Belum ada case arahan yang menumpuk"
                    }
                    description={
                      (managerInsights?.open_coaching_case_count ?? 0) > 0
                        ? "Buka Arahan Tim untuk putuskan mana yang cukup diarahkan manager dan mana yang perlu diangkat lebih tinggi."
                        : "Kalau arahan aman, fokus Head bisa pindah ke pola progres antar tim."
                    }
                    icon={faChartLine}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Link
                    href="/dashboard/notifications"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Buka Alert Tim
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Monitor Tim
                  </Link>
                  <Link
                    href="/dashboard/approvals"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Buka Arahan Tim
                  </Link>
                </div>
              </PanelFrame>

              <PanelFrame
                eyebrow="Pantauan cepat"
                title="Ringkasan lintas tim"
                actionLabel="Buka Monitor Tim"
                actionHref="/dashboard/manager-insights"
              >
                <div className="space-y-3">
                  <PulseRow
                    label="Kepatuhan follow-up"
                    value={
                      managerInsights
                        ? `${(managerInsights.follow_up_compliance_rate * 100).toFixed(0)}%`
                        : "-"
                    }
                  />
                  <PulseRow
                    label="Lead mulai macet"
                    value={
                      managerInsights
                        ? `${(managerInsights.stale_lead_ratio * 100).toFixed(0)}%`
                        : "-"
                    }
                  />
                  <PulseRow
                    label="Catatan yang hilang/lama"
                    value={String(managerInsights?.missing_or_stale_log_count ?? 0)}
                  />
                </div>
                <div className="mt-4 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4 text-sm leading-6 text-slate-600">
                  {(managerInsights?.boundary_alerts.length ?? 0) > 0
                    ? `Ada ${managerInsights?.boundary_alerts.length ?? 0} area yang sudah cukup besar untuk masuk radar Head.`
                    : "Belum ada area tim yang sangat menonjol saat ini."}
                </div>
              </PanelFrame>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <PanelFrame eyebrow="Navigasi cepat" title="Masuk ke area kerja">
                <div className="grid gap-3">
                  <Link
                    href="/dashboard/notifications"
                    className="clara-button clara-button-primary justify-center"
                  >
                    Alert Tim
                  </Link>
                  <Link
                    href="/dashboard/manager-insights"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Monitor Tim
                  </Link>
                  <Link
                    href="/dashboard/approvals"
                    className="clara-button clara-button-ghost justify-center"
                  >
                    Arahan Tim
                  </Link>
                </div>
              </PanelFrame>

              <PanelFrame eyebrow="Urutan kerja" title="Cara baca beranda Head">
                <div className="space-y-3">
                  <ActionChecklistRow
                    step="1"
                    title="Lihat alert yang paling besar"
                    description="Cari dulu tim atau area yang butuh keputusan cepat."
                  />
                  <ActionChecklistRow
                    step="2"
                    title="Baca pola monitor tim"
                    description="Pastikan masalahnya hanya di satu case atau sudah mulai lintas tim."
                  />
                  <ActionChecklistRow
                    step="3"
                    title="Turunkan arahan yang jelas"
                    description="Putuskan siapa yang harus bergerak: sales, manager, atau eskalasi lain."
                  />
                </div>
              </PanelFrame>

              <PanelFrame eyebrow="Angka penting" title="Yang perlu dibaca cepat">
                <div className="space-y-3">
                  <PulseRow
                    label="Lead aktif lintas tim"
                    value={isLoading ? "..." : String(managerInsights?.total_leads ?? 0)}
                  />
                  <PulseRow
                    label="Case arahan"
                    value={isLoading ? "..." : String(managerReviewCount)}
                  />
                  <PulseRow
                    label="Follow-up terlambat"
                    value={isLoading ? "..." : String(managerOverdueCount)}
                  />
                </div>
              </PanelFrame>
            </section>
          </>
        ) : (
          <>
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
          </>
        )}
        {(topSales || topOrganization) && !isSalesWorkspace && (
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

function ActionChecklistRow({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="clara-card-soft flex gap-4 rounded-2xl px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
        {step}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
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
