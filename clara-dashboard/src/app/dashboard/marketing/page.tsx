"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import type {
  MarketingInsightSnapshot,
  MarketingInsightsPreview,
} from "@/types/dashboard";

export default function MarketingInsightsPage() {
  const [insights, setInsights] = useState<MarketingInsightsPreview | null>(null);
  const [snapshots, setSnapshots] = useState<MarketingInsightSnapshot[]>([]);
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
        const [insightData, snapshotData] = await Promise.all([
          apiFetch<MarketingInsightsPreview>("/dashboard/marketing/insights-preview"),
          apiFetch<MarketingInsightSnapshot[]>(
            "/dashboard/marketing/insight-snapshots"
          ),
        ]);
        setInsights(insightData);
        setSnapshots(snapshotData);
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/dashboard/sales"
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              ← Back to Sales Inbox
            </Link>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Clara Marketing Intelligence
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Marketing Insights
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Ringkasan tren customer, rekomendasi konten, dan KPI untuk bantu
              tim marketing menentukan prioritas campaign berikutnya.
            </p>
          </div>

          {insights && (
            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                Generated: {formatDateTime(insights.generated_at)}
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateSnapshot()}
                disabled={isGeneratingSnapshot}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingSnapshot ? "Generating..." : "Generate Snapshot"}
              </button>
            </div>
          )}
        </section>

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
                  description="Area resistensi yang paling sering muncul di chat customer."
                >
                  {insights.top_objections.length === 0 ? (
                    <EmptyText text="Belum ada objection yang cukup untuk dianalisis." />
                  ) : (
                    <div className="space-y-3">
                      {insights.top_objections.map((item) => (
                        <div
                          key={item.topic}
                          className="rounded-xl bg-slate-50 p-4"
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
                  description="Saran output marketing yang langsung bisa diprioritaskan."
                >
                  {insights.top_content_recommendations.length === 0 ? (
                    <EmptyText text="Belum ada rekomendasi konten yang cukup kuat." />
                  ) : (
                    <div className="space-y-4">
                      {insights.top_content_recommendations.map((item) => (
                        <article
                          key={`${item.title}-${item.suggested_format}`}
                          className="rounded-2xl border border-slate-200 p-4"
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
                  title="Recent Snapshots"
                  description="Bandingkan perubahan antar snapshot untuk membaca arah tren."
                >
                  {snapshots.length === 0 ? (
                    <EmptyText text="Belum ada snapshot. Generate snapshot pertama untuk mulai tracking." />
                  ) : (
                    <div className="space-y-4">
                      {snapshots.map((snapshot) => (
                        <article
                          key={snapshot.id}
                          className="rounded-2xl border border-slate-200 p-4"
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
                  description="Breakdown intent, sentiment, dan stage percakapan."
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
                  description="Kesehatan pipeline analysis dan reply workflow."
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
              </div>
            </section>
          </>
        )}
      </div>
    </main>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
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
