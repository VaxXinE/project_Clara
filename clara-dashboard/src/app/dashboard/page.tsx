"use client";

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

const roleCopy: Record<string, { title: string; summary: string }> = {
  owner: {
    title: "Global Command Center",
    summary:
      "Lihat kesehatan operasional, quality insight, dan arah market signal lintas organization.",
  },
  admin: {
    title: "Organization Control Room",
    summary:
      "Pantau aktivitas organization, kualitas follow-up, dan akses operasional tim dengan satu pintu masuk.",
  },
  marketing: {
    title: "Operational Workspace",
    summary:
      "Masuk ke inbox, upload chat baru, dan lanjutkan analisis percakapan customer tanpa harus lompat-lompat halaman.",
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
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
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
            href="/dashboard/upload"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Upload Chat
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
            className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Logout
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {errorMessage && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </section>
        )}

        {successMessage && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
            {successMessage}
          </section>
        )}

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
            hint="Jumlah percakapan yang saat ini bisa Anda tindak lanjuti dari workspace."
          />
          <MetricCard
            label="Sudah Dianalisis"
            value={isLoading ? "..." : String(metrics.analyzedCount)}
            hint="Conversation yang sudah punya hasil pembacaan AI dan next action."
          />
          <MetricCard
            label="Cakupan Insight"
            value={isLoading ? "..." : String(metrics.insightConversationCount)}
            hint="Total percakapan yang ikut membentuk marketing insight saat ini."
          />
          <MetricCard
            label="Risiko Tinggi"
            value={isLoading ? "..." : String(metrics.highRiskCount)}
            hint="Percakapan sensitif yang sebaiknya ditangani atau ditinjau lebih cepat."
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

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Fokus Hari Ini
              </p>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">
                {roleLabel?.title ?? "Team Workspace"}
              </h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
                <li>Prioritaskan upload chat baru dan pastikan parsing berjalan bersih.</li>
                <li>Jalankan AI analysis lebih cepat pada conversation yang sudah aktif lagi.</li>
                <li>Gunakan product knowledge saat menangani legalitas, harga, atau klaim sensitif.</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    AI Worklist
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    Prioritas follow-up hari ini
                  </h2>
                </div>
                <Link
                  href="/dashboard/follow-up"
                  className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                >
                  Lihat Semua
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {worklist && worklist.items.length > 0 ? (
                  worklist.items.slice(0, 3).map((item) => (
                    <div
                      key={`${item.lead_id}-${item.task_type}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">{item.lead_name}</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {item.task_label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.recommended_action}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Belum ada follow-up yang mendesak.
                  </div>
                )}
              </div>
            </section>

            {canAccessAdmin && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      KPI Preview
                    </p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                      Health pipeline & sales snapshot
                    </h2>
                  </div>
                  <Link
                    href="/dashboard/kpi"
                    className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                  >
                    Buka KPI Center
                  </Link>
                </div>

                {kpi ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Top Sales
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {kpi.sales_performance[0]?.user_name ?? "Belum ada data"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {kpi.sales_performance[0]
                            ? `${kpi.sales_performance[0].replies_sent} replies sent • ${kpi.sales_performance[0].closing_leads} closing leads`
                            : "Tambahkan lebih banyak activity untuk mulai melihat ranking."}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Top Organization
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {kpi.organization_performance[0]?.organization_name ??
                            "Belum ada data"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {kpi.organization_performance[0]
                            ? `${kpi.organization_performance[0].hot_leads} hot leads • ${(kpi.organization_performance[0].reply_sent_rate * 100).toFixed(0)}% reply sent rate`
                            : "Organization performance akan muncul ketika data pipeline mulai cukup."}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950 p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        Observation
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-100">
                        {kpi.key_observations[0] ??
                          "Belum ada observasi yang cukup kuat untuk ditampilkan."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    KPI preview belum tersedia untuk role ini atau data pipeline masih tipis.
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Aktivitas Terakhir
              </p>
              {latestConversation ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-950">
                    {latestConversation.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {latestConversation.latest_message?.message_text ??
                      "Belum ada pesan terakhir yang bisa ditampilkan."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                    Last update: {formatDateTime(latestConversation.last_message_at)}
                  </span>
                  <span>•</span>
                    <span>Status: {formatStatusLabel(latestConversation.ui_status)}</span>
                  </div>
                  <Link
                    href={`/dashboard/sales/conversations/${latestConversation.conversation_id}`}
                    className="mt-4 inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                  >
                    Buka Conversation
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Belum ada conversation yang tampil. Kalau baru mulai, upload
                  chat WhatsApp pertama dulu agar workspace ini mulai terasa
                  hidup.
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Keamanan Akun
              </p>
              <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">
                Ganti Password Akun
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gunakan password baru yang cukup kuat agar sesi dashboard dan
                akses data customer tidak mudah diambil alih.
              </p>

              <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
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
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isChangingPassword ? "Saving..." : "Update Password"}
                </button>
              </form>
            </section>
          </div>
        </section>
      </div>
    </WorkspaceShell>
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
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
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

function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
    >
      <h3 className="text-base font-semibold text-slate-950 group-hover:text-slate-800">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
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
        className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Hint: gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
