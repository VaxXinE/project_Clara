"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { describeDelta } from "@/lib/vocab";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { canAccessStrategicInsights, getRoleDisplayLabel } from "@/lib/roles";
import {
  BUYING_INTENT,
  EXECUTION_STATUS,
  EXECUTION_TYPE,
  PRIORITY,
  SENTIMENT,
  STAGE,
  describeContentFormat,
  describeScopeLabel,
  plainJargon,
} from "@/lib/vocab";
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
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
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

function buildOutcomeDraftMap(items: MarketingExecutionItem[]): Record<string, ExecutionOutcomeDraft> {
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
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, ExecutionOutcomeDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [isCreatingExecutionItem, setIsCreatingExecutionItem] = useState(false);
  const [updatingExecutionItemId, setUpdatingExecutionItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");

  async function loadInsights() {
    setErrorMessage("");

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessStrategicInsights(me.role)) {
        router.replace("/dashboard");
        return;
      }

      const [insightData, snapshotData, scopedUsers] = await Promise.all([
        apiFetch<MarketingInsightsPreview>("/dashboard/marketing/insights-preview"),
        apiFetch<MarketingInsightSnapshot[]>("/dashboard/marketing/insight-snapshots"),
        apiFetch<CurrentUser[]>("/auth/users"),
      ]);
      setInsights(insightData);
      setOutcomeDrafts(buildOutcomeDraftMap(insightData.execution_items));
      setSnapshots(snapshotData);
      setUsers(
        scopedUsers.filter(
          (user) => user.is_active && (!me.organization_id || user.organization_id === me.organization_id),
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Insight pasar belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInsights();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleGenerateSnapshot() {
    setIsGeneratingSnapshot(true);
    setErrorMessage("");

    try {
      await apiFetch<MarketingInsightSnapshot>("/dashboard/marketing/insight-snapshots/generate", { method: "POST" });

      const latestInsights = await apiFetch<MarketingInsightsPreview>("/dashboard/marketing/insights-preview");
      setInsights(latestInsights);
      setOutcomeDrafts(buildOutcomeDraftMap(latestInsights.execution_items));
      setSnapshots(await apiFetch<MarketingInsightSnapshot[]>("/dashboard/marketing/insight-snapshots"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Insight belum bisa diperbarui. Coba lagi.");
    } finally {
      setIsGeneratingSnapshot(false);
    }
  }

  async function handleCreateExecutionItem(payload: MarketingExecutionItemCreateRequest) {
    setIsCreatingExecutionItem(true);
    setErrorMessage("");
    setCreatedMessage("");

    try {
      const createdItem = await apiFetch<MarketingExecutionItem>("/dashboard/marketing/execution-items", {
        method: "POST",
        body: payload,
      });

      setInsights((previous) =>
        previous ? { ...previous, execution_items: [createdItem, ...previous.execution_items] } : previous,
      );
      setOutcomeDrafts((current) => ({ ...current, ...buildOutcomeDraftMap([createdItem]) }));
      setCreatedMessage(`"${plainJargon(createdItem.title)}" sudah masuk Daftar kerja pemasaran.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tugas belum bisa dibuat. Coba lagi.");
    } finally {
      setIsCreatingExecutionItem(false);
    }
  }

  async function handleUpdateExecutionItem(itemId: string, payload: MarketingExecutionItemUpdateRequest) {
    setUpdatingExecutionItemId(itemId);
    setErrorMessage("");
    setCreatedMessage("");

    try {
      const updatedItem = await apiFetch<MarketingExecutionItem>(`/dashboard/marketing/execution-items/${itemId}`, {
        method: "PATCH",
        body: payload,
      });

      setInsights((previous) =>
        previous
          ? {
              ...previous,
              execution_items: previous.execution_items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
            }
          : previous,
      );
      setOutcomeDrafts((current) => ({ ...current, ...buildOutcomeDraftMap([updatedItem]) }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tugas belum bisa diperbarui. Coba lagi.");
    } finally {
      setUpdatingExecutionItemId(null);
    }
  }

  function setDraft(itemId: string, field: keyof ExecutionOutcomeDraft, value: string) {
    setOutcomeDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }));
  }

  function saveOutcome(itemId: string) {
    const draft = outcomeDrafts[itemId];

    void handleUpdateExecutionItem(itemId, {
      campaign_name: draft?.campaign_name || null,
      published_at: draft?.published_at ? new Date(draft.published_at).toISOString() : null,
      result_notes: draft?.result_notes || null,
      leads_generated: Number(draft?.leads_generated || 0),
      qualified_leads: Number(draft?.qualified_leads || 0),
      won_leads: Number(draft?.won_leads || 0),
      attributed_pipeline_value: Number(draft?.attributed_pipeline_value || 0),
      attributed_won_value: Number(draft?.attributed_won_value || 0),
      attributed_deposit_amount: Number(draft?.attributed_deposit_amount || 0),
    });
  }

  const topObjections = insights?.top_objections ?? [];
  const tasks = insights?.execution_items ?? [];
  const openTasks = tasks.filter((item) => item.status !== "done").length;
  const summary = {
    total_items: tasks.length,
    leads_generated: tasks.reduce((sum, item) => sum + item.leads_generated, 0),
    won_leads: tasks.reduce((sum, item) => sum + item.won_leads, 0),
    attributed_won_value: tasks.reduce((sum, item) => sum + item.attributed_won_value, 0),
  };

  const summaryTitle = !insights
    ? ""
    : topObjections.length > 0
      ? `Keraguan terbanyak customer: ${topObjections
          .slice(0, 3)
          .map((item) => item.topic)
          .join(", ")}`
      : "Belum ada pola keraguan yang menonjol";
  const summaryHelper = !insights
    ? ""
    : `Dari ${insights.total_conversations} percakapan, ${formatPercent(insights.kpi_summary.analysis_coverage_rate)} sudah dibaca Clara dan ${insights.kpi_summary.high_risk_conversation_count} berisiko tinggi. Mulai dari "Konten yang sebaiknya dibuat" di bawah.`;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.marketing}
      description="Apa yang ditanyakan dan diragukan customer, dan konten apa yang sebaiknya dibuat tim pemasaran."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        insights ? (
          <button
            type="button"
            onClick={() => void handleGenerateSnapshot()}
            disabled={isGeneratingSnapshot}
            className="clara-button clara-button-primary"
          >
            {isGeneratingSnapshot ? "Memperbarui..." : "Perbarui insight"}
          </button>
        ) : null
      }
    >
      <div className="space-y-6">
        {isLoading ? <LoadingState message="Memuat insight pasar..." /> : null}

        {!isLoading && errorMessage && !insights ? <ErrorState message={errorMessage} onRetry={() => void loadInsights()} /> : null}

        {errorMessage && insights ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {createdMessage ? (
          <div role="status" className="clara-alert clara-alert-success">
            {createdMessage}
          </div>
        ) : null}

        {insights && !isLoading ? (
          <>
            <section aria-labelledby="mkt-summary" className="clara-card p-5 sm:p-6">
              <h2 id="mkt-summary" className="break-words text-xl font-bold clara-text-primary sm:text-2xl">
                {summaryTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">{summaryHelper}</p>
              <p className="mt-1 text-xs clara-text-muted">
                Data per {formatRelativeTime(insights.generated_at)} ({formatDateTime(insights.generated_at)}). Ini pola
                dari percakapan, belum tentu sebab-akibat.
              </p>
            </section>

            {topObjections.length > 0 ? (
              <section aria-labelledby="mkt-objections" className="space-y-3">
                <h2 id="mkt-objections" className="text-lg font-bold clara-text-primary">
                  Hal yang diragukan customer
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {topObjections.map((item) => (
                    <li key={item.topic}>
                      <Tag tone="warn" className="px-3 py-1 text-sm">
                        {item.topic} · {item.count} percakapan
                      </Tag>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="mkt-content" className="space-y-3">
              <h2 id="mkt-content" className="text-lg font-bold clara-text-primary">
                Konten yang sebaiknya dibuat
              </h2>
              {insights.top_content_recommendations.length === 0 ? (
                <EmptyState title="Belum ada saran konten" description="Saran muncul setelah ada cukup percakapan yang dibaca Clara." />
              ) : (
                <ul className="space-y-3">
                  {insights.top_content_recommendations.map((item) => (
                    <li key={`${item.title}-${item.suggested_format}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(item.title)}</h3>
                        <ValueTag table={PRIORITY} value={item.priority} />
                      </div>
                      <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(item.rationale)}</p>
                      <p className="mt-2 text-sm clara-text-primary">
                        <span className="font-semibold">Bentuk: </span>
                        {describeContentFormat(item.suggested_format)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Brief siap pakai untuk tim konten ({insights.content_briefs.length})
              </summary>
              <div className="mt-3 space-y-3">
              {insights.content_briefs.length === 0 ? (
                <EmptyState title="Belum ada brief" description="Brief disusun otomatis dari keraguan customer yang paling sering muncul." />
              ) : (
                <ul className="space-y-3">
                  {insights.content_briefs.map((brief) => (
                    <li key={`${brief.title}-${brief.suggested_format}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(brief.title)}</h3>
                        <ValueTag table={PRIORITY} value={brief.urgency} />
                      </div>
                      <p className="mt-2 text-sm leading-6 clara-text-primary">{plainJargon(brief.key_message)}</p>
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <Fact label="Untuk siapa" value={plainJargon(brief.audience_segment)} />
                        <Fact label="Bentuk" value={describeContentFormat(brief.suggested_format)} />
                        <Fact label="Nada" value={plainJargon(brief.tone.replaceAll("_", " "))} />
                        <Fact label="Ajakan di akhir" value={plainJargon(brief.call_to_action)} />
                      </dl>
                      <button
                        type="button"
                        disabled={isCreatingExecutionItem}
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
                        className="clara-button clara-button-primary mt-4"
                      >
                        {isCreatingExecutionItem ? "Menyimpan..." : "Jadikan tugas"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </details>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Saran untuk iklan ({insights.ads_signals.length})
              </summary>
              <div className="mt-3 space-y-3">
              {insights.ads_signals.length === 0 ? (
                <EmptyState title="Belum ada saran iklan" description="Saran budget dan materi iklan muncul saat polanya cukup kuat." />
              ) : (
                <ul className="space-y-3">
                  {insights.ads_signals.map((signal) => (
                    <li key={`${signal.title}-${signal.budget_shift}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(signal.title)}</h3>
                        <ValueTag table={PRIORITY} value={signal.urgency} />
                      </div>
                      <dl className="mt-3 space-y-3 text-sm">
                        <Fact label="Yang terlihat" value={plainJargon(signal.observation)} />
                        <Fact label="Langkah yang disarankan" value={plainJargon(signal.recommendation)} />
                        <Fact label="Pengaturan budget" value={plainJargon(signal.budget_shift)} />
                      </dl>
                      <button
                        type="button"
                        disabled={isCreatingExecutionItem}
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
                        className="clara-button clara-button-primary mt-4"
                      >
                        {isCreatingExecutionItem ? "Menyimpan..." : "Jadikan tugas"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </details>

            <section aria-labelledby="mkt-board" className="space-y-3">
              <h2 id="mkt-board" className="text-lg font-bold clara-text-primary">
                Daftar kerja pemasaran
              </h2>
              <p className="text-sm clara-text-secondary">
                {summary.total_items > 0
                  ? `${summary.total_items} tugas (${openTasks} belum selesai). Hasilnya sejauh ini: ${summary.leads_generated} lead masuk, ${summary.won_leads} closing, nilai ${formatIdr(summary.attributed_won_value)}.`
                  : "Tugas yang kamu buat dari brief atau saran iklan muncul di sini, lengkap dengan penanggung jawab dan hasilnya."}
              </p>
              {insights.execution_items.length === 0 ? (
                <EmptyState title="Belum ada tugas" description="Tekan Jadikan tugas pada brief atau saran iklan di atas." />
              ) : (
                <ul className="space-y-3">
                  {insights.execution_items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      users={users}
                      draft={outcomeDrafts[item.id]}
                      busy={updatingExecutionItemId === item.id}
                      onUpdate={(payload) => void handleUpdateExecutionItem(item.id, payload)}
                      onDraft={(field, value) => setDraft(item.id, field, value)}
                      onSaveOutcome={() => saveOutcome(item.id)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Gambaran customer saat ini
              </summary>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <Breakdown title="Minat beli" table={BUYING_INTENT} items={insights.buying_intent_breakdown} />
                <Breakdown title="Suasana hati customer" table={SENTIMENT} items={insights.sentiment_breakdown} />
                <Breakdown title="Tahap percakapan" table={STAGE} items={insights.pipeline_stage_breakdown} />
              </div>
              <p className="mt-4 text-sm clara-text-secondary">
                Balasan terkirim {formatPercent(insights.kpi_summary.reply_sent_rate)}, disetujui{" "}
                {formatPercent(insights.kpi_summary.approved_reply_rate)}.
              </p>
            </details>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Rencana konten 30 hari ({insights.monthly_content_plan.length})
              </summary>
              {insights.monthly_content_plan.length === 0 ? (
                <p className="mt-3 text-sm clara-text-secondary">Belum ada rencana. Rencana disusun dari percakapan nyata.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {insights.monthly_content_plan.map((item) => (
                    <li key={`${item.window_label}-${item.theme}`} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone="gold">{plainJargon(item.window_label).replace(/^week /i, "Minggu ")}</Tag>
                        <span className="text-xs clara-text-muted">{describeContentFormat(item.suggested_format)}</span>
                      </div>
                      <h3 className="mt-2 break-words text-base font-semibold clara-text-primary">{plainJargon(item.theme)}</h3>
                      <p className="mt-1 text-sm leading-6 clara-text-secondary">{plainJargon(item.objective)}</p>
                      <p className="mt-2 text-xs clara-text-muted">Ukuran berhasil: {plainJargon(item.primary_metric)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </details>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Riwayat insight ({snapshots.length})
              </summary>
              {snapshots.length === 0 ? (
                <p className="mt-3 text-sm clara-text-secondary">Belum ada riwayat. Tekan Perbarui insight untuk menyimpan yang pertama.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {snapshots.map((snapshot) => (
                    <li key={snapshot.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                      <p className="text-sm font-semibold clara-text-primary">{formatDateTime(snapshot.created_at)}</p>
                      <p className="mt-1 text-xs clara-text-muted">
                        Periode {snapshot.period_start} s/d {snapshot.period_end} · {describeScopeLabel(snapshot.scope_type)}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                        <Trend label="Percakapan" value={String(snapshot.total_conversations)} delta={snapshot.comparison?.conversation_delta} />
                        <Trend label="Sudah dibaca Clara" value={String(snapshot.total_analyzed_conversations)} delta={snapshot.comparison?.analyzed_delta} />
                        <Trend
                          label="Balasan terkirim"
                          value={formatPercent(snapshot.kpi_summary.reply_sent_rate)}
                          delta={snapshot.comparison?.reply_sent_rate_delta}
                          percent
                        />
                        <Trend
                          label="Balasan disetujui"
                          value={formatPercent(snapshot.kpi_summary.approved_reply_rate)}
                          delta={snapshot.comparison?.approved_reply_rate_delta}
                          percent
                        />
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words leading-6 clara-text-primary">{value}</dd>
    </div>
  );
}

function Breakdown({
  title,
  table,
  items,
}: {
  title: string;
  table: Parameters<typeof ValueTag>[0]["table"];
  items: { label: string; count: number }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold clara-text-primary">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm clara-text-secondary">Belum ada data.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
              <ValueTag table={table} value={item.label} />
              <span className="font-semibold clara-text-primary">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Trend({ label, value, delta, percent = false }: { label: string; value: string; delta?: number; percent?: boolean }) {
  const change = typeof delta === "number" ? describeDelta(percent ? Math.round(delta * 100) : delta) : null;

  return (
    <div className="min-w-0">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 font-semibold clara-text-primary">{value}</dd>
      {change ? <p className="mt-0.5 text-xs clara-text-muted">{change.text}{percent && delta !== 0 ? " poin" : ""}</p> : null}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="clara-label">
        {label}
      </label>
      <input id={id} type="number" min="0" step="1" value={value} onChange={(event) => onChange(event.target.value)} className="clara-input mt-1 w-full" />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="clara-label">
        {label}
      </label>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="clara-input mt-1 w-full" />
    </div>
  );
}

function TaskCard({
  item,
  users,
  draft,
  busy,
  onUpdate,
  onDraft,
  onSaveOutcome,
}: {
  item: MarketingExecutionItem;
  users: CurrentUser[];
  draft: ExecutionOutcomeDraft | undefined;
  busy: boolean;
  onUpdate: (payload: MarketingExecutionItemUpdateRequest) => void;
  onDraft: (field: keyof ExecutionOutcomeDraft, value: string) => void;
  onSaveOutcome: () => void;
}) {
  const statusId = useId();
  const picId = useId();
  const notesId = useId();

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="break-words text-base font-semibold clara-text-primary">{plainJargon(item.title)}</h3>
        <ValueTag table={EXECUTION_TYPE} value={item.item_type} />
        <ValueTag table={PRIORITY} value={item.priority} />
        <ValueTag table={EXECUTION_STATUS} value={item.status} />
      </div>
      <p className="mt-2 text-sm leading-6 clara-text-secondary">{plainJargon(item.summary)}</p>
      <p className="mt-2 text-sm leading-6 clara-text-primary">
        <span className="font-semibold">Langkah yang disarankan: </span>
        {plainJargon(item.recommended_action)}
      </p>
      <p className="mt-1 text-xs clara-text-muted">
        Dibuat oleh {item.created_by_user_name ?? "Clara"} · Penanggung jawab: {item.assigned_user_name ?? "belum ada"}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={statusId} className="clara-label">
            Status
          </label>
          <select
            id={statusId}
            value={item.status}
            disabled={busy}
            onChange={(event) => onUpdate({ status: event.target.value })}
            className="clara-select mt-1 w-full"
          >
            {EXECUTION_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {EXECUTION_STATUS[option]?.label ?? option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={picId} className="clara-label">
            Penanggung jawab
          </label>
          <select
            id={picId}
            value={item.assigned_user_id ?? ""}
            disabled={busy}
            onChange={(event) => onUpdate({ assigned_user_id: event.target.value || null })}
            className="clara-select mt-1 w-full"
          >
            <option value="">Belum ada</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({getRoleDisplayLabel(user.role)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="mt-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-clara-gold">Catat hasil kampanye</summary>
        <div className="mt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Nama kampanye" value={draft?.campaign_name ?? ""} onChange={(value) => onDraft("campaign_name", value)} />
            <TextField label="Waktu tayang" type="datetime-local" value={draft?.published_at ?? ""} onChange={(value) => onDraft("published_at", value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField label="Lead masuk" value={draft?.leads_generated ?? "0"} onChange={(value) => onDraft("leads_generated", value)} />
            <NumberField label="Lead layak" value={draft?.qualified_leads ?? "0"} onChange={(value) => onDraft("qualified_leads", value)} />
            <NumberField label="Lead closing" value={draft?.won_leads ?? "0"} onChange={(value) => onDraft("won_leads", value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField label="Nilai pipeline (Rp)" value={draft?.attributed_pipeline_value ?? "0"} onChange={(value) => onDraft("attributed_pipeline_value", value)} />
            <NumberField label="Nilai closing (Rp)" value={draft?.attributed_won_value ?? "0"} onChange={(value) => onDraft("attributed_won_value", value)} />
            <NumberField label="Deposit (Rp)" value={draft?.attributed_deposit_amount ?? "0"} onChange={(value) => onDraft("attributed_deposit_amount", value)} />
          </div>
          <div>
            <label htmlFor={notesId} className="clara-label">
              Catatan hasil
            </label>
            <textarea
              id={notesId}
              rows={3}
              value={draft?.result_notes ?? ""}
              onChange={(event) => onDraft("result_notes", event.target.value)}
              className="clara-textarea mt-1 w-full"
            />
          </div>
          <button type="button" disabled={busy} onClick={onSaveOutcome} className="clara-button clara-button-secondary">
            {busy ? "Menyimpan..." : "Simpan hasil"}
          </button>
        </div>
      </details>

      {item.notes ? (
        <p className="mt-3 text-sm clara-text-secondary">
          <span className="font-semibold clara-text-primary">Catatan: </span>
          {item.notes}
        </p>
      ) : null}
    </li>
  );
}
