"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import {
  canAccessQueueAndActionCenter,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import { FOLLOW_UP_RESULTS, STAGE, TEMPERATURE, plainJargon } from "@/lib/vocab";
import type {
  CurrentUser,
  LeadQueueActionRequest,
  SalesWorklistItem,
  SalesWorklistResponse,
} from "@/types/dashboard";

function getWorklistItemKey(item: SalesWorklistItem): string {
  return `${item.lead_id}:${item.task_type}:${item.task_id ?? "derived"}`;
}

type ActionBucketKey =
  | "critical"
  | "due_today"
  | "ready_to_send"
  | "needs_analysis"
  | "hot_lead"
  | "other";

const BUCKET_ORDER: ActionBucketKey[] = [
  "critical",
  "due_today",
  "ready_to_send",
  "needs_analysis",
  "hot_lead",
  "other",
];

const BUCKETS: Record<ActionBucketKey, { label: string; description: string }> = {
  critical: {
    label: "Sudah lama terlambat",
    description: "Terlambat lebih dari sehari. Hubungi lebih dulu supaya customer tidak merasa ditinggal.",
  },
  due_today: {
    label: "Hari ini",
    description: "Jatuh tempo hari ini atau baru lewat sedikit.",
  },
  ready_to_send: {
    label: "Siap dikirim",
    description: "Jawabannya sudah siap. Cek sekali lagi, kirim, lalu tandai selesai.",
  },
  needs_analysis: {
    label: "Perlu dibaca Clara",
    description: "Minta Clara membaca chat-nya dulu sebelum kamu menindaklanjuti.",
  },
  hot_lead: {
    label: "Customer panas",
    description: "Customer yang sedang tertarik. Jaga supaya komunikasinya tidak putus.",
  },
  other: {
    label: "Lainnya",
    description: "Masih aktif, tapi tidak semendesak yang di atas.",
  },
};

function getTimeLabel(value: string | null): string {
  if (!value) {
    return "Belum dijadwalkan";
  }

  const target = new Date(value).getTime();
  const diffMinutes = Math.round((target - Date.now()) / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes < 0
      ? `Terlambat ${Math.abs(diffMinutes)} menit`
      : `${diffMinutes} menit lagi`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return diffHours < 0 ? `Terlambat ${Math.abs(diffHours)} jam` : `${diffHours} jam lagi`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays < 0 ? `Terlambat ${Math.abs(diffDays)} hari` : `${diffDays} hari lagi`;
}

function isOverdue(item: SalesWorklistItem): boolean {
  if (!item.next_follow_up_at) {
    return false;
  }
  return new Date(item.next_follow_up_at).getTime() <= Date.now();
}

function getActionBucket(item: SalesWorklistItem): ActionBucketKey {
  const label = `${item.task_label} ${item.reason} ${item.recommended_action}`.toLowerCase();
  const nextFollowUpTime = item.next_follow_up_at
    ? new Date(item.next_follow_up_at).getTime()
    : null;
  const hoursOverdue =
    nextFollowUpTime !== null ? (Date.now() - nextFollowUpTime) / (1000 * 60 * 60) : 0;

  if (isOverdue(item) && hoursOverdue >= 24) {
    return "critical";
  }

  if (label.includes("ready to send") || label.includes("reply")) {
    return "ready_to_send";
  }

  if (label.includes("analysis") || label.includes("analisis")) {
    return "needs_analysis";
  }

  if (item.lead_temperature === "hot") {
    return "hot_lead";
  }

  if (isOverdue(item) || item.next_follow_up_at) {
    return "due_today";
  }

  return "other";
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
  const [bucketFilter, setBucketFilter] = useState<"all" | ActionBucketKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
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

      const data = await apiFetch<SalesWorklistResponse>("/dashboard/sales/worklist");
      setWorklist(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Daftar tindak lanjut belum bisa dimuat.",
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

  async function handleTaskAction(item: SalesWorklistItem, payload: LeadQueueActionRequest) {
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
          return currentKeys.includes(nextKey) ? currentKeys : [...currentKeys, nextKey];
        });
      }
      setSuccessMessage(
        payload.action === "done"
          ? `${item.lead_name} ditandai selesai.`
          : payload.action === "dismiss"
            ? `${item.lead_name} disembunyikan dari daftar ini.`
            : "Tindak lanjut diperbarui.",
      );
      await loadWorklist();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Tindak lanjut belum bisa diperbarui. Coba lagi.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const visibleItems = useMemo(
    () => (worklist?.items ?? []).filter((item) => !hiddenItemKeys.includes(getWorklistItemKey(item))),
    [hiddenItemKeys, worklist],
  );
  const visibleUpcomingItems = (worklist?.upcoming_items ?? []).filter(
    (item) => !hiddenItemKeys.includes(getWorklistItemKey(item)),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const bucketCounts = useMemo(() => {
    const counts: Partial<Record<ActionBucketKey, number>> = {};

    for (const item of visibleItems) {
      const bucket = getActionBucket(item);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }

    return counts;
  }, [visibleItems]);

  const filteredVisibleItems = useMemo(() => {
    return visibleItems.filter((item) => {
      if (bucketFilter !== "all" && getActionBucket(item) !== bucketFilter) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return [item.lead_name, item.task_label, item.reason, item.recommended_action, item.assigned_user_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [bucketFilter, normalizedSearchQuery, visibleItems]);

  const sections = useMemo(
    () =>
      BUCKET_ORDER.map((bucket) => ({
        bucket,
        items: filteredVisibleItems.filter((item) => getActionBucket(item) === bucket),
      })).filter((section) => section.items.length > 0),
    [filteredVisibleItems],
  );

  const summary = useMemo(() => {
    if (!worklist) {
      return { title: "", helper: "" };
    }

    if (worklist.overdue_24h_count > 0) {
      return {
        title: `${worklist.overdue_24h_count} tindak lanjut sudah terlambat lebih dari sehari`,
        helper: "Mulai dari yang paling atas supaya customer tidak merasa ditinggal.",
      };
    }

    if (worklist.due_today_count > 0) {
      return {
        title: `${worklist.due_today_count} tindak lanjut harus selesai hari ini`,
        helper: "Kerjakan yang jatuh tempo dulu, lalu lanjut ke yang siap dikirim.",
      };
    }

    if (visibleItems.length > 0) {
      return {
        title: `${visibleItems.length} tindak lanjut menunggu kamu`,
        helper: "Tidak ada yang mendesak. Kerjakan dari atas ke bawah.",
      };
    }

    return {
      title: "Tidak ada tindak lanjut yang menunggu",
      helper: "Semua sudah beres. Cek Chat Masuk kalau ada customer yang perlu dibalas.",
    };
  }, [visibleItems.length, worklist]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.followUp}
      description={
        isSalesWorkspace
          ? "Customer yang perlu kamu hubungi lagi. Kerjakan dari atas ke bawah, lalu tandai selesai."
          : "Pekerjaan tindak lanjut yang perlu dikerjakan sekarang, lengkap dengan alasannya."
      }
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        !isSalesWorkspace ? (
          <Link href="/notifications" className="clara-button clara-button-ghost">
            Lihat Alert
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat daftar tindak lanjut..." /> : null}

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
          <div role="status" aria-live="polite" className="clara-alert clara-alert-success">
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
              <h2 id="followup-summary" className="text-xl font-bold clara-text-primary sm:text-2xl">
                {summary.title}
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">{summary.helper}</p>
              <p
                data-onboarding-id="sales-followup-metrics"
                className="mt-3 text-sm clara-text-muted"
              >
                Selesai hari ini: {worklist.completed_today_count} · Dijadwalkan nanti:{" "}
                {visibleUpcomingItems.length}
              </p>
            </section>

            {visibleItems.length > 0 ? (
              <section
                data-onboarding-id="sales-followup-filters"
                aria-label="Cari dan saring tindak lanjut"
                className="clara-card space-y-4 p-4 sm:p-5"
              >
                <div>
                  <label htmlFor="followup-search" className="clara-label">
                    Cari tindak lanjut
                  </label>
                  <input
                    id="followup-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nama customer atau alasannya"
                    className="clara-input mt-2 w-full"
                  />
                </div>

                <div role="group" aria-label="Kelompok tindak lanjut" className="flex flex-wrap gap-2">
                  <FilterChip
                    active={bucketFilter === "all"}
                    onClick={() => setBucketFilter("all")}
                    label={`Semua (${visibleItems.length})`}
                  />
                  {BUCKET_ORDER.filter(
                    (bucket) => (bucketCounts[bucket] ?? 0) > 0 || bucket === bucketFilter,
                  ).map((bucket) => (
                    <FilterChip
                      key={bucket}
                      active={bucketFilter === bucket}
                      onClick={() => setBucketFilter(bucket)}
                      label={`${BUCKETS[bucket].label} (${bucketCounts[bucket] ?? 0})`}
                    />
                  ))}
                </div>

                <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
                  {filteredVisibleItems.length === visibleItems.length
                    ? `${visibleItems.length} tindak lanjut`
                    : `${filteredVisibleItems.length} dari ${visibleItems.length} tindak lanjut`}
                </p>
              </section>
            ) : null}

            {filteredVisibleItems.length === 0 ? (
              <EmptyState
                title={
                  visibleItems.length === 0
                    ? "Belum ada tindak lanjut"
                    : "Tidak ada tindak lanjut yang cocok"
                }
                description={
                  visibleItems.length === 0
                    ? "Saat ada customer yang perlu dihubungi lagi, daftarnya muncul di sini. Sementara itu kamu bisa membalas chat yang masuk."
                    : "Ubah kata pencarian atau pilih kelompok lain."
                }
                actionHref={visibleItems.length === 0 ? "/sales" : undefined}
                actionLabel={visibleItems.length === 0 ? "Buka Chat Masuk" : undefined}
              />
            ) : (
              sections.map((section, sectionIndex) => (
                <section
                  key={section.bucket}
                  aria-labelledby={`bucket-${section.bucket}`}
                  data-onboarding-id={sectionIndex === 0 ? "sales-followup-list" : undefined}
                  className="space-y-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 id={`bucket-${section.bucket}`} className="text-base font-semibold clara-text-primary">
                      {BUCKETS[section.bucket].label}{" "}
                      <span className="font-normal clara-text-muted">({section.items.length})</span>
                    </h2>
                    <p className="text-sm clara-text-secondary">{BUCKETS[section.bucket].description}</p>
                  </div>

                  <ul className="space-y-3">
                    {section.items.map((item, index) => (
                      <WorklistRow
                        key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}`}
                        item={item}
                        index={index}
                        showOwner={!isSalesWorkspace}
                        isUpdating={updatingTaskId === (item.task_id ?? item.lead_id)}
                        onTaskAction={handleTaskAction}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}

            {visibleUpcomingItems.length > 0 ? (
              <details
                data-onboarding-id="sales-followup-upcoming"
                className="clara-card-outline group p-4 sm:p-5"
              >
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-base font-semibold clara-text-primary">
                  <span>
                    Dijadwalkan nanti{" "}
                    <span className="font-normal clara-text-muted">({visibleUpcomingItems.length})</span>
                  </span>
                  <span className="text-sm font-normal clara-text-secondary group-open:hidden">Tampilkan</span>
                  <span className="hidden text-sm font-normal clara-text-secondary group-open:inline">
                    Sembunyikan
                  </span>
                </summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  Belum perlu dikerjakan sekarang, tapi tetap aktif.
                </p>
                <ul className="mt-4 space-y-3">
                  {visibleUpcomingItems.map((item, index) => (
                    <WorklistRow
                      key={`${item.lead_id}-${item.task_type}-${item.task_id ?? "derived"}-upcoming`}
                      item={item}
                      index={index}
                      showOwner={!isSalesWorkspace}
                      isUpdating={updatingTaskId === (item.task_id ?? item.lead_id)}
                      onTaskAction={handleTaskAction}
                    />
                  ))}
                </ul>
              </details>
            ) : null}
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

function WorklistRow({
  item,
  index,
  showOwner,
  isUpdating,
  onTaskAction,
}: {
  item: SalesWorklistItem;
  index: number;
  showOwner: boolean;
  isUpdating: boolean;
  onTaskAction: (item: SalesWorklistItem, payload: LeadQueueActionRequest) => Promise<void>;
}) {
  const [reasonTag, setReasonTag] = useState("follow_up_executed");
  const [reasonNote, setReasonNote] = useState("");

  function buildPayload(action: LeadQueueActionRequest["action"]): LeadQueueActionRequest {
    return {
      action,
      duration: null,
      reason_tag: reasonTag,
      reason_note: reasonNote.trim() || null,
    };
  }

  const overdue = isOverdue(item);
  const fieldId = `${item.task_id ?? item.lead_id}-${index}`;

  return (
    <li className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold clara-text-primary">{item.lead_name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag tone={overdue ? "danger" : "neutral"}>{getTimeLabel(item.next_follow_up_at)}</Tag>
            {item.lead_temperature !== "unknown" ? (
              <ValueTag table={TEMPERATURE} value={item.lead_temperature} />
            ) : null}
            {item.current_stage !== "unknown" ? <ValueTag table={STAGE} value={item.current_stage} /> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {item.conversation_id ? (
            <Link
              href={`/sales/conversations/${item.conversation_id}`}
              className="clara-button clara-button-primary"
            >
              Buka chat
            </Link>
          ) : (
            <Link href={`/crm/${item.lead_id}`} className="clara-button clara-button-primary">
              Buka lead
            </Link>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold clara-text-primary">{plainJargon(item.task_label)}</p>
      <p className="mt-1 text-sm leading-6 clara-text-secondary">{plainJargon(item.reason)}</p>
      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        <span className="font-semibold clara-text-primary">Yang perlu dilakukan: </span>
        {plainJargon(item.recommended_action)}
      </p>

      <p className="mt-3 text-xs clara-text-muted">
        Kontak terakhir {formatRelativeTime(item.last_contact_at)}
        {showOwner ? ` · Penanggung jawab: ${item.assigned_user_name ?? "belum ada"}` : ""}
      </p>

      <details className="mt-4 border-t border-clara-line-subtle pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-clara-gold">
          Sudah selesai? Catat hasilnya
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void onTaskAction(item, buildPayload("done"))}
            className="clara-button clara-button-secondary"
          >
            {isUpdating ? "Menyimpan..." : "Tandai selesai"}
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void onTaskAction(item, buildPayload("dismiss"))}
            className="clara-button clara-button-ghost"
            title="Hilangkan dari daftar ini tanpa menandainya selesai"
          >
            Sembunyikan dari daftar
          </button>
          {item.conversation_id ? (
            <Link href={`/crm/${item.lead_id}`} className="clara-button clara-button-ghost">
              Buka lead
            </Link>
          ) : null}
        </div>
      </details>
    </li>
  );
}
