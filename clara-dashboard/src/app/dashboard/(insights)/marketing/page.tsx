"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canAccessStrategicInsights } from "@/lib/roles";
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

function buildOutcomeDraftMap(
  items: MarketingExecutionItem[],
): Record<string, ExecutionOutcomeDraft> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        campaign_name: item.campaign_name ?? "",
        published_at: toDateTimeLocal(item.published_at),
        leads_generated: String(item.leads_generated),
        qualified_leads: String(item.qualified_leads),
        won_leads: String(item.won_leads),
        attributed_pipeline_value: String(item.attributed_pipeline_value),
        attributed_won_value: String(item.attributed_won_value),
        attributed_deposit_amount: String(item.attributed_deposit_amount),
        result_notes: item.result_notes ?? "",
      },
    ]),
  );
}

export default function MarketingInsightsPage() {
  const router = useRouter();
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
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!canAccessStrategicInsights(me.role)) {
          router.replace("/dashboard");
          return;
        }

        const [insightData, snapshotData, scopedUsers] = await Promise.all([
          apiFetch<MarketingInsightsPreview>(
            "/dashboard/marketing/insights-preview"
          ),
          apiFetch<MarketingInsightSnapshot[]>(
            "/dashboard/marketing/insight-snapshots"
          ),
          apiFetch<CurrentUser[]>("/auth/users"),
        ]);
        setInsights(insightData);
        setOutcomeDrafts(buildOutcomeDraftMap(insightData.execution_items));
        setSnapshots(snapshotData);
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
  }, [router]);

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
      setOutcomeDrafts(buildOutcomeDraftMap(latestInsights.execution_items));
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
      setOutcomeDrafts((current) => ({
        ...current,
        ...buildOutcomeDraftMap([createdItem]),
      }));
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
      setOutcomeDrafts((current) => ({
        ...current,
        ...buildOutcomeDraftMap([updatedItem]),
      }));
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
      description="Ringkasan yang membantu superadmin dan head membaca kebutuhan pasar, area resistensi, dan prioritas konten berikutnya tanpa harus membongkar seluruh chat customer."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        insights ? (
          <>
            <div className="rounded-full border border-[#f0cb73]/18 bg-[#1f1810] px-4 py-2.5 text-sm text-slate-200">
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
          <div className="clara-empty-state text-sm text-slate-300">
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
                        <article
                          key={item.topic}
                          className="clara-card-soft rounded-[20px] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-100">
                              {item.topic}
                            </p>
                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                              {item.count}
                            </span>
                          </div>
                        </article>
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
                          className="clara-card-soft rounded-[22px] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-100">
                              {item.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.priority === "high"
                                  ? "bg-red-600/15 text-red-200"
                                  : "bg-amber-600/15 text-amber-200"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">
                            {item.rationale}
                          </p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Suggested format
                          </p>
                          <p className="mt-1 text-sm text-slate-100">
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
                          className="clara-card rounded-[24px] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-100">
                              {brief.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                brief.urgency === "high"
                                  ? "bg-red-600/15 text-red-200"
                                  : "bg-amber-600/15 text-amber-200"
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

                          <div className="mt-4 rounded-2xl bg-[rgba(31,24,17,0.9)] p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Key message
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-200">
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
                          className="clara-card rounded-[24px] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-100">
                              {item.title}
                            </h3>
                            <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-slate-100">
                              {formatStatusLabel(item.item_type)}
                            </span>
                            <span className="rounded-full bg-amber-600/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                              {item.priority}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            {item.summary}
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <SignalBlock label="Recommended action" value={item.recommended_action} />
                            <div className="rounded-2xl bg-[rgba(31,24,17,0.9)] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Ownership
                              </p>
                              <p className="mt-2 text-sm text-slate-300">
                                Dibuat oleh {item.created_by_user_name ?? "System"}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">
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
                                className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
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
                                className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
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
                                className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
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
                                className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
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
                              className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
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
                            <div className="mt-4 rounded-2xl bg-[rgba(31,24,17,0.9)] p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Notes
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
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
                          className="clara-card-soft rounded-[22px] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-100">
                                {formatDateTime(snapshot.created_at)}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Period: {snapshot.period_start} s/d {snapshot.period_end}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-slate-100">
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
                          className="clara-card rounded-[24px] p-5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-100">
                              {signal.title}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                signal.urgency === "high"
                                  ? "bg-red-600/15 text-red-200"
                                  : "bg-sky-600/15 text-sky-200"
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
                          className="clara-card-soft rounded-[22px] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {item.window_label}
                            </h3>
                            <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-slate-100">
                              {formatStatusLabel(item.suggested_format)}
                            </span>
                          </div>
                          <p className="mt-3 text-base font-semibold text-slate-100">
                            {item.theme}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {item.objective}
                          </p>
                          <div className="mt-4 rounded-2xl bg-[rgba(31,24,17,0.9)] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Primary metric
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-100">
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
    <section className="clara-card rounded-[28px] p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
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
    slate: "bg-[linear-gradient(180deg,rgba(31,24,17,0.98)_0%,rgba(21,16,12,0.98)_100%)] border border-[#f0cb73]/12 text-[#f8e8c1]",
    blue: "bg-[linear-gradient(180deg,rgba(10,29,50,0.95)_0%,rgba(6,18,36,0.94)_100%)] border border-[#7dd3fc]/20 text-sky-100",
    green: "bg-[linear-gradient(180deg,rgba(10,30,24,0.95)_0%,rgba(7,22,16,0.94)_100%)] border border-[#4ade80]/20 text-emerald-100",
    red: "bg-[linear-gradient(180deg,rgba(59,15,15,0.95)_0%,rgba(38,9,9,0.94)_100%)] border border-[#f87171]/20 text-rose-100",
  }[tone];

  return (
    <div className={`clara-card rounded-[24px] p-5 ${toneClass}`}>
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
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
              <span className="text-sm text-slate-300">
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
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-slate-300">{text}</p>;
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function SignalBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{value}</p>
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
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-slate-100">{value}</span>
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
        className="w-full rounded-2xl border border-[#4b3c24] bg-[#120d08] px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#7dd3fc]/50"
      />
    </label>
  );
}
