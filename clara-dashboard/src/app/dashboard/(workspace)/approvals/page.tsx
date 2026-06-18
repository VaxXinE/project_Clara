"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getLeadBadgeClass,
  getRiskBadgeClass,
} from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  ChatReviewCenterResponse,
  ChatReviewQueueItem,
  CurrentUser,
} from "@/types/dashboard";

function formatAccountCategory(value: string): string {
  switch (value) {
    case "mini":
      return "Mini";
    case "reguler":
      return "Reguler";
    case "unknown":
      return "Belum ditentukan";
    default:
      return value.replaceAll("_", " ");
  }
}

function getAccountCategoryBadgeClass(value: string): string {
  switch (value) {
    case "mini":
      return "bg-emerald-100 text-emerald-700";
    case "reguler":
      return "bg-amber-100 text-amber-700";
    default:
      return "border border-[#d9bf87] bg-[#f7ebc9] text-[#6a4a17]";
  }
}

export default function ChatReviewCenterPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [queue, setQueue] = useState<ChatReviewCenterResponse | null>(null);
  const [reviewBucketFilter, setReviewBucketFilter] = useState("all");
  const [riskLevelFilter, setRiskLevelFilter] = useState("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState("all");
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  function buildQueuePath(filters?: {
    reviewBucket?: string;
    riskLevel?: string;
    ageBucket?: string;
    sourceChannel?: string;
  }) {
    const resolvedFilters = {
      reviewBucket: filters?.reviewBucket ?? reviewBucketFilter,
      riskLevel: filters?.riskLevel ?? riskLevelFilter,
      ageBucket: filters?.ageBucket ?? ageBucketFilter,
      sourceChannel: filters?.sourceChannel ?? sourceChannelFilter,
    };

    const query = new URLSearchParams();
    if (resolvedFilters.reviewBucket !== "all") {
      query.set("review_bucket", resolvedFilters.reviewBucket);
    }
    if (resolvedFilters.riskLevel !== "all") {
      query.set("risk_level", resolvedFilters.riskLevel);
    }
    if (resolvedFilters.ageBucket !== "all") {
      query.set("age_bucket", resolvedFilters.ageBucket);
    }
    if (resolvedFilters.sourceChannel !== "all") {
      query.set("source_channel", resolvedFilters.sourceChannel);
    }

    return query.size
      ? `/dashboard/sales/chat-review-center?${query.toString()}`
      : "/dashboard/sales/chat-review-center";
  }

  async function loadQueue(filters?: {
    reviewBucket?: string;
    riskLevel?: string;
    ageBucket?: string;
    sourceChannel?: string;
  }) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [me, data] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<ChatReviewCenterResponse>(buildQueuePath(filters)),
      ]);

      setCurrentUser(me);
      setQueue(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat review sales.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadQueue();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnalyze(conversationId: string) {
    const nextActionKey = `${conversationId}:analyze`;
    setActionKey(nextActionKey);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/analyze`, {
        method: "POST",
      });
      await loadQueue();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menjalankan AI analysis.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function handleGenerateReply(conversationId: string) {
    const nextActionKey = `${conversationId}:reply`;
    setActionKey(nextActionKey);
    setErrorMessage("");

    try {
      await apiFetch(`/conversations/${conversationId}/reply-suggestions`, {
        method: "POST",
      });
      await loadQueue();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal membuat draft balasan.",
      );
    } finally {
      setActionKey(null);
    }
  }

  const canAccessQueue = canAccessQueueAndActionCenter(currentUser?.role);
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const isHeadView = normalizedRole === "head";
  const isManagerView = normalizedRole === "manager";
  const fallbackHref = canAccessQueue
    ? "/dashboard/sales"
    : isHeadView
      ? "/dashboard/notifications"
      : "/dashboard/manager-insights";
  const reviewItems = queue?.items ?? [];
  const decisionCount = reviewItems.filter((item) =>
    ["pending_approval", "draft_review"].includes(item.review_bucket),
  ).length;
  const draftPrepCount = reviewItems.filter((item) =>
    ["needs_analysis", "needs_reply_suggestion", "needs_rework"].includes(
      item.review_bucket,
    ),
  ).length;
  const escalationCount = reviewItems.filter(
    (item) => item.review_bucket === "human_escalation",
  ).length;
  const readyToSendCount = reviewItems.filter(
    (item) => item.review_bucket === "ready_to_send",
  ).length;
  const topPriorityItem = [...reviewItems].sort(
    (left, right) => right.priority_score - left.priority_score,
  )[0] ?? null;
  const reviewDailySummary = isLoading
    ? "Clara sedang menyiapkan antrian review tim."
    : isHeadView
      ? decisionCount > 0 || escalationCount > 0
        ? `Ada ${decisionCount} item yang perlu keputusan Head dan ${escalationCount} item yang sudah naik eskalasi.`
        : "Antrian arahan tim relatif aman. Kalau perlu, lanjut cek Head Insight atau Lead Tim yang mulai melambat."
      : decisionCount > 0 || draftPrepCount > 0
        ? `Saat ini ada ${decisionCount} item yang butuh keputusan manager dan ${draftPrepCount} item yang masih butuh dipersiapkan dulu.`
        : "Antrian review sales relatif aman. Anda bisa cek item stale atau item yang siap dikirim."
  const activeFilterSummary = [
    reviewBucketFilter !== "all" ? `Bucket: ${formatStatusLabel(reviewBucketFilter)}` : null,
    riskLevelFilter !== "all" ? `Risk: ${riskLevelFilter}` : null,
    ageBucketFilter !== "all" ? `Age: ${formatStatusLabel(ageBucketFilter)}` : null,
    sourceChannelFilter !== "all"
      ? `Channel: ${sourceChannelFilter}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const reviewNextAction = topPriorityItem
    ? {
        title: isHeadView
          ? `${topPriorityItem.lead_name} paling layak diputuskan lebih dulu`
          : `${topPriorityItem.lead_name} paling layak dibuka dulu`,
        description:
          topPriorityItem.recommended_action ||
          (isHeadView
            ? "Mulai dari skor prioritas tertinggi supaya keputusan Head langsung kena ke bottleneck paling besar."
            : "Mulai dari item dengan skor prioritas tertinggi supaya review manager tidak keburu melebar."),
        href: `/dashboard/sales/conversations/${topPriorityItem.conversation_id}`,
        label: isHeadView ? "Buka Kasus Prioritas" : "Buka Review Utama",
      }
        : {
            title: "Belum ada item review yang menonjol",
            description:
              "Kalau daftar kosong, berarti belum ada percakapan yang butuh analisis, draft, atau keputusan tambahan.",
            href: fallbackHref,
            label: "Kembali ke Halaman Sebelumnya",
          };

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={isHeadView ? "Arahan Tim" : "Review workflow"}
      title={isHeadView ? "Arahan Tim" : "Review Sales"}
      description={
        isHeadView
          ? "Satu layar untuk membaca kasus yang perlu keputusan Head, melihat bottleneck follow-up, lalu menurunkan arahan yang jelas ke tim."
          : isManagerView
            ? "Satu layar untuk melihat balasan sales yang perlu keputusan, rework, atau eskalasi tanpa harus tenggelam di detail percakapan."
            : "Satu layar untuk mengecek balasan Sales yang perlu dilihat ulang, perlu draft baru, atau butuh keputusan sebelum lanjut."
      }
      backHref={fallbackHref}
      backLabel={
        canAccessQueue
          ? "Kembali ke Queue"
          : isHeadView
            ? "Kembali ke Alert Tim"
            : "Kembali ke Monitor Tim"
      }
      actions={
        <Link
          href={
            canAccessQueue
              ? "/dashboard/follow-up"
              : isHeadView
                ? "/dashboard/crm"
                : "/dashboard/manager-insights"
          }
          className="clara-button clara-button-primary"
        >
          {canAccessQueue
            ? "Buka Action Center"
            : isHeadView
              ? "Buka Lead Tim"
              : "Buka Monitor Tim"}
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading review sales...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {queue && !isLoading && !errorMessage && (
          <>
            <section className="clara-card rounded-[32px] p-6">
              <p className="clara-kicker text-xs">
                {isHeadView ? "Ringkasan arahan" : "Ringkasan review"}
              </p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {isHeadView
                      ? "Mulai dari kasus tim yang paling butuh keputusan Head"
                      : "Mulai dari balasan sales yang paling butuh keputusan"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {reviewDailySummary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={reviewNextAction.href}
                    className="clara-button clara-button-primary justify-center"
                  >
                    {reviewNextAction.label}
                  </Link>
                  <Link
                    href={isHeadView ? "/dashboard/manager-insights" : "/dashboard/crm"}
                    className="clara-button clara-button-ghost justify-center"
                  >
                    {isHeadView ? "Buka Head Insight" : "Buka Lead Tim"}
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <QueueMetric
                label={isHeadView ? "Perlu Keputusan Head" : "Butuh Keputusan"}
                value={String(decisionCount)}
                hint={
                  isHeadView
                    ? "Kasus yang sudah tidak cukup selesai di level manager."
                    : "Item yang perlu arahan, revisi, atau keputusan reviewer."
                }
              />
              <QueueMetric
                label={isHeadView ? "Masih perlu disiapkan" : "Butuh Persiapan"}
                value={String(draftPrepCount)}
                hint={
                  isHeadView
                    ? "Kasus yang belum cukup matang untuk diputuskan sekarang."
                    : "Item yang masih perlu analysis AI, draft, atau rework."
                }
              />
              <QueueMetric
                label="Eskalasi"
                value={String(escalationCount)}
                hint={
                  isHeadView
                    ? "Kasus yang sudah naik level dan perlu perhatian lebih tegas."
                    : "Item yang sudah terlalu sensitif untuk dibiarkan jalan sendiri."
                }
              />
              <QueueMetric
                label="Stale"
                value={String(queue.stale_count)}
                hint="Item yang sudah terlalu lama menunggu dan rawan makin melebar."
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
              <div className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-5 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f0cb73]">
                    {isHeadView ? "Saring daftar arahan" : "Saring daftar review"}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[#d6bb84]">
                    {isHeadView
                      ? "Kalau kasus mulai banyak, Head cukup mulai dari eskalasi, stale, atau risk tinggi dulu."
                      : "Pakai filter kalau item review sudah mulai banyak. Kalau belum, mulai saja dari item prioritas tertinggi di daftar bawah."}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-[#f0cb73]/12 bg-[#1b140e] px-4 py-3">
                  <span className="text-sm text-[#d8bc84]">
                    Menampilkan{" "}
                    <span className="font-semibold text-[#f0cb73]">
                      {queue.items.length}
                    </span>{" "}
                    item review
                  </span>
                  <span className="hidden h-4 w-px bg-[#f0cb73]/12 md:block" />
                  <span className="text-sm text-[#bfa36c]">
                    {activeFilterSummary || "Belum ada filter aktif"}
                  </span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Filter bucket</span>
                    <select
                      value={reviewBucketFilter}
                      onChange={(event) => setReviewBucketFilter(event.target.value)}
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                    >
                      <option value="all">Semua bucket</option>
                      <option value="needs_analysis">Butuh AI analysis</option>
                      <option value="needs_reply_suggestion">Butuh draft baru</option>
                      <option value="pending_approval">Pending approval</option>
                      <option value="draft_review">Draft siap direview</option>
                      <option value="human_escalation">Human escalation</option>
                      <option value="ready_to_send">Siap dikirim</option>
                      <option value="needs_rework">Perlu rework</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Filter risk</span>
                    <select
                      value={riskLevelFilter}
                      onChange={(event) => setRiskLevelFilter(event.target.value)}
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                    >
                      <option value="all">Semua risk</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Filter age</span>
                    <select
                      value={ageBucketFilter}
                      onChange={(event) => setAgeBucketFilter(event.target.value)}
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                    >
                      <option value="all">Semua age</option>
                      <option value="fresh">Fresh (&lt;24 jam)</option>
                      <option value="aging">Aging (24-72 jam)</option>
                      <option value="stale">Stale (&gt;72 jam)</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Filter channel</span>
                    <select
                      value={sourceChannelFilter}
                      onChange={(event) => setSourceChannelFilter(event.target.value)}
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none ring-0"
                    >
                      <option value="all">Semua channel</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="instagram">Instagram</option>
                      <option value="email">Email</option>
                      <option value="import">Import</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void loadQueue()}
                    className="clara-button clara-button-primary min-h-0 px-5 py-3"
                  >
                    Terapkan Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewBucketFilter("all");
                      setRiskLevelFilter("all");
                      setAgeBucketFilter("all");
                      setSourceChannelFilter("all");
                      void loadQueue({
                        reviewBucket: "all",
                        riskLevel: "all",
                        ageBucket: "all",
                        sourceChannel: "all",
                      });
                    }}
                    className="clara-button clara-button-ghost min-h-0 px-5 py-3"
                  >
                    Reset
                  </button>
                </div>
              </div>

            <section className="clara-card rounded-[28px] p-5">
                <p className="clara-kicker text-xs">Urutan kerja cepat</p>
                <div className="mt-4 space-y-3">
                  <StepHint
                    number="1"
                    title={isHeadView ? "Buka kasus prioritas tertinggi" : "Buka item paling prioritas"}
                    description={
                      isHeadView
                        ? "Mulai dari eskalasi, stale, atau skor tertinggi dulu."
                        : "Mulai dari skor tertinggi atau item yang sudah masuk bucket keputusan."
                    }
                  />
                  <StepHint
                    number="2"
                    title={isHeadView ? "Baca konteks dan dampaknya" : "Baca konteks singkat"}
                    description={
                      isHeadView
                        ? "Cek preview pesan, status draft, dan rekomendasi Clara."
                        : "Cek preview pesan customer dan tindakan yang direkomendasikan Clara."
                    }
                  />
                  <StepHint
                    number="3"
                    title={isHeadView ? "Turunkan keputusan yang jelas" : "Putuskan jalur berikutnya"}
                    description={
                      isHeadView
                        ? "Putuskan: cukup diarahkan ke manager, buka detail, atau naikkan lagi."
                        : "Lanjut analisis, bikin draft, buka conversation, atau turun ke lead."
                    }
                  />
                </div>
                <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {isHeadView ? "Sudah relatif aman:" : "Siap dikirim:"}
                  <span className="ml-2 font-semibold text-slate-950">
                    {readyToSendCount} item
                  </span>
                </div>
              </section>
            </section>

            <section className="space-y-4">
              {queue.items.length === 0 ? (
                <div className="clara-empty-state text-sm text-[#d6bb84]">
                  Tidak ada item review yang cocok dengan filter saat ini. Halaman ini hanya memuat chat yang benar-benar perlu analisis, draft, approval, escalation, atau sudah stale.
                </div>
              ) : (
                queue.items.map((item) => (
                  <ReviewCard
                    key={item.conversation_id}
                    item={item}
                    isHeadView={isHeadView}
                    actionKey={actionKey}
                    onAnalyze={handleAnalyze}
                    onGenerateReply={handleGenerateReply}
                  />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function ReviewCard({
  item,
  isHeadView,
  actionKey,
  onAnalyze,
  onGenerateReply,
}: {
  item: ChatReviewQueueItem;
  isHeadView: boolean;
  actionKey: string | null;
  onAnalyze: (conversationId: string) => Promise<void>;
  onGenerateReply: (conversationId: string) => Promise<void>;
}) {
  const isAnalyzing = actionKey === `${item.conversation_id}:analyze`;
  const isGeneratingReply = actionKey === `${item.conversation_id}:reply`;
  const showAnalyzeAction = item.review_bucket === "needs_analysis";
  const showGenerateReplyAction =
    item.review_bucket === "needs_reply_suggestion" ||
    item.review_bucket === "needs_rework";
  const reviewerFocus =
    item.review_bucket === "pending_approval"
        ? isHeadView
        ? "Draft ini sudah sampai ke keputusan akhir. Head cukup memastikan arah jawaban aman, konsisten, dan layak diteruskan."
        : "Draft ini sudah masuk tahap keputusan. Manager cukup cek apakah arah jawabannya aman, tepat, dan siap lanjut."
      : item.review_bucket === "draft_review"
        ? isHeadView
          ? "Draft sudah ada. Head tinggal menilai apakah mutu dan arahnya cukup kuat untuk dilanjutkan."
          : "Draft sudah tersedia, tapi masih perlu review manager sebelum dianggap layak jalan."
        : item.review_bucket === "human_escalation"
          ? isHeadView
            ? "Percakapan ini sudah masuk area sensitif. Head perlu memutuskan apakah cukup diarahkan ke manager atau butuh keputusan yang lebih tegas."
            : "Percakapan ini sudah terlalu sensitif untuk dibiarkan auto-flow. Butuh keputusan manusia."
          : item.review_bucket === "needs_rework"
            ? isHeadView
              ? "Draft sebelumnya belum cukup kuat. Head cukup menilai apakah ini masalah kualitas jawaban atau konteks customer yang naik level."
              : "Draft sebelumnya belum cukup kuat. Manager perlu cek apakah konteks customer berubah atau jawaban perlu diperjelas."
            : item.review_bucket === "needs_reply_suggestion"
              ? isHeadView
                ? "Draft final belum siap. Biasanya Head tidak perlu turun detail, kecuali kasus ini memang menahan proses tim."
                : "AI belum menyiapkan draft final. Ini cocok untuk dibantu generate ulang atau diturunkan ke review percakapan."
              : item.review_bucket === "ready_to_send"
                ? isHeadView
                  ? "Item ini relatif aman. Head cukup memastikan tidak ada pola risiko yang lolos."
                  : "Item ini relatif aman. Manager hanya perlu validasi akhir kalau mau jaga kualitas tim."
                : isHeadView
                  ? "Percakapan ini masih butuh AI analysis sebelum Head punya konteks cukup untuk ikut memutuskan."
                  : "Percakapan ini masih butuh AI analysis sebelum manager bisa mengambil keputusan yang cukup aman.";
  const nextDecision =
    showAnalyzeAction
      ? isHeadView
        ? "Lengkapi dulu konteks AI sebelum Head ikut turun."
        : "Jalankan AI analysis dulu."
      : showGenerateReplyAction
        ? isHeadView
          ? "Perkuat draft dulu, lalu cek lagi kalau kasusnya masih tertahan."
          : "Generate draft baru lalu review hasilnya."
        : item.latest_reply_suggestion?.approval_status === "approved"
          ? isHeadView
            ? "Buka conversation kalau perlu validasi akhir atau cek apakah kasus ini sudah aman diturunkan."
            : "Buka conversation untuk validasi akhir atau kirim."
          : item.review_bucket === "human_escalation"
            ? isHeadView
              ? "Buka conversation dan putuskan arah manual yang paling aman."
              : "Buka conversation dan putuskan arahan manual."
            : isHeadView
              ? "Buka conversation kalau perlu konteks penuh sebelum memberi arah."
              : "Buka conversation untuk review detail.";

  return (
    <article className="clara-card rounded-[28px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              {item.lead_name}
            </h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                item.lead_temperature,
              )}`}
            >
              {item.lead_temperature.toUpperCase()}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountCategoryBadgeClass(
                item.account_category,
              )}`}
            >
              {formatAccountCategory(item.account_category)}
            </span>
            {item.risk_level && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(
                  item.risk_level,
                )}`}
              >
                Risk {item.risk_level}
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getReviewBucketBadgeClass(
                item.review_bucket,
              )}`}
            >
              {item.review_label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAgeBucketBadgeClass(
                item.age_bucket,
              )}`}
            >
              {formatStatusLabel(item.age_bucket)}
            </span>
          </div>

          <p className="mt-2 text-sm text-[#d6bb84]">
            {item.conversation_title} &bull; {formatStatusLabel(item.current_stage)}{" "}
            &bull; {item.source_label}
          </p>
          <p className="mt-2 text-xs text-[#b89a62]">
            Owner: {item.sales_owner_name ?? "-"} &bull; Queue since:{" "}
            {formatDateTime(item.queue_since_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.latest_reply_suggestion && (
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
              {formatStatusLabel(item.latest_reply_suggestion.approval_status)}
            </span>
          )}
          {item.latest_reply_suggestion && (
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
              {formatStatusLabel(item.latest_reply_suggestion.action_mode)}
            </span>
          )}
          <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
            Score {item.priority_score}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="clara-card-soft rounded-2xl p-4">
          <p className="clara-kicker text-xs">Konteks terakhir</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#fff0c9]">
            {item.latest_message_preview ?? "Belum ada preview pesan terbaru."}
          </p>
          <p className="mt-3 text-xs text-[#b89a62]">
            Last message: {formatDateTime(item.latest_message_at)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(34,25,18,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
            <p className="clara-kicker text-xs">{isHeadView ? "Fokus Head" : "Fokus Manager"}</p>
            <p className="mt-3 text-sm leading-7 text-[#fff0c9]">
              {reviewerFocus}
            </p>
            <div className="mt-3 rounded-2xl border border-[#f0cb73]/12 bg-[#1c150f] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b9924b]">
                Langkah berikutnya
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#f3d89a]">
                {nextDecision}
              </p>
            </div>
          </div>

          <div className="clara-card-soft rounded-2xl p-4">
            <p className="clara-kicker text-xs">Arah yang disarankan Clara</p>
            <p className="mt-3 text-sm leading-7 text-[#fff0c9]">
              {item.recommended_action}
            </p>
          </div>

          {item.active_review_case_id ? (
            <div className="rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
              <p className="clara-kicker text-xs text-[#f0cb73]">
                Active Coaching Case
              </p>
              <p className="mt-3 text-sm font-semibold text-[#fff0c9]">
                {formatStatusLabel(item.active_review_status ?? "draft")} ·{" "}
                {(item.active_review_label ?? "unik").replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                Reviewer: {item.active_review_reviewer_name ?? "Belum ditunjuk"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <MetaCard
              label="AI Status"
              value={item.latest_ai_extraction ? "Ready" : "Pending"}
            />
            <MetaCard
              label="Draft Status"
              value={
                item.latest_reply_suggestion
                  ? formatStatusLabel(item.latest_reply_suggestion.approval_status)
                  : "Belum ada"
              }
            />
            <MetaCard
              label="Sent Status"
              value={item.latest_sent_message ? "Sent" : "Belum terkirim"}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {showAnalyzeAction && (
          <button
            type="button"
            onClick={() => void onAnalyze(item.conversation_id)}
            disabled={isAnalyzing}
            className="clara-button clara-button-primary"
          >
            {isAnalyzing ? "Analyzing..." : "Jalankan AI Analysis"}
          </button>
        )}

        {showGenerateReplyAction && (
          <button
            type="button"
            onClick={() => void onGenerateReply(item.conversation_id)}
            disabled={isGeneratingReply}
            className="clara-button clara-button-primary"
          >
            {isGeneratingReply ? "Generating..." : "Generate Draft Baru"}
          </button>
        )}

        <Link
          href={`/dashboard/sales/conversations/${item.conversation_id}`}
          className="clara-button clara-button-ghost"
        >
          {isHeadView ? "Buka Kasus Lengkap" : "Buka Conversation"}
        </Link>

        {item.lead_id && (
          <Link
            href={`/dashboard/crm/${item.lead_id}`}
            className="clara-button clara-button-ghost"
          >
            Buka Lead
          </Link>
        )}
      </div>
    </article>
  );
}

function QueueMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#140f08]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#140f08]">{value}</p>
      <p className="mt-2 text-sm text-[#2f210f]">{hint}</p>
    </article>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="clara-kicker text-[11px]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#fff0c9]">{value}</p>
    </div>
  );
}

function StepHint({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="clara-card-soft flex gap-3 rounded-2xl px-4 py-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function getReviewBucketBadgeClass(reviewBucket: string) {
  switch (reviewBucket) {
    case "human_escalation":
      return "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]";
    case "pending_approval":
    case "draft_review":
      return "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]";
    case "needs_analysis":
      return "border border-[#f0cb73]/18 bg-[#241a10] text-[#f0cb73]";
    case "needs_reply_suggestion":
    case "needs_rework":
      return "border border-[#f0cb73]/18 bg-[#2b2013] text-[#f0cb73]";
    case "ready_to_send":
      return "border border-[#f0cb73]/18 bg-[#1f170f] text-[#f0cb73]";
    default:
      return "border border-[#f0cb73]/18 bg-[#1d150d] text-[#f0cb73]";
  }
}

function getAgeBucketBadgeClass(ageBucket: string) {
  switch (ageBucket) {
    case "stale":
      return "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]";
    case "aging":
      return "border border-[#f0cb73]/18 bg-[#2c1f12] text-[#f0cb73]";
    default:
      return "border border-[#f0cb73]/18 bg-[#1d150d] text-[#f0cb73]";
  }
}
