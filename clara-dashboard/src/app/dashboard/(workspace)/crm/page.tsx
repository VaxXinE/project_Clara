"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CloseLeadDialog } from "@/components/dashboard/CloseLeadDialog";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { buildOpenChatLinkFor } from "@/lib/conversation";
import {
  formatChannelLabel,
  formatClock,
  formatDayLabel,
  formatRelativeTime,
} from "@/lib/format";
import { isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import { QUICK_SCHEDULES } from "@/lib/schedule";
import { ACCOUNT_CATEGORY, STAGE, TEMPERATURE, labelOf } from "@/lib/vocab";
import type {
  CurrentUser,
  LeadListItem,
  LeadUpdateRequest,
} from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "tiktok", label: "TikTok DM" },
  { value: "telegram", label: "Telegram" },
] as const;

type QuickFilter =
  "all" | "today" | "overdue" | "hot" | "need_sync" | "need_discipline" | "won";

const QUICK_FILTER_OPTIONS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "today", label: "Perlu tindakan hari ini" },
  { value: "overdue", label: "Terlambat" },
  { value: "hot", label: "Customer panas" },
  { value: "need_sync", label: "Data deal belum sinkron" },
  { value: "need_discipline", label: "Catatan aktivitas belum diisi" },
  { value: "won", label: "Deal berhasil" },
];

/** Chip yang selalu tampil supaya tata letak tidak berubah-ubah. Sisanya muncul kalau ada isinya. */
const ALWAYS_VISIBLE_FILTERS: QuickFilter[] = [
  "all",
  "today",
  "overdue",
  "hot",
  "won",
];

/** Tahap yang masih berjalan, dari awal sampai dekat closing. */
const PIPELINE_STAGES = [
  "new_lead",
  "qualification",
  "education",
  "objection",
  "negotiation",
  "closing",
] as const;

const SORT_OPTIONS = [
  { value: "created_at", label: "Terbaru masuk" },
  { value: "priority", label: "Paling mendesak" },
  { value: "last_contact", label: "Terakhir dihubungi" },
  { value: "next_follow_up", label: "Jadwal follow-up terdekat" },
  { value: "updated_at", label: "Terakhir diubah" },
] as const;

type BucketKey = "action" | "waiting" | "won" | "archived";

const BUCKET_ORDER: BucketKey[] = ["action", "waiting", "won", "archived"];

const BUCKETS: Record<BucketKey, { title: string; description: string }> = {
  action: {
    title: "Perlu tindakan",
    description:
      "Ada yang harus kamu lakukan: follow-up, merapikan data, atau mengisi catatan.",
  },
  waiting: {
    title: "Menunggu",
    description:
      "Sudah aman untuk sekarang. Tinggal tunggu jadwal follow-up berikutnya.",
  },
  won: {
    title: "Deal berhasil",
    description: "Sudah closing. Pastikan data deal-nya lengkap.",
  },
  archived: {
    title: "Lead lama (arsip)",
    description:
      "Sudah lama tidak aktif atau batal. Disimpan terpisah supaya daftar utama tetap bersih.",
  },
};

const STAGE_OPTIONS = [
  "new_lead",
  "qualification",
  "education",
  "objection",
  "negotiation",
  "closing",
  "won",
  "lost",
] as const;

const VISIBLE_STEP = 8;

function isClosedStage(stage: string) {
  return stage === "won" || stage === "lost";
}

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function isOverdueLead(lead: LeadListItem) {
  const nextFollowUp = toDate(lead.next_follow_up_at);
  if (!nextFollowUp) return false;
  return nextFollowUp.getTime() <= Date.now();
}

function needsActionToday(lead: LeadListItem) {
  return (
    isOverdueLead(lead) ||
    lead.needs_deal_sync ||
    lead.discipline_compliance_status !== "logged_today" ||
    ["new_lead", "qualification", "objection", "closing"].includes(
      lead.current_stage,
    )
  );
}

function calculateLeadPriority(lead: LeadListItem) {
  let score = 0;

  if (isOverdueLead(lead)) score += 50;
  if (lead.needs_deal_sync) score += 40;
  if (lead.lead_temperature === "hot") score += 25;
  if (lead.discipline_compliance_status === "missing_today_log") score += 20;
  if (lead.discipline_compliance_status === "stale_log") score += 10;
  if (lead.current_stage === "closing") score += 15;
  if (lead.current_stage === "won") score -= 10;
  if (lead.current_stage === "lost") score -= 20;

  return score;
}

function isLeadArchived(lead: LeadListItem) {
  if (lead.current_stage === "lost") return true;

  const lastContact = toDate(lead.last_contact_at);
  const hasNoActiveSchedule = !lead.next_follow_up_at;
  const isDormant =
    lastContact &&
    Date.now() - lastContact.getTime() > 14 * 24 * 60 * 60 * 1000;

  return (
    Boolean(isDormant) &&
    hasNoActiveSchedule &&
    !lead.needs_deal_sync &&
    lead.current_stage !== "won"
  );
}

function getLeadBucket(lead: LeadListItem): BucketKey {
  if (isLeadArchived(lead)) return "archived";
  if (
    lead.current_stage === "won" &&
    !lead.needs_deal_sync &&
    !isOverdueLead(lead)
  ) {
    return "won";
  }
  if (needsActionToday(lead)) return "action";
  return "waiting";
}

function matchesQuickFilter(lead: LeadListItem, quickFilter: QuickFilter) {
  // Lead arsip hanya muncul di kelompoknya sendiri, jadi tidak ikut dihitung sebagai "perlu tindakan".
  if (quickFilter !== "all" && isLeadArchived(lead)) {
    return false;
  }

  switch (quickFilter) {
    case "today":
      return needsActionToday(lead);
    case "overdue":
      return isOverdueLead(lead);
    case "hot":
      return lead.lead_temperature === "hot";
    case "need_sync":
      return lead.needs_deal_sync;
    case "need_discipline":
      return lead.discipline_compliance_status !== "logged_today";
    case "won":
      return lead.current_stage === "won";
    default:
      return true;
  }
}

/** Satu kalimat langkah berikutnya untuk sebuah lead, dari kondisi yang paling mendesak. */
function getNextStep(lead: LeadListItem): string {
  if (lead.needs_deal_sync) {
    return "Rapikan data deal-nya supaya laporan KPI cocok.";
  }

  if (isOverdueLead(lead)) {
    return "Jadwal follow-up sudah lewat. Hubungi customer atau jadwalkan ulang.";
  }

  if (lead.discipline_compliance_status !== "logged_today") {
    return "Isi catatan aktivitas hari ini setelah menghubungi customer.";
  }

  if (lead.current_stage === "closing") {
    return "Sudah dekat closing. Jaga komunikasinya sampai selesai.";
  }

  return "Tidak ada yang mendesak. Cukup dipantau.";
}

export default function CrmPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortBy, setSortBy] = useState("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCounts, setVisibleCounts] = useState<
    Partial<Record<BucketKey, number>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [notice, setNotice] = useState("");
  const [closeRequest, setCloseRequest] = useState<{
    lead: LeadListItem;
    outcome: "won" | "lost";
  } | null>(null);

  const leadsPath =
    sourceChannelFilter === "all"
      ? "/leads"
      : `/leads?source_channel=${encodeURIComponent(sourceChannelFilter)}`;

  /** Muat ulang daftar tanpa menutup layar dengan "Memuat...", dipakai setelah sebuah aksi. */
  const refreshLeads = useCallback(async () => {
    setLeads(await apiFetch<LeadListItem[]>(leadsPath));
  }, [leadsPath]);

  const loadCrmBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [me, leadItems] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<LeadListItem[]>(leadsPath),
      ]);
      setCurrentUser(me);
      setLeads(leadItems);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Daftar lead belum bisa dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [leadsPath]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCrmBoard();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadCrmBoard]);

  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;
  const isSalesWorkspace =
    normalizeWorkspaceRole(currentUser?.role) === "sales";

  const quickCounts = useMemo(() => {
    const counts = {} as Record<QuickFilter, number>;

    for (const option of QUICK_FILTER_OPTIONS) {
      counts[option.value] = leads.filter((lead) =>
        matchesQuickFilter(lead, option.value),
      ).length;
    }

    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const result = leads
      .filter((lead) => matchesQuickFilter(lead, quickFilter))
      .filter(
        (lead) => stageFilter === "all" || lead.current_stage === stageFilter,
      )
      .filter((lead) => {
        if (!normalizedQuery) return true;

        return [
          lead.display_name,
          lead.summary ?? "",
          lead.customer_profile_name ?? "",
          lead.assigned_user_name ?? "",
          lead.source_label,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

    const time = (value: string | null, fallback = 0) =>
      toDate(value)?.getTime() ?? fallback;

    return [...result].sort((left, right) => {
      if (sortBy === "created_at")
        return time(right.created_at) - time(left.created_at);
      if (sortBy === "last_contact")
        return time(right.last_contact_at) - time(left.last_contact_at);
      if (sortBy === "next_follow_up") {
        return (
          time(left.next_follow_up_at, Number.MAX_SAFE_INTEGER) -
          time(right.next_follow_up_at, Number.MAX_SAFE_INTEGER)
        );
      }
      if (sortBy === "updated_at")
        return time(right.updated_at) - time(left.updated_at);

      return calculateLeadPriority(right) - calculateLeadPriority(left);
    });
  }, [leads, quickFilter, searchQuery, sortBy, stageFilter]);

  const sections = useMemo(
    () =>
      BUCKET_ORDER.map((bucket) => ({
        bucket,
        leads: filteredLeads.filter((lead) => getLeadBucket(lead) === bucket),
      })).filter((section) => section.leads.length > 0),
    [filteredLeads],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const lead of leads) {
      if (isLeadArchived(lead) || isClosedStage(lead.current_stage)) continue;
      counts[lead.current_stage] = (counts[lead.current_stage] ?? 0) + 1;
    }

    return counts;
  }, [leads]);

  const needsActionCount = quickCounts.today;
  const overdueCount = quickCounts.overdue;
  const summaryText =
    leads.length === 0
      ? ""
      : needsActionCount > 0
        ? `${needsActionCount} lead perlu tindakan${overdueCount > 0 ? `, ${overdueCount} di antaranya terlambat` : ""}.`
        : "Semua lead aman untuk sekarang.";

  async function handleStageChange(leadId: string, stage: string) {
    setUpdatingLeadId(leadId);
    setActionError("");
    setNotice("");

    try {
      const payload: LeadUpdateRequest = { current_stage: stage };
      await apiFetch(`/leads/${leadId}`, { method: "PATCH", body: payload });
      await refreshLeads();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Tahap lead belum bisa diubah. Coba lagi.",
      );
    } finally {
      setUpdatingLeadId(null);
    }
  }

  /** Pindah ke "Deal berhasil" atau "Batal" harus lewat konfirmasi, karena laporan KPI memakai data deal-nya. */
  function requestStageChange(lead: LeadListItem, stage: string) {
    if (stage === "won" || stage === "lost") {
      setCloseRequest({ lead, outcome: stage });
      return;
    }

    void handleStageChange(lead.id, stage);
  }

  /** Atur atau hapus jadwal follow-up. Backend ikut membuat atau memperbarui tugasnya di Tindak Lanjut. */
  async function handleSchedule(lead: LeadListItem, date: Date | null) {
    setUpdatingLeadId(lead.id);
    setActionError("");
    setNotice("");

    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        body: {
          next_follow_up_at: date ? date.toISOString() : null,
        } satisfies LeadUpdateRequest,
      });
      await refreshLeads();
      setNotice(
        date
          ? `${lead.display_name} dijadwalkan: ${formatDayLabel(date.toISOString())}, ${formatClock(date.toISOString())}. Muncul di Tindak Lanjut pada harinya.`
          : `Jadwal follow-up ${lead.display_name} dihapus.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Jadwal belum bisa disimpan. Coba lagi.",
      );
    } finally {
      setUpdatingLeadId(null);
    }
  }

  const hasUsableLeadData = leads.length > 0;
  const shouldRenderLeadWorkspace =
    !isLoading && (!errorMessage || hasUsableLeadData);
  const pageTitle = isLeadershipWorkspace
    ? PAGE_NAMES.leadsTeam
    : isSalesWorkspace
      ? PAGE_NAMES.leadsAndCustomers
      : PAGE_NAMES.leads;
  const pageDescription = isHeadWorkspace
    ? "Lead dari semua tim. Lihat siapa pemiliknya dan di tahap mana, lalu buka detail kalau perlu keputusan."
    : isManagerWorkspace
      ? "Lead dari timmu yang paling butuh perhatian. Buka detail atau chat saat perlu."
      : "Prospect yang sedang kamu tangani. Atur jadwal follow-up, ubah tahapnya kalau ada kemajuan, atau buka profil customernya.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={pageTitle}
      description={pageDescription}
      actions={
        !isHeadWorkspace ? (
          <Link href="/upload" className="clara-button clara-button-primary">
            {PAGE_NAMES.intake}
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat daftar lead..." /> : null}

        {!isLoading && errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => void loadCrmBoard()}
          />
        ) : null}

        {actionError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionError}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className="clara-alert clara-alert-success"
          >
            {notice}
          </div>
        ) : null}

        {shouldRenderLeadWorkspace ? (
          <>
            {hasUsableLeadData ? (
              <>
                <section
                  data-onboarding-id="sales-crm-hero"
                  className="clara-card space-y-4 p-4 sm:p-5"
                  aria-label="Cari dan saring lead"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p
                      data-onboarding-id="sales-crm-metrics"
                      role="status"
                      aria-live="polite"
                      className="text-base font-semibold clara-text-primary"
                    >
                      {summaryText}
                    </p>
                    <div
                      role="group"
                      aria-label="Tampilan"
                      className="flex gap-1 rounded-full border border-clara-line p-1"
                    >
                      {(["list", "board"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          aria-pressed={viewMode === mode}
                          className={`min-h-9 rounded-full px-4 text-sm font-semibold ${
                            viewMode === mode
                              ? "bg-clara-gold text-clara-deep"
                              : "text-clara-ink-2 hover:text-clara-ink"
                          }`}
                        >
                          {mode === "list" ? "Daftar" : "Papan per tahap"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {Object.keys(stageCounts).length > 0 ? (
                    <div
                      role="group"
                      aria-label="Posisi lead per tahap"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="text-sm clara-text-secondary">
                        Posisi lead:
                      </span>
                      {PIPELINE_STAGES.filter(
                        (stage) =>
                          (stageCounts[stage] ?? 0) > 0 ||
                          stage === stageFilter,
                      ).map((stage) => (
                        <button
                          key={stage}
                          type="button"
                          onClick={() =>
                            setStageFilter((current) =>
                              current === stage ? "all" : stage,
                            )
                          }
                          aria-pressed={stageFilter === stage}
                          className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${
                            stageFilter === stage
                              ? "border-clara-gold bg-clara-gold text-clara-deep"
                              : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
                          }`}
                        >
                          {labelOf(STAGE, stage)} {stageCounts[stage] ?? 0}
                        </button>
                      ))}
                      {stageFilter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => setStageFilter("all")}
                          className="clara-button clara-button-ghost"
                        >
                          Tampilkan semua tahap
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    data-onboarding-id="sales-crm-filters"
                    className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <div className="col-span-2 md:col-span-1">
                      <label htmlFor="lead-search" className="clara-label">
                        Cari lead
                      </label>
                      <input
                        id="lead-search"
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Nama customer atau ringkasan"
                        className="clara-input mt-2 w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="lead-sort" className="clara-label">
                        Urutkan
                      </label>
                      <select
                        id="lead-sort"
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value)}
                        className="clara-select mt-2 w-full"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="lead-channel" className="clara-label">
                        Channel
                      </label>
                      <select
                        id="lead-channel"
                        value={sourceChannelFilter}
                        onChange={(event) =>
                          setSourceChannelFilter(event.target.value)
                        }
                        className="clara-select mt-2 w-full"
                      >
                        {SOURCE_CHANNEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label="Kelompok lead"
                    className="flex flex-wrap gap-2"
                  >
                    {QUICK_FILTER_OPTIONS.filter(
                      (option) =>
                        ALWAYS_VISIBLE_FILTERS.includes(option.value) ||
                        quickCounts[option.value] > 0 ||
                        option.value === quickFilter,
                    ).map((option) => (
                      <FilterChip
                        key={option.value}
                        active={quickFilter === option.value}
                        onClick={() => setQuickFilter(option.value)}
                        label={`${option.label} (${option.value === "all" ? leads.length : quickCounts[option.value]})`}
                      />
                    ))}
                  </div>
                </section>

                {filteredLeads.length === 0 ? (
                  <EmptyState
                    title="Tidak ada lead yang cocok"
                    description="Ubah kata pencarian atau pilih kelompok lain."
                  />
                ) : viewMode === "board" ? (
                  <LeadBoard
                    leads={filteredLeads.filter(
                      (lead) => !isLeadArchived(lead),
                    )}
                    canChangeStage={!isHeadWorkspace}
                    updatingLeadId={updatingLeadId}
                    onStageChange={requestStageChange}
                  />
                ) : (
                  sections.map((section, sectionIndex) => {
                    const visible =
                      visibleCounts[section.bucket] ?? VISIBLE_STEP;
                    const shown = section.leads.slice(0, visible);
                    const hiddenCount = section.leads.length - shown.length;

                    return (
                      <section
                        key={section.bucket}
                        aria-labelledby={`lead-bucket-${section.bucket}`}
                        data-onboarding-id={
                          sectionIndex === 0 ? "sales-crm-list" : undefined
                        }
                        className="space-y-3"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                          <h2
                            id={`lead-bucket-${section.bucket}`}
                            className="text-base font-semibold clara-text-primary"
                          >
                            {BUCKETS[section.bucket].title}{" "}
                            <span className="font-normal clara-text-muted">
                              ({section.leads.length})
                            </span>
                          </h2>
                          <p className="text-sm clara-text-secondary">
                            {BUCKETS[section.bucket].description}
                          </p>
                        </div>

                        <ul className="space-y-3">
                          {shown.map((lead) => (
                            <LeadRow
                              key={lead.id}
                              lead={lead}
                              showOwner={isLeadershipWorkspace}
                              canChangeStage={!isHeadWorkspace}
                              isUpdating={updatingLeadId === lead.id}
                              onStageChange={(stage) =>
                                requestStageChange(lead, stage)
                              }
                              onSchedule={(date) =>
                                void handleSchedule(lead, date)
                              }
                            />
                          ))}
                        </ul>

                        {hiddenCount > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleCounts((current) => ({
                                ...current,
                                [section.bucket]: visible + VISIBLE_STEP,
                              }))
                            }
                            className="clara-button clara-button-ghost"
                          >
                            Tampilkan {Math.min(hiddenCount, VISIBLE_STEP)} lead
                            lagi ({hiddenCount} tersisa)
                          </button>
                        ) : null}
                      </section>
                    );
                  })
                )}
              </>
            ) : (
              <EmptyState
                title="Belum ada lead"
                description="Lead dibuat otomatis saat sebuah chat masuk ke Clara. Masukkan chat pertama untuk memulai."
                actionHref={!isHeadWorkspace ? "/upload" : undefined}
                actionLabel={
                  !isHeadWorkspace ? "Masukkan chat pertama" : undefined
                }
              />
            )}
          </>
        ) : null}
      </div>

      {closeRequest ? (
        <CloseLeadDialog
          lead={closeRequest.lead}
          outcome={closeRequest.outcome}
          onClose={() => setCloseRequest(null)}
          onDone={async () => {
            await refreshLeads();
            setNotice(
              closeRequest.outcome === "won"
                ? `${closeRequest.lead.display_name} ditandai deal berhasil.`
                : `${closeRequest.lead.display_name} ditandai batal dan dipindah ke arsip.`,
            );
          }}
        />
      ) : null}
    </WorkspaceShell>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
        active
          ? "border-clara-gold bg-clara-gold text-clara-deep"
          : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** Baris jadwal follow-up: kapan, dan (untuk Sales) tombol cepat untuk mengaturnya. */
function FollowUpLine({
  lead,
  canSchedule,
  isUpdating,
  onSchedule,
}: {
  lead: LeadListItem;
  canSchedule: boolean;
  isUpdating: boolean;
  onSchedule: (date: Date | null) => void;
}) {
  const [showChange, setShowChange] = useState(false);
  const at = lead.next_follow_up_at;
  const overdue = isOverdueLead(lead);
  const quickOptions = QUICK_SCHEDULES.filter(
    (option) => option.key !== "tomorrow-noon",
  );

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold clara-text-primary">Follow-up:</span>
        {at ? (
          <span
            className={
              overdue
                ? "font-semibold text-clara-danger"
                : "clara-text-secondary"
            }
          >
            {overdue ? "Terlambat, seharusnya " : ""}
            {formatDayLabel(at)}, {formatClock(at)}
          </span>
        ) : (
          <span className="font-semibold text-clara-warning">
            Belum dijadwalkan
          </span>
        )}

        {canSchedule && at ? (
          <button
            type="button"
            onClick={() => setShowChange((current) => !current)}
            aria-expanded={showChange}
            className="clara-button clara-button-ghost"
          >
            Ubah jadwal
          </button>
        ) : null}

        {canSchedule && !at
          ? quickOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={isUpdating}
                onClick={() => onSchedule(option.date())}
                className="clara-button clara-button-secondary"
              >
                {option.shortLabel}
              </button>
            ))
          : null}
      </div>

      {canSchedule && at && showChange ? (
        <div className="flex flex-wrap gap-2">
          {QUICK_SCHEDULES.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={isUpdating}
              onClick={() => {
                setShowChange(false);
                onSchedule(option.date());
              }}
              className="clara-button clara-button-secondary"
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              setShowChange(false);
              onSchedule(null);
            }}
            className="clara-button clara-button-ghost"
          >
            Hapus jadwal
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LeadRow({
  lead,
  showOwner,
  canChangeStage,
  isUpdating,
  onStageChange,
  onSchedule,
}: {
  lead: LeadListItem;
  showOwner: boolean;
  canChangeStage: boolean;
  isUpdating: boolean;
  onStageChange: (stage: string) => void;
  onSchedule: (date: Date | null) => void;
}) {
  const priorityScore = calculateLeadPriority(lead);
  const overdue = isOverdueLead(lead);
  const category =
    lead.account_category && lead.account_category !== "unknown"
      ? labelOf(ACCOUNT_CATEGORY, lead.account_category)
      : null;
  const openChat = buildOpenChatLinkFor(lead.source_channel, [
    lead.display_name,
    lead.customer_profile_name ?? "",
  ]);
  const isClosed = isClosedStage(lead.current_stage);

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">
            {lead.display_name}
          </h3>
          <p className="mt-0.5 text-xs clara-text-muted">
            {formatChannelLabel(lead.source_channel)} · terakhir dihubungi{" "}
            {formatRelativeTime(lead.last_contact_at)}
            {showOwner
              ? ` · Sales: ${lead.assigned_user_name ?? "belum ada"}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/crm/${lead.id}`}
            className="clara-button clara-button-primary"
          >
            Buka lead
          </Link>
          {lead.latest_conversation_id ? (
            <Link
              href={`/sales/conversations/${lead.latest_conversation_id}`}
              className="clara-button clara-button-secondary"
            >
              Buka chat
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lead.current_stage !== "unknown" ? (
          <ValueTag table={STAGE} value={lead.current_stage} />
        ) : null}
        {lead.lead_temperature !== "unknown" ? (
          <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
        ) : null}
        {priorityScore >= 70 ? (
          <Tag tone="danger">Mendesak</Tag>
        ) : priorityScore >= 35 ? (
          <Tag tone="warn">Perlu dicek</Tag>
        ) : null}
        {overdue ? <Tag tone="danger">Follow-up terlambat</Tag> : null}
        {lead.needs_deal_sync ? (
          <Tag tone="warn">Data deal belum sinkron</Tag>
        ) : null}
        {category ? <Tag>{category}</Tag> : null}
      </div>

      <p className="mt-3 line-clamp-2 break-words text-sm leading-6 clara-text-secondary">
        {lead.summary ??
          "Belum ada ringkasan. Buka chat-nya lalu minta Clara membacanya."}
      </p>

      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        <span className="font-semibold clara-text-primary">
          Langkah berikutnya:{" "}
        </span>
        {getNextStep(lead)}
      </p>

      {isClosed ? null : (
        <FollowUpLine
          lead={lead}
          canSchedule={canChangeStage}
          isUpdating={isUpdating}
          onSchedule={onSchedule}
        />
      )}

      {canChangeStage || openChat || lead.customer_profile_id ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-clara-line-subtle pt-3 lg:flex-row lg:items-center">
          {canChangeStage ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                htmlFor={`stage-${lead.id}`}
                className="shrink-0 whitespace-nowrap text-sm font-semibold clara-text-primary"
              >
                Tahap customer
              </label>
              <select
                id={`stage-${lead.id}`}
                value={lead.current_stage}
                disabled={isUpdating}
                onChange={(event) => onStageChange(event.target.value)}
                className="clara-select w-full sm:w-56"
              >
                {lead.current_stage === "unknown" ? (
                  <option value="unknown">Belum ditentukan</option>
                ) : null}
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {labelOf(STAGE, stage)}
                  </option>
                ))}
              </select>
              {isUpdating ? (
                <span role="status" className="text-sm clara-text-secondary">
                  Menyimpan...
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {lead.customer_profile_id ? (
              <Link
                href={`/customers/${lead.customer_profile_id}`}
                className="clara-button clara-button-ghost"
              >
                Profil customer
              </Link>
            ) : null}
            {openChat && canChangeStage ? (
              <a
                href={openChat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="clara-button clara-button-ghost"
              >
                {openChat.label} (tab baru)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Semua lead aktif dalam kolom per tahap, supaya posisi pipeline kelihatan sekilas. */
function LeadBoard({
  leads,
  canChangeStage,
  updatingLeadId,
  onStageChange,
}: {
  leads: LeadListItem[];
  canChangeStage: boolean;
  updatingLeadId: string | null;
  onStageChange: (lead: LeadListItem, stage: string) => void;
}) {
  const columns = [...PIPELINE_STAGES, "won"] as const;

  return (
    <div className="clara-scrollbar -mx-1 overflow-x-auto px-1 pb-3">
      <div className="flex min-w-max gap-3">
        {columns.map((stage) => {
          // Lead yang tahapnya belum ditentukan ditaruh di kolom pertama supaya tidak hilang dari papan.
          const inColumn = leads.filter(
            (lead) =>
              lead.current_stage === stage ||
              (stage === "new_lead" && lead.current_stage === "unknown"),
          );

          return (
            <section
              key={stage}
              aria-label={`Tahap ${labelOf(STAGE, stage)}`}
              className="w-72 shrink-0 rounded-2xl border border-clara-line-subtle bg-clara-sunken p-3"
            >
              <h3 className="mb-3 flex items-baseline justify-between text-sm font-semibold clara-text-primary">
                {stage === "won" ? "Deal berhasil" : labelOf(STAGE, stage)}
                <span className="font-normal clara-text-muted">
                  {inColumn.length}
                </span>
              </h3>
              <ul className="space-y-2">
                {inColumn.length === 0 ? (
                  <li className="py-3 text-center text-xs clara-text-muted">
                    Kosong
                  </li>
                ) : null}
                {inColumn.map((lead) => {
                  const at = lead.next_follow_up_at;
                  const overdue = isOverdueLead(lead);

                  return (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-clara-line-subtle bg-clara-raised p-3"
                    >
                      <Link
                        href={`/crm/${lead.id}`}
                        className="block break-words text-sm font-semibold clara-text-primary hover:underline"
                      >
                        {lead.display_name}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {lead.lead_temperature !== "unknown" ? (
                          <ValueTag
                            table={TEMPERATURE}
                            value={lead.lead_temperature}
                          />
                        ) : null}
                        {lead.needs_deal_sync ? (
                          <Tag tone="warn">Deal belum sinkron</Tag>
                        ) : null}
                      </div>
                      {stage !== "won" ? (
                        <p
                          className={`mt-2 text-xs ${
                            overdue
                              ? "font-semibold text-clara-danger"
                              : at
                                ? "clara-text-secondary"
                                : "text-clara-warning"
                          }`}
                        >
                          {at
                            ? `${overdue ? "Terlambat: " : "Follow-up: "}${formatDayLabel(at)}, ${formatClock(at)}`
                            : "Belum dijadwalkan"}
                        </p>
                      ) : null}
                      {canChangeStage ? (
                        <select
                          aria-label={`Pindahkan ${lead.display_name} ke tahap lain`}
                          value={
                            lead.current_stage === "unknown"
                              ? "new_lead"
                              : lead.current_stage
                          }
                          disabled={updatingLeadId === lead.id}
                          onChange={(event) =>
                            onStageChange(lead, event.target.value)
                          }
                          className="clara-select mt-2 w-full"
                        >
                          {STAGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option === lead.current_stage
                                ? labelOf(STAGE, option)
                                : `Pindah ke ${labelOf(STAGE, option)}`}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
