"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowDownWideShort,
  faBullseye,
  faFilter,
  faFire,
  faLayerGroup,
  faLink,
  faRotateLeft,
  faTrophy,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  isHeadRole,
  isManagerRole,
} from "@/lib/roles";
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
  { value: "created_at", label: "Terbaru" },
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

const BUCKET_SECTION_COPY = {
  action: {
    title: "Perlu tindakan",
    description:
      "Lead yang masih butuh aksi hari ini, overdue, atau butuh sinkronisasi CRM.",
  },
  waiting: {
    title: "Waiting",
    description:
      "Lead yang sudah cukup aman untuk sekarang dan tinggal menunggu momen follow-up berikutnya.",
  },
  won: {
    title: "Won",
    description:
      "Lead yang sudah closing dan relatif aman, cocok untuk cek kelengkapan KPI atau deal metrics.",
  },
  archived: {
    title: "Archived",
    description:
      "Lead yang sudah dingin atau lost, disimpan terpisah supaya list aktif tetap bersih.",
  },
} as const;

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

function getSourceLabelBadgeClass(sourceLabel: string) {
  const normalizedSourceLabel = sourceLabel.trim().toLowerCase();

  if (normalizedSourceLabel.includes("telegram extension")) {
    return "border-blue-500/20 bg-blue-500/10 text-blue-500";
  }

  if (normalizedSourceLabel.includes("whatsapp extension")) {
    return "border-green-500/20 bg-green-500/10 text-green-500";
  }

  if (normalizedSourceLabel.includes("instagram")) {
    return "border-pink-500/20 bg-pink-500/10 text-pink-500";
  }

  if (normalizedSourceLabel.includes("facebook")) {
    return "border-indigo-500/20 bg-indigo-500/10 text-indigo-500";
  }

  return "border-[#f0cb73]/20 bg-[#f0cb73]/10 text-[#f0cb73]";
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

function getLeadPriorityTone(priorityScore: number) {
  if (priorityScore >= 70) {
    return {
      label: "Urgent",
      className: "border-[#ffb37a]/22 bg-[#4a2413] text-[#ffd7aa]",
    };
  }

  if (priorityScore >= 35) {
    return {
      label: "Perlu dicek",
      className: "border-[#f0cb73]/18 bg-[#3a2a17] text-[#f0cb73]",
    };
  }

  return {
    label: "Stabil",
    className: "border-[#dcc086]/14 bg-[#22190f] text-[#d7c18e]",
  };
}

export default function CrmPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
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
          : "Gagal memuat daftar leads.",
      );
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
      if (sortBy === "created_at") {
        const leftTime = toDate(left.created_at)?.getTime() ?? 0;
        const rightTime = toDate(right.created_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      }

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
  const effectiveLeadPage = Math.min(leadPage, totalLeadPages);
  const paginatedVisibleLeads = useMemo(() => {
    const startIndex = (effectiveLeadPage - 1) * LEADS_PAGE_SIZE;
    return visibleLeads.slice(startIndex, startIndex + LEADS_PAGE_SIZE);
  }, [effectiveLeadPage, visibleLeads]);

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

  const renderedBucketSections = useMemo(() => {
    if (bucketFilter === "all") {
      return [
        { ...BUCKET_SECTION_COPY.action, leads: bucketedLeads.action },
        { ...BUCKET_SECTION_COPY.waiting, leads: bucketedLeads.waiting },
        { ...BUCKET_SECTION_COPY.won, leads: bucketedLeads.won },
        { ...BUCKET_SECTION_COPY.archived, leads: bucketedLeads.archived },
      ];
    }

    const selectedBucketCopy =
      BUCKET_SECTION_COPY[bucketFilter as keyof typeof BUCKET_SECTION_COPY];

    if (!selectedBucketCopy) {
      return [];
    }

    return [
      {
        ...selectedBucketCopy,
        leads: paginatedVisibleLeads,
      },
    ];
  }, [bucketFilter, bucketedLeads, paginatedVisibleLeads]);

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
    if (!isFilterModalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isFilterModalOpen]);

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
  const isSalesWorkspace = currentUser?.role === "sales";
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;
  const topPriorityLead = useMemo(() => {
    if (!filteredLeads.length) return null;
    return [...filteredLeads].sort(
      (left, right) => calculateLeadPriority(right) - calculateLeadPriority(left),
    )[0] ?? null;
  }, [filteredLeads]);
  const salesLeadSummary =
    summary.needsAction > 0
      ? `Ada ${summary.needsAction} lead yang masih perlu tindakan, termasuk ${summary.overdue} yang sudah overdue.`
      : summary.hot > 0
        ? `Tidak ada tekanan follow-up besar, tapi masih ada ${summary.hot} lead hot yang perlu dijaga ritmenya.`
        : "Lead aktif relatif aman. Kamu bisa fokus rapikan follow-up dan update stage.";
  const leadershipLeadSummary = isHeadWorkspace
    ? summary.needsAction > 0
      ? `Head cukup mulai dari ${summary.needsAction} lead yang mulai butuh perhatian. Fokus utamanya ${summary.overdue} overdue, ${summary.needsSync} perlu sync, dan lead hot yang paling dekat ke keputusan tim.`
      : summary.won > 0
        ? "Lead aktif relatif aman. Pakai halaman ini untuk audit owner, kualitas update stage, dan ritme follow-up lintas tim."
        : "Belum ada tekanan besar. Head bisa pakai halaman ini untuk membaca ritme tim tanpa turun terlalu detail."
    : summary.needsAction > 0
      ? `Manager cukup mulai dari ${summary.needsAction} lead yang masih perlu tindakan. Prioritas utamanya ${summary.overdue} overdue, ${summary.needsSync} perlu sync, dan lead hot yang paling dekat ke closing.`
      : summary.won > 0
        ? "Lead aktif relatif aman. Pakai halaman ini untuk cek lead won, kualitas update stage, dan ritme follow-up tim."
        : "Belum ada tekanan besar. Manager bisa pakai halaman ini untuk audit ritme kerja tim dan melihat lead yang mulai naik prioritasnya.";
  const pageTitle = isHeadWorkspace
    ? "Lead Tim"
    : isManagerWorkspace
      ? "Lead Management"
      : "Leads";
  const pageDescription = isHeadWorkspace
    ? "Halaman head untuk membaca lead lintas tim yang mulai berisiko, cek owner dan stage, lalu turun ke detail hanya saat memang perlu keputusan."
    : isManagerWorkspace
      ? "Halaman manager untuk melihat lead tim yang paling butuh perhatian, lalu turun ke detail lead atau percakapan saat memang perlu."
      : "Tempat paling cepat untuk lihat lead yang masih perlu disentuh, update stage, lalu lanjut ke percakapan.";
  const heroTitle = isHeadWorkspace
    ? "Mulai dari lead tim yang paling dekat ke risiko, eskalasi, atau keputusan"
    : isManagerWorkspace
      ? "Mulai dari lead tim yang paling dekat ke risiko atau aksi"
      : "Fokus ke lead yang paling dekat ke aksi berikutnya";
  const heroSummary = isLeadershipWorkspace
    ? leadershipLeadSummary
    : salesLeadSummary;
  const leadListTitle = isHeadWorkspace
    ? "Daftar lead tim yang perlu dibaca cepat"
    : isManagerWorkspace
      ? "Daftar prioritas lead tim"
      : "Daftar lead yang sedang kamu pegang";
  const leadListDescription = isHeadWorkspace
    ? "Head tidak perlu baca semua lead satu per satu. Pilih dulu lead yang paling butuh keputusan, overdue, atau sinkronisasi tim."
    : isManagerWorkspace
      ? "Manager tidak perlu baca semua lead sekaligus. Pilih dulu lead yang paling butuh keputusan, overdue, atau sinkronisasi."
      : "Pilih lead yang paling perlu diproses, lalu lanjut ke detail atau percakapan.";
  const previewTitle = isLeadershipWorkspace
    ? "Lead preview"
    : "Ringkasan lead";
  const previewEmpty = isLeadershipWorkspace
    ? "Pilih satu lead dari panel kiri untuk melihat ringkasan cepat sebelum turun ke detail penuh."
    : "Pilih satu lead dari panel kiri untuk melihat preview cepatnya.";

  const activeBucketLabel =
    BUCKET_OPTIONS.find((option) => option.value === bucketFilter)?.label ??
    "Semua bucket";
  const activeChannelLabel =
    SOURCE_CHANNEL_OPTIONS.find(
      (option) => option.value === sourceChannelFilter,
    )?.label ?? "Semua Channel";
  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (searchQuery.trim()) count += 1;
    if (sourceChannelFilter !== "all") count += 1;
    if (quickFilter !== "all") count += 1;
    if (bucketFilter !== "all") count += 1;
    if (sortBy !== "created_at") count += 1;

    return count;
  }, [bucketFilter, quickFilter, searchQuery, sortBy, sourceChannelFilter]);

  const effectiveSelectedLeadId =
    selectedLeadId && paginatedVisibleLeads.some((lead) => lead.id === selectedLeadId)
      ? selectedLeadId
      : paginatedVisibleLeads[0]?.id ?? null;
  const selectedLead =
    paginatedVisibleLeads.find((lead) => lead.id === effectiveSelectedLeadId) ?? null;
  const selectedLeadPriorityScore = selectedLead
    ? calculateLeadPriority(selectedLead)
    : 0;
  const selectedLeadPriorityTone = getLeadPriorityTone(
    selectedLeadPriorityScore,
  );
  const selectedLeadLeadershipFocus = selectedLead
    ? selectedLead.needs_deal_sync
      ? isHeadWorkspace
        ? "Deal di lead ini belum sinkron. Head perlu memastikan pembacaan KPI, status deal, dan arah next step tim tetap selaras sebelum issue ini melebar."
        : "Deal di lead ini belum sinkron. Manager sebaiknya cek data KPI dan pastikan status deal-nya tidak tertinggal."
      : isOverdueLead(selectedLead)
        ? isHeadWorkspace
          ? "Lead ini sudah lewat jadwal follow-up. Head cukup cek apakah bottleneck-nya ada di owner, ritme tim, atau butuh arahan lintas tim."
          : "Lead ini sudah lewat jadwal follow-up. Cek apakah sales sudah bergerak dan apakah perlu arahan cepat."
        : selectedLead.discipline_compliance_status !== "logged_today"
          ? isHeadWorkspace
            ? "Log follow-up hari ini belum rapi. Head bisa pakai sinyal ini untuk melihat apakah masalahnya ada di disiplin eksekusi atau hanya keterlambatan pencatatan."
            : "Catatan follow-up hari ini belum rapi. Cek apakah eksekusi sales sudah jalan tapi belum tercatat."
          : selectedLead.current_stage === "closing"
            ? isHeadWorkspace
              ? "Lead ini sudah dekat closing. Head cukup menjaga supaya owner, stage, dan dukungan tim tetap rapi tanpa turun terlalu detail."
              : "Lead ini sudah dekat ke tahap closing. Manager cukup jaga ritme follow-up dan pastikan tidak ada blocker."
            : isHeadWorkspace
              ? "Lead ini relatif aman. Pakai preview ini untuk validasi owner, stage, dan apakah perlu intervensi head sebelum membuka detail penuh."
              : "Lead ini relatif aman. Pakai preview ini untuk validasi owner, stage, dan langkah berikutnya sebelum membuka detail."
    : "";
  const selectedLeadNextAction = selectedLead
    ? selectedLead.needs_deal_sync
      ? isHeadWorkspace
        ? "Buka detail lead lalu pastikan stage, owner, dan KPI/deal sync sudah satu bacaan."
        : "Buka detail lead lalu rapikan KPI/deal sync."
      : isOverdueLead(selectedLead)
        ? isHeadWorkspace
          ? "Cek detail lead untuk memastikan apakah cukup diarahkan ke manager/sales atau perlu eskalasi lebih lanjut."
          : "Buka percakapan atau follow-up untuk cek tindakan terbaru sales."
        : selectedLead.discipline_compliance_status !== "logged_today"
          ? isHeadWorkspace
            ? "Validasi dulu apakah ini masalah disiplin tim atau hanya keterlambatan update log."
            : "Minta sales rapikan log follow-up hari ini."
          : selectedLead.current_stage === "closing"
            ? isHeadWorkspace
              ? "Pantau ritme closing dan cek apakah ada keputusan Head yang perlu diberikan."
              : "Pantau ritme closing dan cek kebutuhan eskalasi."
            : isHeadWorkspace
              ? "Belum ada intervensi besar. Cukup monitor owner, stage, dan suhu lead."
              : "Tidak ada tindakan mendesak. Cukup monitor ritmenya."
    : "";

  function resetFilters() {
    setSearchQuery("");
    setSortBy("created_at");
    setSourceChannelFilter("all");
    setQuickFilter("all");
    setBucketFilter("all");
    setLeadPage(1);
  }

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
      title={pageTitle}
      description={pageDescription}
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <>
          {isHeadWorkspace ? (
            <Link
              href="/dashboard/notifications"
              className="clara-button clara-button-ghost"
            >
              Buka Alert Tim
            </Link>
          ) : isManagerWorkspace ? (
            <Link
              href="/dashboard/manager-insights"
              className="clara-button clara-button-ghost"
            >
              Monitor Tim
            </Link>
          ) : currentUser && canAccessQueueAndActionCenter(currentUser.role) ? (
            <Link
              href="/dashboard/sales"
              className="clara-button clara-button-ghost"
            >
              Chat Masuk
            </Link>
          ) : (
            <Link
              href="/dashboard/approvals"
              className="clara-button clara-button-ghost"
            >
              Review Sales
            </Link>
          )}
          <Link
            href={
              isHeadWorkspace
                ? "/dashboard/approvals"
                : "/dashboard/upload"
            }
            className="clara-button clara-button-primary"
          >
            {isHeadWorkspace ? "Buka Arahan Tim" : "Lead Capture"}
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state p-8 text-center text-sm text-[#d6bb84]">
            Loading leads...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-[#f0cb73]/20 bg-[linear-gradient(180deg,rgba(33,24,17,0.94)_0%,rgba(18,13,10,0.94)_100%)] p-5 text-sm text-[#f0cb73]">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section
              data-onboarding-id="sales-crm-hero"
              className="clara-card rounded-[30px] p-6"
            >
              <p className="clara-kicker text-xs">Ringkasan leads</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {heroTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {heroSummary}
                  </p>
                  {isLeadershipWorkspace && topPriorityLead ? (
                    <p className="mt-3 text-sm font-medium text-[#f0cb73]">
                      Prioritas sekarang: {topPriorityLead.display_name} •{" "}
                      {STAGE_LABELS[topPriorityLead.current_stage] ??
                        topPriorityLead.current_stage}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {isHeadWorkspace ? (
                    <>
                      <Link
                        href="/dashboard/notifications"
                        className="clara-button clara-button-primary justify-center"
                      >
                        Buka Alert Tim
                      </Link>
                      <Link
                        href="/dashboard/approvals"
                        className="clara-button clara-button-ghost justify-center"
                      >
                        Buka Arahan Tim
                      </Link>
                    </>
                  ) : isManagerWorkspace ? (
                    <>
                      <Link
                        href="/dashboard/approvals"
                        className="clara-button clara-button-primary justify-center"
                      >
                        Buka Review Sales
                      </Link>
                      <Link
                        href="/dashboard/manager-insights"
                        className="clara-button clara-button-ghost justify-center"
                      >
                        Lihat Monitor Tim
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/dashboard/sales"
                        className="clara-button clara-button-ghost justify-center"
                      >
                        Buka Chat Masuk
                      </Link>
                      <Link
                        href="/dashboard/follow-up"
                        className="clara-button clara-button-primary justify-center"
                      >
                        Buka Tindak Lanjut
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section
              data-onboarding-id="sales-crm-metrics"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <BoardMetric
                label={isLeadershipWorkspace ? "Butuh perhatian" : "Perlu tindakan"}
                value={String(summary.needsAction)}
                icon={faBullseye}
                accentClass="from-[#f59e0b]/18 to-transparent text-[#f5c15d]"
              />
              <BoardMetric
                label="Overdue"
                value={String(summary.overdue)}
                icon={faBullseye}
                accentClass="from-[#fb923c]/18 to-transparent text-[#f4b164]"
              />
              <BoardMetric
                label="Hot"
                value={String(summary.hot)}
                icon={faFire}
                accentClass="from-[#ef4444]/18 to-transparent text-[#ff9d7a]"
              />
              <BoardMetric
                label="Perlu sync"
                value={String(summary.needsSync)}
                icon={faLink}
                accentClass="from-[#60a5fa]/18 to-transparent text-[#8fc0ff]"
              />
              {isLeadershipWorkspace ? (
                <BoardMetric
                  label="Lead dimonitor"
                  value={String(summary.total)}
                  icon={faUsers}
                  accentClass="from-[#f0cb73]/18 to-transparent text-[#f0cb73]"
                />
              ) : (
                <BoardMetric
                  label="Total lead aktif"
                  value={String(summary.total)}
                  icon={faUsers}
                  accentClass="from-[#f0cb73]/18 to-transparent text-[#f0cb73]"
                />
              )}
            </section>

            <section
              data-onboarding-id="sales-crm-filters"
              className="clara-card rounded-[30px] p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="clara-kicker text-xs">Filter lead</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {isHeadWorkspace
                      ? "Saring lead tim untuk cepat melihat yang butuh keputusan"
                      : isManagerWorkspace
                        ? "Saring lead tim tanpa tenggelam di semua data"
                        : "Cari lead dan rapikan daftar kerja"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {isHeadWorkspace
                      ? "Head cukup pakai filter sederhana untuk menemukan lead yang mulai butuh intervensi, overdue, atau tidak sinkron antar tim."
                      : isManagerWorkspace
                        ? "Manager cukup pakai filter sederhana untuk menemukan lead yang butuh keputusan, overdue, atau sinkronisasi."
                        : "Pakai pencarian dan filter sederhana supaya cepat ketemu lead yang perlu diproses dulu."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFilterModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-5 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                  >
                    <FontAwesomeIcon
                      icon={faFilter}
                      className="h-3.5 w-3.5"
                    />
                    Filter
                    {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-full border border-[#3c2c16] bg-[#22190f] px-5 py-2.5 text-sm font-semibold text-[#e1c27c] transition hover:border-[#f0cb73]/28 hover:bg-[#2a1e12]"
                  >
                    <FontAwesomeIcon
                      icon={faRotateLeft}
                      className="h-3.5 w-3.5"
                    />
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
                <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                  <span>Cari lead</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setLeadPage(1);
                    }}
                    placeholder="Cari nama lead atau summary..."
                    className="w-full rounded-2xl border border-[#4a3618] bg-[#1a130d] px-4 py-3 text-sm text-[#f7e7b7] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.04)] placeholder:text-[#907953]"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                  <span>Bucket</span>
                  <select
                    value={bucketFilter}
                    onChange={(event) => {
                      setBucketFilter(event.target.value);
                      setLeadPage(1);
                    }}
                    className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.05)]"
                  >
                    {BUCKET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                  <span>Quick filter</span>
                  <select
                    value={quickFilter}
                    onChange={(event) => {
                      setQuickFilter(event.target.value);
                      setLeadPage(1);
                    }}
                    className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.05)]"
                  >
                    {QUICK_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                  <span>Urutkan</span>
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value);
                      setLeadPage(1);
                    }}
                    className="w-full rounded-2xl border border-[#4a3618] bg-[#22190f] px-4 py-3 text-sm text-[#efd59e] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.05)]"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {isFilterModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(8,6,4,0.72)] p-4 backdrop-blur-sm sm:items-center">
                <button
                  type="button"
                  aria-label="Tutup filter"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="absolute inset-0"
                />
                <section className="relative z-10 w-full max-w-4xl rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.98)_0%,rgba(22,16,12,0.98)_48%,rgba(53,39,17,0.96)_100%)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.36)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                        Filter
                      </p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#fff0c9]">
                        Lead controls
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFilterModalOpen(false)}
                      className="rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                      <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                          Cari lead
                        </span>
                        <input
                          value={searchQuery}
                            onChange={(event) => {
                              setSearchQuery(event.target.value);
                              setLeadPage(1);
                            }}
                          placeholder="Cari nama, owner, profile, source, atau summary..."
                          className="w-full rounded-2xl border border-[#4a3618] bg-[#1a130d] px-4 py-3 text-sm text-[#f7e7b7] outline-none shadow-[inset_0_1px_0_rgba(255,232,182,0.04)] placeholder:text-[#907953]"
                        />
                      </label>

                      <label className="space-y-2 text-sm font-medium text-[#e3c990]">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                          Sort
                        </span>
                        <select
                          value={sortBy}
                          onChange={(event) => {
                            setSortBy(event.target.value);
                            setLeadPage(1);
                          }}
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
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                          Channel
                        </span>
                        <select
                          value={sourceChannelFilter}
                            onChange={(event) => {
                              setSourceChannelFilter(event.target.value);
                              setLeadPage(1);
                            }}
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
                      <div className="rounded-[22px] border border-[#f0cb73]/12 bg-[linear-gradient(180deg,rgba(34,25,18,0.82)_0%,rgba(18,13,10,0.88)_100%)] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                          Quick Filters
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {QUICK_FILTER_OPTIONS.map((option) => {
                            const isActive = quickFilter === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setQuickFilter(option.value);
                                  setLeadPage(1);
                                }}
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

                      <div className="rounded-[22px] border border-[#f0cb73]/12 bg-[linear-gradient(180deg,rgba(34,25,18,0.82)_0%,rgba(18,13,10,0.88)_100%)] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                          Bucket View
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                                onClick={() => {
                                  setBucketFilter(option.value);
                                  setLeadPage(1);
                                }}
                                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                                  isActive
                                    ? "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                    : "border border-[#3c2c16] bg-[#22190f] text-[#e1c27c] hover:border-[#f0cb73]/28"
                                }`}
                              >
                                {option.label}
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

                  <div className="mt-5 flex flex-col gap-3 border-t border-[#f0cb73]/12 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#d8bc84]">
                      {activeFilterCount > 0
                        ? `${activeFilterCount} filter aktif`
                        : "Belum ada filter aktif"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] hover:border-[#f0cb73]/28"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterModalOpen(false)}
                        className="rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-5 py-2 text-sm font-semibold text-[#140f08]"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(53,39,17,0.94)_100%)] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#f0cb73]/12 px-2 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                    Lead List
                  </p>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {leadListTitle}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c8ad75]">
                    {leadListDescription}
                  </p>
                </div>
                <p className="text-sm text-[#c8ad75]">
                  {paginatedVisibleLeads.length} / {visibleLeads.length} lead
                  tampil di halaman ini
                </p>
              </div>

              <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)]">
                {paginatedVisibleLeads.length === 0 ? (
                  <div className="clara-empty-state p-6 text-sm text-[#d6bb84]">
                    Tidak ada lead yang cocok dengan filter saat ini.
                  </div>
                ) : (
                  <>
                    <div className="flex min-h-0 flex-col gap-4 xl:max-h-[780px]">
                      <div className="clara-scrollbar min-h-0 flex-1 space-y-3 rounded-[24px] border border-[#f0cb73]/12 bg-[linear-gradient(180deg,rgba(35,25,17,0.82)_0%,rgba(17,13,10,0.86)_100%)] p-3 xl:overflow-y-auto">
                        {renderedBucketSections.map((section, index) => (
                          <Fragment key={section.title}>
                            {renderBucketSection({
                              title: section.title,
                              description: section.description,
                              leads: section.leads,
                              selectedLeadId: effectiveSelectedLeadId,
                              setSelectedLeadId,
                              onboardingTargetId:
                                index === 0 ? "sales-crm-list" : undefined,
                            })}
                          </Fragment>
                        ))}
                      </div>

                      {totalLeadPages > 1 ? (
                        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(16,12,9,0.96)_100%)] p-4">
                          <p className="text-sm text-[#d8bc84]">
                            Halaman {effectiveLeadPage} dari {totalLeadPages}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={effectiveLeadPage === 1}
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
                              disabled={effectiveLeadPage === totalLeadPages}
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

                    <div data-onboarding-id="sales-crm-preview">
                      {selectedLead ? (
                        <>
                          <div className="border-b border-[#f0cb73]/12 pb-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                              {previewTitle}
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
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSourceLabelBadgeClass(
                                  selectedLead.source_label,
                                )}`}
                              >
                                {selectedLead.source_label}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedLeadPriorityTone.className}`}
                              >
                                {selectedLeadPriorityTone.label} • skor{" "}
                                {selectedLeadPriorityScore}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                              {selectedLead.summary ??
                                "Belum ada summary lead. Buka detail penuh kalau mau update konteks atau review AI lebih dalam."}
                            </p>
                          </div>

                          <div className="mt-4 space-y-4">
                            {isLeadershipWorkspace ? (
                              <section className="rounded-[20px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(34,25,18,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
                                  {isHeadWorkspace
                                    ? "Fokus head"
                                    : "Fokus manager"}
                                </p>
                                <p className="mt-3 text-sm leading-6 text-[#fff0c9]">
                                  {selectedLeadLeadershipFocus}
                                </p>
                                <div className="mt-3 rounded-2xl border border-[#f0cb73]/12 bg-[#1e160f] px-3 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b9924b]">
                                    Langkah berikutnya
                                  </p>
                                  <p className="mt-2 text-sm font-medium leading-6 text-[#f3d89a]">
                                    {selectedLeadNextAction}
                                  </p>
                                </div>
                              </section>
                            ) : null}

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

                            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
                              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                                {isHeadWorkspace
                                  ? "Kontrol cepat head"
                                  : isManagerWorkspace
                                    ? "Kontrol cepat manager"
                                  : "Update stage cepat"}
                              </label>
                              {isLeadershipWorkspace ? (
                                <p className="mt-2 text-sm leading-6 text-[#d6bb84]">
                                  {isHeadWorkspace
                                    ? "Head cukup cek owner, stage, dan suhu lead di sini sebelum memutuskan perlu turun ke detail atau cukup memberi arahan."
                                    : "Manager bisa cek stage terakhir di sini sebelum membuka detail lead atau percakapan."}
                                </p>
                              ) : null}
                              <StageQuickSelect
                                value={selectedLead.current_stage}
                                disabled={updatingLeadId === selectedLead.id}
                                onChange={(stage) => {
                                  void handleStageChange(
                                    selectedLead.id,
                                    stage,
                                  );
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
                          {previewEmpty}
                        </div>
                      )}
                    </div>
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
  onboardingTargetId,
}: {
  title: string;
  description: string;
  leads: LeadListItem[];
  selectedLeadId: string | null;
  setSelectedLeadId: (leadId: string) => void;
  onboardingTargetId?: string;
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
        {leads.map((lead, index) => (
          <LeadListRow
            key={lead.id}
            lead={lead}
            isSelected={selectedLeadId === lead.id}
            onboardingTargetId={index === 0 ? onboardingTargetId : undefined}
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
  onboardingTargetId,
  onSelect,
}: {
  lead: LeadListItem;
  isSelected: boolean;
  onboardingTargetId?: string;
  onSelect: () => void;
}) {
  const isOverdue = isOverdueLead(lead);
  const priorityScore = calculateLeadPriority(lead);
  const priorityTone = getLeadPriorityTone(priorityScore);
  const nextStepLabel = lead.needs_deal_sync
    ? "Rapikan sync"
    : isOverdue
      ? "Cek follow-up"
      : lead.discipline_compliance_status !== "logged_today"
        ? "Cek log sales"
        : lead.current_stage === "closing"
          ? "Jaga closing"
          : "Monitor";

  return (
    <button
      type="button"
      data-onboarding-id={onboardingTargetId}
      onClick={onSelect}
      className={`block w-full rounded-[22px] border p-4 text-left transition ${
        isSelected
          ? "border-[#f0cb73]/24 bg-[linear-gradient(180deg,rgba(60,42,17,0.98)_0%,rgba(27,20,14,0.98)_100%)] shadow-[0_16px_32px_rgba(0,0,0,0.22)]"
          : "border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] hover:border-[#f0cb73]/28"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityTone.className}`}
              >
                {priorityTone.label} • {priorityScore}
              </span>
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
              <div
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSourceLabelBadgeClass(
                  lead.source_label,
                )}`}
              >
                {lead.source_label}
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-[#f0cb73]/14 bg-[#1c140d] px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b9924b]">
              Next step
            </p>
            <p className="mt-1 text-sm font-semibold text-[#fff0c9]">
              {nextStepLabel}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#d6bb84]">
          {lead.summary ??
            "Belum ada summary lead. Jalankan AI analysis dulu kalau konteksnya masih mentah."}
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-2">
          <LeadMetaPill
            label="Owner"
            value={lead.assigned_user_name ?? "Belum ada owner"}
            icon={faUsers}
          />
          <LeadMetaPill
            label="Last contact"
            value={formatDateTime(lead.last_contact_at)}
            icon={faArrowDownWideShort}
          />
          <LeadMetaPill
            label="Next follow-up"
            value={formatDateTime(lead.next_follow_up_at)}
            icon={faLayerGroup}
          />
          <LeadMetaPill
            label="Deal status"
            value={lead.deal_status ?? "Belum diisi"}
            icon={faTrophy}
          />
        </div>
      </div>
    </button>
  );
}

function LeadMetaPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconDefinition;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cb73]/14 bg-[linear-gradient(180deg,rgba(32,24,17,0.92)_0%,rgba(20,15,11,0.96)_100%)] px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,232,182,0.04)]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0cb73]/10 text-[#d6a74e]">
        <FontAwesomeIcon icon={icon} className="h-3 w-3" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9f7a38]">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold text-[#f0cb73]">
          {value}
        </span>
      </span>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[18px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#fff0c9]">
        {value}
      </p>
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
  const isDropdownOpen = !disabled && isOpen;

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
        aria-expanded={isDropdownOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-[18px] border border-[#f0cb73]/24 bg-[linear-gradient(180deg,rgba(24,18,13,0.98)_0%,rgba(16,12,9,0.98)_100%)] px-4 py-3 text-left text-sm font-semibold text-[#fff8de] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:border-[#f0cb73]/40 hover:text-[#fffdf5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{STAGE_LABELS[value] ?? value}</span>
        <span
          aria-hidden="true"
          className={`text-[#f0cb73] transition-transform ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {isDropdownOpen ? (
        <div className="absolute inset-x-0 z-30 mt-2 rounded-[18px] border border-[#f0cb73]/24 bg-[linear-gradient(180deg,rgba(28,20,15,0.99)_0%,rgba(17,12,9,0.99)_100%)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
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
                        ? "bg-[#f0cb73] text-[#130d07]"
                        : "text-[#fff2cf] hover:bg-[#3a2917] hover:text-[#fffdf5]"
                    }`}
                  >
                    <span>{STAGE_LABELS[stage]}</span>
                    {isSelected ? (
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#2a1c0e]">
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
  icon,
  accentClass,
}: {
  label: string;
  value: string;
  icon: IconDefinition;
  accentClass: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] px-5 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b9924b]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#fff0c9]">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${accentClass}`}
        >
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
