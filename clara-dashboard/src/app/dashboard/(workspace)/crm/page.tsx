"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatChannelLabel, formatRelativeTime } from "@/lib/format";
import { isHeadRole, isManagerRole } from "@/lib/roles";
import { ACCOUNT_CATEGORY, STAGE, TEMPERATURE, labelOf } from "@/lib/vocab";
import type { CurrentUser, LeadListItem, LeadUpdateRequest } from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
] as const;

type QuickFilter = "all" | "today" | "overdue" | "hot" | "need_sync" | "need_discipline" | "won";

const QUICK_FILTER_OPTIONS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "today", label: "Perlu tindakan hari ini" },
  { value: "overdue", label: "Terlambat" },
  { value: "hot", label: "Customer panas" },
  { value: "need_sync", label: "Data deal belum sinkron" },
  { value: "need_discipline", label: "Catatan aktivitas belum diisi" },
  { value: "won", label: "Deal berhasil" },
];

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
    description: "Ada yang harus kamu lakukan: follow-up, merapikan data, atau mengisi catatan.",
  },
  waiting: {
    title: "Menunggu",
    description: "Sudah aman untuk sekarang. Tinggal tunggu jadwal follow-up berikutnya.",
  },
  won: {
    title: "Deal berhasil",
    description: "Sudah closing. Pastikan data deal-nya lengkap.",
  },
  archived: {
    title: "Lead lama (arsip)",
    description: "Sudah lama tidak aktif atau batal. Disimpan terpisah supaya daftar utama tetap bersih.",
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
    ["new_lead", "qualification", "objection", "closing"].includes(lead.current_stage)
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
  const isDormant = lastContact && Date.now() - lastContact.getTime() > 14 * 24 * 60 * 60 * 1000;

  return Boolean(isDormant) && hasNoActiveSchedule && !lead.needs_deal_sync && lead.current_stage !== "won";
}

function getLeadBucket(lead: LeadListItem): BucketKey {
  if (isLeadArchived(lead)) return "archived";
  if (lead.current_stage === "won" && !lead.needs_deal_sync && !isOverdueLead(lead)) {
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
  const [visibleCounts, setVisibleCounts] = useState<Partial<Record<BucketKey, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const loadCrmBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const leadsPath =
        sourceChannelFilter === "all"
          ? "/leads"
          : `/leads?source_channel=${encodeURIComponent(sourceChannelFilter)}`;
      const [me, leadItems] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<LeadListItem[]>(leadsPath),
      ]);
      setCurrentUser(me);
      setLeads(leadItems);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Daftar lead belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, [sourceChannelFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCrmBoard();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadCrmBoard]);

  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;

  const quickCounts = useMemo(() => {
    const counts = {} as Record<QuickFilter, number>;

    for (const option of QUICK_FILTER_OPTIONS) {
      counts[option.value] = leads.filter((lead) => matchesQuickFilter(lead, option.value)).length;
    }

    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const result = leads
      .filter((lead) => matchesQuickFilter(lead, quickFilter))
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

    const time = (value: string | null, fallback = 0) => toDate(value)?.getTime() ?? fallback;

    return [...result].sort((left, right) => {
      if (sortBy === "created_at") return time(right.created_at) - time(left.created_at);
      if (sortBy === "last_contact") return time(right.last_contact_at) - time(left.last_contact_at);
      if (sortBy === "next_follow_up") {
        return (
          time(left.next_follow_up_at, Number.MAX_SAFE_INTEGER) -
          time(right.next_follow_up_at, Number.MAX_SAFE_INTEGER)
        );
      }
      if (sortBy === "updated_at") return time(right.updated_at) - time(left.updated_at);

      return calculateLeadPriority(right) - calculateLeadPriority(left);
    });
  }, [leads, quickFilter, searchQuery, sortBy]);

  const sections = useMemo(
    () =>
      BUCKET_ORDER.map((bucket) => ({
        bucket,
        leads: filteredLeads.filter((lead) => getLeadBucket(lead) === bucket),
      })).filter((section) => section.leads.length > 0),
    [filteredLeads],
  );

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

    try {
      const payload: LeadUpdateRequest = { current_stage: stage };
      const updatedLead = await apiFetch<LeadListItem>(`/leads/${leadId}`, {
        method: "PATCH",
        body: payload,
      });

      setLeads((previous) => previous.map((lead) => (lead.id === leadId ? updatedLead : lead)));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Tahap lead belum bisa diubah. Coba lagi.");
    } finally {
      setUpdatingLeadId(null);
    }
  }

  const hasUsableLeadData = leads.length > 0;
  const shouldRenderLeadWorkspace = !isLoading && (!errorMessage || hasUsableLeadData);
  const pageTitle = isLeadershipWorkspace ? PAGE_NAMES.leadsTeam : PAGE_NAMES.leads;
  const pageDescription = isHeadWorkspace
    ? "Lead dari semua tim. Lihat siapa pemiliknya dan di tahap mana, lalu buka detail kalau perlu keputusan."
    : isManagerWorkspace
      ? "Lead dari timmu yang paling butuh perhatian. Buka detail atau chat saat perlu."
      : "Prospect yang sedang kamu tangani. Ubah tahapnya kalau ada kemajuan, lalu lanjutkan lewat chat.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={pageTitle}
      description={pageDescription}
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
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
          <ErrorState message={errorMessage} onRetry={() => void loadCrmBoard()} />
        ) : null}

        {actionError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionError}
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
                  <p
                    data-onboarding-id="sales-crm-metrics"
                    role="status"
                    aria-live="polite"
                    className="text-base font-semibold clara-text-primary"
                  >
                    {summaryText}
                  </p>

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
                        onChange={(event) => setSourceChannelFilter(event.target.value)}
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

                  <div role="group" aria-label="Kelompok lead" className="flex flex-wrap gap-2">
                    {QUICK_FILTER_OPTIONS.filter(
                      (option) =>
                        option.value === "all" ||
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
                ) : (
                  sections.map((section, sectionIndex) => {
                    const visible = visibleCounts[section.bucket] ?? VISIBLE_STEP;
                    const shown = section.leads.slice(0, visible);
                    const hiddenCount = section.leads.length - shown.length;

                    return (
                      <section
                        key={section.bucket}
                        aria-labelledby={`lead-bucket-${section.bucket}`}
                        data-onboarding-id={sectionIndex === 0 ? "sales-crm-list" : undefined}
                        className="space-y-3"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                          <h2
                            id={`lead-bucket-${section.bucket}`}
                            className="text-base font-semibold clara-text-primary"
                          >
                            {BUCKETS[section.bucket].title}{" "}
                            <span className="font-normal clara-text-muted">({section.leads.length})</span>
                          </h2>
                          <p className="text-sm clara-text-secondary">{BUCKETS[section.bucket].description}</p>
                        </div>

                        <ul className="space-y-3">
                          {shown.map((lead) => (
                            <LeadRow
                              key={lead.id}
                              lead={lead}
                              showOwner={isLeadershipWorkspace}
                              canChangeStage={!isHeadWorkspace}
                              isUpdating={updatingLeadId === lead.id}
                              onStageChange={(stage) => void handleStageChange(lead.id, stage)}
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
                            Tampilkan {Math.min(hiddenCount, VISIBLE_STEP)} lead lagi ({hiddenCount} tersisa)
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
                actionLabel={!isHeadWorkspace ? "Masukkan chat pertama" : undefined}
              />
            )}
          </>
        ) : null}
      </div>
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

function LeadRow({
  lead,
  showOwner,
  canChangeStage,
  isUpdating,
  onStageChange,
}: {
  lead: LeadListItem;
  showOwner: boolean;
  canChangeStage: boolean;
  isUpdating: boolean;
  onStageChange: (stage: string) => void;
}) {
  const priorityScore = calculateLeadPriority(lead);
  const overdue = isOverdueLead(lead);
  const category =
    lead.account_category && lead.account_category !== "unknown"
      ? labelOf(ACCOUNT_CATEGORY, lead.account_category)
      : null;

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">{lead.display_name}</h3>
          <p className="mt-0.5 text-xs clara-text-muted">
            {formatChannelLabel(lead.source_channel)} · terakhir dihubungi {formatRelativeTime(lead.last_contact_at)}
            {showOwner ? ` · Sales: ${lead.assigned_user_name ?? "belum ada"}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/crm/${lead.id}`} className="clara-button clara-button-primary">
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
        {lead.current_stage !== "unknown" ? <ValueTag table={STAGE} value={lead.current_stage} /> : null}
        {lead.lead_temperature !== "unknown" ? (
          <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
        ) : null}
        {priorityScore >= 70 ? (
          <Tag tone="danger">Mendesak</Tag>
        ) : priorityScore >= 35 ? (
          <Tag tone="warn">Perlu dicek</Tag>
        ) : null}
        {overdue ? <Tag tone="danger">Follow-up terlambat</Tag> : null}
        {lead.needs_deal_sync ? <Tag tone="warn">Data deal belum sinkron</Tag> : null}
        {category ? <Tag>{category}</Tag> : null}
      </div>

      <p className="mt-3 line-clamp-2 break-words text-sm leading-6 clara-text-secondary">
        {lead.summary ?? "Belum ada ringkasan. Buka chat-nya lalu minta Clara membacanya."}
      </p>

      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        <span className="font-semibold clara-text-primary">Langkah berikutnya: </span>
        {getNextStep(lead)}
      </p>

      {canChangeStage ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-clara-line-subtle pt-3 sm:flex-row sm:items-center">
          <label htmlFor={`stage-${lead.id}`} className="shrink-0 whitespace-nowrap text-sm font-semibold clara-text-primary">
            Tahap customer
          </label>
          <select
            id={`stage-${lead.id}`}
            value={lead.current_stage}
            disabled={isUpdating}
            onChange={(event) => onStageChange(event.target.value)}
            className="clara-select w-full sm:max-w-xs"
          >
            {lead.current_stage === "unknown" ? <option value="unknown">Belum ditentukan</option> : null}
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
    </li>
  );
}
