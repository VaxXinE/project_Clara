"use client";

import Link from "next/link";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { formatRelativeTime } from "@/lib/format";
import { isDecisionBucket } from "@/lib/review";
import { PRIORITY, REVIEW_BUCKET, plainJargon } from "@/lib/vocab";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  ManagerInsightsResponse,
} from "@/types/dashboard";

const DECISION_LIMIT = 3;
const TEAM_LIMIT = 5;
const ALERT_LIMIT = 2;

type Props = {
  queue: ChatReviewCenterResponse | null;
  insights: ManagerInsightsResponse | null;
  isLoading: boolean;
};

/**
 * Beranda Manager: tiga pertanyaan yang dijawab berurutan. Apa yang menunggu keputusanku, bagaimana kondisi tiap
 * Sales hari ini, dan adakah peringatan dari tim.
 */
export function ManagerHome({ queue, insights, isLoading }: Props) {
  const items = queue?.items ?? [];
  const decisions = items.filter((item) =>
    isDecisionBucket(item.review_bucket),
  );
  const waitingForSales = items.length - decisions.length;
  const staleDecisions = decisions.filter(
    (item) => item.age_bucket === "stale",
  ).length;
  const team = [...(insights?.sales_performance ?? [])]
    .sort(
      (left, right) =>
        right.coaching_signal.priority_score -
        left.coaching_signal.priority_score,
    )
    .slice(0, TEAM_LIMIT);
  const alerts = (insights?.boundary_alerts ?? []).slice(0, ALERT_LIMIT);

  return (
    <div className="space-y-6">
      <section
        data-onboarding-id="manager-home-next-action"
        aria-labelledby="manager-decisions-title"
        className="clara-card p-5 sm:p-6"
      >
        <p className="text-sm font-semibold text-clara-gold">
          Perlu keputusanmu
        </p>

        {isLoading ? (
          <p role="status" className="mt-3 text-sm clara-text-secondary">
            Memuat...
          </p>
        ) : decisions.length > 0 ? (
          <>
            <h2
              id="manager-decisions-title"
              className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl"
            >
              {decisions.length} kasus menunggu keputusanmu
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              {staleDecisions > 0
                ? `${staleDecisions} sudah menunggu lebih dari 3 hari. Mulai dari yang paling atas.`
                : "Sales menunggu kamu menyetujui, menolak, atau mengarahkan balasan ini."}
            </p>
            <ul className="mt-4 space-y-2">
              {decisions.slice(0, DECISION_LIMIT).map((item) => (
                <li key={item.conversation_id}>
                  <DecisionRow item={item} />
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Link
                href="/approvals"
                className="clara-button clara-button-primary"
              >
                {decisions.length > DECISION_LIMIT
                  ? `Lihat semua kasus (${decisions.length})`
                  : "Buka Review Sales"}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2
              id="manager-decisions-title"
              className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl"
            >
              Tidak ada yang menunggu keputusanmu
            </h2>
            <p className="mt-1 text-sm leading-6 clara-text-secondary">
              {waitingForSales > 0
                ? `${waitingForSales} chat sedang menunggu Sales bertindak. Kamu bisa memantaunya di Review Sales.`
                : "Semua balasan Sales sudah ditangani."}
            </p>
            {waitingForSales > 0 ? (
              <div className="mt-4">
                <Link
                  href="/approvals"
                  className="clara-button clara-button-secondary"
                >
                  Lihat chat yang menunggu Sales
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section
        data-onboarding-id="manager-home-metrics"
        aria-labelledby="manager-team-title"
        className="space-y-3"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="manager-team-title"
            className="text-base font-semibold clara-text-primary"
          >
            Tim hari ini
          </h2>
          <Link
            href="/manager-insights"
            className="text-sm font-semibold text-clara-gold hover:underline"
          >
            Lihat Monitor Tim
          </Link>
        </div>

        {isLoading ? null : team.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-clara-line p-4 text-sm clara-text-secondary">
            Belum ada Sales di timmu yang bisa dipantau.
          </p>
        ) : (
          <ul className="space-y-2">
            {team.map((sales) => (
              <li
                key={sales.sales_user_id}
                className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold clara-text-primary">
                    {sales.sales_name}
                  </h3>
                  <ValueTag
                    table={PRIORITY}
                    value={sales.coaching_signal.priority_label}
                  />
                  <span className="text-xs clara-text-muted">
                    {sales.latest_activity_at
                      ? `Terakhir aktif ${formatRelativeTime(sales.latest_activity_at)}`
                      : "Belum ada aktivitas"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 clara-text-secondary">
                  {plainJargon(sales.coaching_signal.primary_reason)}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Figure
                    label="Chat belum dibalas"
                    value={sales.needs_reply_count}
                    warn={sales.needs_reply_count > 0}
                  />
                  <Figure
                    label="Follow-up terlambat"
                    value={sales.overdue_follow_up_count}
                    warn={sales.overdue_follow_up_count > 0}
                  />
                  <Figure
                    label="Customer panas"
                    value={sales.hot_leads_count}
                  />
                  <Figure label="Lead aktif" value={sales.active_leads_count} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {alerts.length > 0 ? (
        <section aria-labelledby="manager-alerts-title" className="space-y-3">
          <h2
            id="manager-alerts-title"
            className="text-base font-semibold clara-text-primary"
          >
            Peringatan dari tim
          </h2>
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={`${alert.team_id}-${alert.title}`}
                className="flex flex-col gap-3 rounded-2xl border border-clara-warning-line bg-clara-warning-surface p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold clara-text-primary">
                    {plainJargon(alert.title)}
                  </p>
                  <p className="mt-1 text-sm leading-6 clara-text-secondary">
                    {plainJargon(alert.description)}
                  </p>
                </div>
                {alert.target_href ? (
                  <Link
                    href={alert.target_href}
                    className="clara-button clara-button-secondary shrink-0"
                  >
                    Lihat
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DecisionRow({ item }: { item: ChatReviewQueueItem }) {
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
