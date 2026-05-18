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
            href="/dashboard/sales"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Buka Inbox
          </Link>
          <Link
            href="/dashboard/upload"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Upload Chat
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

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quick Actions
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ActionCard
                href="/dashboard/sales"
                title="Conversation Inbox"
                description="Masuk ke antrian percakapan, buka detail customer, dan lanjutkan follow-up."
              />
              <ActionCard
                href="/dashboard/upload"
                title="Upload WhatsApp TXT"
                description="Masukkan export chat baru untuk diparse menjadi conversation dan message."
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
