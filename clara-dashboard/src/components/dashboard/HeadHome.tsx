"use client";

import Link from "next/link";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { formatRelativeTime, formatRupiah } from "@/lib/format";
import { isDecisionBucket } from "@/lib/review";
import {
  ALERT_SEVERITY,
  PRIORITY,
  REVIEW_BUCKET,
  plainJargon,
} from "@/lib/vocab";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  KpiCommandCenterResponse,
  ManagerInsightsResponse,
  OpsNotificationItem,
} from "@/types/dashboard";

const LIST_LIMIT = 3;
const TEAM_LIMIT = 6;
const SEVERITY_ORDER = ["critical", "high", "warning", "medium", "low", "info"];

type Props = {
  queue: ChatReviewCenterResponse | null;
  insights: ManagerInsightsResponse | null;
  /** Peringatan lintas tim yang masih terbuka untuk Head. */
  alerts: OpsNotificationItem[];
  kpi: KpiCommandCenterResponse | null;
  isLoading: boolean;
};

/**
 * Beranda Head: apa yang naik ke kamu, bagaimana kondisi tiap tim, dan angka bisnis dalam satu layar.
 * Detailnya ada di Arahan Tim, Alert Tim, Monitor Tim, dan Dashboard Operasional.
 */
export function HeadHome({ queue, insights, alerts, kpi, isLoading }: Props) {
  const decisions = (queue?.items ?? []).filter((item) =>
    isDecisionBucket(item.review_bucket),
  );
  const sortedAlerts = [...alerts].sort(
    (left, right) =>
      SEVERITY_ORDER.indexOf(left.severity) -
      SEVERITY_ORDER.indexOf(right.severity),
  );
  const nothingWaiting = decisions.length === 0 && alerts.length === 0;
  const teams = [...(insights?.team_performance ?? [])]
    .sort(
      (left, right) =>
        right.coaching_signal.priority_score -
        left.coaching_signal.priority_score,
    )
    .slice(0, TEAM_LIMIT);
  const summary = kpi?.summary;

  return (
    <div className="space-y-6">
      <section
        data-onboarding-id="head-home-next-action"
        aria-labelledby="head-decisions-title"
        className="clara-card p-5 sm:p-6"
      >
        <p className="text-sm font-semibold text-clara-gold">
          Perlu keputusanmu
        </p>

        {isLoading ? (
          <p role="status" className="mt-3 text-sm clara-text-secondary">
            Memuat...
          </p>
        ) : nothingWaiting ? (
          <>
            <h2
              id="head-decisions-title"
              className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl"
            >
              Tidak ada yang menunggu keputusanmu
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              Tidak ada kasus yang naik ke kamu dan tidak ada peringatan lintas
              tim yang terbuka. Cek kondisi tiap tim di bawah.
            </p>
          </>
        ) : (
          <>
            <h2
              id="head-decisions-title"
              className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl"
            >
              {decisions.length + alerts.length} hal menunggu keputusanmu
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              {decisions.length} kasus dari tim dan {alerts.length} peringatan
              lintas tim.
            </p>

            {decisions.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold clara-text-primary">
                  Kasus yang naik ke kamu
                </h3>
                <ul className="space-y-2">
                  {decisions.slice(0, LIST_LIMIT).map((item) => (
                    <li key={item.conversation_id}>
                      <CaseRow item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sortedAlerts.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold clara-text-primary">
                  Peringatan lintas tim
                </h3>
                <ul className="space-y-2">
                  {sortedAlerts.slice(0, LIST_LIMIT).map((alert) => (
                    <li key={alert.id}>
                      <Link
                        href="/notifications"
                        className="clara-card-soft flex flex-col gap-1 p-4 hover:border-clara-gold focus-visible:border-clara-gold"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold clara-text-primary">
                            {plainJargon(alert.title)}
                          </p>
                          <ValueTag
                            table={ALERT_SEVERITY}
                            value={alert.severity}
                          />
                        </div>
                        <p className="line-clamp-2 text-sm leading-6 clara-text-secondary">
                          {plainJargon(alert.body)}
                        </p>
                        <p className="text-xs clara-text-muted">
                          {alert.team_name ??
                            alert.sales_owner_name ??
                            "Lintas tim"}{" "}
                          ·{" "}
                          {formatRelativeTime(
                            alert.triggered_at ?? alert.created_at,
                          )}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {decisions.length > 0 ? (
                <Link
                  href="/approvals"
                  className="clara-button clara-button-primary"
                >
                  Buka Arahan Tim{" "}
                  {decisions.length > LIST_LIMIT ? `(${decisions.length})` : ""}
                </Link>
              ) : null}
              {alerts.length > 0 ? (
                <Link
                  href="/notifications"
                  className={`clara-button ${decisions.length > 0 ? "clara-button-secondary" : "clara-button-primary"}`}
                >
                  Buka Alert Tim{" "}
                  {alerts.length > LIST_LIMIT ? `(${alerts.length})` : ""}
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section
        data-onboarding-id="head-home-metrics"
        aria-labelledby="head-teams-title"
        className="space-y-3"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="head-teams-title"
            className="text-base font-semibold clara-text-primary"
          >
            Kondisi tiap tim
          </h2>
          <Link
            href="/manager-insights"
            className="text-sm font-semibold text-clara-gold hover:underline"
          >
            Lihat Monitor Tim
          </Link>
        </div>

        {isLoading ? null : teams.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-clara-line p-4 text-sm clara-text-secondary">
            Belum ada tim yang bisa dipantau.
          </p>
        ) : (
          <ul className="space-y-2">
            {teams.map((team) => (
              <li
                key={team.team_id ?? team.team_name}
                className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold clara-text-primary">
                    {team.team_name}
                  </h3>
                  <ValueTag
                    table={PRIORITY}
                    value={team.coaching_signal.priority_label}
                  />
                  <span className="text-xs clara-text-muted">
                    Manager: {team.manager_user_name ?? "belum ada"} ·{" "}
                    {team.member_count} Sales
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 clara-text-secondary">
                  {plainJargon(team.coaching_signal.primary_reason)}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Figure label="Lead aktif" value={team.active_leads_count} />
                  <Figure
                    label="Chat belum dibalas"
                    value={team.needs_reply_count}
                    warn={team.needs_reply_count > 0}
                  />
                  <Figure
                    label="Follow-up terlambat"
                    value={team.overdue_follow_up_count}
                    warn={team.overdue_follow_up_count > 0}
                  />
                  <Figure label="Customer panas" value={team.hot_leads_count} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary ? (
        <section aria-labelledby="head-business-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="head-business-title"
              className="text-base font-semibold clara-text-primary"
            >
              Angka bisnis
            </h2>
            <Link
              href="/kpi"
              className="text-sm font-semibold text-clara-gold hover:underline"
            >
              Buka Dashboard Operasional
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat
              label="Nilai pipeline"
              value={formatRupiah(summary.pipeline_value)}
              hint="Deal yang masih berjalan"
            />
            <Stat
              label="Nilai closing"
              value={formatRupiah(summary.won_value)}
              hint="Deal yang sudah menang"
            />
            <Stat
              label="Tingkat closing"
              value={`${Math.round(summary.win_rate * 100)}%`}
              hint="Menang dari deal yang selesai"
            />
            <Stat
              label="Lead aktif"
              value={String(summary.total_leads)}
              hint={`${summary.hot_leads} panas`}
            />
            <Stat
              label="Siap closing"
              value={String(summary.closing_leads)}
              hint="Tinggal diselesaikan"
            />
            <Stat
              label="Follow-up terlambat"
              value={String(summary.overdue_follow_ups)}
              hint="Sudah lewat jadwal"
            />
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function CaseRow({ item }: { item: ChatReviewQueueItem }) {
  return (
    <Link
      href={`/sales/conversations/${item.conversation_id}`}
      className="clara-card-soft flex flex-col gap-2 p-4 hover:border-clara-gold focus-visible:border-clara-gold sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold clara-text-primary">
            {item.lead_name}
          </p>
          <ValueTag table={REVIEW_BUCKET} value={item.review_bucket} />
          {item.risk_level === "high" ? (
            <Tag tone="danger">Risiko tinggi</Tag>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-1 text-sm clara-text-secondary">
          {item.latest_message_preview ?? "Belum ada pesan."}
        </p>
        <p className="mt-0.5 text-xs clara-text-muted">
          Sales: {item.sales_owner_name ?? "belum ada"} · menunggu{" "}
          {formatRelativeTime(item.queue_since_at).replace(" lalu", "")}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-clara-gold">
        Tinjau
      </span>
    </Link>
  );
}

function Figure({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-lg font-bold ${warn ? "text-clara-warning" : "clara-text-primary"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="clara-card-soft p-4">
      <dt className="text-sm clara-text-secondary">{label}</dt>
      <dd className="mt-1 break-words text-2xl font-bold clara-text-primary">
        {value}
      </dd>
      <p className="mt-0.5 text-xs clara-text-muted">{hint}</p>
    </div>
  );
}
