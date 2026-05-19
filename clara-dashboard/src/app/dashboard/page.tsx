"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faBookOpen,
  faBriefcase,
  faBullseye,
  faCalendarCheck,
  faChartLine,
  faCloudArrowUp,
  faComments,
  faShieldHalved,
  faTriangleExclamation,
  faUsersGear,
  faWandSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getPasswordStrength,
} from "@/lib/format";
import type {
  ChangePasswordRequest,
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

type QuickLink = {
  href: string;
  title: string;
  description: string;
  eyebrow: string;
  icon: IconDefinition;
};

const EMPTY_METRICS: OverviewMetrics = {
  inboxCount: 0,
  analyzedCount: 0,
  insightConversationCount: 0,
  highRiskCount: 0,
};

const EMPTY_CHANGE_PASSWORD_FORM: ChangePasswordRequest = {
  current_password: "",
  new_password: "",
};

const roleCopy: Record<
  string,
  { title: string; summary: string; focus: string[] }
> = {
  owner: {
    title: "Global Command Center",
    summary:
      "Lihat kesehatan operasional, quality insight, dan arah market signal lintas organization dari satu control room yang ringkas.",
    focus: [
      "Pantau conversation berisiko tinggi sebelum mengganggu closing.",
      "Validasi insight mingguan agar tim sales dan marketing bergerak sinkron.",
      "Jaga knowledge base tetap rapi supaya balasan Clara tetap grounded.",
    ],
  },
  admin: {
    title: "Organization Control Room",
    summary:
      "Atur ritme kerja tim, follow-up, dan akses operasional tanpa harus lompat dari satu modul ke modul lain.",
    focus: [
      "Pastikan worklist tim tetap bergerak untuk lead panas dan overdue.",
      "Jaga akses user dan pipeline supaya tidak ada bottleneck operasional.",
      "Gunakan preview KPI untuk memutuskan prioritas tim hari ini.",
    ],
  },
  marketing: {
    title: "Operational Workspace",
    summary:
      "Masuk ke inbox, upload percakapan baru, lalu teruskan analisis customer dengan alur yang lebih fokus dan minim distraksi.",
    focus: [
      "Upload chat baru dan cek parsing agar tidak ada data yang tertinggal.",
      "Lanjutkan follow-up conversation yang sudah aktif kembali hari ini.",
      "Gunakan knowledge resmi saat menghadapi legalitas, harga, atau klaim sensitif.",
    ],
  },
};

export default function DashboardHomePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics>(EMPTY_METRICS);
  const [latestConversation, setLatestConversation] =
    useState<SalesInboxItem | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [kpi, setKpi] = useState<KpiCommandCenterResponse | null>(null);
  const [changePasswordForm, setChangePasswordForm] =
    useState<ChangePasswordRequest>(EMPTY_CHANGE_PASSWORD_FORM);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    async function loadDashboardHome() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        const nextMetrics: OverviewMetrics = { ...EMPTY_METRICS };

        if (["marketing", "admin", "owner"].includes(me.role)) {
          try {
            const [inbox, worklistResponse] = await Promise.all([
              apiFetch<SalesInboxItem[]>("/dashboard/sales/inbox"),
              apiFetch<SalesWorklistResponse>("/dashboard/sales/worklist"),
            ]);
            nextMetrics.inboxCount = inbox.length;
            nextMetrics.analyzedCount = inbox.filter(
              (item) => item.latest_ai_extraction !== null
            ).length;
            setLatestConversation(inbox[0] ?? null);
            setWorklist(worklistResponse);
          } catch {
            // Owner bisa gagal karena route inbox masih bukan primary focus untuk role ini.
          }
        }

        if (["owner", "admin"].includes(me.role)) {
          try {
            const [insights, kpiResponse] = await Promise.all([
              apiFetch<MarketingInsightsPreview>(
                "/dashboard/marketing/insights-preview"
              ),
              apiFetch<KpiCommandCenterResponse>("/dashboard/kpi/command-center"),
            ]);
            nextMetrics.insightConversationCount = insights.total_conversations;
            nextMetrics.highRiskCount =
              insights.kpi_summary.high_risk_conversation_count;
            setKpi(kpiResponse);
          } catch {
            // Biarkan dashboard home tetap usable walau insight belum tersedia.
          }
        }

        setMetrics(nextMetrics);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat dashboard overview."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboardHome();
  }, []);

  async function handleLogout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API failure.
    } finally {
      window.location.href = "/login";
    }
  }

  async function handleChangePassword(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsChangingPassword(true);

    try {
      await apiFetch<CurrentUser>("/auth/change-password", {
        method: "POST",
        body: changePasswordForm,
      });
      setSuccessMessage("Password akun berhasil diubah.");
      setChangePasswordForm(EMPTY_CHANGE_PASSWORD_FORM);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah password akun."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  const roleLabel = currentUser ? roleCopy[currentUser.role] : null;
  const canAccessInsights =
    currentUser !== null && ["owner", "admin"].includes(currentUser.role);
  const canAccessAdmin =
    currentUser !== null && ["owner", "admin"].includes(currentUser.role);
  const passwordStrength = getPasswordStrength(changePasswordForm.new_password);
  const quickLinks = buildQuickLinks(canAccessInsights, canAccessAdmin);
  const nextStep = getDashboardNextStep({
    currentUser,
    latestConversation,
    worklist,
    metrics,
    canAccessInsights,
  });

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Workspace overview"
      title={currentUser ? `Halo, ${currentUser.name}.` : "Clara Workspace"}
      description={
        roleLabel?.summary ??
        "Pusat kerja harian untuk mengubah percakapan customer menjadi tindakan operasional dan insight yang bisa dipakai tim."
      }
      actions={
        <>
          <Link
            href="/dashboard/start"
            className="clara-button clara-button-primary"
          >
            Mulai dari Sini
          </Link>
          <Link
            href="/dashboard/sales"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Buka Chat Masuk
          </Link>
          <Link
            href="/dashboard/channels"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Channels
          </Link>
          <Link
            href="/dashboard/notifications"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Notifications
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="clara-button clara-button-ghost"
          >
            Logout
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {errorMessage && (
          <section className="clara-alert clara-alert-danger">
            {errorMessage}
          </section>
        )}

        {successMessage && (
          <section className="clara-alert clara-alert-success">
            {successMessage}
          </section>
        )}

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="clara-panel overflow-hidden rounded-[34px] p-6 sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_250px]">
              <div>
                <span className="inline-flex rounded-full border border-[#e5d2b3] bg-[#fff5e5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6737]">
                  {roleLabel?.title ?? "Workspace"}
                </span>
                <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-[-0.05em] text-slate-950 sm:text-[2.85rem]">
                  Dashboard yang lebih fokus untuk operasional, insight, dan eksekusi harian.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                  {roleLabel?.summary ??
                    "Semua titik kerja penting Clara dikumpulkan dalam satu workspace yang lebih tenang, lebih jelas, dan lebih cepat dipindai."}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <SignalPill
                    label="Percakapan"
                    value={isLoading ? "..." : String(metrics.inboxCount)}
                  />
                  <SignalPill
                    label="AI Analyzed"
                    value={isLoading ? "..." : String(metrics.analyzedCount)}
                  />
                  <SignalPill
                    label="High Risk"
                    value={isLoading ? "..." : String(metrics.highRiskCount)}
                  />
                </div>
              </div>

              <div className="rounded-[30px] bg-[linear-gradient(180deg,#10172d_0%,#172241_100%)] p-5 text-white shadow-[0_20px_40px_rgba(16,23,45,0.22)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4b07b]">
                  Fokus Hari Ini
                </p>
                <ul className="mt-4 space-y-3">
                  {(roleLabel?.focus ?? []).map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm leading-6 text-slate-100"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <section className="clara-panel-soft rounded-[28px] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10172d] text-[#f4e7d3]">
                  <FontAwesomeIcon icon={faBullseye} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6737]">
                    System Pulse
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    Ringkas, tapi langsung berguna
                  </h3>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <PulseRow
                  label="Conversation aktif"
                  value={isLoading ? "..." : String(metrics.inboxCount)}
                />
                <PulseRow
                  label="Insight coverage"
                  value={isLoading ? "..." : String(metrics.insightConversationCount)}
                />
                <PulseRow
                  label="Status workspace"
                  value={canAccessInsights ? "Extended view" : "Operational view"}
                />
              </div>
            </section>

            <section className="clara-panel-soft rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6737]">
                Aktivitas Terakhir
              </p>
              {latestConversation ? (
                <div className="mt-4 rounded-[24px] border border-white/80 bg-white/80 p-4">
                  <p className="text-base font-semibold text-slate-950">
                    {latestConversation.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {latestConversation.latest_message?.message_text ??
                      "Belum ada pesan terakhir yang bisa ditampilkan."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      Last update: {formatDateTime(latestConversation.last_message_at)}
                    </span>
                    <span>&bull;</span>
                    <span>
                      Status: {formatStatusLabel(latestConversation.ui_status)}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/sales/conversations/${latestConversation.conversation_id}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                  >
                    Buka Conversation
                    <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
                  Belum ada conversation yang tampil. Kalau baru mulai, upload
                  chat WhatsApp pertama dulu agar workspace ini mulai terasa
                  hidup.
                </div>
              )}
            </section>
          </div>
        </section>

        <NextStepBanner
          title={nextStep.title}
          description={nextStep.description}
          href={nextStep.href}
          actionLabel={nextStep.actionLabel}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Percakapan Aktif"
            value={isLoading ? "..." : String(metrics.inboxCount)}
            hint="Jumlah percakapan yang sedang bisa ditindak lanjuti dari workspace."
            icon={faComments}
            accent="from-[#fff4e5] to-[#f5dcc0]"
          />
          <MetricCard
            label="Sudah Dianalisis"
            value={isLoading ? "..." : String(metrics.analyzedCount)}
            hint="Conversation yang sudah punya pembacaan AI dan next action."
            icon={faWandSparkles}
            accent="from-[#eef4ff] to-[#dfe8fb]"
          />
          <MetricCard
            label="Cakupan Insight"
            value={isLoading ? "..." : String(metrics.insightConversationCount)}
            hint="Percakapan yang ikut membentuk insight marketing saat ini."
            icon={faChartLine}
            accent="from-[#ebfaf4] to-[#d5eedf]"
          />
          <MetricCard
            label="Risiko Tinggi"
            value={isLoading ? "..." : String(metrics.highRiskCount)}
            hint="Percakapan sensitif yang sebaiknya ditangani atau ditinjau lebih cepat."
            icon={faTriangleExclamation}
            accent="from-[#fff0ea] to-[#f7d7c8]"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Cara Pakai Clara
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Gunakan Clara dalam 4 langkah
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Kalau Anda bingung harus mulai dari mana, jangan lompat ke semua menu sekaligus.
                Clara paling mudah dipakai dengan alur ini: masukkan chat, review chat masuk,
                ubah jadi lead kerja, lalu eksekusi follow-up harian.
              </p>
            </div>
            <Link
              href="/dashboard/start"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Buka Panduan Lengkap
            </Link>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            <WorkflowStepCard
              step="1"
              title="Import Chat"
              description="Upload TXT atau paste chat ke Clara."
              href="/dashboard/upload"
            />
            <WorkflowStepCard
              step="2"
              title="Review Chat Masuk"
              description="Buka percakapan, jalankan AI analysis, dan siapkan draft."
              href="/dashboard/sales"
            />
            <WorkflowStepCard
              step="3"
              title="Kelola Lead"
              description="Pindahkan stage, atur follow-up, dan baca identity customer."
              href="/dashboard/crm"
            />
            <WorkflowStepCard
              step="4"
              title="Eksekusi Tindakan"
              description="Gunakan worklist, approvals, dan notifications untuk aksi harian."
              href="/dashboard/follow-up"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PanelFrame
            eyebrow="Quick Routes"
            title="Akses modul yang paling sering dipakai"
            actionLabel="Lihat inbox"
            actionHref="/dashboard/sales"
          >
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {quickLinks.map((item) => (
                  <ActionCard key={item.href} item={item} />
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Paling Sering Dipakai
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <ActionCard
                    href="/dashboard/start"
                    title="Mulai dari Sini"
                    description="Panduan langkah demi langkah supaya user baru tidak bingung membaca alur Clara."
                  />
                  <ActionCard
                    href="/dashboard/sales"
                    title="Chat Masuk"
                    description="Masuk ke antrian percakapan, buka detail customer, dan lanjutkan follow-up."
                  />
                  <ActionCard
                    href="/dashboard/upload"
                    title="Import Chat"
                    description="Masukkan export chat baru atau paste chat langsung untuk diparse menjadi conversation."
                  />
                  <ActionCard
                    href="/dashboard/crm"
                    title="Lead Pipeline"
                    description="Lihat lead yang sudah terbentuk dari conversation dan mulai atur stage CRM dasarnya."
                  />
                  <ActionCard
                    href="/dashboard/follow-up"
                    title="AI Worklist"
                    description="Buka daftar follow-up harian yang sudah diprioritaskan Clara dari hot lead, overdue, dan draft siap kirim."
                  />
                  <ActionCard
                    href="/dashboard/approvals"
                    title="Approval Queue"
                    description="Lihat draft pending approval dan escalation tanpa buka conversation satu per satu."
                  />
                </div>

                <div className="mt-6 border-t border-slate-200 pt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Tools Tambahan
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ActionCard
                      href="/dashboard/knowledge"
                      title="Product Knowledge"
                      description="Kelola fakta produk, legalitas, dan policy supaya reply AI tetap grounded."
                    />
                    <ActionCard
                      href={canAccessInsights ? "/dashboard/marketing" : "/dashboard/sales"}
                      title={canAccessInsights ? "Marketing Insights" : "Operational Flow"}
                      description={
                        canAccessInsights
                          ? "Baca tren objection, insight snapshot, dan sinyal market dari percakapan customer."
                          : "Lanjutkan alur operasional harian dari inbox, analisis, hingga reply."
                      }
                    />
                    {canAccessAdmin && (
                      <ActionCard
                        href="/dashboard/kpi"
                        title="KPI Command Center"
                        description="Baca leaderboard sales, health pipeline per organization, dan KPI foundation untuk owner/admin."
                      />
                    )}
                    {canAccessAdmin && (
                      <ActionCard
                        href="/dashboard/admin/access"
                        title="User Management"
                        description="Kelola akses user dan organization sesuai role yang berwenang."
                      />
                    )}
                    {canAccessAdmin && (
                      <ActionCard
                        href="/dashboard/admin/ops"
                        title="Admin Ops"
                        description="Lihat overview database dan metadata sistem tanpa buka PostgreSQL client."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </PanelFrame>

          <div className="space-y-6">
            <PanelFrame
              eyebrow="AI Worklist"
              title="Prioritas follow-up hari ini"
              actionLabel="Lihat semua"
              actionHref="/dashboard/follow-up"
            >
              <div className="space-y-3">
                {worklist && worklist.items.length > 0 ? (
                  worklist.items.slice(0, 3).map((item) => (
                    <div
                      key={`${item.lead_id}-${item.task_type}`}
                      className="rounded-[24px] border border-slate-200/80 bg-[#fffdf8] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">
                          {item.lead_name}
                        </p>
                        <span className="rounded-full bg-[#fff0da] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6737]">
                          {item.task_label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.recommended_action}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-[#fffdf8] p-5 text-sm text-slate-600">
                    Belum ada follow-up yang mendesak.
                  </div>
                )}
              </div>
            </PanelFrame>

            {canAccessAdmin && (
              <PanelFrame
                eyebrow="KPI Preview"
                title="Health pipeline & sales snapshot"
                actionLabel="Buka KPI Center"
                actionHref="/dashboard/kpi"
              >
                {kpi ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniInsightCard
                        label="Top Sales"
                        title={kpi.sales_performance[0]?.user_name ?? "Belum ada data"}
                        description={
                          kpi.sales_performance[0]
                            ? `${kpi.sales_performance[0].replies_sent} replies sent / ${kpi.sales_performance[0].closing_leads} closing leads`
                            : "Tambahkan lebih banyak activity untuk mulai melihat ranking."
                        }
                      />
                      <MiniInsightCard
                        label="Top Organization"
                        title={
                          kpi.organization_performance[0]?.organization_name ??
                          "Belum ada data"
                        }
                        description={
                          kpi.organization_performance[0]
                            ? `${kpi.organization_performance[0].hot_leads} hot leads / ${(kpi.organization_performance[0].reply_sent_rate * 100).toFixed(0)}% reply sent rate`
                            : "Organization performance akan muncul ketika data pipeline mulai cukup."
                        }
                      />
                    </div>

                    <div className="rounded-[24px] bg-[linear-gradient(180deg,#10172d_0%,#172241_100%)] p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4b07b]">
                        Observation
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-100">
                        {kpi.key_observations[0] ??
                          "Belum ada observasi yang cukup kuat untuk ditampilkan."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-[#fffdf8] p-5 text-sm text-slate-600">
                    KPI preview belum tersedia untuk role ini atau data pipeline
                    masih tipis.
                  </div>
                )}
              </PanelFrame>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
          <PanelFrame eyebrow="Security" title="Jaga akses akun tetap aman">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[24px] bg-[linear-gradient(180deg,#10172d_0%,#172241_100%)] p-5 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#f4e7d3]">
                    <FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4b07b]">
                      Account Safety
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">Keamanan akun Clara</h3>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
                  <li>Gunakan kombinasi password yang kuat dan unik.</li>
                  <li>Jangan berbagi akses dashboard lintas role tanpa kebutuhan operasional.</li>
                  <li>Update password ketika ada pergantian personel atau device.</li>
                </ul>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <PasswordField
                  label="Current Password"
                  value={changePasswordForm.current_password}
                  onChange={(value) =>
                    setChangePasswordForm((current) => ({
                      ...current,
                      current_password: value,
                    }))
                  }
                />
                <PasswordField
                  label="New Password"
                  value={changePasswordForm.new_password}
                  onChange={(value) =>
                    setChangePasswordForm((current) => ({
                      ...current,
                      new_password: value,
                    }))
                  }
                />

                <PasswordStrengthHint
                  password={changePasswordForm.new_password}
                  strength={passwordStrength}
                />

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="rounded-full bg-[#10172d] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,23,45,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isChangingPassword ? "Saving..." : "Update Password"}
                </button>
              </form>
            </div>
          </PanelFrame>

          <PanelFrame eyebrow="Operating Notes" title="Pegangan harian tim">
            <div className="space-y-3">
              <NoteCard
                icon={faComments}
                title="Conversation first"
                description="Buka inbox lebih dulu saat mulai kerja agar semua lead aktif langsung terlihat."
              />
              <NoteCard
                icon={faCloudArrowUp}
                title="Raw chat discipline"
                description="Setelah upload, cek parsing dan status data sebelum analisis lanjutan dijalankan."
              />
              <NoteCard
                icon={faBookOpen}
                title="Grounded replies"
                description="Saat ada pembahasan legalitas, policy, atau harga sensitif, selalu rujuk knowledge resmi."
              />
            </div>
          </PanelFrame>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function buildQuickLinks(
  canAccessInsights: boolean,
  canAccessAdmin: boolean
): QuickLink[] {
  const links: QuickLink[] = [
    {
      href: "/dashboard/sales",
      title: "Conversation Inbox",
      description: "Masuk ke antrian percakapan dan lanjutkan follow-up customer.",
      eyebrow: "Sales",
      icon: faComments,
    },
    {
      href: "/dashboard/upload",
      title: "Upload WhatsApp TXT",
      description: "Masukkan export chat baru untuk diparse menjadi conversation dan message.",
      eyebrow: "Input",
      icon: faCloudArrowUp,
    },
    {
      href: "/dashboard/crm",
      title: "Lead Pipeline",
      description: "Lihat lead yang terbentuk dari percakapan dan atur tahap CRM dasarnya.",
      eyebrow: "CRM",
      icon: faBriefcase,
    },
    {
      href: "/dashboard/follow-up",
      title: "AI Worklist",
      description: "Pantau hot lead, overdue follow-up, dan draft siap kirim.",
      eyebrow: "AI Tasks",
      icon: faCalendarCheck,
    },
  ];

  if (canAccessInsights) {
    links.push({
      href: "/dashboard/marketing",
      title: "Marketing Insights",
      description: "Baca tren objection, snapshot insight, dan sinyal market dari customer.",
      eyebrow: "Insights",
      icon: faChartLine,
    });
  } else {
    links.push({
      href: "/dashboard/knowledge",
      title: "Product Knowledge",
      description: "Kelola fakta produk, legalitas, dan policy agar reply AI tetap grounded.",
      eyebrow: "Knowledge",
      icon: faBookOpen,
    });
  }

  if (canAccessAdmin) {
    links.push({
      href: "/dashboard/admin/access",
      title: "User Access",
      description: "Kelola akses user dan organization sesuai role yang berwenang.",
      eyebrow: "Administration",
      icon: faUsersGear,
    });
  }

  return links;
}

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl px-4 py-3">
      <p className="clara-kicker text-xs">{label}</p>
      <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
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

function getDashboardNextStep({
  currentUser,
  latestConversation,
  worklist,
  metrics,
  canAccessInsights,
}: {
  currentUser: CurrentUser | null;
  latestConversation: SalesInboxItem | null;
  worklist: SalesWorklistResponse | null;
  metrics: OverviewMetrics;
  canAccessInsights: boolean;
}) {
  if (!currentUser) {
    return {
      title: "Mulai dari halaman panduan",
      description:
        "Kalau Anda baru masuk ke Clara, buka panduan singkat dulu supaya alurnya cepat kebaca.",
      href: "/dashboard/start",
      actionLabel: "Buka Panduan",
    };
  }

  if (metrics.inboxCount === 0) {
    return {
      title: "Masukkan chat pertama Anda",
      description:
        "Workspace masih kosong. Langkah paling masuk akal sekarang adalah import atau paste chat agar Clara mulai membentuk conversation dan lead.",
      href: "/dashboard/upload",
      actionLabel: "Import Chat",
    };
  }

  if (metrics.analyzedCount < metrics.inboxCount) {
    return {
      title: "Masih ada chat yang belum dibaca AI",
      description:
        "Buka Chat Masuk lalu jalankan AI analysis pada conversation yang belum punya insight. Ini langkah paling penting sebelum reply atau memindahkan lead.",
      href: latestConversation
        ? `/dashboard/sales/conversations/${latestConversation.conversation_id}`
        : "/dashboard/sales",
      actionLabel: latestConversation ? "Buka Chat Terbaru" : "Buka Chat Masuk",
    };
  }

  if (worklist && worklist.items.length > 0) {
    return {
      title: "Ada tindakan harian yang sudah siap dikerjakan",
      description:
        "AI Worklist sudah menyusun prioritas follow-up. Fokus ke sana dulu supaya tidak kehilangan hot lead atau task yang overdue.",
      href: "/dashboard/follow-up",
      actionLabel: "Buka AI Worklist",
    };
  }

  if (canAccessInsights) {
    return {
      title: "Operasional sudah cukup stabil, lanjut baca insight",
      description:
        "Kalau inbox dan follow-up relatif aman, langkah berikutnya yang paling bernilai adalah membaca Marketing Insights atau KPI untuk mengambil keputusan level tim.",
      href: currentUser.role === "owner" || currentUser.role === "admin"
        ? "/dashboard/marketing"
        : "/dashboard/sales",
      actionLabel:
        currentUser.role === "owner" || currentUser.role === "admin"
          ? "Buka Marketing Insights"
          : "Buka Workspace",
    };
  }

  return {
    title: "Lead sudah terbentuk, saatnya rapikan pipeline",
    description:
      "Masuk ke Lead Pipeline untuk memastikan stage, follow-up, dan identitas customer sudah rapi sebelum volume chat bertambah.",
    href: "/dashboard/crm",
    actionLabel: "Buka Lead Pipeline",
  };
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

function NextStepBanner({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Langkah Berikutnya
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            {description}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
        >
          {actionLabel}
        </Link>
      </div>
    </section>
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
          <Link
            href={actionHref}
            className="clara-button clara-button-ghost"
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

function ActionCard({
  item,
  href,
  title,
  description,
  eyebrow,
  icon,
}: {
  item?: QuickLink;
  href?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  icon?: IconDefinition;
}) {
  const resolvedHref = item?.href ?? href ?? "/dashboard";
  const resolvedTitle = item?.title ?? title ?? "Workspace";
  const resolvedDescription =
    item?.description ?? description ?? "Buka modul Clara yang relevan.";
  const resolvedEyebrow = item?.eyebrow ?? eyebrow ?? "Clara";
  const resolvedIcon = item?.icon ?? icon ?? faArrowRight;

  return (
    <Link
      href={resolvedHref}
      className="clara-card-soft group rounded-[26px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(16,23,45,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{resolvedEyebrow}</p>
          <h3 className="mt-2 text-base font-semibold text-slate-950">
            {resolvedTitle}
          </h3>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10172d] text-[#f4e7d3]">
          <FontAwesomeIcon icon={resolvedIcon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{resolvedDescription}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#7d5b32]">
        Buka modul
        <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
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
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#10172d] text-[#f4e7d3]">
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

function NoteCard({
  icon,
  title,
  description,
}: {
  icon: IconDefinition;
  title: string;
  description: string;
}) {
  return (
    <div className="clara-card-soft rounded-[24px] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#10172d] text-[#f4e7d3]">
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkflowStepCard({
  step,
  title,
  description,
  href,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 transition hover:border-slate-300 hover:bg-white"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
        {step}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-900">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="password"
        className="mt-2 w-full rounded-2xl border border-slate-300/90 bg-white/85 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#cdae7c]"
        placeholder="Minimum 8 karakter"
      />
    </div>
  );
}

function PasswordStrengthHint({
  password,
  strength,
}: {
  password: string;
  strength: ReturnType<typeof getPasswordStrength>;
}) {
  if (!password) {
    return (
      <p className="rounded-2xl border border-slate-200/80 bg-[#fffdf8] p-3 text-xs text-slate-600">
        Hint: gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-[#fffdf8] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6737]">
          Password Strength
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${strength.badgeClassName}`}
        >
          {strength.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {strength.checks.map((check) => (
          <span
            key={check.label}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              check.passed
                ? "bg-green-100 text-green-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}
