"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessManagerInsights } from "@/lib/roles";
import type {
  CurrentUser,
  ManagerInsightsResponse,
} from "@/types/dashboard";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function getCoachingPriorityAction(item: {
  review_status: string;
  risk_level: string | null;
  review_label: string;
}) {
  if (item.review_status === "in_review") {
    return {
      title: "Manager harus review kasus ini sekarang",
      description:
        "Baca conversation, pastikan masalah utamanya jelas, lalu isi coaching note atau putuskan apakah case ini perlu `needs_rework`, `coaching_done`, atau `escalated`.",
      primaryLabel: "Buka Chat Review Center",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "needs_rework") {
    return {
      title: "Manager harus beri arahan revisi yang tegas",
      description:
        "Kasus ini belum selesai. Buka review center, tulis revisi yang harus dilakukan sales, dan pastikan next action tidak ambigu.",
      primaryLabel: "Lanjutkan Review",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "escalated") {
    return {
      title: "Kasus ini perlu keputusan level lebih tinggi",
      description:
        "Cek alasan eskalasinya, validasi risiko atau klaim sensitifnya, lalu tentukan apakah perlu dinaikkan lagi atau dikembalikan dengan arahan yang jelas.",
      primaryLabel: "Buka Chat Review Center",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.risk_level === "high") {
    return {
      title: "Kasus ini berisiko tinggi",
      description:
        "Jangan cukup baca summary. Manager perlu buka conversation dan pastikan tidak ada jawaban yang berpotensi mis-selling atau klaim sensitif.",
      primaryLabel: "Buka Conversation",
      primaryHref: null,
    };
  }

  return {
    title: "Manager perlu pastikan arah coaching-nya jelas",
    description:
      item.review_label === "unik"
        ? "Kasus ini unik, jadi manager perlu memastikan insight utamanya terdokumentasi dan tidak hilang setelah dibaca."
        : "Buka case ini dan pastikan keputusan review-nya jelas, bukan cuma dibaca lalu ditinggalkan.",
    primaryLabel: "Buka Chat Review Center",
    primaryHref: "/dashboard/approvals",
  };
}

export function ManagerInsightsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [insights, setInsights] = useState<ManagerInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadPage() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!canAccessManagerInsights(me.role)) {
          router.replace("/dashboard");
          return;
        }

        const response = await apiFetch<ManagerInsightsResponse>(
          "/dashboard/manager-insights",
        );
        setInsights(response);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat manager insights.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPage();
  }, [router]);

  function toggleTeamMembers(teamId: string | null) {
    if (!teamId) {
      return;
    }

    setExpandedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Manager command center"
      title="Manager Insights"
      description="Halaman ini dipakai untuk membaca disiplin tim, bottleneck follow-up, coaching case aktif, dan sinyal objection yang perlu diintervensi lebih dulu."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {insights ? (
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
              Generated: {formatDateTime(insights.generated_at)}
            </div>
          ) : null}
          <Link
            href="/dashboard/approvals"
            className="clara-button clara-button-primary"
          >
            Buka Chat Review Center
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading manager insights...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {insights && !isLoading && !errorMessage ? (
          <>
            <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#eff6ff_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    Mulai dari boundary alert, lalu turun ke tim yang paling bocor
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Manager view ini paling berguna kalau dibaca berurutan:
                    lihat alert tim atau unit dulu, cek compliance discipline dan
                    follow-up, lalu baru turun ke coaching case dan objection trend.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  {insights.scope_label}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Scope Teams"
                value={String(insights.scope_team_count)}
                hint="Jumlah team yang saat ini masuk boundary manager Anda."
              />
              <MetricCard
                label="Total Leads"
                value={String(insights.total_leads)}
                hint="Lead aktif yang perlu dijaga ritmenya di scope Anda."
              />
              <MetricCard
                label="Stale Lead Ratio"
                value={formatPercent(insights.stale_lead_ratio)}
                hint="Semakin tinggi, semakin banyak lead yang log harian atau ritmenya mulai longgar."
              />
              <MetricCard
                label="Follow-up Compliance"
                value={formatPercent(insights.follow_up_compliance_rate)}
                hint="Persentase lead yang follow-up schedule-nya belum overdue."
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Panel title="Boundary Alerts" description="Alert cepat per team atau unit untuk memutuskan intervensi paling mendesak.">
                <div className="space-y-3">
                  {insights.boundary_alerts.length === 0 ? (
                    <EmptyText text="Belum ada alert boundary yang cukup kuat." />
                  ) : (
                    insights.boundary_alerts.map((alert, index) => (
                      <article
                        key={`${alert.team_name}-${index}`}
                        className="rounded-[22px] border border-slate-200 bg-[#fffdf8] p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {alert.team_name}
                          </span>
                          {alert.unit_name ? (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {alert.unit_name}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              alert.severity === "high"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-950">
                          {alert.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {alert.description}
                        </p>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                          >
                            Buka area terkait
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </Panel>

              <Panel title="Coaching Priority" description="Case review yang paling perlu dibaca manager sekarang, diurutkan berdasarkan risiko dan umur chat.">
                <div className="space-y-3">
                  {insights.coaching_priority.length === 0 ? (
                    <EmptyText text="Belum ada coaching case aktif di scope ini." />
                  ) : (
                    insights.coaching_priority.map((item) => (
                      <CoachingPriorityCard key={item.review_case_id} item={item} />
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="Discipline by Team" description="Baca team mana yang mulai longgar, bukan sekadar melihat angka global.">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="px-3 py-3 font-medium">Team</th>
                        <th className="px-3 py-3 font-medium">Leads</th>
                        <th className="px-3 py-3 font-medium">Log Compliance</th>
                        <th className="px-3 py-3 font-medium">Follow-up</th>
                        <th className="px-3 py-3 font-medium">Coaching</th>
                        <th className="px-3 py-3 font-medium">Knowledge Queue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.team_discipline.map((row) => {
                        const teamKey = row.team_id ?? row.team_name;
                        const isExpanded =
                          row.team_id !== null && expandedTeamIds.includes(row.team_id);

                        return (
                          <Fragment key={teamKey}>
                            <tr className="border-b border-slate-100">
                              <td className="px-3 py-3 align-top">
                                {row.team_id ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleTeamMembers(row.team_id)}
                                    className="text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-950 hover:text-slate-700">
                                        {row.team_name}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                        {isExpanded ? "Hide members" : "Show members"}
                                      </span>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="font-semibold text-slate-950">{row.team_name}</div>
                                )}
                                <div className="text-xs text-slate-500">
                                  {row.unit_name ?? "Tanpa unit"} • Manager: {row.manager_user_name ?? "-"} • {row.member_count} member
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                {row.lead_count}
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                {formatPercent(row.discipline_compliance_rate)}
                                <div className="text-xs text-slate-500">
                                  {row.missing_or_stale_logs} stale/missing
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                {formatPercent(row.follow_up_compliance_rate)}
                                <div className="text-xs text-slate-500">
                                  {row.overdue_follow_ups} overdue
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                {row.open_coaching_cases}
                              </td>
                              <td className="px-3 py-3 align-top text-slate-700">
                                {row.pending_knowledge_proposals}
                              </td>
                            </tr>

                            {isExpanded ? (
                              <tr className="border-b border-slate-100 bg-slate-50/70">
                                <td colSpan={6} className="px-3 py-4">
                                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Anggota Team
                                    </p>
                                    {row.members.length === 0 ? (
                                      <p className="mt-3 text-sm text-slate-500">
                                        Belum ada anggota team yang bisa ditampilkan.
                                      </p>
                                    ) : (
                                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {row.members.map((member) => (
                                          <div
                                            key={member.id}
                                            className="rounded-[16px] border border-slate-200 bg-slate-50 p-3"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="text-sm font-semibold text-slate-950">
                                                {member.name}
                                              </p>
                                              <span
                                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                  member.is_active
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-200 text-slate-600"
                                                }`}
                                              >
                                                {member.is_active ? "Active" : "Inactive"}
                                              </span>
                                            </div>
                                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                                              {member.role}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Objection Trends" description="Top objection untuk membantu manager membaca pola hambatan yang berulang.">
                <div className="space-y-3">
                  {insights.objection_trends.length === 0 ? (
                    <EmptyText text="Belum ada objection trend yang cukup kuat di scope ini." />
                  ) : (
                    insights.objection_trends.map((item) => (
                      <div
                        key={item.objection}
                        className="rounded-[20px] border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">
                            {item.objection}
                          </p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {item.count} chat
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function CoachingPriorityCard({
  item,
}: {
  item: ManagerInsightsResponse["coaching_priority"][number];
}) {
  const action = getCoachingPriorityAction(item);

  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-950">{item.lead_name}</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {formatStatusLabel(item.review_status)}
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {item.review_label.replaceAll("_", " ")}
        </span>
        {item.risk_level ? (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
            Risk {item.risk_level}
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50/70 p-4">
        <p className="text-sm font-semibold text-slate-950">{action.title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {action.description}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {item.recommended_action ?? "Belum ada recommended action."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>Owner: {item.sales_owner_name ?? "-"}</span>
        <span>&bull;</span>
        <span>Reviewer: {item.reviewer_user_name ?? "-"}</span>
        <span>&bull;</span>
        <span>Score: {item.priority_score}</span>
        <span>&bull;</span>
        <span>Last message: {formatDateTime(item.latest_message_at)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {action.primaryHref ? (
          <Link
            href={action.primaryHref}
            className="inline-flex rounded-full bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {action.primaryLabel}
          </Link>
        ) : null}
        <Link
          href={`/dashboard/sales/conversations/${item.conversation_id}`}
          className="inline-flex rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          Buka Conversation
        </Link>
      </div>
    </article>
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
    <article className="clara-card rounded-[24px] p-5">
      <p className="clara-kicker text-xs text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clara-card rounded-[28px] p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-[#fffdf8] p-5 text-sm text-slate-600">
      {text}
    </div>
  );
}
