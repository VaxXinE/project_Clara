"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faBullseye,
  faChartLine,
  faComments,
  faTriangleExclamation,
  faCircleCheck,
  faFlag,
  faListCheck,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import {
  formatChannelLabel,
  formatDateTime,
  formatRelativeTime,
  formatStatusLabel,
} from "@/lib/format";
import { ACTIONABLE_BUCKETS, getQueueBucket, pickNextChat } from "@/lib/inbox";
import { REPLY_STATE, TEMPERATURE } from "@/lib/vocab";
import { canAccessQueueAndActionCenter } from "@/lib/roles";
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

const LOADING_VALUE = "__loading__";

export default function DashboardHomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics>(EMPTY_METRICS);
  const [inboxItems, setInboxItems] = useState<SalesInboxItem[]>([]);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [managerInsights, setManagerInsights] =
    useState<ManagerInsightsResponse | null>(null);
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

        if (["superadmin", "head"].includes(me.role)) {
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
  const shouldRenderLeadershipWorkspace =
    !isLoading && (!errorMessage || hasLeadershipData);
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
  const nextChat = pickNextChat(inboxItems);
  // Dipakai panel "Chat terbaru" milik Head dan Superadmin.
  const latestConversation = inboxItems[0] ?? null;
  const latestActivityHref = latestConversation
    ? `/sales/conversations/${latestConversation.conversation_id}`
    : "/upload";
  const latestActivityLabel = latestConversation ? "Buka chat" : "Buka Input Chat";
  const actionableChatCount = inboxItems.filter((item) =>
    ACTIONABLE_BUCKETS.includes(getQueueBucket(item)),
  ).length;
  const highRiskChatCount = inboxItems.filter(
    (item) => !item.is_archived && item.latest_ai_extraction?.risk_level === "high",
  ).length;
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
          : (roleLabel?.summary ?? "Ringkasan kerja hari ini.")
      }
    >
      <div className="space-y-6">
        {errorMessage && (
          <section role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </section>
        )}

        {currentUser && !isSalesWorkspace && isLoading ? (
          <div role="status" className="clara-empty-state text-sm text-clara-ink-2">
            Memuat ringkasan...
          </div>
        ) : null}

        {isSalesWorkspace ? (
          <>
            <section
              data-onboarding-id="sales-home-next-action"
              aria-labelledby="sales-next-title"
              className="clara-card p-5 sm:p-6"
            >
              <p className="text-sm font-semibold text-clara-gold">Mulai dari sini</p>

              {isLoading ? (
                <div className="mt-3 space-y-3" role="status" aria-label="Memuat">
                  <LoadingBar className="h-6 w-1/2" />
                  <LoadingBar className="h-4 w-full" />
                  <LoadingBar className="h-4 w-2/3" />
                </div>
              ) : nextChat ? (
                <>
                  <h2
                    id="sales-next-title"
                    className="mt-2 break-words text-xl font-bold clara-text-primary sm:text-2xl"
                  >
                    {nextChat.title}
                  </h2>
                  <p className="mt-1 text-xs clara-text-muted">
                    {formatChannelLabel(nextChat.source_channel)} · {formatRelativeTime(nextChat.last_message_at)}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 clara-text-secondary">
                    {nextChat.latest_message?.message_text ?? "Belum ada pesan."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nextChat.latest_ai_extraction ? (
                      <ValueTag table={TEMPERATURE} value={nextChat.latest_ai_extraction.lead_temperature} />
                    ) : null}
                    {nextChat.latest_ai_extraction?.risk_level === "high" ? (
                      <Tag tone="danger">Risiko tinggi</Tag>
                    ) : null}
                    <ValueTag table={REPLY_STATE} value={nextChat.ui_status} />
                  </div>
                  {nextChat.latest_ai_extraction?.next_best_action ? (
                    <p className="mt-3 text-sm leading-6 clara-text-secondary">
                      <span className="font-semibold clara-text-primary">Langkah berikutnya: </span>
                      {nextChat.latest_ai_extraction.next_best_action}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/sales/conversations/${nextChat.conversation_id}`}
                      className="clara-button clara-button-primary justify-center"
                    >
                      Buka dan balas
                    </Link>
                    <Link href="/sales" className="clara-button clara-button-secondary justify-center">
                      Lihat semua chat ({actionableChatCount})
                    </Link>
                  </div>
                </>
              ) : nextWorkItem ? (
                <>
                  <h2
                    id="sales-next-title"
                    className="mt-2 break-words text-xl font-bold clara-text-primary sm:text-2xl"
                  >
                    {nextWorkItem.lead_name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 clara-text-secondary">
                    {nextWorkItem.reason || "Ada tindak lanjut yang perlu kamu selesaikan."}
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={
                        nextWorkItem.conversation_id
                          ? `/sales/conversations/${nextWorkItem.conversation_id}`
                          : "/follow-up"
                      }
                      className="clara-button clara-button-primary justify-center"
                    >
                      {nextWorkItem.conversation_id ? "Buka chat" : "Buka Tindak Lanjut"}
                    </Link>
                    <Link href="/follow-up" className="clara-button clara-button-secondary justify-center">
                      Lihat semua tindak lanjut
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 id="sales-next-title" className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl">
                    Belum ada yang mendesak
                  </h2>
                  <p className="mt-2 text-sm leading-6 clara-text-secondary">
                    Semua chat sudah kamu tangani. Kalau ada percakapan dari luar extension, masukkan lewat Input
                    Chat supaya Clara bisa membantu membalasnya.
                  </p>
                  <div className="mt-5">
                    <Link href="/upload" className="clara-button clara-button-primary">
                      Masukkan chat baru
                    </Link>
                  </div>
                </>
              )}
            </section>

            <section
              data-onboarding-id="sales-home-counts"
              aria-label="Ringkasan pekerjaan"
              className="grid gap-3 sm:grid-cols-3"
            >
              <CountLink
                href="/sales"
                label="Chat menunggu kamu"
                value={isLoading ? null : actionableChatCount}
              />
              <CountLink
                href="/sales"
                label="Chat berisiko tinggi"
                value={isLoading ? null : highRiskChatCount}
              />
              <CountLink
                href="/follow-up"
                label="Tindak lanjut aktif"
                value={isLoading ? null : openTaskCount}
              />
            </section>
          </>
        ) : !shouldRenderLeadershipWorkspace ? null : isManagerWorkspace ? (
          <>
            <section
              data-onboarding-id="manager-home-summary"
              className="clara-card rounded-3xl p-6"
            >
              <p className="clara-kicker text-xs">Ringkasan hari ini</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] clara-text-primary">
                    Mulai dari bottleneck tim, lalu turun ke review sales
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-clara-ink-2">
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
              <div data-onboarding-id="manager-home-next-action">
                <PanelFrame
                  eyebrow={managerNextAction.eyebrow}
                  title={managerNextAction.title}
                  actionLabel={managerNextAction.label}
                  actionHref={managerNextAction.href}
                >
                <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5">
                  <p className="text-sm leading-7 text-clara-ink-2">
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
                    icon={faListCheck}
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
              </div>

              <div className="space-y-6">
              <div data-onboarding-id="manager-home-health">
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
                        ? LOADING_VALUE
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
                <div className="mt-4 rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4 text-sm leading-6 text-clara-ink-2">
                  {managerBoundaryAlertCount > 0
                    ? `Ada ${managerBoundaryAlertCount} alert tim yang perlu Anda lihat lebih dulu.`
                    : managerOverdueCount > 0
                      ? `${managerOverdueCount} follow-up mulai terlambat meskipun belum muncul banyak alert besar.`
                      : "Belum ada alert tim yang menonjol saat ini."}
                </div>
                </PanelFrame>
              </div>
              <div data-onboarding-id="manager-home-metrics">
                <PanelFrame eyebrow="Angka penting" title="Yang perlu dibaca cepat">
                <div className="space-y-3">
                  <PulseRow
                    label="Lead aktif"
                    value={isLoading ? LOADING_VALUE : String(managerInsights?.total_leads ?? 0)}
                  />
                  <PulseRow
                    label="Perlu review"
                    value={isLoading ? LOADING_VALUE : String(managerReviewCount)}
                  />
                  <PulseRow
                    label="Follow-up terlambat"
                    value={isLoading ? LOADING_VALUE : String(managerOverdueCount)}
                  />
                </div>
                </PanelFrame>
              </div>
              </div>
            </section>

          </>
        ) : isHeadWorkspace ? (
          <>
            <section className="clara-card rounded-3xl p-6">
              <p className="clara-kicker text-xs">Ringkasan hari ini</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] clara-text-primary">
                    Mulai dari sinyal lintas tim yang butuh keputusan Head
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-clara-ink-2">
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
                value={isLoading ? LOADING_VALUE : String(managerInsights?.scope_team_count ?? 0)}
                hint="Jumlah tim yang sedang masuk area pantau Head."
                icon={faComments}
                accent="from-[#f7dfa2] to-[#be8d2f]"
              />
              <MetricCard
                label="Lead Aktif"
                value={isLoading ? LOADING_VALUE : String(managerInsights?.total_leads ?? 0)}
                hint="Lead lintas tim yang masih perlu dijaga ritmenya."
                icon={faBullseye}
                accent="from-[#f3d48a] to-[#9f7121]"
              />
              <MetricCard
                label="Perlu Intervensi"
                value={
                  isLoading
                    ? LOADING_VALUE
                    : String(
                        (managerInsights?.boundary_alerts.length ?? 0) +
                          (managerInsights?.open_coaching_case_count ?? 0),
                      )
                }
                hint="Area tim yang perlu arahan atau tekanan lebih dulu."
                icon={faFlag}
                accent="from-[#f1cf7a] to-[#7f5a1a]"
              />
              <MetricCard
                label="Follow-up Terlambat"
                value={
                  isLoading ? LOADING_VALUE : String(managerInsights?.overdue_follow_up_count ?? 0)
                }
                hint="Follow-up yang mulai bocor dan perlu segera dikawal."
                icon={faTriangleExclamation}
                accent="from-[#f6dc9d] to-[#b67d27]"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div data-onboarding-id="head-home-next-action">
                <PanelFrame
                  eyebrow={headNextAction.eyebrow}
                  title={headNextAction.title}
                  actionLabel={headNextAction.label}
                  actionHref={headNextAction.href}
                >
                <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5">
                  <p className="text-sm leading-7 text-clara-ink-2">
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
              </div>

              <div data-onboarding-id="head-home-health">
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
                <div className="mt-4 rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4 text-sm leading-6 text-clara-ink-2">
                  {(managerInsights?.boundary_alerts.length ?? 0) > 0
                    ? `Ada ${managerInsights?.boundary_alerts.length ?? 0} area yang sudah cukup besar untuk masuk radar Head.`
                    : "Belum ada area tim yang sangat menonjol saat ini."}
                </div>
                </PanelFrame>
              </div>
            </section>

          </>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Percakapan Aktif"
                value={isLoading ? LOADING_VALUE : String(metrics.inboxCount)}
                hint="Chat aktif saat ini."
                icon={faComments}
                accent="from-[#f7dfa2] to-[#be8d2f]"
              />
              <MetricCard
                label="Sudah Dianalisis"
                value={isLoading ? LOADING_VALUE : String(metrics.analyzedCount)}
                hint="Chat yang sudah dibaca AI."
                icon={faCircleCheck}
                accent="from-[#f3d48a] to-[#9f7121]"
              />
              <MetricCard
                label="Cakupan Insight"
                value={isLoading ? LOADING_VALUE : String(metrics.insightConversationCount)}
                hint="Chat yang masuk insight."
                icon={faChartLine}
                accent="from-[#f1cf7a] to-[#7f5a1a]"
              />
              <MetricCard
                label="Risiko Tinggi"
                value={isLoading ? LOADING_VALUE : String(metrics.highRiskCount)}
                hint="Chat yang perlu perhatian."
                icon={faTriangleExclamation}
                accent="from-[#f6dc9d] to-[#b67d27]"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <PanelFrame eyebrow="Ringkasan" title="Kondisi hari ini">
            <div className="grid gap-4">
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PulseRow label="Chat dibaca AI" value={isLoading ? LOADING_VALUE : aiCoverage} />
              <PulseRow
                label="Update terakhir"
                value={
                  latestConversation?.last_message_at
                    ? formatDateTime(latestConversation.last_message_at)
                    : "-"
                }
              />
            </div>

            {primaryObservation ? (
              <div className="mt-4 rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(30,22,14,0.98)_0%,rgba(17,12,8,0.98)_100%)] p-4 text-clara-cream">
                <p className="text-xs font-semibold text-[#f0cb73]">
                  Catatan Clara
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7e7b7]">
                  {primaryObservation}
                </p>
              </div>
            ) : null}
              </PanelFrame>

              <PanelFrame
                eyebrow="Aktivitas"
                title="Chat terbaru"
                actionLabel={latestActivityLabel}
                actionHref={latestActivityHref}
              >
                {latestConversation ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-4">
                      <p className="text-base font-semibold clara-text-primary">
                        {latestConversation.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-clara-ink-2">
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
                  <div className="rounded-2xl border border-dashed border-[#f0cb73]/26 bg-[linear-gradient(180deg,rgba(33,24,17,0.9)_0%,rgba(18,13,10,0.9)_100%)] p-5 text-sm text-clara-ink-2">
                    Belum ada chat yang tampil. Input chat pertama untuk mulai
                    mengisi ringkasan di beranda ini.
                  </div>
                )}
              </PanelFrame>
            </section>
          </>
        )}
        {(topSales || topOrganization) && !isSalesWorkspace && (
          <section className="grid gap-6 xl:grid-cols-2">
            {topSales ? (
              <PanelFrame eyebrow="Sales teratas" title={topSales.user_name}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PulseRow
                    label="Balasan terkirim"
                    value={String(topSales.replies_sent)}
                  />
                  <PulseRow
                    label="Lead Closing"
                    value={String(topSales.closing_leads)}
                  />
                  <PulseRow
                    label="Lead Panas"
                    value={String(topSales.hot_leads)}
                  />
                </div>
              </PanelFrame>
            ) : null}

            {topOrganization ? (
              <PanelFrame
                eyebrow="Organisasi teratas"
                title={topOrganization.organization_name}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <PulseRow
                    label="Lead Panas"
                    value={String(topOrganization.hot_leads)}
                  />
                  <PulseRow
                    label="Tingkat balasan"
                    value={`${(topOrganization.reply_sent_rate * 100).toFixed(0)}%`}
                  />
                  <PulseRow
                    label="Tingkat closing"
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
    <article className="clara-card rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          {value === LOADING_VALUE ? (
            <LoadingBar className="mt-3 h-9 w-20" />
          ) : (
            <p className="mt-3 text-3xl font-bold tracking-tight clara-text-primary">
              {value}
            </p>
          )}
        </div>
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-[var(--color-text-inverse)]`}
        >
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-clara-ink-2">{hint}</p>
    </article>
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
    <section className="clara-card rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] clara-text-primary">
            {title}
          </h2>
        </div>

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="clara-button clara-button-ghost shrink-0 whitespace-nowrap"
          >
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
      <span className="text-clara-ink-2">{label}</span>
      {value === LOADING_VALUE ? (
        <LoadingBar className="h-5 w-16" />
      ) : (
        <span className="font-semibold clara-text-primary">{value}</span>
      )}
    </div>
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
    <div className="clara-card-soft rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          <h3 className="text-base font-semibold clara-text-primary">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-clara-ink-2">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
