"use client";

import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import type {
  CurrentUser,
  MarketingExecutionItem,
  MarketingExecutionItemCreateRequest,
  MarketingExecutionItemUpdateRequest,
  MarketingInsightSnapshot,
  MarketingInsightsPreview,
} from "@/types/dashboard";

const EXECUTION_STATUS_OPTIONS = ["draft", "assigned", "in_progress", "done"];

type ExecutionOutcomeDraft = {
  campaign_name: string;
  published_at: string;
  leads_generated: string;
  qualified_leads: string;
  won_leads: string;
  attributed_pipeline_value: string;
  attributed_won_value: string;
  attributed_deposit_amount: string;
  result_notes: string;
};

function formatIdr(value: number): string {
  return `IDR ${value.toLocaleString("id-ID")}`;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default function MarketingInsightsPage() {
  const [insights, setInsights] = useState<MarketingInsightsPreview | null>(null);
  const [snapshots, setSnapshots] = useState<MarketingInsightSnapshot[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [outcomeDrafts, setOutcomeDrafts] = useState<
    Record<string, ExecutionOutcomeDraft>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [isCreatingExecutionItem, setIsCreatingExecutionItem] = useState(false);
  const [updatingExecutionItemId, setUpdatingExecutionItemId] = useState<string | null>(null);
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
        const [insightData, snapshotData, me, scopedUsers] = await Promise.all([
          apiFetch<MarketingInsightsPreview>("/dashboard/marketing/insights-preview"),
          apiFetch<MarketingInsightSnapshot[]>(
            "/dashboard/marketing/insight-snapshots"
          ),
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<CurrentUser[]>("/auth/users"),
        ]);
        setInsights(insightData);
        setSnapshots(snapshotData);
        setCurrentUser(me);
        setUsers(
          scopedUsers.filter(
            (user) =>
              user.is_active &&
              (!me.organization_id || user.organization_id === me.organization_id)
          )
        );
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

  useEffect(() => {
    if (!insights) {
      return;
    }

    setOutcomeDrafts((current) => {
      const next = { ...current };
      for (const item of insights.execution_items) {
        next[item.id] = {
          campaign_name: item.campaign_name ?? "",
          published_at: toDateTimeLocal(item.published_at),
          leads_generated: String(item.leads_generated),
          qualified_leads: String(item.qualified_leads),
          won_leads: String(item.won_leads),
          attributed_pipeline_value: String(item.attributed_pipeline_value),
          attributed_won_value: String(item.attributed_won_value),
          attributed_deposit_amount: String(item.attributed_deposit_amount),
          result_notes: item.result_notes ?? "",
        };
      }
      return next;
    });
  }, [insights]);

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

  async function handleCreateExecutionItem(
    payload: MarketingExecutionItemCreateRequest
  ) {
    setIsCreatingExecutionItem(true);
    setErrorMessage("");

    try {
      const createdItem = await apiFetch<MarketingExecutionItem>(
        "/dashboard/marketing/execution-items",
        {
          method: "POST",
          body: payload,
        }
      );

      setInsights((previous) =>
        previous
          ? {
              ...previous,
              execution_items: [createdItem, ...previous.execution_items],
            }
          : previous
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal membuat execution item marketing."
      );
    } finally {
      setIsCreatingExecutionItem(false);
    }
  }

  async function handleUpdateExecutionItem(
    itemId: string,
    payload: MarketingExecutionItemUpdateRequest
  ) {
    setUpdatingExecutionItemId(itemId);
    setErrorMessage("");

    try {
      const updatedItem = await apiFetch<MarketingExecutionItem>(
        `/dashboard/marketing/execution-items/${itemId}`,
        {
          method: "PATCH",
          body: payload,
        }
      );

      setInsights((previous) =>
        previous
          ? {
              ...previous,
              execution_items: previous.execution_items.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
              ),
            }
          : previous
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui execution item marketing."
      );
    } finally {
      setUpdatingExecutionItemId(null);
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
              className="clara-button clara-button-primary"
            >
              {isGeneratingSnapshot ? "Generating..." : "Generate Snapshot"}
            </button>
          </>
        ) : null
      }
    >
      <div className="space-y-6">

        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading marketing insights...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        )}

        {insights && !isLoading && !errorMessage && (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_45%,#f8fafc_100%)] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {insights.execution_items.length === 0
                      ? "Mulai dari insight yang paling siap dieksekusi"
                      : "Periksa execution item yang belum selesai lebih dulu"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {insights.execution_items.length === 0
                      ? "Kalau belum ada item kerja marketing, ubah content brief atau ads signal menjadi execution item supaya insight tidak berhenti sebagai bacaan."
                      : "Halaman ini paling berguna saat dipakai untuk menurunkan insight menjadi kerja nyata: assign PIC, ubah status, lalu isi outcome saat campaign atau konten sudah berjalan."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateSnapshot()}
                  disabled={isGeneratingSnapshot}
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingSnapshot ? "Menyegarkan..." : "Segarkan Insight"}
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Baca objection dan angle dulu"
                  description="Itu membantu Anda memahami kenapa brief atau signal tertentu muncul."
                />
                <UsageHint
                  title="2. Turunkan jadi execution item"
                  description="Begitu ada insight yang cukup jelas, ubah jadi item kerja agar bisa di-assign dan dilacak."
                />
                <UsageHint
                  title="3. Isi outcome setelah jalan"
                  description="Bagian outcome dipakai untuk menutup loop dari ide marketing ke hasil bisnis."
                />
              </div>
            </section>

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

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Execution Items"
                value={String(insights.execution_summary.total_items)}
                tone="slate"
              />
              <MetricCard
                label="Leads Generated"
                value={String(insights.execution_summary.leads_generated)}
                tone="blue"
              />
              <MetricCard
                label="Won Leads"
                value={String(insights.execution_summary.won_leads)}
                tone="green"
              />
              <MetricCard
                label="Attributed Won"
                value={formatIdr(insights.execution_summary.attributed_won_value)}
                tone="green"
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

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCreateExecutionItem({
                                  item_type: "content_brief",
                                  source_kind: "content_brief",
                                  title: brief.title,
                                  summary: brief.key_message,
                                  recommended_action: brief.call_to_action,
                                  priority: brief.urgency === "high" ? "high" : "medium",
                                  assigned_user_id: currentUser?.id ?? null,
                                })
                              }
                              disabled={isCreatingExecutionItem}
                              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isCreatingExecutionItem ? "Menyimpan..." : "Jadikan Execution Item"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Marketing Execution Board"
                  description="Daftar item kerja yang sudah diturunkan dari insight, supaya tim tahu mana yang masih draft, sudah di-assign, sedang dikerjakan, atau selesai."
                >
                  {insights.execution_items.length === 0 ? (
                    <EmptyText text="Belum ada execution item. Konversi content brief atau ads signal menjadi item kerja." />
                  ) : (
                    <div className="space-y-4">
                      {insights.execution_items.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">
                              {item.title}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {formatStatusLabel(item.item_type)}
                            </span>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {item.priority}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {item.summary}
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <SignalBlock label="Recommended action" value={item.recommended_action} />
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Ownership
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                Dibuat oleh {item.created_by_user_name ?? "System"}
                              </p>
                              <p className="mt-1 text-sm text-slate-700">
                                PIC: {item.assigned_user_name ?? "Belum di-assign"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Status
                              </span>
                              <select
                                value={item.status}
                                onChange={(event) =>
                                  void handleUpdateExecutionItem(item.id, {
                                    status: event.target.value,
                                  })
                                }
                                disabled={updatingExecutionItemId === item.id}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                              >
                                {EXECUTION_STATUS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {formatStatusLabel(option)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Assign PIC
                              </span>
                              <select
                                value={item.assigned_user_id ?? ""}
                                onChange={(event) =>
                                  void handleUpdateExecutionItem(item.id, {
                                    assigned_user_id: event.target.value || null,
                                  })
                                }
                                disabled={updatingExecutionItemId === item.id}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                              >
                                <option value="">Belum di-assign</option>
                                {users.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name} · {user.role}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Campaign Name
                              </span>
                              <input
                                type="text"
                                value={outcomeDrafts[item.id]?.campaign_name ?? ""}
                                onChange={(event) =>
                                  setOutcomeDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...current[item.id],
                                      campaign_name: event.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Published At
                              </span>
                              <input
                                type="datetime-local"
                                value={outcomeDrafts[item.id]?.published_at ?? ""}
                                onChange={(event) =>
                                  setOutcomeDrafts((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...current[item.id],
                                      published_at: event.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                              />
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <OutcomeNumberField
                              label="Leads Generated"
                              value={outcomeDrafts[item.id]?.leads_generated ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...current[item.id], leads_generated: value },
                                }))
                              }
                            />
                            <OutcomeNumberField
                              label="Qualified Leads"
                              value={outcomeDrafts[item.id]?.qualified_leads ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...current[item.id], qualified_leads: value },
                                }))
                              }
                            />
                            <OutcomeNumberField
                              label="Won Leads"
                              value={outcomeDrafts[item.id]?.won_leads ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...current[item.id], won_leads: value },
                                }))
                              }
                            />
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <OutcomeNumberField
                              label="Attributed Pipeline"
                              value={outcomeDrafts[item.id]?.attributed_pipeline_value ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    attributed_pipeline_value: value,
                                  },
                                }))
                              }
                            />
                            <OutcomeNumberField
                              label="Attributed Won"
                              value={outcomeDrafts[item.id]?.attributed_won_value ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    attributed_won_value: value,
                                  },
                                }))
                              }
                            />
                            <OutcomeNumberField
                              label="Attributed Deposit"
                              value={outcomeDrafts[item.id]?.attributed_deposit_amount ?? "0"}
                              onChange={(value) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    attributed_deposit_amount: value,
                                  },
                                }))
                              }
                            />
                          </div>

                          <label className="mt-4 block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Result Notes
                            </span>
                            <textarea
                              value={outcomeDrafts[item.id]?.result_notes ?? ""}
                              onChange={(event) =>
                                setOutcomeDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    result_notes: event.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </label>

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              disabled={updatingExecutionItemId === item.id}
                              onClick={() =>
                                void handleUpdateExecutionItem(item.id, {
                                  campaign_name:
                                    outcomeDrafts[item.id]?.campaign_name || null,
                                  published_at:
                                    outcomeDrafts[item.id]?.published_at
                                      ? new Date(
                                          outcomeDrafts[item.id].published_at
                                        ).toISOString()
                                      : null,
                                  result_notes:
                                    outcomeDrafts[item.id]?.result_notes || null,
                                  leads_generated: Number(
                                    outcomeDrafts[item.id]?.leads_generated || 0
                                  ),
                                  qualified_leads: Number(
                                    outcomeDrafts[item.id]?.qualified_leads || 0
                                  ),
                                  won_leads: Number(
                                    outcomeDrafts[item.id]?.won_leads || 0
                                  ),
                                  attributed_pipeline_value: Number(
                                    outcomeDrafts[item.id]?.attributed_pipeline_value || 0
                                  ),
                                  attributed_won_value: Number(
                                    outcomeDrafts[item.id]?.attributed_won_value || 0
                                  ),
                                  attributed_deposit_amount: Number(
                                    outcomeDrafts[item.id]?.attributed_deposit_amount || 0
                                  ),
                                })
                              }
                              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updatingExecutionItemId === item.id
                                ? "Menyimpan..."
                                : "Simpan Outcome"}
                            </button>
                          </div>

                          {item.notes && (
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Notes
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">
                                {item.notes}
                              </p>
                            </div>
                          )}
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

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCreateExecutionItem({
                                  item_type: "ads_signal",
                                  source_kind: "ads_signal",
                                  title: signal.title,
                                  summary: signal.observation,
                                  recommended_action: `${signal.recommendation} ${signal.budget_shift}`,
                                  priority: signal.urgency === "high" ? "high" : "medium",
                                  assigned_user_id: currentUser?.id ?? null,
                                })
                              }
                              disabled={isCreatingExecutionItem}
                              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isCreatingExecutionItem ? "Menyimpan..." : "Jadikan Execution Item"}
                            </button>
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

function UsageHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
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
    <div className={`clara-card rounded-[24px] p-5 ${toneClass}`}>
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
              className="clara-card-soft flex items-center justify-between rounded-xl px-3 py-2"
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
    <div className="clara-card-soft flex items-center justify-between rounded-xl px-4 py-3">
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
    <div className="clara-card-soft rounded-2xl px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function SignalBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl p-4">
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
    <div className="clara-card-soft rounded-xl px-4 py-3">
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

function OutcomeNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-400"
      />
    </label>
  );
}
