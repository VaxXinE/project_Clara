"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChatAvatar } from "@/components/dashboard/ChatAvatar";
import { apiFetch } from "@/lib/api";
import { formatChannelLabel, formatRelativeTime } from "@/lib/format";
import { isSalesConversationMessage } from "@/lib/conversation";
import {
  ACTIONABLE_BUCKETS,
  BUCKETS,
  getQueueBucket,
  type QueueBucketKey,
} from "@/lib/inbox";
import type { SalesInboxItem } from "@/types/dashboard";

const CHANNEL_OPTIONS = [
  { value: "all", label: "Semua channel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "tiktok", label: "TikTok DM" },
  { value: "telegram", label: "Telegram" },
] as const;

const ARCHIVE_OPTIONS = [
  { value: "active", label: "Chat aktif" },
  { value: "archived", label: "Chat lama (arsip)" },
  { value: "all", label: "Semua chat" },
] as const;

type Group = "all" | "mine" | "waiting";

const BUCKET_TEXT_CLASS: Record<QueueBucketKey, string> = {
  high_risk: "text-clara-danger",
  needs_analysis: "text-clara-warning",
  needs_draft: "text-clara-warning",
  pending_review: "text-clara-ink-3",
  reply_now: "text-clara-gold",
  waiting_customer: "text-clara-ink-3",
  archived: "text-clara-ink-3",
};

// Daftar tidak boleh kosong sebentar setiap kali pindah chat, dan posisi scroll harus bertahan.
let cachedItems: SalesInboxItem[] | null = null;
let cachedScrollTop = 0;

// Catatan "sudah dilihat": waktu pesan terakhir per chat yang pernah dibuka Sales di perangkat ini.
const SEEN_KEY = "clara.inbox-seen.v1";
const REFRESH_INTERVAL_MS = 30_000;

type SeenMap = Record<string, string>;

function readSeen(): SeenMap | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : null;
  } catch {
    return null;
  }
}

function writeSeen(seen: SeenMap) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Tanpa penyimpanan browser, penanda pesan baru cukup tidak muncul.
  }
}

/** Pesan baru = pesan terakhir dari customer yang lebih baru dari terakhir kali chat itu dibuka. */
function isUnread(
  item: SalesInboxItem,
  selectedId: string | null,
  seen: SeenMap | null,
): boolean {
  if (!seen || item.conversation_id === selectedId) {
    return false;
  }

  const last = item.latest_message;
  if (!last || isSalesConversationMessage(last)) {
    return false;
  }

  const seenAt = seen[item.conversation_id];
  return !seenAt || (item.last_message_at ?? "") > seenAt;
}

function buildPath(channel: string, archive: string): string {
  const params = new URLSearchParams();

  if (channel !== "all") {
    params.set("source_channel", channel);
  }

  if (archive !== "active") {
    params.set("archive_scope", archive);
  }

  return params.size
    ? `/dashboard/sales/inbox?${params.toString()}`
    : "/dashboard/sales/inbox";
}

type Props = {
  selectedId: string | null;
  /** Naikkan angka ini untuk memuat ulang daftar setelah ada aksi di percakapan. */
  refreshToken?: number;
};

export function SalesInboxList({ selectedId, refreshToken = 0 }: Props) {
  const [items, setItems] = useState<SalesInboxItem[]>(cachedItems ?? []);
  const [isLoading, setIsLoading] = useState(cachedItems === null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [channel, setChannel] = useState("all");
  const [archive, setArchive] = useState("active");
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const isDefaultFilter = channel === "all" && archive === "active";

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const data = await apiFetch<SalesInboxItem[]>(
          buildPath(channel, archive),
        );
        if (isCancelled) {
          return;
        }
        if (isDefaultFilter) {
          cachedItems = data;
        }
        if (readSeen() === null) {
          // Pertama kali dipakai: chat yang sudah ada dianggap sudah dilihat, jadi hanya pesan sesudahnya yang ditandai baru.
          writeSeen(
            Object.fromEntries(
              data.map((item) => [
                item.conversation_id,
                item.last_message_at ?? "",
              ]),
            ),
          );
        }
        setItems(data);
        setErrorMessage("");
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Daftar chat belum bisa dimuat.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [archive, channel, isDefaultFilter, refreshToken, reloadKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = cachedScrollTop;
    }
  }, [isLoading]);

  // Chat baru dari extension harus muncul tanpa Sales perlu reload: muat ulang berkala dan saat tab dibuka lagi.
  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        setReloadKey((key) => key + 1);
      }
    }

    const timer = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);

  // Chat yang sedang dibuka dianggap sudah dilihat, termasuk pesan yang masuk saat dia dibuka.
  useEffect(() => {
    const opened = selectedId
      ? items.find((item) => item.conversation_id === selectedId)
      : null;
    if (!opened) {
      return;
    }

    const seen = readSeen() ?? {};
    if (seen[opened.conversation_id] !== (opened.last_message_at ?? "")) {
      writeSeen({
        ...seen,
        [opened.conversation_id]: opened.last_message_at ?? "",
      });
    }
  }, [items, selectedId]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items
      .map((item) => ({ item, bucket: getQueueBucket(item) }))
      .filter(({ item, bucket }) => {
        if (group === "mine" && !ACTIONABLE_BUCKETS.includes(bucket)) {
          return false;
        }
        if (group === "waiting" && bucket !== "waiting_customer") {
          return false;
        }
        if (!query) {
          return true;
        }

        return `${item.title} ${item.latest_message?.message_text ?? ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) =>
        (right.item.last_message_at ?? "").localeCompare(
          left.item.last_message_at ?? "",
        ),
      );
  }, [group, items, search]);

  const seen = readSeen();
  const unreadCount = items.filter((item) =>
    isUnread(item, selectedId, seen),
  ).length;

  useEffect(() => {
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    document.title =
      unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;

    return () => {
      document.title = baseTitle;
    };
  }, [unreadCount]);

  const mineCount = useMemo(
    () =>
      items.filter((item) => ACTIONABLE_BUCKETS.includes(getQueueBucket(item)))
        .length,
    [items],
  );
  const waitingCount = useMemo(
    () =>
      items.filter((item) => getQueueBucket(item) === "waiting_customer")
        .length,
    [items],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-clara-line-subtle p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold clara-text-primary">Chat Masuk</h2>
          {unreadCount > 0 ? (
            <p role="status" className="text-sm font-semibold text-clara-gold">
              {unreadCount} pesan baru
            </p>
          ) : (
            <p className="text-sm clara-text-muted">{items.length} chat</p>
          )}
        </div>

        <div>
          <label htmlFor="sales-search" className="sr-only">
            Cari chat
          </label>
          <input
            id="sales-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau isi pesan"
            className="clara-input w-full"
          />
        </div>

        <div
          role="group"
          aria-label="Kelompok chat"
          data-onboarding-id="sales-inbox-metrics"
          className="flex flex-wrap gap-2"
        >
          <GroupChip
            active={group === "all"}
            onClick={() => setGroup("all")}
            label="Semua"
          />
          <GroupChip
            active={group === "mine"}
            onClick={() => setGroup("mine")}
            label={`Perlu kamu (${mineCount})`}
          />
          <GroupChip
            active={group === "waiting"}
            onClick={() => setGroup("waiting")}
            label={`Menunggu (${waitingCount})`}
          />
        </div>

        <details open={!isDefaultFilter}>
          <summary className="clara-disclosure">Filter lain</summary>
          <div className="grid gap-3 pb-1 pt-2">
            <select
              aria-label="Channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="clara-select w-full"
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Tampilkan"
              value={archive}
              onChange={(event) => setArchive(event.target.value)}
              className="clara-select w-full"
            >
              {ARCHIVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </details>
      </div>

      {isLoading ? (
        <p role="status" className="p-6 text-sm clara-text-secondary">
          Memuat daftar chat...
        </p>
      ) : errorMessage && items.length === 0 ? (
        <div
          role="alert"
          className="space-y-3 p-6 text-sm clara-text-secondary"
        >
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="clara-button clara-button-secondary"
          >
            Coba lagi
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="space-y-3 p-6 text-sm leading-6 clara-text-secondary">
          <p className="font-semibold clara-text-primary">
            {items.length > 0 ? "Tidak ada chat yang cocok" : "Belum ada chat"}
          </p>
          <p>
            {items.length > 0
              ? "Ubah kata pencarian atau kelompok chat di atas."
              : "Chat dari WhatsApp, Instagram, TikTok, atau input manual akan muncul di sini."}
          </p>
          {items.length === 0 ? (
            <Link href="/upload" className="clara-button clara-button-primary">
              Masukkan chat pertama
            </Link>
          ) : null}
        </div>
      ) : (
        <ul
          ref={scrollRef}
          data-onboarding-id="sales-inbox-queue"
          onScroll={(event) => {
            cachedScrollTop = event.currentTarget.scrollTop;
          }}
          aria-label="Daftar chat"
          className="clara-scrollbar min-h-0 flex-1 divide-y divide-clara-line-subtle overflow-y-auto"
        >
          {rows.map(({ item, bucket }, index) => (
            <li
              key={item.conversation_id}
              data-onboarding-id={
                index === 0 ? "sales-inbox-upcoming-actions" : undefined
              }
            >
              <ChatRow
                item={item}
                bucket={bucket}
                selected={item.conversation_id === selectedId}
                unread={isUnread(item, selectedId, seen)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatRow({
  item,
  bucket,
  selected,
  unread,
}: {
  item: SalesInboxItem;
  bucket: QueueBucketKey;
  selected: boolean;
  unread: boolean;
}) {
  const last = item.latest_message;
  const fromSales = last ? isSalesConversationMessage(last) : false;

  return (
    <Link
      href={`/sales/conversations/${item.conversation_id}`}
      aria-current={selected ? "page" : undefined}
      className={`flex min-h-[76px] items-center gap-3 px-4 py-3 ${
        selected ? "bg-clara-sunken" : "hover:bg-clara-wash"
      }`}
    >
      <ChatAvatar title={item.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold clara-text-primary">
            {item.title}
          </p>
          <p
            className={`shrink-0 text-xs ${unread ? "font-semibold text-clara-gold" : "clara-text-muted"}`}
          >
            {formatRelativeTime(item.last_message_at)}
          </p>
        </div>
        <p
          className={`mt-0.5 truncate text-sm ${unread ? "font-semibold clara-text-primary" : "clara-text-secondary"}`}
        >
          {last
            ? `${fromSales ? "Kamu: " : ""}${last.message_text}`
            : "Belum ada pesan."}
        </p>
        <p className="mt-0.5 truncate text-xs">
          <span className={`font-semibold ${BUCKET_TEXT_CLASS[bucket]}`}>
            {BUCKETS[bucket].chip}
          </span>
          <span className="clara-text-muted">
            {" "}
            · {formatChannelLabel(item.source_channel)}
          </span>
        </p>
      </div>
      {unread ? (
        <span
          role="img"
          aria-label="Pesan baru"
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-clara-gold"
        />
      ) : null}
    </Link>
  );
}

function GroupChip({
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
      className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${
        active
          ? "border-clara-gold bg-clara-gold text-clara-deep"
          : "border-clara-line bg-clara-sunken text-clara-ink-2 hover:border-clara-gold hover:text-clara-ink"
      }`}
    >
      {label}
    </button>
  );
}
