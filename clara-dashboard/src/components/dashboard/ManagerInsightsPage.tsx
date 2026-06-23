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
        ? "Kasus ini perlu perhatian Head sekarang"
        : "Manager perlu review kasus ini sekarang",
      description:
        isHeadView
          ? "Baca conversation, lihat hambatan utamanya, lalu beri arahan yang tegas ke sales agar next action tidak menggantung."
          : "Baca conversation, pastikan masalah utamanya jelas, lalu isi coaching note atau putuskan apakah case ini perlu `needs_rework`, `coaching_done`, atau `escalated`.",
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
      primaryHref: "/dashboard/approvals",
    };
  }

  if (item.review_status === "needs_rework") {
    return {
      title: isHeadView
        ? "Kasus ini perlu arahan revisi dari Head"
        : "Manager perlu beri arahan revisi yang tegas",
      description:
        isHeadView
          ? "Kasus ini belum selesai. Buka Arahan Tim, tulis revisi yang tegas ke sales, lalu pastikan owner berikutnya jelas."
          : "Kasus ini belum selesai. Buka review center, tulis revisi yang harus dilakukan sales, dan pastikan next action tidak ambigu.",
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Lanjutkan Review",
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
      primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
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
        ? "Head perlu memastikan arah follow-up-nya jelas"
        : "Manager perlu pastikan arah coaching-nya jelas",
    description:
      item.review_label === "unik"
        ? isHeadView
          ? "Kasus ini unik, jadi Head perlu memastikan arahan utamanya terdokumentasi dan tidak hilang setelah dibaca."
          : "Kasus ini unik, jadi manager perlu memastikan insight utamanya terdokumentasi dan tidak hilang setelah dibaca."
        : isHeadView
          ? "Buka case ini dan pastikan sales mendapat arahan yang jelas, bukan cuma dibaca lalu dibiarkan."
          : "Buka case ini dan pastikan keputusan review-nya jelas, bukan cuma dibaca lalu ditinggalkan.",
    primaryLabel: isHeadView ? "Buka Arahan Tim" : "Buka Review Sales",
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
  const teamRows = insights?.team_discipline ?? [];
  const reviewCases = insights?.coaching_priority ?? [];
  const boundaryAlerts = insights?.boundary_alerts ?? [];
  const objectionTrends = insights?.objection_trends ?? [];
  const topBoundaryAlert = boundaryAlerts[0] ?? null;
  const topReviewCase = reviewCases[0] ?? null;
  const priorityTeamRows = [...teamRows].sort((left, right) => {
    const leftScore =
      left.overdue_follow_ups * 4 +
      left.missing_or_stale_logs * 3 +
      left.open_coaching_cases * 2 +
      left.pending_knowledge_proposals;
    const rightScore =
      right.overdue_follow_ups * 4 +
      right.missing_or_stale_logs * 3 +
      right.open_coaching_cases * 2 +
      right.pending_knowledge_proposals;

    return rightScore - leftScore;
  });
  const topTeamRows = priorityTeamRows.slice(0, 4);
  const monitorUrgencyCount =
    (insights?.overdue_follow_up_count ?? 0) +
    (insights?.open_coaching_case_count ?? 0) +
    boundaryAlerts.length;
  const teamHealthTone =
    (insights?.follow_up_compliance_rate ?? 0) >= 0.8
      ? "Ritme tim masih sehat"
      : (insights?.follow_up_compliance_rate ?? 0) >= 0.6
        ? "Ritme tim mulai longgar"
        : "Ritme tim butuh intervensi cepat";
  const monitorSummary = isHeadView
    ? `Mulai dari ${boundaryAlerts.length} area risiko utama, lalu turun hanya ke ${reviewCases.length} case yang benar-benar butuh keputusan Head.`
    : `Manager cukup mulai dari ${monitorUrgencyCount} item penting: overdue, coaching case aktif, dan boundary alert yang bikin ritme tim melambat.`;
  const monitorNextAction = topBoundaryAlert
    ? `Prioritas pertama: cek ${topBoundaryAlert.team_name} karena "${topBoundaryAlert.title}" sudah muncul sebagai sinyal utama.`
    : topReviewCase
      ? isHeadView
        ? `Prioritas pertama: buka case ${topReviewCase.lead_name} lalu pastikan arahan akhirnya jelas dan tidak berhenti di level manager saja.`
        : `Prioritas pertama: buka case ${topReviewCase.lead_name} lalu putuskan arahan yang paling jelas untuk sales.`
      : isHeadView
        ? "Belum ada alert besar. Pakai halaman ini untuk membaca pola hambatan antar tim dan mendeteksi area yang mulai longgar sebelum membesar."
        : "Belum ada alert besar. Pakai halaman ini untuk cek tim dengan overdue tertinggi dan menjaga ritme follow-up tetap rapi.";

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
      eyebrow={isHeadView ? "Ringkasan Head" : "Manager monitoring"}
      title={isHeadView ? "Head Insight" : "Monitor Tim"}
      description={
        isHeadView
          ? "Halaman ini dipakai Head untuk membaca ritme lintas tim, melihat area berisiko, lalu memutuskan intervensi tanpa tenggelam di detail operasional."
          : "Halaman ini dipakai manager untuk melihat progres tim, hambatan follow-up, case yang perlu direview, dan area yang butuh arahan lebih dulu."
      }
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {insights ? (
            <div className="rounded-full border border-[#f0cb73]/18 bg-[#1d150d] px-4 py-2.5 text-sm text-[#d6bb84]">
              Data: {formatDateTime(insights.generated_at)}
            </div>
          ) : null}
          <Link
            href={isHeadView ? "/dashboard/notifications" : "/dashboard/approvals"}
            className="clara-button clara-button-primary"
          >
            {isHeadView ? "Buka Alert Tim" : "Buka Review Sales"}
          </Link>
          {isHeadView ? (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Buka Arahan Tim
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            {isHeadView ? "Loading head insight..." : "Loading monitor tim..."}
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {insights && !isLoading && !errorMessage ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_320px]">
              <section className="clara-card rounded-[32px] p-6">
                <div className="max-w-4xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                    {isHeadView ? "Head insight" : "Prioritas monitor"}
                  </p>
                  <h2 className="mt-3 text-[clamp(2rem,3vw,2.6rem)] font-semibold leading-tight text-[#fff4d6]">
                    {isHeadView
                      ? "Lihat area tim yang mulai longgar, lalu putuskan intervensi Head"
                      : "Lihat tim yang mulai macet dulu, baru turun ke case review"}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-[#d6bb84]">
                    {monitorSummary}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                        Scope aktif
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[#fff0c9]">
                        {isHeadView ? "Cakupan pantau Head" : insights.scope_label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                        {insights.scope_team_count} tim • {insights.scope_member_count} member yang sedang masuk area pantau.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                        Ringkasan cepat
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[#fff0c9]">
                        {isHeadView
                          ? boundaryAlerts.length > 0
                            ? "Ada area yang perlu keputusan Head"
                            : teamHealthTone
                          : teamHealthTone}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                        {monitorNextAction}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#f0cb73]/14 bg-[#1b140e] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                      Aksi cepat
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                      {isHeadView
                        ? "Setelah baca halaman ini, biasanya Head lanjut ke Alert Tim atau Arahan Tim untuk menurunkan keputusan yang lebih tegas."
                        : "Buka area kerja yang paling sering dipakai manager setelah membaca monitor tim."}
                    </p>
                    <Link
                      href={isHeadView ? "/dashboard/notifications" : "/dashboard/approvals"}
                      className="clara-button clara-button-primary mt-4 w-full justify-center px-5 py-3"
                    >
                      {isHeadView ? "Buka Alert Tim" : "Buka Review Sales"}
                    </Link>
                    <Link
                      href={isHeadView ? "/dashboard/approvals" : "/dashboard/sales"}
                      className="clara-button clara-button-ghost mt-3 w-full justify-center px-5 py-3"
                    >
                      {isHeadView ? "Buka Arahan Tim" : "Lihat Queue Sales"}
                    </Link>
                  </div>
                </div>
              </section>

              <section className="clara-card rounded-[32px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                  Urutan baca cepat
                </p>
                <div className="mt-5 space-y-4">
                  <ManagerStepItem
                    step="01"
                    title={isHeadView ? "Lihat area risiko paling menonjol" : "Cek tim paling bermasalah"}
                    description={
                      isHeadView
                        ? "Mulai dari boundary alert, overdue tertinggi, dan gap follow-up yang paling terasa."
                        : "Mulai dari overdue, stale log, dan boundary alert yang paling tinggi dulu."
                    }
                  />
                  <ManagerStepItem
                    step="02"
                    title={isHeadView ? "Turun ke case yang butuh keputusan" : "Turun ke case coaching"}
                    description={
                      isHeadView
                        ? "Setelah tahu area timnya, buka hanya case yang memang perlu penegasan arah atau keputusan level Head."
                        : "Setelah tahu timnya, baru buka case review yang memang butuh keputusan."
                    }
                  />
                  <ManagerStepItem
                    step="03"
                    title={isHeadView ? "Baca pola hambatan yang berulang" : "Lihat pola hambatan tim"}
                    description={
                      isHeadView
                        ? "Pakai objection trend untuk melihat masalah yang layak dijadikan arahan umum lintas tim."
                        : "Pakai objection trend untuk lihat masalah yang berulang dan layak dijadikan arahan tim."
                    }
                  />
                </div>
              </section>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={isHeadView ? "Perlu Keputusan" : "Item Mendesak"}
                value={String(monitorUrgencyCount)}
                hint={
                  isHeadView
                    ? "Gabungan boundary alert, overdue, dan case yang perlu dibaca Head."
                    : "Gabungan overdue, coaching aktif, dan boundary alert yang perlu ditangani manager."
                }
              />
              <MetricCard
                label="Follow-up Overdue"
                value={String(insights.overdue_follow_up_count)}
                hint={
                  isHeadView
                    ? "Semakin tinggi, semakin banyak lead tim yang perlu perhatian lintas sales."
                    : "Jumlah lead yang ritme follow-up-nya sudah lewat dari jalur aman."
                }
              />
              <MetricCard
                label="Kepatuhan Follow-up"
                value={formatPercent(insights.follow_up_compliance_rate)}
                hint={
                  isHeadView
                    ? "Menunjukkan seberapa rapi ritme follow-up seluruh tim yang dipantau Head."
                    : "Angka global untuk baca apakah ritme tim masih sehat atau mulai longgar."
                }
              />
              <MetricCard
                label={isHeadView ? "Case Arahan" : "Case Coaching"}
                value={String(insights.open_coaching_case_count)}
                hint={
                  isHeadView
                    ? "Case yang perlu dibaca head sebelum memberi arahan lintas tim."
                    : "Case review aktif yang masih perlu keputusan atau arahan manager."
                }
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <Panel
                title={isHeadView ? "Area Risiko yang Perlu Dibaca Dulu" : "Alert yang Perlu Dicek Dulu"}
                description={
                  isHeadView
                    ? "Ini daftar area yang sebaiknya dibaca Head dulu sebelum turun ke lead atau case tertentu."
                    : "Mulai dari daftar ini dulu supaya manager tidak tenggelam di semua data tim sekaligus."
                }
              >
                <div className="space-y-3">
                  {boundaryAlerts.length === 0 ? (
                    <EmptyText text="Belum ada alert boundary yang cukup kuat." />
                  ) : (
                    boundaryAlerts.slice(0, 4).map((alert, index) => (
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
                        <p className="mt-3 text-base font-semibold text-[#fff0c9]">
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
                title={isHeadView ? "Case yang Butuh Keputusan Head" : "Case Review yang Harus Dibaca"}
                description={
                  isHeadView
                    ? "Setelah baca alert di kiri, lanjutkan hanya ke case yang memang perlu keputusan atau validasi Head."
                    : "Case ini yang paling cepat memberi dampak kalau manager ambil keputusan sekarang."
                }
              >
                <div className="space-y-3">
                  {reviewCases.length === 0 ? (
                    <EmptyText text="Belum ada coaching case aktif di scope ini." />
                  ) : (
                    reviewCases.slice(0, 3).map((item) => (
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
                title={isHeadView ? "Tim yang Perlu Dipantau" : "Ringkasan Kondisi Tiap Tim"}
                description={
                  isHeadView
                    ? "Tidak semua tim harus dibaca penuh. Fokus ke tim dengan gap follow-up, stale log, atau case paling terasa dulu."
                    : "Bagian ini menggantikan tabel besar supaya manager bisa cepat tahu tim mana yang butuh intervensi."
                }
              >
                <div className="space-y-4">
                  {topTeamRows.length === 0 ? (
                    <EmptyText text="Belum ada data team yang bisa diringkas." />
                  ) : (
                    topTeamRows.map((row) => {
                      const teamKey = row.team_id ?? row.team_name;
                      const isExpanded =
                        row.team_id !== null && expandedTeamIds.includes(row.team_id);

                      return (
                        <Fragment key={teamKey}>
                          <TeamHealthCard
                            row={row}
                            isExpanded={isExpanded}
                            onToggle={toggleTeamMembers}
                          />

                          {isExpanded ? (
                            <div className="rounded-[20px] border border-[#f0cb73]/12 bg-[#1a130d]/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                                Anggota tim
                              </p>
                              {row.members.length === 0 ? (
                                <p className="mt-3 text-sm text-[#b89a62]">
                                  Belum ada anggota team yang bisa ditampilkan.
                                </p>
                              ) : (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {row.members.map((member) => (
                                    <div
                                      key={member.id}
                                      className="rounded-[16px] border border-[#f0cb73]/14 bg-[#1d150d] p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-[#fff0c9]">
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
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </div>
              </Panel>

              <Panel
                title={isHeadView ? "Pola Hambatan Tim" : "Objection yang Paling Sering Muncul"}
                description={
                  isHeadView
                    ? "Head bisa pakai ini untuk melihat pola hambatan yang layak dijadikan arahan umum tim."
                    : "Kalau hambatan yang sama terus muncul, berarti manager perlu kasih arahan yang lebih sistematis ke sales."
                }
              >
                <div className="space-y-3">
                  {objectionTrends.length === 0 ? (
                    <EmptyText text="Belum ada objection trend yang cukup kuat di scope ini." />
                  ) : (
                    objectionTrends.slice(0, 6).map((item) => (
                      <div
                        key={item.objection}
                        className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#fff0c9]">
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
        <p className="font-semibold text-[#fff0c9]">{item.lead_name}</p>
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
        <p className="text-sm font-semibold text-[#fff0c9]">{action.title}</p>
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
      <h2 className="text-lg font-semibold text-[#fff0c9]">{title}</h2>
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

function ManagerStepItem({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#f0cb73]/14 bg-[#1b140e] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#f0cb73]/16 bg-[#f0cb73]/10 text-sm font-semibold text-[#f0cb73]">
          {step}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#fff0c9]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6bb84]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function TeamHealthCard({
  row,
  isExpanded,
  onToggle,
}: {
  row: ManagerInsightsResponse["team_discipline"][number];
  isExpanded: boolean;
  onToggle: (teamId: string | null) => void;
}) {
  return (
    <article className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[#fff0c9]">{row.team_name}</p>
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
              {row.lead_count} lead
            </span>
          </div>
          <p className="mt-2 text-sm text-[#b89a62]">
            {row.unit_name ?? "Tanpa unit"} • Manager: {row.manager_user_name ?? "-"} • {row.member_count} member
          </p>
        </div>

        {row.team_id ? (
          <button
            type="button"
            onClick={() => onToggle(row.team_id)}
            className="inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-3.5 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
          >
            {isExpanded ? "Sembunyikan anggota" : "Lihat anggota"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeamMiniMetric
          label="Log discipline"
          value={formatPercent(row.discipline_compliance_rate)}
          hint={`${row.missing_or_stale_logs} stale/missing`}
        />
        <TeamMiniMetric
          label="Follow-up"
          value={formatPercent(row.follow_up_compliance_rate)}
          hint={`${row.overdue_follow_ups} overdue`}
        />
        <TeamMiniMetric
          label="Coaching"
          value={String(row.open_coaching_cases)}
          hint="case aktif"
        />
        <TeamMiniMetric
          label="Knowledge"
          value={String(row.pending_knowledge_proposals)}
          hint="proposal pending"
        />
      </div>
    </article>
  );
}

function TeamMiniMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#f0cb73]/12 bg-[#1b140e] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[#fff0c9]">{value}</p>
      <p className="mt-1 text-xs text-[#d6bb84]">{hint}</p>
    </div>
  );
}
