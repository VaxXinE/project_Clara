"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { customerLabel } from "@/lib/customer";
import { dayOffset, formatClock, formatDayLabel, formatRelativeTime } from "@/lib/format";
import { takeFollowUpNotice } from "@/lib/follow-up-notice";
import { QUICK_SCHEDULES } from "@/lib/schedule";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import {
  FOLLOW_UP_RESULTS,
  STAGE,
  TEMPERATURE,
  plainJargon,
} from "@/lib/vocab";
import type {
  CurrentUser,
  LeadListItem,
  LeadQueueActionRequest,
  SalesWorklistItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

/** Tugas urusan customer (balas, hubungi lagi) dipisah dari tugas administrasi (isi catatan harian). */
type TaskKind = "customer" | "log";

type TaskView = {
  kind: TaskKind;
  /** Satu kalimat: apa yang harus dilakukan. */
  headline: string;
  /** Satu-dua kalimat: kenapa, dan saran kalau ada. */
  hint: string;
  ctaLabel: string;
  ctaHref: string;
  /** Makin kecil makin mendesak. */
  rank: number;
};

const LIST_SEARCH_THRESHOLD = 8;
const UNSCHEDULED_LIMIT = 5;

function getWorklistItemKey(item: SalesWorklistItem): string {
  return `${item.lead_id}:${item.task_type}:${item.task_id ?? "derived"}`;
}

function hoursOverdue(item: SalesWorklistItem): number {
  if (!item.next_follow_up_at) {
    return 0;
  }

  return (
    (Date.now() - new Date(item.next_follow_up_at).getTime()) / (1000 * 60 * 60)
  );
}

function isOverdue(item: SalesWorklistItem): boolean {
  return hoursOverdue(item) >= 0 && Boolean(item.next_follow_up_at);
}

function getTimeLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const diffMinutes = Math.round(
    (new Date(value).getTime() - Date.now()) / (1000 * 60),
  );

  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes < 0
      ? `Terlambat ${Math.abs(diffMinutes)} menit`
      : `${diffMinutes} menit lagi`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return diffHours < 0
      ? `Terlambat ${Math.abs(diffHours)} jam`
      : `${diffHours} jam lagi`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays < 0
    ? `Terlambat ${Math.abs(diffDays)} hari`
    : `${diffDays} hari lagi`;
}

/** Tugas yang ditunda Sales dan belum waktunya muncul lagi (hari ini). Backend tetap mengirimnya di daftar utama. */
function isSnoozedForLater(item: SalesWorklistItem): boolean {
  return (
    item.task_status === "snoozed" &&
    Boolean(item.next_follow_up_at) &&
    new Date(item.next_follow_up_at as string).getTime() > Date.now() &&
    dayOffset(item.next_follow_up_at as string) === 0
  );
}

const SNOOZE_OPTIONS: Array<{
  value: NonNullable<LeadQueueActionRequest["duration"]>;
  label: string;
}> = [
  { value: "30m", label: "30 menit lagi" },
  { value: "2h", label: "2 jam lagi" },
  { value: "tomorrow", label: "Besok" },
];

/** Tugas terjadwal yang jatuh tempo mulai besok. Yang jatuh tempo hari ini tetap di daftar utama. */
function isScheduledAhead(item: SalesWorklistItem): boolean {
  return (
    Boolean(item.next_follow_up_at) &&
    dayOffset(item.next_follow_up_at as string) >= 1
  );
}

function withSuggestion(base: string, suggestion: string): string {
  const text = plainJargon(suggestion).trim();
  return text ? `${base} Saran Clara: ${text}` : base;
}

/** Ubah tipe tugas dari backend jadi kalimat perintah, dengan tombol yang cocok dengan perintahnya. */
function describeTask(item: SalesWorklistItem): TaskView {
  const chatHref = item.conversation_id
    ? `/sales/conversations/${item.conversation_id}`
    : `/crm/${item.lead_id}`;
  const openLabel = item.conversation_id ? "Buka chat" : "Buka lead";

  switch (item.task_type) {
    case "missing_discipline_log":
    case "stale_discipline_log":
      return {
        kind: "log",
        headline: "Isi catatan hari ini",
        hint:
          item.task_type === "missing_discipline_log"
            ? "Belum ada catatan untuk customer ini. Tulis singkat apa yang sudah kamu lakukan, misalnya telepon atau chat. Manager memakainya untuk memantau."
            : "Catatan terakhir belum diperbarui hari ini. Tulis singkat apa yang sudah kamu lakukan, dan kapan kamu akan menghubungi lagi.",
        ctaLabel: "Isi catatan",
        ctaHref: `/crm/${item.lead_id}#activity-log-title`,
        rank: 9,
      };

    case "overdue_follow_up":
      return {
        kind: "customer",
        headline: "Waktunya hubungi customer ini lagi",
        hint: withSuggestion(
          "Jadwal follow-up sudah lewat.",
          item.recommended_action,
        ),
        ctaLabel: openLabel,
        ctaHref: chatHref,
        rank: hoursOverdue(item) >= 24 ? 0 : 1,
      };

    case "hot_lead_needs_reply":
      return {
        kind: "customer",
        headline: "Customer sedang tertarik dan menunggu balasanmu",
        hint: withSuggestion(
          "Balas secepatnya supaya tidak keduluan yang lain.",
          item.recommended_action,
        ),
        ctaLabel: "Balas sekarang",
        ctaHref: chatHref,
        rank: 1,
      };

    case "approved_ready_to_send":
      return {
        kind: "customer",
        headline: "Jawaban sudah siap, tinggal dikirim",
        hint: "Salin jawabannya, kirim dari WhatsApp, lalu tandai sudah terkirim.",
        ctaLabel: "Kirim jawaban",
        ctaHref: chatHref,
        rank: 2,
      };

    case "needs_analysis":
      return {
        kind: "customer",
        headline: "Customer membalas lagi, Clara perlu membacanya",
        hint: "Buka chat, lalu klik Baca dan susun jawaban. Jawabannya disiapkan Clara.",
        ctaLabel: "Buka dan baca",
        ctaHref: chatHref,
        rank: 3,
      };

    case "needs_reply_suggestion":
      return {
        kind: "customer",
        headline: "Jawaban untuk pesan terbaru belum ada",
        hint: "Chat sudah dibaca. Buka chat dan minta Clara menyusun jawabannya.",
        ctaLabel: "Buka dan susun jawaban",
        ctaHref: chatHref,
        rank: 4,
      };

    case "scheduled_follow_up":
    case "standard_follow_up":
    case "manual_follow_up":
    case "closing_follow_up":
      return {
        kind: "customer",
        headline: "Hubungi customer ini sesuai jadwal",
        hint: withSuggestion(
          "Jadwal ini kamu atur sendiri di halaman lead.",
          item.recommended_action,
        ),
        ctaLabel: openLabel,
        ctaHref: chatHref,
        rank: 5,
      };

    case "snoozed_follow_up":
      return {
        kind: "customer",
        headline: "Tugas yang kamu tunda",
        hint: "Cek apakah sudah waktunya dilanjutkan.",
        ctaLabel: openLabel,
        ctaHref: chatHref,
        rank: 5,
      };

    default:
      return {
        kind: "customer",
        headline: plainJargon(item.task_label) || "Tindak lanjut customer",
        hint: withSuggestion(plainJargon(item.reason), item.recommended_action),
        ctaLabel: openLabel,
        ctaHref: chatHref,
        rank: 5,
      };
  }
}

function sortByUrgency(
  items: Array<{ item: SalesWorklistItem; view: TaskView }>,
) {
  return [...items].sort(
    (left, right) =>
      left.view.rank - right.view.rank ||
      right.item.priority_score - left.item.priority_score,
  );
}

export default function FollowUpPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [worklist, setWorklist] = useState<SalesWorklistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hiddenItemKeys, setHiddenItemKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [schedulingLeadId, setSchedulingLeadId] = useState<string | null>(null);
  const workspaceRole = currentUser
    ? normalizeWorkspaceRole(currentUser.role)
    : null;
  const isSalesWorkspace = workspaceRole === "sales";

  const loadWorklist = useCallback(async () => {
    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessQueueAndActionCenter(me.role)) {
        router.replace(
          normalizeWorkspaceRole(me.role) === "head"
            ? "/dashboard/notifications"
            : "/dashboard/manager-insights",
        );
        return;
      }

      const data = await apiFetch<SalesWorklistResponse>(
        "/dashboard/sales/worklist",
      );
      setWorklist(data);
      setErrorMessage("");

      try {
        setLeads(await apiFetch<LeadListItem[]>("/leads"));
      } catch {
        // Daftar "belum dijadwalkan" hanya pelengkap. Tugas utama tetap tampil kalau daftar lead gagal dimuat.
        setLeads([]);
      }

      const notice = takeFollowUpNotice();
      if (notice) {
        setSuccessMessage(notice);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Daftar tindak lanjut belum bisa dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadWorklist();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadWorklist]);

  async function handleTaskAction(
    item: SalesWorklistItem,
    payload: LeadQueueActionRequest,
  ) {
    setUpdatingTaskId(item.task_id ?? item.lead_id);
    setActionError("");
    setSuccessMessage("");

    try {
      await apiFetch(`/leads/${item.lead_id}/queue-action`, {
        method: "POST",
        body: payload,
      });
      if (payload.action === "done" || payload.action === "dismiss") {
        setHiddenItemKeys((currentKeys) => {
          const nextKey = getWorklistItemKey(item);
          return currentKeys.includes(nextKey)
            ? currentKeys
            : [...currentKeys, nextKey];
        });
      }
      setSuccessMessage(
        payload.action === "done"
          ? `${item.lead_name} ditandai selesai.`
          : payload.action === "dismiss"
            ? `${item.lead_name} disembunyikan dari daftar ini.`
            : payload.action === "snooze"
              ? `${item.lead_name} ditunda. Muncul lagi di daftar utama saat waktunya tiba.`
              : "Tindak lanjut diperbarui.",
      );
      await loadWorklist();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Tindak lanjut belum bisa diperbarui. Coba lagi.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  /** Atur atau hapus jadwal follow-up sebuah lead. Backend ikut membuat atau memperbarui tugasnya. */
  async function handleSchedule(
    leadId: string,
    leadName: string,
    date: Date | null,
  ) {
    setSchedulingLeadId(leadId);
    setActionError("");
    setSuccessMessage("");

    try {
      await apiFetch(`/leads/${leadId}`, {
        method: "PATCH",
        body: { next_follow_up_at: date ? date.toISOString() : null },
      });
      setSuccessMessage(
        date
          ? `${leadName} dijadwalkan: ${formatDayLabel(date.toISOString())}, ${formatClock(date.toISOString())}.`
          : `Jadwal follow-up ${leadName} dihapus.`,
      );
      await loadWorklist();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Jadwal belum bisa disimpan. Coba lagi.",
      );
    } finally {
      setSchedulingLeadId(null);
    }
  }

  const query = searchQuery.trim().toLowerCase();

  const {
    customerTasks,
    logTasks,
    total,
    customerTotal,
    tomorrow,
    later,
    snoozed,
  } = useMemo(() => {
    const notHidden = (item: SalesWorklistItem) =>
      !hiddenItemKeys.includes(getWorklistItemKey(item));
    const allItems = (worklist?.items ?? []).filter(notHidden);
    const upcoming = (worklist?.upcoming_items ?? []).filter(notHidden);

    // Tugas terjadwal untuk besok atau lebih jauh dipindah keluar dari daftar "hari ini", apa pun asalnya dari backend.
    const snoozedItems = allItems
      .filter(isSnoozedForLater)
      .sort((left, right) =>
        (left.next_follow_up_at ?? "").localeCompare(
          right.next_follow_up_at ?? "",
        ),
      );
    const todayItems = [
      ...allItems.filter(
        (item) =>
          !(item.task_id && isScheduledAhead(item)) && !isSnoozedForLater(item),
      ),
      ...upcoming.filter((item) => !isScheduledAhead(item)),
    ];
    const ahead = [
      ...allItems.filter((item) => item.task_id && isScheduledAhead(item)),
      ...upcoming.filter(isScheduledAhead),
    ].sort((left, right) =>
      (left.next_follow_up_at ?? "").localeCompare(
        right.next_follow_up_at ?? "",
      ),
    );

    const visible = todayItems.map((item) => ({
      item,
      view: describeTask(item),
    }));
    const matching = query
      ? visible.filter(({ item, view }) =>
          `${item.lead_name} ${view.headline} ${view.hint}`
            .toLowerCase()
            .includes(query),
        )
      : visible;
    const aheadViews = ahead.map((item) => ({
      item,
      view: describeTask(item),
    }));

    return {
      customerTasks: sortByUrgency(
        matching.filter(({ view }) => view.kind === "customer"),
      ),
      logTasks: sortByUrgency(
        matching.filter(({ view }) => view.kind === "log"),
      ),
      total: visible.length,
      customerTotal: visible.filter(({ view }) => view.kind === "customer")
        .length,
      tomorrow: aheadViews.filter(
        ({ item }) => dayOffset(item.next_follow_up_at as string) === 1,
      ),
      later: aheadViews.filter(
        ({ item }) => dayOffset(item.next_follow_up_at as string) > 1,
      ),
      snoozed: snoozedItems.map((item) => ({ item, view: describeTask(item) })),
    };
  }, [hiddenItemKeys, query, worklist]);

  const unscheduled = useMemo(() => {
    const alreadyHandled = new Set(
      [
        ...(worklist?.items ?? []).filter(
          (item) => describeTask(item).kind === "customer",
        ),
        ...(worklist?.upcoming_items ?? []),
      ].map((item) => item.lead_id),
    );
    const closedValues = ["won", "lost"];
    const heat = (lead: LeadListItem) =>
      lead.lead_temperature === "hot" ? 0 : 1;

    return (
      leads
        .filter(
          (lead) =>
            (lead.lead_temperature === "hot" ||
              lead.lead_temperature === "warm") &&
            !lead.next_follow_up_at &&
            !closedValues.includes(lead.current_stage) &&
            !closedValues.includes(lead.deal_status ?? "") &&
            !alreadyHandled.has(lead.id),
        )
        // Yang paling panas dulu, lalu yang paling lama tidak dihubungi.
        .sort(
          (left, right) =>
            heat(left) - heat(right) ||
            (left.last_contact_at ?? "").localeCompare(
              right.last_contact_at ?? "",
            ),
        )
    );
  }, [leads, worklist]);

  const logTotal = total - customerTotal;
  const aheadCount = tomorrow.length + later.length;

  const summary = useMemo(() => {
    if (!worklist) {
      return { title: "", helper: "" };
    }

    if (customerTotal > 0) {
      return {
        title: `${customerTotal} customer menunggu kamu`,
        helper:
          worklist.overdue_24h_count > 0
            ? `${worklist.overdue_24h_count} sudah terlambat lebih dari sehari. Mulai dari yang paling atas.`
            : "Kerjakan dari atas ke bawah. Yang paling mendesak ada di atas.",
      };
    }

    if (logTotal > 0) {
      return {
        title: "Semua customer sudah kamu tangani",
        helper: `Tinggal ${logTotal} catatan harian yang belum diisi.`,
      };
    }

    return {
      title: "Semua tindak lanjut hari ini sudah beres",
      helper:
        "Tidak ada customer yang perlu dihubungi, dan catatan harian sudah terisi. Tugas yang selesai otomatis hilang dari sini.",
    };
  }, [customerTotal, logTotal, worklist]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.followUp}
      description={
        isSalesWorkspace
          ? "Customer yang perlu kamu hubungi lagi, dan catatan harian yang belum kamu isi."
          : "Pekerjaan tindak lanjut yang perlu dikerjakan sekarang, lengkap dengan alasannya."
      }
      actions={
        !isSalesWorkspace ? (
          <Link
            href="/notifications"
            className="clara-button clara-button-ghost"
          >
            Lihat Alert
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {isLoading ? (
          <LoadingState message="Memuat daftar tindak lanjut..." />
        ) : null}

        {!isLoading && errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => {
              setIsLoading(true);
              void loadWorklist();
            }}
          />
        ) : null}

        {actionError ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {actionError}
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="clara-alert clara-alert-success"
          >
            {successMessage}
          </div>
        ) : null}

        {!isLoading && worklist ? (
          <>
            <section
              data-onboarding-id="sales-followup-focus"
              aria-labelledby="followup-summary"
              className="clara-card p-5 sm:p-6"
            >
              <h2
                id="followup-summary"
                className="text-xl font-bold clara-text-primary sm:text-2xl"
              >
                {summary.title}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                {summary.helper}
              </p>
              {tomorrow.length > 0 ? (
                <p className="mt-3 text-sm font-semibold text-clara-gold">
                  Besok: {tomorrow.length} follow-up sudah dijadwalkan (lihat di
                  bawah)
                </p>
              ) : null}
              {unscheduled.length > 0 ? (
                <p className="mt-2 text-sm font-semibold text-clara-warning">
                  {unscheduled.length} lead panas atau hangat belum punya jadwal
                  follow-up (lihat di bawah)
                </p>
              ) : null}
              {worklist.completed_today_count > 0 ? (
                <p
                  data-onboarding-id="sales-followup-metrics"
                  className="mt-2 text-sm clara-text-muted"
                >
                  Sudah kamu selesaikan hari ini:{" "}
                  {worklist.completed_today_count}
                </p>
              ) : null}
              {total === 0 ? (
                <div className="mt-4">
                  <Link
                    href="/sales"
                    className="clara-button clara-button-primary"
                  >
                    Buka Chat Masuk
                  </Link>
                </div>
              ) : null}
            </section>

            {total > LIST_SEARCH_THRESHOLD ? (
              <section
                data-onboarding-id="sales-followup-filters"
                aria-label="Cari tindak lanjut"
              >
                <label htmlFor="followup-search" className="sr-only">
                  Cari tindak lanjut
                </label>
                <input
                  id="followup-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama customer"
                  className="clara-input w-full"
                />
              </section>
            ) : null}

            {total > 0 &&
            customerTasks.length === 0 &&
            logTasks.length === 0 ? (
              <EmptyState
                title="Tidak ada yang cocok"
                description="Ubah kata pencarian."
              />
            ) : null}

            {customerTasks.length > 0 ? (
              <TaskSection
                id="customer"
                title="Hubungi atau balas customer"
                description="Kerjakan dari atas ke bawah."
                onboardingId="sales-followup-list"
                tasks={customerTasks}
                showOwner={!isSalesWorkspace}
                updatingTaskId={updatingTaskId}
                onTaskAction={handleTaskAction}
              />
            ) : null}

            {logTasks.length > 0 ? (
              <TaskSection
                id="log"
                title="Catatan harian yang belum diisi"
                description="Bukan untuk customer. Ini laporan singkat tentang apa yang sudah kamu kerjakan, dipakai manager untuk memantau."
                tasks={logTasks}
                showOwner={!isSalesWorkspace}
                updatingTaskId={updatingTaskId}
                onTaskAction={handleTaskAction}
              />
            ) : null}

            {unscheduled.length > 0 ? (
              <UnscheduledSection
                leads={unscheduled}
                schedulingLeadId={schedulingLeadId}
                onSchedule={handleSchedule}
              />
            ) : null}

            {tomorrow.length > 0 ? (
              <ScheduledSection
                id="tomorrow"
                title="Besok"
                description="Sudah dijadwalkan. Belum perlu dikerjakan hari ini."
                onboardingId="sales-followup-upcoming"
                tasks={tomorrow}
                showOwner={!isSalesWorkspace}
                schedulingLeadId={schedulingLeadId}
                onSchedule={handleSchedule}
              />
            ) : null}

            {later.length > 0 ? (
              <ScheduledSection
                id="later"
                title="Hari-hari berikutnya"
                description="Jadwal yang lebih jauh."
                tasks={later}
                showOwner={!isSalesWorkspace}
                schedulingLeadId={schedulingLeadId}
                onSchedule={handleSchedule}
                withDay
              />
            ) : null}

            {snoozed.length > 0 ? (
              <ScheduledSection
                id="snoozed"
                title="Ditunda sementara"
                description="Muncul lagi di daftar utama pada jam yang tertera."
                tasks={snoozed}
                showOwner={!isSalesWorkspace}
              />
            ) : null}

            {aheadCount === 0 && total === 0 && unscheduled.length === 0 ? (
              <section
                aria-label="Jadwal besok"
                className="clara-card-outline space-y-3 p-4 sm:p-5"
              >
                <h2 className="text-base font-semibold clara-text-primary">
                  Besok belum ada yang dijadwalkan
                </h2>
                <p className="text-sm leading-6 clara-text-secondary">
                  Untuk menjadwalkan follow-up: buka salah satu lead, lalu klik{" "}
                  <strong>Besok pagi</strong> di bagian &ldquo;Jadwalkan
                  follow-up&rdquo;. Lead itu akan muncul di sini pada harinya.
                </p>
                <Link
                  href="/crm"
                  className="clara-button clara-button-secondary"
                >
                  Buka daftar Lead
                </Link>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function TaskSection({
  id,
  title,
  description,
  onboardingId,
  tasks,
  showOwner,
  updatingTaskId,
  onTaskAction,
}: {
  id: string;
  title: string;
  description: string;
  onboardingId?: string;
  tasks: Array<{ item: SalesWorklistItem; view: TaskView }>;
  showOwner: boolean;
  updatingTaskId: string | null;
  onTaskAction: (
    item: SalesWorklistItem,
    payload: LeadQueueActionRequest,
  ) => Promise<void>;
}) {
  return (
    <section
      aria-labelledby={`tasks-${id}`}
      data-onboarding-id={onboardingId}
      className="space-y-3"
    >
      <div>
        <h2
          id={`tasks-${id}`}
          className="text-base font-semibold clara-text-primary"
        >
          {title}{" "}
          <span className="font-normal clara-text-muted">({tasks.length})</span>
        </h2>
        <p className="mt-0.5 text-sm clara-text-secondary">{description}</p>
      </div>
      <ul className="space-y-3">
        {tasks.map(({ item, view }, index) => (
          <TaskCard
            key={getWorklistItemKey(item)}
            item={item}
            view={view}
            index={index}
            showOwner={showOwner}
            isUpdating={updatingTaskId === (item.task_id ?? item.lead_id)}
            onTaskAction={onTaskAction}
          />
        ))}
      </ul>
    </section>
  );
}

function TaskCard({
  item,
  view,
  index,
  showOwner,
  isUpdating,
  onTaskAction,
}: {
  item: SalesWorklistItem;
  view: TaskView;
  index: number;
  showOwner: boolean;
  isUpdating: boolean;
  onTaskAction: (
    item: SalesWorklistItem,
    payload: LeadQueueActionRequest,
  ) => Promise<void>;
}) {
  const [panel, setPanel] = useState<"done" | "snooze" | null>(null);
  const [reasonTag, setReasonTag] = useState("follow_up_executed");
  const [reasonNote, setReasonNote] = useState("");
  const fieldId = `${item.task_id ?? item.lead_id}-${index}`;
  const timeLabel =
    view.kind === "customer" ? getTimeLabel(item.next_follow_up_at) : null;
  const canMarkDone = view.kind === "customer";

  function buildPayload(
    action: LeadQueueActionRequest["action"],
  ): LeadQueueActionRequest {
    return {
      action,
      duration: null,
      reason_tag: reasonTag,
      reason_note: reasonNote.trim() || null,
    };
  }

  function togglePanel(next: "done" | "snooze") {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="break-words text-base font-semibold clara-text-primary">
          {item.lead_name}
        </h3>
        {timeLabel ? (
          <Tag tone={isOverdue(item) ? "danger" : "neutral"}>{timeLabel}</Tag>
        ) : null}
        {view.kind === "customer" && item.lead_temperature !== "unknown" ? (
          <ValueTag table={TEMPERATURE} value={item.lead_temperature} />
        ) : null}
        {view.kind === "customer" && item.current_stage !== "unknown" ? (
          <ValueTag table={STAGE} value={item.current_stage} />
        ) : null}
      </div>

      <p className="mt-3 text-base font-semibold clara-text-primary">
        {view.headline}
      </p>
      <p className="mt-1 text-sm leading-6 clara-text-secondary">{view.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={view.ctaHref} className="clara-button clara-button-primary">
          {view.ctaLabel}
        </Link>
        {canMarkDone ? (
          <>
            <button
              type="button"
              onClick={() => togglePanel("done")}
              aria-expanded={panel === "done"}
              className="clara-button clara-button-secondary"
            >
              Sudah saya kerjakan
            </button>
            <button
              type="button"
              onClick={() => togglePanel("snooze")}
              aria-expanded={panel === "snooze"}
              className="clara-button clara-button-ghost"
            >
              Tunda
            </button>
          </>
        ) : null}
        <p className="text-xs clara-text-muted sm:ml-auto">
          Kontak terakhir {formatRelativeTime(item.last_contact_at)}
          {showOwner
            ? ` · Penanggung jawab: ${item.assigned_user_name ?? "belum ada"}`
            : ""}
        </p>
      </div>

      {canMarkDone && panel === "snooze" ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-clara-line-subtle p-4">
          <p className="text-sm clara-text-secondary">
            Belum sempat sekarang? Tunda sampai kapan. Tugas ini muncul lagi di
            daftar utama saat waktunya tiba.
          </p>
          <div className="flex flex-wrap gap-2">
            {SNOOZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={isUpdating}
                onClick={() =>
                  void onTaskAction(item, {
                    action: "snooze",
                    duration: option.value,
                    reason_tag: "not_priority_now",
                    reason_note: null,
                  })
                }
                className="clara-button clara-button-secondary"
              >
                {isUpdating ? "Menyimpan..." : option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canMarkDone && panel === "done" ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-clara-line-subtle p-4">
          <p className="text-sm clara-text-secondary">
            Hasilnya apa? Setelah disimpan, tugas ini hilang dari daftar.
          </p>
          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label htmlFor={`result-${fieldId}`} className="clara-label">
                Hasilnya
              </label>
              <select
                id={`result-${fieldId}`}
                value={reasonTag}
                onChange={(event) => setReasonTag(event.target.value)}
                className="clara-select mt-2 w-full"
                disabled={isUpdating}
              >
                {FOLLOW_UP_RESULTS.map((result) => (
                  <option key={result.value} value={result.value}>
                    {result.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`note-${fieldId}`} className="clara-label">
                Catatan (boleh dikosongkan)
              </label>
              <input
                id={`note-${fieldId}`}
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                className="clara-input mt-2 w-full"
                placeholder="Contoh: sudah janji telepon besok pagi"
                disabled={isUpdating}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void onTaskAction(item, buildPayload("done"))}
              className="clara-button clara-button-primary"
            >
              {isUpdating ? "Menyimpan..." : "Simpan dan tandai selesai"}
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void onTaskAction(item, buildPayload("dismiss"))}
              className="clara-button clara-button-ghost"
              title="Hilangkan dari daftar ini tanpa menandainya selesai"
            >
              Tidak perlu, hilangkan
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Lead panas atau hangat yang belum punya jadwal follow-up: yang paling mungkin terlupakan. */
function UnscheduledSection({
  leads,
  schedulingLeadId,
  onSchedule,
}: {
  leads: LeadListItem[];
  schedulingLeadId: string | null;
  onSchedule: (
    leadId: string,
    leadName: string,
    date: Date | null,
  ) => Promise<void>;
}) {
  const shown = leads.slice(0, UNSCHEDULED_LIMIT);
  const quickOptions = QUICK_SCHEDULES.filter(
    (option) => option.key !== "tomorrow-noon",
  );

  return (
    <section aria-labelledby="unscheduled-title" className="space-y-3">
      <div>
        <h2
          id="unscheduled-title"
          className="text-base font-semibold clara-text-primary"
        >
          Belum dijadwalkan{" "}
          <span className="font-normal clara-text-muted">({leads.length})</span>
        </h2>
        <p className="mt-0.5 text-sm clara-text-secondary">
          Lead panas dan hangat yang belum punya jadwal follow-up. Pilih kapan
          kamu akan menghubunginya supaya tidak terlupakan.
        </p>
      </div>
      <ul className="space-y-2">
        {shown.map((lead) => {
          const isSaving = schedulingLeadId === lead.id;

          return (
            <li
              key={lead.id}
              className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-sm font-semibold clara-text-primary">
                  {customerLabel(lead.display_name).text}
                </h3>
                <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
                {lead.current_stage !== "unknown" ? (
                  <ValueTag table={STAGE} value={lead.current_stage} />
                ) : null}
                <span className="text-xs clara-text-muted">
                  Terakhir dihubungi {formatRelativeTime(lead.last_contact_at)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm clara-text-secondary">Jadwalkan:</span>
                {quickOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      void onSchedule(lead.id, lead.display_name, option.date())
                    }
                    className="clara-button clara-button-secondary"
                  >
                    {isSaving ? "Menyimpan..." : option.shortLabel}
                  </button>
                ))}
                <Link
                  href={`/crm/${lead.id}`}
                  className="clara-button clara-button-ghost sm:ml-auto"
                >
                  Buka lead
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {leads.length > shown.length ? (
        <p className="text-sm clara-text-secondary">
          Dan {leads.length - shown.length} lead lainnya.{" "}
          <Link
            href="/crm"
            className="font-semibold text-clara-gold hover:underline"
          >
            Lihat semua di Lead
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function ScheduledSection({
  id,
  title,
  description,
  onboardingId,
  tasks,
  showOwner,
  withDay = false,
  schedulingLeadId = null,
  onSchedule,
}: {
  id: string;
  title: string;
  description: string;
  onboardingId?: string;
  tasks: Array<{ item: SalesWorklistItem; view: TaskView }>;
  showOwner: boolean;
  /** Tampilkan nama hari di tiap baris, untuk jadwal yang lebih jauh dari besok. */
  withDay?: boolean;
  schedulingLeadId?: string | null;
  /** Kalau ada, baris jadwal biasa bisa dipindah atau dihapus dari sini. */
  onSchedule?: (
    leadId: string,
    leadName: string,
    date: Date | null,
  ) => Promise<void>;
}) {
  return (
    <section
      aria-labelledby={`scheduled-${id}`}
      data-onboarding-id={onboardingId}
      className="space-y-3"
    >
      <div>
        <h2
          id={`scheduled-${id}`}
          className="text-base font-semibold clara-text-primary"
        >
          {title}{" "}
          <span className="font-normal clara-text-muted">({tasks.length})</span>
        </h2>
        <p className="mt-0.5 text-sm clara-text-secondary">{description}</p>
      </div>
      <ul className="space-y-2">
        {tasks.map(({ item, view }) => (
          <ScheduledRow
            key={getWorklistItemKey(item)}
            item={item}
            view={view}
            showOwner={showOwner}
            withDay={withDay}
            isSaving={schedulingLeadId === item.lead_id}
            onSchedule={onSchedule}
          />
        ))}
      </ul>
    </section>
  );
}

function ScheduledRow({
  item,
  view,
  showOwner,
  withDay,
  isSaving,
  onSchedule,
}: {
  item: SalesWorklistItem;
  view: TaskView;
  showOwner: boolean;
  withDay: boolean;
  isSaving: boolean;
  onSchedule?: (
    leadId: string,
    leadName: string,
    date: Date | null,
  ) => Promise<void>;
}) {
  const [showReschedule, setShowReschedule] = useState(false);
  const isSnoozed = item.task_status === "snoozed";
  // Hanya jadwal biasa yang bisa dipindah dari lead. Tugas manual atau yang ditunda punya jadwalnya sendiri.
  const canReschedule =
    Boolean(onSchedule) &&
    item.task_type === "scheduled_follow_up" &&
    !isSnoozed;
  const at = item.next_follow_up_at as string;

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="shrink-0 sm:w-28">
          <p className="text-sm font-bold text-clara-gold">{formatClock(at)}</p>
          {withDay ? (
            <p className="text-xs clara-text-muted">{formatDayLabel(at)}</p>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-sm font-semibold clara-text-primary">
              {item.lead_name}
            </h3>
            {item.lead_temperature !== "unknown" ? (
              <ValueTag table={TEMPERATURE} value={item.lead_temperature} />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 clara-text-secondary">
            {isSnoozed
              ? "Kamu tunda tugas ini. Muncul lagi di daftar utama saat waktunya tiba."
              : view.hint}
          </p>
          {showOwner ? (
            <p className="mt-1 text-xs clara-text-muted">
              Penanggung jawab: {item.assigned_user_name ?? "belum ada"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canReschedule ? (
            <button
              type="button"
              onClick={() => setShowReschedule((current) => !current)}
              aria-expanded={showReschedule}
              className="clara-button clara-button-ghost"
            >
              Ubah jadwal
            </button>
          ) : null}
          <Link
            href={view.ctaHref}
            className="clara-button clara-button-secondary"
          >
            {view.ctaLabel}
          </Link>
        </div>
      </div>

      {canReschedule && showReschedule && onSchedule ? (
        <div className="mt-3 space-y-2 border-t border-clara-line-subtle pt-3">
          <p className="text-sm clara-text-secondary">
            Pindahkan follow-up ke:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SCHEDULES.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void onSchedule(item.lead_id, item.lead_name, option.date())
                }
                className="clara-button clara-button-secondary"
              >
                {isSaving ? "Menyimpan..." : option.label}
              </button>
            ))}
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                void onSchedule(item.lead_id, item.lead_name, null)
              }
              className="clara-button clara-button-ghost"
              title="Hapus jadwal. Lead ini tidak akan muncul di daftar jadwal lagi."
            >
              Hapus jadwal
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
