"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessManagerInsights, isHeadRole } from "@/lib/roles";
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
}, isHeadView: boolean) {
  if (item.review_status === "in_review") {
    return {
      title: isHeadView
        ? "Head perlu follow-up kasus ini sekarang"
        : "Manager harus review kasus ini sekarang",
      description:
        isHeadView
          ? "Baca conversation, lihat hambatan utamanya, lalu beri arahan yang tegas ke sales agar next action tidak menggantung."
          : "Baca conversation, pastikan masalah utamanya jelas, lalu isi coaching note atau putuskan apakah case ini perlu `needs_rework`, `coaching_done`, atau `escalated`.",
      primaryLabel: isHeadView ? "Buka Follow-up Center" : "Buka Chat Review Center",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "needs_rework") {
    return {
      title: isHeadView
        ? "Head perlu beri arahan revisi yang tegas"
        : "Manager harus beri arahan revisi yang tegas",
      description:
        isHeadView
          ? "Kasus ini belum selesai. Buka follow-up center, tulis arahan revisi ke sales, dan pastikan owner berikutnya jelas."
          : "Kasus ini belum selesai. Buka review center, tulis revisi yang harus dilakukan sales, dan pastikan next action tidak ambigu.",
      primaryLabel: "Lanjutkan Review",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "escalated") {
    return {
      title: isHeadView
        ? "Kasus ini perlu keputusan Head"
        : "Kasus ini perlu keputusan level lebih tinggi",
      description:
        isHeadView
          ? "Cek alasan eskalasinya, validasi risiko atau klaim sensitifnya, lalu putuskan arahan yang harus dibawa sales."
          : "Cek alasan eskalasinya, validasi risiko atau klaim sensitifnya, lalu tentukan apakah perlu dinaikkan lagi atau dikembalikan dengan arahan yang jelas.",
      primaryLabel: isHeadView ? "Buka Follow-up Center" : "Buka Chat Review Center",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.risk_level === "high") {
    return {
      title: isHeadView
        ? "Lead ini berisiko tinggi"
        : "Kasus ini berisiko tinggi",
      description:
        isHeadView
          ? "Jangan cukup baca summary. Head perlu buka conversation dan memastikan sales tidak jalan tanpa arahan di lead sensitif ini."
          : "Jangan cukup baca summary. Manager perlu buka conversation dan pastikan tidak ada jawaban yang berpotensi mis-selling atau klaim sensitif.",
      primaryLabel: "Buka Conversation",
      primaryHref: null,
    };
  }

  return {
    title: isHeadView
      ? "Head perlu pastikan arah follow-up-nya jelas"
      : "Manager perlu pastikan arah coaching-nya jelas",
    description:
      item.review_label === "unik"
        ? isHeadView
          ? "Kasus ini unik, jadi head perlu memastikan arahan utamanya terdokumentasi dan tidak hilang setelah dibaca."
          : "Kasus ini unik, jadi manager perlu memastikan insight utamanya terdokumentasi dan tidak hilang setelah dibaca."
        : isHeadView
          ? "Buka case ini dan pastikan sales mendapat arahan yang jelas, bukan cuma dibaca lalu dibiarkan."
          : "Buka case ini dan pastikan keputusan review-nya jelas, bukan cuma dibaca lalu ditinggalkan.",
    primaryLabel: isHeadView ? "Buka Follow-up Center" : "Buka Chat Review Center",
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
  const isHeadView = isHeadRole(currentUser?.role);

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
      eyebrow={isHeadView ? "Head command center" : "Manager command center"}
      title={isHeadView ? "Head Insights" : "Manager Insights"}
      description={
        isHeadView
          ? "Halaman ini dipakai head untuk membaca performa prospect tim, mencari lead yang berisiko, lalu menentukan follow-up dan arahan ke sales."
          : "Halaman ini dipakai manager untuk membaca disiplin tim, bottleneck follow-up, coaching case aktif, dan sinyal objection yang perlu diintervensi lebih dulu."
      }
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {insights ? (
            <div className="rounded-full border border-[#f0cb73]/18 bg-[#1d150d] px-4 py-2.5 text-sm text-[#d6bb84]">
              Generated: {formatDateTime(insights.generated_at)}
            </div>
          ) : null}
          <Link
            href={isHeadView ? "/dashboard/crm" : "/dashboard/approvals"}
            className="clara-button clara-button-primary"
          >
            {isHeadView ? "Buka Lead Management" : "Buka Chat Review Center"}
          </Link>
          {isHeadView ? (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Buka Follow-up Center
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading manager insights...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {insights && !isLoading && !errorMessage ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Scope Teams"
                value={String(insights.scope_team_count)}
                hint={
                  isHeadView
                    ? "Jumlah team yang saat ini masuk area pantau Head."
                    : "Jumlah team yang saat ini masuk boundary manager Anda."
                }
              />
              <MetricCard
                label="Total Leads"
                value={String(insights.total_leads)}
                hint={
                  isHeadView
                    ? "Prospect aktif yang perlu dijaga ritme dan arahnya."
                    : "Lead aktif yang perlu dijaga ritmenya di scope Anda."
                }
              />
              <MetricCard
                label="Stale Lead Ratio"
                value={formatPercent(insights.stale_lead_ratio)}
                hint={
                  isHeadView
                    ? "Semakin tinggi, semakin banyak prospect yang ritmenya mulai longgar dan perlu tekanan."
                    : "Semakin tinggi, semakin banyak lead yang log harian atau ritmenya mulai longgar."
                }
              />
              <MetricCard
                label="Follow-up Compliance"
                value={formatPercent(insights.follow_up_compliance_rate)}
                hint={
                  isHeadView
                    ? "Persentase prospect yang follow-up schedule-nya masih sehat."
                    : "Persentase lead yang follow-up schedule-nya belum overdue."
                }
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Panel
                title={isHeadView ? "Prospect Berisiko" : "Boundary Alerts"}
                description={
                  isHeadView
                    ? "Daftar cepat team atau unit yang perlu intervensi Head lebih dulu."
                    : "Alert cepat per team atau unit untuk memutuskan intervensi paling mendesak."
                }
              >
                <div className="space-y-3">
                  {insights.boundary_alerts.length === 0 ? (
                    <EmptyText text="Belum ada alert boundary yang cukup kuat." />
                  ) : (
                    insights.boundary_alerts.map((alert, index) => (
                      <article
                        key={`${alert.team_name}-${index}`}
                        className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                            {alert.team_name}
                          </span>
                          {alert.unit_name ? (
                            <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                              {alert.unit_name}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              alert.severity === "high"
                                ? "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                : "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-950">
                          {alert.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                          {alert.description}
                        </p>
                        {alert.target_href ? (
                          <Link
                            href={alert.target_href}
                            className="mt-4 inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                          >
                            Buka area terkait
                          </Link>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </Panel>

              <Panel
                title={isHeadView ? "Follow-up ke Sales" : "Coaching Priority"}
                description={
                  isHeadView
                    ? "Case yang paling perlu dibaca Head sekarang sebelum memberi arahan ke Sales."
                    : "Case review yang paling perlu dibaca manager sekarang, diurutkan berdasarkan risiko dan umur chat."
                }
              >
                <div className="space-y-3">
                  {insights.coaching_priority.length === 0 ? (
                    <EmptyText text="Belum ada coaching case aktif di scope ini." />
                  ) : (
                    insights.coaching_priority.map((item) => (
                      <CoachingPriorityCard
                        key={item.review_case_id}
                        item={item}
                        isHeadView={isHeadView}
                      />
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel
                title={isHeadView ? "Snapshot Per Team" : "Discipline by Team"}
                description={
                  isHeadView
                    ? "Lihat team mana yang mulai longgar, berisiko, atau butuh intervensi cepat."
                    : "Baca team mana yang mulai longgar, bukan sekadar melihat angka global."
                }
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#f0cb73]/12 text-[#b89a62]">
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
                            <tr className="border-b border-[#f0cb73]/10">
                              <td className="px-3 py-3 align-top">
                                {row.team_id ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleTeamMembers(row.team_id)}
                                    className="text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-950 hover:text-[#fff0c9]">
                                        {row.team_name}
                                      </span>
                                      <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f0cb73]">
                                        {isExpanded ? "Hide members" : "Show members"}
                                      </span>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="font-semibold text-slate-950">{row.team_name}</div>
                                )}
                                <div className="text-xs text-[#b89a62]">
                                  {row.unit_name ?? "Tanpa unit"} • Manager: {row.manager_user_name ?? "-"} • {row.member_count} member
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-[#fff0c9]">
                                {row.lead_count}
                              </td>
                              <td className="px-3 py-3 align-top text-[#fff0c9]">
                                {formatPercent(row.discipline_compliance_rate)}
                                <div className="text-xs text-[#b89a62]">
                                  {row.missing_or_stale_logs} stale/missing
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-[#fff0c9]">
                                {formatPercent(row.follow_up_compliance_rate)}
                                <div className="text-xs text-[#b89a62]">
                                  {row.overdue_follow_ups} overdue
                                </div>
                              </td>
                              <td className="px-3 py-3 align-top text-[#fff0c9]">
                                {row.open_coaching_cases}
                              </td>
                              <td className="px-3 py-3 align-top text-[#fff0c9]">
                                {row.pending_knowledge_proposals}
                              </td>
                            </tr>

                            {isExpanded ? (
                              <tr className="border-b border-[#f0cb73]/10 bg-[#1a130d]/70">
                                <td colSpan={6} className="px-3 py-4">
                                  <div className="rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                                      Anggota Team
                                    </p>
                                    {row.members.length === 0 ? (
                                      <p className="mt-3 text-sm text-[#b89a62]">
                                        Belum ada anggota team yang bisa ditampilkan.
                                      </p>
                                    ) : (
                                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {row.members.map((member) => (
                                          <div
                                            key={member.id}
                                            className="rounded-[16px] border border-[#f0cb73]/14 bg-[#1d150d] p-3"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="text-sm font-semibold text-slate-950">
                                                {member.name}
                                              </p>
                                              <span
                                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                  member.is_active
                                                    ? "border border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
                                                    : "border border-[#3c2c16] bg-[#22190f] text-[#c8ad75]"
                                                }`}
                                              >
                                                {member.is_active ? "Active" : "Inactive"}
                                              </span>
                                            </div>
                                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#b89a62]">
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

              <Panel
                title={isHeadView ? "Pola Objection Tim" : "Objection Trends"}
                description={
                  isHeadView
                    ? "Top objection untuk membantu Head membaca peluang, risiko, dan pola hambatan berulang."
                    : "Top objection untuk membantu manager membaca pola hambatan yang berulang."
                }
              >
                <div className="space-y-3">
                  {insights.objection_trends.length === 0 ? (
                    <EmptyText text="Belum ada objection trend yang cukup kuat di scope ini." />
                  ) : (
                    insights.objection_trends.map((item) => (
                      <div
                        key={item.objection}
                        className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">
                            {item.objection}
                          </p>
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
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
  isHeadView,
}: {
  item: ManagerInsightsResponse["coaching_priority"][number];
  isHeadView: boolean;
}) {
  const action = getCoachingPriorityAction(item, isHeadView);

  return (
    <article className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-950">{item.lead_name}</p>
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          {formatStatusLabel(item.review_status)}
        </span>
        <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
          {item.review_label.replaceAll("_", " ")}
        </span>
        {item.risk_level ? (
          <span className="rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
            Risk {item.risk_level}
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
        <p className="text-sm font-semibold text-slate-950">{action.title}</p>
        <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
          {action.description}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
        {item.recommended_action ?? "Belum ada recommended action."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#b89a62]">
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
            className="inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3.5 py-2 text-sm font-semibold text-[#140f08] hover:brightness-105"
          >
            {action.primaryLabel}
          </Link>
        ) : null}
        <Link
          href={`/dashboard/sales/conversations/${item.conversation_id}`}
          className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
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
    <article className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#140f08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#2f210f]">{hint}</p>
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
      <p className="mt-1 text-sm text-[#d6bb84]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5 text-sm text-[#d6bb84]">
      {text}
    </div>
  );
}
