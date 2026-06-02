"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import { canAccessQueueAndActionCenter } from "@/lib/roles";
import type {
  CurrentUser,
  LeadListItem,
  LeadUpdateRequest,
} from "@/types/dashboard";

const SOURCE_CHANNEL_OPTIONS = [
  { value: "all", label: "Semua Channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
] as const;

const QUICK_FILTER_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "today", label: "Hari ini" },
  { value: "overdue", label: "Overdue" },
  { value: "hot", label: "Hot" },
  { value: "need_sync", label: "Need sync" },
  { value: "need_discipline", label: "Need discipline" },
  { value: "won", label: "Won" },
] as const;

const SORT_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "last_contact", label: "Last contact" },
  { value: "next_follow_up", label: "Next follow-up" },
  { value: "updated_at", label: "Updated terbaru" },
] as const;

const BUCKET_OPTIONS = [
  { value: "all", label: "Semua bucket" },
  { value: "action", label: "Perlu tindakan" },
  { value: "waiting", label: "Waiting" },
  { value: "won", label: "Won" },
  { value: "archived", label: "Archived" },
] as const;

const STAGE_ORDER = [
  "new_lead",
  "qualification",
  "education",
  "objection",
  "negotiation",
  "closing",
  "won",
  "lost",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  qualification: "Qualification",
  education: "Education",
  objection: "Objection",
  negotiation: "Negotiation",
  closing: "Closing",
  won: "Won",
  lost: "Lost",
  unknown: "Unknown",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  logged_today: "Discipline ok",
  missing_today_log: "Need discipline",
  stale_log: "Discipline stale",
};

const LEADS_PAGE_SIZE = 8;

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

function getLeadBucket(lead: LeadListItem) {
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

function matchesBucketFilter(lead: LeadListItem, bucketFilter: string) {
  if (bucketFilter === "all") return true;
  return getLeadBucket(lead) === bucketFilter;
}

function matchesQuickFilter(lead: LeadListItem, quickFilter: string) {
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

function getLeadActionItems(lead: LeadListItem) {
  const items: Array<{
    condition: string;
    action: string;
    detail: string;
  }> = [];

  if (isOverdueLead(lead)) {
    items.push({
      condition: "Jika statusnya Follow-up overdue",
      action:
        "Buka lead detail, cek chat terakhir, lalu isi next follow-up baru pada hari/jam yang realistis.",
      detail:
        "Jangan pindah ke lead lain sebelum lead ini punya jadwal follow-up baru. Kalau ternyata lead sudah tidak aktif, update stage atau catat alasannya di notes/log.",
    });
  }

  if (lead.discipline_compliance_status === "stale_log") {
    items.push({
      condition: "Jika statusnya Discipline stale",
      action:
        "Isi discipline log baru hari ini berdasarkan aktivitas terakhir yang benar-benar terjadi.",
      detail:
        "Minimal isi activity type, result status, objection utama, customer mood, dan next follow-up. Tujuannya menghidupkan lagi jejak kerja lead ini.",
    });
  }

  if (lead.discipline_compliance_status === "missing_today_log") {
    items.push({
      condition: "Jika statusnya Need discipline",
      action:
        "Catat aktivitas hari ini walaupun hasilnya belum closing, misalnya follow-up chat, no response, atau waiting customer.",
      detail:
        "Status ini artinya belum ada bukti kerja hari ini. Isi log supaya lead tidak terlihat diam dan manager tahu langkah yang sudah dilakukan.",
    });
  }

  if (lead.needs_deal_sync) {
    items.push({
      condition: "Jika statusnya Need sync",
      action:
        "Masuk ke section Deal Metrics lalu samakan deal status dengan kondisi lead sekarang, kemudian simpan.",
      detail:
        "Biasanya ini muncul saat stage sudah `won` atau `lost` tapi deal status KPI belum ikut berubah. Jangan biarkan karena angka KPI bisa salah.",
    });
  }

  if (
    lead.current_stage === "new_lead" ||
    lead.current_stage === "qualification"
  ) {
    items.push({
      condition: "Jika stage masih New Lead atau Qualification",
      action:
        "Lengkapi summary singkat, tetapkan owner, lalu set next follow-up pertama.",
      detail:
        "Targetnya sederhana: lead jangan mentah. Orang lain harus bisa buka lead ini dan langsung paham siapa customer-nya dan next step-nya apa.",
    });
  }

  if (lead.current_stage === "objection" || lead.current_stage === "closing") {
    items.push({
      condition: "Jika stage sudah Objection atau Closing",
      action:
        "Buka conversation terakhir dulu sebelum update stage atau kirim follow-up baru.",
      detail:
        "Di fase ini jangan kerja berdasarkan asumsi. Pastikan objection, risiko, dan posisi customer terakhir benar-benar terbaca sebelum ambil tindakan.",
    });
  }

  if (!items.length) {
    items.push({
      condition: "Jika tidak ada badge masalah",
      action:
        "Cek cepat apakah stage, owner, dan next follow-up masih relevan lalu lanjut ke lead berikutnya.",
      detail:
        "Artinya lead ini relatif aman untuk sekarang dan tidak butuh intervensi langsung.",
    });
  }

  return items.slice(0, 3);
}

export default function CrmPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  async function loadCrmBoard() {
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
      setSelectedLeadId((previous) => {
        if (previous && leadItems.some((lead) => lead.id === previous)) {
          return previous;
        }
        return leadItems[0]?.id ?? null;
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat Lead Management.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCrmBoard();
    }, 0);

    return () => clearTimeout(timer);
  }, [sourceChannelFilter]);

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
          lead.account_category,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

    return [...result].sort((left, right) => {
      if (sortBy === "last_contact") {
        const leftTime = toDate(left.last_contact_at)?.getTime() ?? 0;
        const rightTime = toDate(right.last_contact_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      }

      if (sortBy === "next_follow_up") {
        const leftTime =
          toDate(left.next_follow_up_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightTime =
          toDate(right.next_follow_up_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      }

      if (sortBy === "updated_at") {
        const leftTime = toDate(left.updated_at)?.getTime() ?? 0;
        const rightTime = toDate(right.updated_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      }

      return calculateLeadPriority(right) - calculateLeadPriority(left);
    });
  }, [leads, quickFilter, searchQuery, sortBy]);

  const visibleLeads = useMemo(() => {
    return filteredLeads.filter((lead) =>
      matchesBucketFilter(lead, bucketFilter),
    );
  }, [filteredLeads, bucketFilter]);

  const totalLeadPages = Math.max(
    1,
    Math.ceil(visibleLeads.length / LEADS_PAGE_SIZE),
  );
  const paginatedVisibleLeads = useMemo(() => {
    const startIndex = (leadPage - 1) * LEADS_PAGE_SIZE;
    return visibleLeads.slice(startIndex, startIndex + LEADS_PAGE_SIZE);
  }, [leadPage, visibleLeads]);

  const bucketedLeads = useMemo(() => {
    return {
      action: paginatedVisibleLeads.filter(
        (lead) => getLeadBucket(lead) === "action",
      ),
      waiting: paginatedVisibleLeads.filter(
        (lead) => getLeadBucket(lead) === "waiting",
      ),
      won: paginatedVisibleLeads.filter(
        (lead) => getLeadBucket(lead) === "won",
      ),
      archived: paginatedVisibleLeads.filter(
        (lead) => getLeadBucket(lead) === "archived",
      ),
    };
  }, [paginatedVisibleLeads]);

  const bucketSummary = useMemo(() => {
    return {
      action: filteredLeads.filter((lead) => getLeadBucket(lead) === "action")
        .length,
      waiting: filteredLeads.filter((lead) => getLeadBucket(lead) === "waiting")
        .length,
      won: filteredLeads.filter((lead) => getLeadBucket(lead) === "won").length,
      archived: filteredLeads.filter(
        (lead) => getLeadBucket(lead) === "archived",
      ).length,
    };
  }, [filteredLeads]);

  useEffect(() => {
    if (leadPage > totalLeadPages) {
      setLeadPage(totalLeadPages);
    }
  }, [leadPage, totalLeadPages]);

  useEffect(() => {
    setLeadPage(1);
  }, [bucketFilter, quickFilter, searchQuery, sortBy, sourceChannelFilter]);

  useEffect(() => {
    if (!paginatedVisibleLeads.length) {
      setSelectedLeadId(null);
      return;
    }

    setSelectedLeadId((previous) => {
      if (
        previous &&
        paginatedVisibleLeads.some((lead) => lead.id === previous)
      ) {
        return previous;
      }
      return paginatedVisibleLeads[0]?.id ?? null;
    });
  }, [paginatedVisibleLeads]);

  const summary = useMemo(() => {
    return {
      total: leads.length,
      needsAction: leads.filter((lead) => needsActionToday(lead)).length,
      overdue: leads.filter((lead) => isOverdueLead(lead)).length,
      needsSync: leads.filter((lead) => lead.needs_deal_sync).length,
      hot: leads.filter((lead) => lead.lead_temperature === "hot").length,
      won: leads.filter((lead) => lead.current_stage === "won").length,
    };
  }, [leads]);

  const selectedLead =
    paginatedVisibleLeads.find((lead) => lead.id === selectedLeadId) ?? null;

  async function handleStageChange(leadId: string, currentStage: string) {
    setUpdatingLeadId(leadId);

    try {
      const payload: LeadUpdateRequest = { current_stage: currentStage };
      const updatedLead = await apiFetch<LeadListItem>(`/leads/${leadId}`, {
        method: "PATCH",
        body: payload,
      });

      setLeads((previous) =>
        previous.map((lead) => (lead.id === leadId ? updatedLead : lead)),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah stage lead.",
      );
    } finally {
      setUpdatingLeadId(null);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="CRM workspace"
      title="Lead Management"
      description="Halaman ini difokuskan untuk scanning cepat, update CRM, dan melihat health lead tanpa tenggelam di daftar panjang. Queue tetap dipakai untuk kerja chat, sedangkan Lead Management dipakai untuk membaca status, sinkronisasi, dan follow-up."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          {currentUser && canAccessQueueAndActionCenter(currentUser.role) ? (
            <Link
              href="/dashboard/sales"
              className="clara-button clara-button-ghost"
            >
              Queue
            </Link>
          ) : (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Chat Review Center
            </Link>
          )}
          <Link
            href="/dashboard/upload"
            className="clara-button clara-button-primary"
          >
            Lead Capture
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state p-8 text-center text-sm text-[#d6bb84]">
            Loading Lead Management...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5 text-sm text-[#f0cb73]">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <BoardMetric
                label="Total Leads"
                value={String(summary.total)}
                hint="Semua lead yang masuk scope Anda."
              />
              <BoardMetric
                label="Perlu tindakan"
                value={String(summary.needsAction)}
                hint="Lead yang sebaiknya dicek hari ini."
              />
              <BoardMetric
                label="Overdue"
                value={String(summary.overdue)}
                hint="Follow-up yang sudah lewat jadwal."
              />
              <BoardMetric
                label="Need sync"
                value={String(summary.needsSync)}
                hint="Stage dan deal metrics belum selaras."
              />
              <BoardMetric
                label="Hot"
                value={String(summary.hot)}
                hint="Lead dengan urgensi tinggi."
              />
              <BoardMetric
                label="Won"
                value={String(summary.won)}
                hint="Lead yang sudah closing berhasil."
              />
            </section>

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
              <div className="space-y-4 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(28,21,15,0.94)_0%,rgba(18,13,10,0.96)_100%)] p-4 backdrop-blur-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                      Kontrol Lead
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                      Atur lead yang mau discan dari satu toolbar
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#e3c990]">
                      Gunakan search, sort, channel, quick filter, dan bucket
                      view supaya list lead tetap bersih walau volume hariannya
                      tinggi.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <LeadMetaPill
                      label="Perlu tindakan"
                      value={String(summary.needsAction)}
                    />
                    <LeadMetaPill
                      label="Overdue"
                      value={String(summary.overdue)}
                    />
                    <LeadMetaPill
                      label="Need sync"
                      value={String(summary.needsSync)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Cari lead</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari nama lead, owner, customer profile, source, atau summary..."
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#1a130d] px-4 py-3 text-sm text-[#f7e7b7] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.04)] placeholder:text-[#907953]"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Sort</span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.05)]"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                    <span>Channel</span>
                    <select
                      value={sourceChannelFilter}
                      onChange={(event) =>
                        setSourceChannelFilter(event.target.value)
                      }
                      className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.05)]"
                    >
                      {SOURCE_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                      Quick Filters
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {QUICK_FILTER_OPTIONS.map((option) => {
                        const isActive = quickFilter === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setQuickFilter(option.value)}
                            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                              isActive
                                ? "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                : "border border-[#3c2c16] bg-[#22190f] text-[#e1c27c] hover:border-[#f0cb73]/28"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                      Bucket View
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {BUCKET_OPTIONS.map((option) => {
                        const isActive = bucketFilter === option.value;
                        const count =
                          option.value === "all"
                            ? filteredLeads.length
                            : bucketSummary[
                                option.value as keyof typeof bucketSummary
                              ];
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBucketFilter(option.value)}
                            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                              isActive
                                ? "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                : "border border-[#3c2c16] bg-[#22190f] text-[#e1c27c] hover:border-[#f0cb73]/28"
                            }`}
                          >
                            {option.label}{" "}
                            <span className="ml-1 text-xs opacity-80">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[22px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,14,0.96)_0%,rgba(16,12,9,0.96)_100%)] px-4 py-3 text-sm text-[#d8bc84] shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                <span className="rounded-full bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                  Hasil
                </span>
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-[#fff0c9]">
                    {paginatedVisibleLeads.length}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-[#fff0c9]">
                    {visibleLeads.length}
                  </span>{" "}
                  lead pada halaman ini.
                </span>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#f0cb73]/12 px-2 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                    Lead List
                  </p>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    Scan cepat dengan bucket operasional
                  </h3>
                </div>
                <p className="text-sm text-[#c8ad75]">
                  {paginatedVisibleLeads.length} / {visibleLeads.length} lead
                  tampil di halaman ini
                </p>
              </div>

              <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                {paginatedVisibleLeads.length === 0 ? (
                  <div className="clara-empty-state p-6 text-sm text-[#d6bb84]">
                    Tidak ada lead yang cocok dengan filter saat ini.
                  </div>
                ) : (
                  <>
                    <div className="clara-scrollbar space-y-3 xl:max-h-[780px] xl:overflow-y-auto xl:pr-2">
                      {renderBucketSection({
                        title: "Perlu tindakan",
                        description:
                          "Lead yang masih butuh aksi hari ini, overdue, atau butuh sinkronisasi CRM.",
                        leads:
                          bucketFilter === "all"
                            ? bucketedLeads.action
                            : visibleLeads,
                        selectedLeadId,
                        setSelectedLeadId,
                      })}
                      {bucketFilter === "all" &&
                        renderBucketSection({
                          title: "Waiting",
                          description:
                            "Lead yang sudah cukup aman untuk sekarang dan tinggal menunggu momen follow-up berikutnya.",
                          leads: bucketedLeads.waiting,
                          selectedLeadId,
                          setSelectedLeadId,
                        })}
                      {bucketFilter === "all" &&
                        renderBucketSection({
                          title: "Won",
                          description:
                            "Lead yang sudah closing dan relatif aman, cocok untuk cek kelengkapan KPI atau deal metrics.",
                          leads: bucketedLeads.won,
                          selectedLeadId,
                          setSelectedLeadId,
                        })}
                      {bucketFilter === "all" &&
                        renderBucketSection({
                          title: "Archived",
                          description:
                            "Lead yang sudah dingin atau lost, disimpan terpisah supaya list aktif tetap bersih.",
                          leads: bucketedLeads.archived,
                          selectedLeadId,
                          setSelectedLeadId,
                        })}

                      {totalLeadPages > 1 ? (
                        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
                          <p className="text-sm text-[#d8bc84]">
                            Halaman {leadPage} dari {totalLeadPages}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={leadPage === 1}
                              onClick={() =>
                                setLeadPage((current) =>
                                  Math.max(1, current - 1),
                                )
                              }
                              className="rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={leadPage === totalLeadPages}
                              onClick={() =>
                                setLeadPage((current) =>
                                  Math.min(totalLeadPages, current + 1),
                                )
                              }
                              className="rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <aside className="clara-scrollbar rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-5 xl:sticky xl:top-6 xl:max-h-[780px] xl:self-start xl:overflow-y-auto">
                      {selectedLead ? (
                        <>
                          <div className="border-b border-[#f0cb73]/12 pb-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                              Lead Preview
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-bold tracking-tight text-slate-950">
                                {selectedLead.display_name}
                              </h3>
                              <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                {STAGE_LABELS[selectedLead.current_stage] ??
                                  selectedLead.current_stage}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                                  selectedLead.lead_temperature,
                                )}`}
                              >
                                {selectedLead.lead_temperature.toUpperCase()}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                              {selectedLead.summary ??
                                "Belum ada summary lead. Buka detail penuh kalau mau update konteks atau review AI lebih dalam."}
                            </p>
                          </div>

                          <div className="mt-4 space-y-4">
                            <section className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
                                Sync Health
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                                  {selectedLead.needs_deal_sync
                                    ? "Need deal sync"
                                    : "CRM sync ok"}
                                </span>
                                {isOverdueLead(selectedLead) && (
                                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                                    Follow-up overdue
                                  </span>
                                )}
                                {selectedLead.discipline_compliance_status !==
                                "logged_today" ? (
                                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                                    {DISCIPLINE_LABELS[
                                      selectedLead.discipline_compliance_status
                                    ] ??
                                      selectedLead.discipline_compliance_status}
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-[#f0cb73]/18 bg-[#1f170f] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                                    Discipline ok
                                  </span>
                                )}
                              </div>
                            </section>

                            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                              <PreviewStat
                                label="Owner"
                                value={
                                  selectedLead.assigned_user_name ??
                                  "Belum ada owner"
                                }
                              />
                              <PreviewStat
                                label="Customer profile"
                                value={
                                  selectedLead.customer_profile_name ??
                                  "Belum terhubung"
                                }
                              />
                              <PreviewStat
                                label="Last contact"
                                value={formatDateTime(
                                  selectedLead.last_contact_at,
                                )}
                              />
                              <PreviewStat
                                label="Next follow-up"
                                value={formatDateTime(
                                  selectedLead.next_follow_up_at,
                                )}
                              />
                              <PreviewStat
                                label="Deal status"
                                value={
                                  selectedLead.deal_status ?? "Belum diisi"
                                }
                              />
                              <PreviewStat
                                label="Source"
                                value={selectedLead.source_label}
                              />
                            </section>

                            <section className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
                                Apa yang harus dilakukan
                              </p>
                              <div className="mt-3 space-y-3">
                                {getLeadActionItems(selectedLead).map(
                                  (item) => (
                                    <ActionGuideCard
                                      key={item.condition}
                                      title={item.condition}
                                      action={item.action}
                                      detail={item.detail}
                                    />
                                  ),
                                )}
                              </div>
                            </section>

                            <section className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                                Update stage cepat
                              </label>
                              <StageQuickSelect
                                value={selectedLead.current_stage}
                                disabled={updatingLeadId === selectedLead.id}
                                onChange={(stage) => {
                                  void handleStageChange(selectedLead.id, stage);
                                }}
                              />

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                  href={`/dashboard/crm/${selectedLead.id}`}
                                  className="clara-button clara-button-primary px-3 py-2 text-xs"
                                >
                                  Detail Lead
                                </Link>
                                {selectedLead.latest_conversation_id && (
                                  <Link
                                    href={`/dashboard/sales/conversations/${selectedLead.latest_conversation_id}`}
                                    className="clara-button clara-button-ghost px-3 py-2 text-xs"
                                  >
                                    Buka Conversation
                                  </Link>
                                )}
                              </div>
                            </section>
                          </div>
                        </>
                      ) : (
                        <div className="clara-empty-state p-6 text-sm text-[#d6bb84]">
                          Pilih satu lead dari panel kiri untuk melihat preview
                          cepatnya.
                        </div>
                      )}
                    </aside>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function renderBucketSection({
  title,
  description,
  leads,
  selectedLeadId,
  setSelectedLeadId,
}: {
  title: string;
  description: string;
  leads: LeadListItem[];
  selectedLeadId: string | null;
  setSelectedLeadId: (leadId: string) => void;
}) {
  if (!leads.length) return null;

  return (
    <section className="space-y-3">
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
            {title}
          </h4>
          <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
            {leads.length} lead
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#c8ad75]">{description}</p>
      </div>

      <div className="space-y-3">
        {leads.map((lead) => (
          <LeadListRow
            key={lead.id}
            lead={lead}
            isSelected={selectedLeadId === lead.id}
            onSelect={() => setSelectedLeadId(lead.id)}
          />
        ))}
      </div>
    </section>
  );
}

function LeadListRow({
  lead,
  isSelected,
  onSelect,
}: {
  lead: LeadListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isOverdue = isOverdueLead(lead);
  const priorityScore = calculateLeadPriority(lead);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-[22px] border p-4 text-left transition ${
        isSelected
          ? "border-[#f0cb73]/24 bg-[linear-gradient(180deg,rgba(60,42,17,0.98)_0%,rgba(27,20,14,0.98)_100%)] shadow-[0_16px_32px_rgba(0,0,0,0.22)]"
          : "border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] hover:border-[#f0cb73]/28"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">
              {lead.display_name}
            </h2>
            <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
              {STAGE_LABELS[lead.current_stage] ?? lead.current_stage}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                lead.lead_temperature,
              )}`}
            >
              {lead.lead_temperature.toUpperCase()}
            </span>
            {lead.account_category !== "unknown" && (
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                {lead.account_category}
              </span>
            )}
            {isOverdue && (
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#4a3112] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                Overdue
              </span>
            )}
            {lead.needs_deal_sync && (
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#2c1f12] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                Need sync
              </span>
            )}
            {lead.discipline_compliance_status !== "logged_today" && (
              <span className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                {DISCIPLINE_LABELS[lead.discipline_compliance_status] ??
                  lead.discipline_compliance_status}
              </span>
            )}
          </div>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#d6bb84]">
            {lead.summary ??
              "Belum ada summary lead. Jalankan AI analysis dulu kalau konteksnya masih mentah."}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#c8ad75]">
            <p className="rounded-full border border-[#f0cb73]/14 bg-[#1d150d] px-3 py-1.5">
              Owner:{" "}
              <span className="font-semibold text-[#f0cb73]">
                {lead.assigned_user_name ?? "Belum ada owner"}
              </span>
            </p>
            <p className="rounded-full border border-[#f0cb73]/14 bg-[#1d150d] px-3 py-1.5">
              Last contact:{" "}
              <span className="font-semibold text-[#f0cb73]">
                {formatDateTime(lead.last_contact_at)}
              </span>
            </p>
            <p className="rounded-full border border-[#f0cb73]/14 bg-[#1d150d] px-3 py-1.5">
              Next follow-up:{" "}
              <span className="font-semibold text-[#f0cb73]">
                {formatDateTime(lead.next_follow_up_at)}
              </span>
            </p>
            <p className="rounded-full border border-[#f0cb73]/14 bg-[#1d150d] px-3 py-1.5">
              Priority:{" "}
              <span className="font-semibold text-[#f0cb73]">
                {priorityScore}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-3 py-1 text-xs font-semibold text-[#f0cb73]">
          {lead.source_label}
        </div>
      </div>
    </button>
  );
}

function LeadMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[#f0cb73]/18 bg-[#1d150d] px-3.5 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b58d43]">
        {label}
      </span>
      <span className="ml-2 text-sm font-semibold text-[#f0cb73]">{value}</span>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#fff0c9]">{value}</p>
    </article>
  );
}

function StageQuickSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (stage: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative mt-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-[18px] border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(24,18,13,0.98)_0%,rgba(16,12,9,0.98)_100%)] px-4 py-3 text-left text-sm font-semibold text-[#fff0c9] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:border-[#f0cb73]/36 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{STAGE_LABELS[value] ?? value}</span>
        <span
          aria-hidden="true"
          className={`text-[#f0cb73] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="absolute inset-x-0 z-30 mt-2 rounded-[18px] border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(26,19,14,0.99)_0%,rgba(15,11,8,0.99)_100%)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
          <ul
            role="listbox"
            aria-label="Stage lead"
            className="max-h-72 space-y-1 overflow-y-auto pr-1 clara-scrollbar"
          >
            {STAGE_ORDER.map((stage) => {
              const isSelected = stage === value;

              return (
                <li key={stage}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setIsOpen(false);
                      if (stage !== value) {
                        onChange(stage);
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? "bg-[#f0cb73] text-[#1a120b]"
                        : "text-[#f6ddb0] hover:bg-[#2b2013] hover:text-[#fff0c9]"
                    }`}
                  >
                    <span>{STAGE_LABELS[stage]}</span>
                    {isSelected ? (
                      <span className="text-xs font-bold uppercase tracking-[0.18em]">
                        Aktif
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BoardMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#be8d2f_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#140f08]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#140f08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#2f210f]">{hint}</p>
    </article>
  );
}

function BoardGuideCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(25,19,14,0.94)_0%,rgba(16,12,9,0.94)_100%)] p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{description}</p>
    </article>
  );
}

function ActionGuideCard({
  title,
  action,
  detail,
}: {
  title: string;
  action: string;
  detail: string;
}) {
  return (
    <article className="rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <p className="mt-2 text-sm font-medium leading-6 text-[#fff0c9]">
        {action}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{detail}</p>
    </article>
  );
}
