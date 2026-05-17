"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import type {
  CurrentUser,
  MarketingInsightSnapshot,
  MarketingInsightsPreview,
} from "@/types/dashboard";

export default function MarketingInsightsPage() {
  const [insights, setInsights] = useState<MarketingInsightsPreview | null>(null);
  const [snapshots, setSnapshots] = useState<MarketingInsightSnapshot[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSnapshotList() {
    const snapshotData = await apiFetch<MarketingInsightSnapshot[]>(
      "/dashboard/marketing/insight-snapshots"
    );
    setSnapshots(snapshotData);
  }

  useEffect(() => {
    async function loadInsights() {
      try {
        const [insightData, snapshotData, me] = await Promise.all([
          apiFetch<MarketingInsightsPreview>("/dashboard/marketing/insights-preview"),
          apiFetch<MarketingInsightSnapshot[]>(
            "/dashboard/marketing/insight-snapshots"
          ),
          apiFetch<CurrentUser>("/auth/me"),
        ]);
        setInsights(insightData);
        setSnapshots(snapshotData);
        setCurrentUser(me);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat marketing insights."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInsights();
  }, []);

  async function handleGenerateSnapshot() {
    setIsGeneratingSnapshot(true);
    setErrorMessage("");

    try {
      await apiFetch<MarketingInsightSnapshot>(
        "/dashboard/marketing/insight-snapshots/generate",
        {
          method: "POST",
        }
      );

      const latestInsights = await apiFetch<MarketingInsightsPreview>(
        "/dashboard/marketing/insights-preview"
      );
      setInsights(latestInsights);
      await loadSnapshotList();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal generate insight snapshot."
      );
    } finally {
      setIsGeneratingSnapshot(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Strategic intelligence"
      title="Marketing Insights"
      description="Ringkasan yang membantu owner dan admin membaca kebutuhan pasar, area resistensi, dan prioritas konten berikutnya tanpa harus membongkar seluruh chat customer."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        insights ? (
          <>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
              Snapshot: {formatDateTime(insights.generated_at)}
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateSnapshot()}
              disabled={isGeneratingSnapshot}
              className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingSnapshot ? "Generating..." : "Generate Snapshot"}
            </button>
          </>
        ) : null
      }
    >
      <div className="space-y-6">

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading marketing insights...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {insights && !isLoading && !errorMessage && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Conversations"
                value={String(insights.total_conversations)}
                tone="slate"
              />
              <MetricCard
                label="Analysis Coverage"
                value={`${(insights.kpi_summary.analysis_coverage_rate * 100).toFixed(0)}%`}
                tone="blue"
              />
              <MetricCard
                label="Reply Sent Rate"
                value={`${(insights.kpi_summary.reply_sent_rate * 100).toFixed(0)}%`}
                tone="green"
              />
              <MetricCard
                label="High Risk Conversations"
                value={String(insights.kpi_summary.high_risk_conversation_count)}
                tone="red"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <Panel
                  title="Top Customer Objections"
                  description="Area resistensi yang paling sering muncul dan paling layak dijawab lewat edukasi atau konten."
                >
                  {insights.top_objections.length === 0 ? (
                    <EmptyText text="Belum ada objection yang cukup untuk dianalisis." />
                  ) : (
                    <div className="space-y-3">
                      {insights.top_objections.map((item) => (
                        <div
                          key={item.topic}
                          className="rounded-[20px] bg-slate-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.topic}
                            </p>
                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Recommended Content Angles"
                  description="Saran output marketing yang langsung bisa diprioritaskan berdasarkan percakapan terbaru."
                >
                  {insights.top_content_recommendations.length === 0 ? (
                    <EmptyText text="Belum ada rekomendasi konten yang cukup kuat." />
                  ) : (
                    <div className="space-y-4">
                      {insights.top_content_recommendations.map((item) => (
                        <article
                          key={`${item.title}-${item.suggested_format}`}
                          className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">
                              {item.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.priority === "high"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {item.rationale}
                          </p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Suggested format
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {formatStatusLabel(item.suggested_format)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Ready-to-use Content Briefs"
                  description="Brief ringkas yang bisa langsung dilempar ke content creator tanpa harus menyusun ulang insight mentah."
                >
                  {insights.content_briefs.length === 0 ? (
                    <EmptyText text="Belum ada brief yang cukup kuat untuk disiapkan." />
                  ) : (
                    <div className="space-y-4">
                      {insights.content_briefs.map((brief) => (
                        <article
                          key={`${brief.title}-${brief.suggested_format}`}
                          className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">
                              {brief.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                brief.urgency === "high"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {brief.urgency}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <BriefRow
                              label="Audience"
                              value={brief.audience_segment}
                            />
                            <BriefRow
                              label="Format"
                              value={formatStatusLabel(brief.suggested_format)}
                            />
                            <BriefRow
                              label="Tone"
                              value={formatStatusLabel(brief.tone)}
                            />
                            <BriefRow
                              label="CTA"
                              value={brief.call_to_action}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Key message
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {brief.key_message}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Recent Snapshots"
                  description="Bandingkan perubahan antar snapshot untuk membaca apakah arah tren sedang menguat, melemah, atau bergeser."
                >
                  {snapshots.length === 0 ? (
                    <EmptyText text="Belum ada snapshot. Generate snapshot pertama untuk mulai tracking." />
                  ) : (
                    <div className="space-y-4">
                      {snapshots.map((snapshot) => (
                        <article
                          key={snapshot.id}
                          className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-950">
                                {formatDateTime(snapshot.created_at)}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Period: {snapshot.period_start} s/d {snapshot.period_end}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {snapshot.scope_type}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <TrendRow
                              label="Conversations"
                              value={String(snapshot.total_conversations)}
                              delta={snapshot.comparison?.conversation_delta}
                            />
                            <TrendRow
                              label="Analyzed"
                              value={String(snapshot.total_analyzed_conversations)}
                              delta={snapshot.comparison?.analyzed_delta}
                            />
                            <TrendRow
                              label="Reply Sent Rate"
                              value={`${(snapshot.kpi_summary.reply_sent_rate * 100).toFixed(0)}%`}
                              delta={snapshot.comparison?.reply_sent_rate_delta}
                              asPercent
                            />
                            <TrendRow
                              label="Approved Reply Rate"
                              value={`${(snapshot.kpi_summary.approved_reply_rate * 100).toFixed(0)}%`}
                              delta={snapshot.comparison?.approved_reply_rate_delta}
                              asPercent
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel
                  title="Audience Signals"
                  description="Breakdown cepat intent, sentiment, dan stage percakapan agar tim tahu siapa yang mendekat ke keputusan."
                >
                  <BreakdownGroup
                    title="Buying Intent"
                    items={insights.buying_intent_breakdown}
                  />
                  <BreakdownGroup
                    title="Sentiment"
                    items={insights.sentiment_breakdown}
                  />
                  <BreakdownGroup
                    title="Pipeline Stage"
                    items={insights.pipeline_stage_breakdown}
                  />
                </Panel>

                <Panel
                  title="Operational KPI"
                  description="KPI pendukung untuk membaca kesehatan pipeline analysis dan workflow balasan tim."
                >
                  <div className="grid gap-3">
                    <KpiRow
                      label="Approved reply rate"
                      value={`${(insights.kpi_summary.approved_reply_rate * 100).toFixed(0)}%`}
                    />
                    <KpiRow
                      label="Lead temperature tracked"
                      value={String(
                        Object.values(insights.lead_temperature_breakdown).reduce(
                          (sum, count) => sum + count,
                          0
                        )
                      )}
                    />
                    <KpiRow
                      label="Risk signals tracked"
                      value={String(
                        Object.values(insights.risk_level_breakdown).reduce(
                          (sum, count) => sum + count,
                          0
                        )
                      )}
                    />
                  </div>
                </Panel>

                <Panel
                  title="Signals for Ads Specialist"
                  description="Sinyal yang lebih operasional untuk pengambilan keputusan budget, retargeting, dan angle creative."
                >
                  {insights.ads_signals.length === 0 ? (
                    <EmptyText text="Belum ada sinyal budget atau creative yang cukup kuat." />
                  ) : (
                    <div className="space-y-4">
                      {insights.ads_signals.map((signal) => (
                        <article
                          key={`${signal.title}-${signal.budget_shift}`}
                          className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">
                              {signal.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                signal.urgency === "high"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-sky-100 text-sky-700"
                              }`}
                            >
                              {signal.urgency}
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            <SignalBlock
                              label="Observation"
                              value={signal.observation}
                            />
                            <SignalBlock
                              label="Recommended move"
                              value={signal.recommendation}
                            />
                            <SignalBlock
                              label="Budget shift"
                              value={signal.budget_shift}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="30-day Content Plan"
                  description="Draft planning bulanan berbasis percakapan real, supaya tim konten tidak mulai dari kertas kosong."
                >
                  {insights.monthly_content_plan.length === 0 ? (
                    <EmptyText text="Belum ada plan yang cukup untuk dirangkai." />
                  ) : (
                    <div className="space-y-4">
                      {insights.monthly_content_plan.map((item) => (
                        <article
                          key={`${item.window_label}-${item.theme}`}
                          className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {item.window_label}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {formatStatusLabel(item.suggested_format)}
                            </span>
                          </div>
                          <p className="mt-3 text-base font-semibold text-slate-950">
                            {item.theme}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {item.objective}
                          </p>
                          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Primary metric
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {item.primary_metric}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
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
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "blue" | "green" | "red";
}) {
  const toneClass = {
    slate: "bg-white border-slate-200 text-slate-950",
    blue: "bg-blue-50 border-blue-200 text-blue-950",
    green: "bg-green-50 border-green-200 text-green-950",
    red: "bg-red-50 border-red-200 text-red-950",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${toneClass}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function BreakdownGroup({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {items.length === 0 ? (
        <EmptyText text="Belum ada data." />
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div
              key={`${title}-${item.label}`}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
            >
              <span className="text-sm text-slate-700">
                {formatStatusLabel(item.label)}
              </span>
              <span className="text-sm font-semibold text-slate-950">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-slate-600">{text}</p>;
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function SignalBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function TrendRow({
  label,
  value,
  delta,
  asPercent = false,
}: {
  label: string;
  value: string;
  delta?: number;
  asPercent?: boolean;
}) {
  const hasDelta = typeof delta === "number";
  const positive = hasDelta && delta > 0;
  const negative = hasDelta && delta < 0;

  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-semibold text-slate-950">{value}</span>
      </div>
      {hasDelta && (
        <p
          className={`mt-2 text-xs font-medium ${
            positive
              ? "text-green-700"
              : negative
                ? "text-red-700"
                : "text-slate-500"
          }`}
        >
          Delta: {delta > 0 ? "+" : ""}
          {asPercent ? `${(delta * 100).toFixed(0)}%` : delta}
        </p>
      )}
    </div>
  );
}
