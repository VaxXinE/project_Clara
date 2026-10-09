"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { resetDashboardOnboardingState } from "@/components/dashboard/SalesOnboardingTour";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { formatChannelLabel, formatRelativeTime } from "@/lib/format";
import {
  ACTIONABLE_BUCKETS,
  BUCKETS,
  BUCKET_ORDER,
  getQueueBucket,
  type QueueBucketKey,
} from "@/lib/inbox";
import { PAGE_NAMES } from "@/lib/labels";
import { TEMPERATURE } from "@/lib/vocab";
import type { SalesInboxItem, SalesWorklistItem } from "@/types/dashboard";

const LIST_LIMIT = 4;
const FOLLOW_UP_LIMIT = 3;

type SalesHomeProps = {
  userId: string | null;
  inboxItems: SalesInboxItem[];
  worklistItems: SalesWorklistItem[];
  isLoading: boolean;
};

type RankedChat = { item: SalesInboxItem; bucket: QueueBucketKey };

/** Chat yang menunggu Sales, paling mendesak dulu. Urutan dalam satu kelompok mengikuti urutan dari server. */
function rankActionableChats(items: SalesInboxItem[]): RankedChat[] {
  return items
    .map((item) => ({ item, bucket: getQueueBucket(item) }))
    .filter(({ bucket }) => ACTIONABLE_BUCKETS.includes(bucket))
    .sort((left, right) => BUCKET_ORDER.indexOf(left.bucket) - BUCKET_ORDER.indexOf(right.bucket));
}

function helpStorageKey(userId: string) {
  return `clara.sales-home-help.v1.${userId}`;
}

export function SalesHome({ userId, inboxItems, worklistItems, isLoading }: SalesHomeProps) {
  const ranked = useMemo(() => rankActionableChats(inboxItems), [inboxItems]);
  const first = ranked[0] ?? null;
  const others = ranked.slice(1, 1 + LIST_LIMIT);
  const hiddenChatCount = Math.max(ranked.length - 1 - others.length, 0);

  const shownConversationIds = useMemo(
    () => new Set(ranked.slice(0, 1 + LIST_LIMIT).map(({ item }) => item.conversation_id)),
    [ranked],
  );
  // Chat yang sama sudah tampil di atas, jadi tidak diulang sebagai tindak lanjut.
  const followUps = useMemo(
    () =>
      worklistItems.filter(
        (task) => !task.conversation_id || !shownConversationIds.has(task.conversation_id),
      ),
    [shownConversationIds, worklistItems],
  );
  const firstFollowUp = !first ? (followUps[0] ?? null) : null;
  const followUpList = followUps.slice(firstFollowUp ? 1 : 0, (firstFollowUp ? 1 : 0) + FOLLOW_UP_LIMIT);

  return (
    <div className="space-y-6">
      <section data-onboarding-id="sales-home-next-action" aria-labelledby="sales-next-title" className="clara-card p-5 sm:p-6">
        <p className="text-sm font-semibold text-clara-gold">Kerjakan ini dulu</p>

        {isLoading ? (
          <div className="mt-3 space-y-3" role="status" aria-label="Memuat">
            <LoadingBar className="h-6 w-1/2" />
            <LoadingBar className="h-4 w-full" />
            <LoadingBar className="h-4 w-2/3" />
          </div>
        ) : first ? (
          <FirstChat chat={first} />
        ) : firstFollowUp ? (
          <FirstFollowUp task={firstFollowUp} />
        ) : (
          <>
            <h2 id="sales-next-title" className="mt-2 text-xl font-bold clara-text-primary sm:text-2xl">
              Tidak ada yang menunggu kamu
            </h2>
            <p className="mt-2 text-sm leading-6 clara-text-secondary">
              Semua chat sudah kamu tangani. Kalau ada percakapan dari luar extension, masukkan lewat Input Chat supaya
              Clara bisa membantu membalasnya.
            </p>
            <div className="mt-5">
              <Link href="/upload" className="clara-button clara-button-primary">
                {PAGE_NAMES.intake}
              </Link>
            </div>
          </>
        )}
      </section>

      {!isLoading && others.length > 0 ? (
        <section data-onboarding-id="sales-home-counts" aria-labelledby="sales-others-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="sales-others-title" className="text-base font-semibold clara-text-primary">
              Berikutnya
            </h2>
            <Link href="/sales" className="text-sm font-semibold text-clara-gold hover:underline">
              {hiddenChatCount > 0 ? `Lihat semua chat (+${hiddenChatCount})` : "Lihat semua chat"}
            </Link>
          </div>
          <ul className="space-y-2">
            {others.map(({ item, bucket }) => (
              <li key={item.conversation_id}>
                <ChatRow item={item} bucket={bucket} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isLoading && followUpList.length > 0 ? (
        <section aria-labelledby="sales-followup-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="sales-followup-title" className="text-base font-semibold clara-text-primary">
              Customer yang perlu dihubungi lagi
            </h2>
            <Link href="/follow-up" className="text-sm font-semibold text-clara-gold hover:underline">
              Lihat semua
            </Link>
          </div>
          <ul className="space-y-2">
            {followUpList.map((task) => (
              <li key={`${task.lead_id}-${task.task_id ?? task.task_type}`}>
                <FollowUpRow task={task} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HelpCard userId={userId} />
    </div>
  );
}

function FirstChat({ chat }: { chat: RankedChat }) {
  const { item, bucket } = chat;
  const extraction = item.latest_ai_extraction;
  // Bacaan lama tidak ditampilkan sebagai fakta kalau chat sudah berubah.
  const showReading = Boolean(extraction) && bucket !== "needs_analysis";

  return (
    <>
      <h2 id="sales-next-title" className="mt-2 break-words text-xl font-bold clara-text-primary sm:text-2xl">
        {item.title}
      </h2>
      <p className="mt-1 text-xs clara-text-muted">
        {formatChannelLabel(item.source_channel)} · {formatRelativeTime(item.last_message_at)}
      </p>
      <p className="mt-3 line-clamp-3 text-base leading-7 clara-text-primary">
        {item.latest_message?.message_text ?? "Belum ada pesan."}
      </p>

      {showReading && extraction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <ValueTag table={TEMPERATURE} value={extraction.lead_temperature} />
          {extraction.risk_level === "high" ? <Tag tone="danger">Risiko tinggi</Tag> : null}
        </div>
      ) : null}

      <p className="mt-3 text-sm leading-6 clara-text-secondary">
        {showReading && extraction?.next_best_action ? (
          <>
            <span className="font-semibold clara-text-primary">Langkah berikutnya: </span>
            {extraction.next_best_action}
          </>
        ) : (
          BUCKETS[bucket].hint
        )}
      </p>

      <div className="mt-5">
        <Link href={`/sales/conversations/${item.conversation_id}`} className="clara-button clara-button-primary">
          {BUCKETS[bucket].cta}
        </Link>
      </div>
    </>
  );
}

function FirstFollowUp({ task }: { task: SalesWorklistItem }) {
  return (
    <>
      <h2 id="sales-next-title" className="mt-2 break-words text-xl font-bold clara-text-primary sm:text-2xl">
        {task.lead_name}
      </h2>
      <p className="mt-2 text-sm leading-6 clara-text-secondary">
        {task.reason || "Ada tindak lanjut yang perlu kamu selesaikan."}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={task.conversation_id ? `/sales/conversations/${task.conversation_id}` : "/follow-up"}
          className="clara-button clara-button-primary justify-center"
        >
          {task.conversation_id ? "Buka chat" : "Buka Tindak Lanjut"}
        </Link>
      </div>
    </>
  );
}

function ChatRow({ item, bucket }: { item: SalesInboxItem; bucket: QueueBucketKey }) {
  return (
    <Link
      href={`/sales/conversations/${item.conversation_id}`}
      className="clara-card-soft flex min-h-11 items-center gap-3 p-4 hover:border-clara-gold focus-visible:border-clara-gold"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold clara-text-primary">{item.title}</p>
        <p className="mt-0.5 truncate text-sm clara-text-secondary">
          {item.latest_message?.message_text ?? "Belum ada pesan."}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold text-clara-gold">{BUCKETS[bucket].chip}</p>
        <p className="mt-0.5 text-xs clara-text-muted">{formatRelativeTime(item.last_message_at)}</p>
      </div>
    </Link>
  );
}

function FollowUpRow({ task }: { task: SalesWorklistItem }) {
  return (
    <Link
      href={task.conversation_id ? `/sales/conversations/${task.conversation_id}` : "/follow-up"}
      className="clara-card-soft flex min-h-11 items-center gap-3 p-4 hover:border-clara-gold focus-visible:border-clara-gold"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold clara-text-primary">{task.lead_name}</p>
        <p className="mt-0.5 truncate text-sm clara-text-secondary">{task.reason || task.recommended_action}</p>
      </div>
      <p className="shrink-0 text-xs font-semibold text-clara-gold">{task.task_label}</p>
    </Link>
  );
}

/** Penjelasan singkat untuk yang baru memakai Clara. Bisa ditutup, dan tidak muncul lagi setelahnya. */
function HelpCard({ userId }: { userId: string | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    try {
      setVisible(window.localStorage.getItem(helpStorageKey(userId)) !== "closed");
    } catch {
      setVisible(true);
    }
  }, [userId]);

  function close() {
    setVisible(false);
    if (!userId) {
      return;
    }

    try {
      window.localStorage.setItem(helpStorageKey(userId), "closed");
    } catch {
      // Tanpa penyimpanan browser, kartu ini cukup muncul lagi di kunjungan berikutnya.
    }
  }

  function startTour() {
    if (userId) {
      resetDashboardOnboardingState(userId, "sales");
    }
    window.location.href = "/workspace";
  }

  if (!visible) {
    return null;
  }

  return (
    <section aria-labelledby="sales-help-title" className="clara-card-outline p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="sales-help-title" className="text-base font-semibold clara-text-primary">
          Baru di Clara? Alurnya cuma 3 langkah
        </h2>
        <button type="button" onClick={close} className="clara-button clara-button-ghost shrink-0">
          Tutup
        </button>
      </div>
      <ol className="mt-3 grid gap-3 text-sm leading-6 clara-text-secondary sm:grid-cols-3">
        <li>
          <span className="font-semibold clara-text-primary">1. Buka chat.</span> Pilih customer dari daftar di bawah.
        </li>
        <li>
          <span className="font-semibold clara-text-primary">2. Pilih jawaban.</span> Clara menyusunnya, kamu boleh
          mengubahnya.
        </li>
        <li>
          <span className="font-semibold clara-text-primary">3. Kirim sendiri.</span> Salin jawabannya, kirim dari
          WhatsApp, lalu tandai terkirim.
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/start" className="clara-button clara-button-secondary">
          {PAGE_NAMES.guide}
        </Link>
        <button type="button" onClick={startTour} className="clara-button clara-button-ghost">
          Mulai tur singkat
        </button>
      </div>
    </section>
  );
}

function LoadingBar({ className }: { className: string }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={`inline-block rounded-md bg-[var(--color-surface-overlay)] ${className}`}
    />
  );
}
