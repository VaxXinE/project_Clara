"use client";

import {
  faArrowDown,
  faArrowLeft,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/dashboard/ChatAvatar";
import { customerLabel } from "@/lib/customer";
import { ContactInfoPanel } from "@/components/dashboard/ContactInfoPanel";
import { SalesReplyFlow } from "@/components/dashboard/SalesReplyFlow";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import {
  buildContinuationHref,
  buildOpenChatLink,
  getLatestCustomerMessage,
  isAnalysisStale,
  isReplySuggestionStale,
  isSalesConversationMessage,
} from "@/lib/conversation";
import {
  formatChannelLabel,
  formatClock,
  formatDayHeading,
  formatProviderLabel,
  localDayKey,
  formatRelativeTime,
  inferProviderFromSource,
  isExperimentalChannel,
} from "@/lib/format";
import { STAGE, TEMPERATURE } from "@/lib/vocab";
import type { SalesConversationDetail } from "@/types/dashboard";

const RECENT_MESSAGE_COUNT = 30;

type Props = {
  detail: SalesConversationDetail;
  uploadBanner: { tone: "success" | "neutral"; text: string } | null;
  onUpdated: () => Promise<void>;
};

/**
 * Sisi kanan halaman Chat Masuk: header customer, isi chat yang bisa di-scroll, dan panel balas di bawahnya.
 * Isi chat dibaca dari bawah ke atas seperti WhatsApp Web, jadi pesan terbaru langsung kelihatan.
 */
export function SalesConversationPane({
  detail,
  uploadBanner,
  onUpdated,
}: Props) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const analysisStale = isAnalysisStale(detail);
  const suggestionStale = isReplySuggestionStale(detail);
  const latestCustomerMessage = getLatestCustomerMessage(detail);
  const provider = inferProviderFromSource(detail.source);
  const channelLabel = formatChannelLabel(detail.source_channel);
  // Bacaan lama tidak ditampilkan sebagai fakta kalau chat sudah berubah.
  const showReading = Boolean(extraction) && !analysisStale;

  const openChat = buildOpenChatLink(detail);
  const [showInfo, setShowInfo] = useState(false);
  const infoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const timelineRef = useRef<HTMLOListElement | null>(null);
  // Pesan baru hanya menggeser layar kalau Sales memang sedang di bagian bawah chat.
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [seenCount, setSeenCount] = useState(detail.messages.length);
  const messages = showAll
    ? detail.messages
    : detail.messages.slice(-RECENT_MESSAGE_COUNT);
  const hiddenCount = detail.messages.length - messages.length;
  const messageCount = detail.messages.length;

  useEffect(() => {
    if (stickToBottomRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [detail.conversation_id, messageCount, showAll]);

  function handleScroll(element: HTMLOListElement) {
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;

    stickToBottomRef.current = nearBottom;
    setAtBottom(nearBottom);
    if (nearBottom) {
      setSeenCount(messageCount);
    }
  }

  function scrollToLatest() {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  const unseenCount = atBottom ? 0 : Math.max(messageCount - seenCount, 0);

  return (
    <div className="@container relative flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-clara-line-subtle px-3 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            aria-label="Kembali ke daftar chat"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-clara-line hover:bg-clara-sunken lg:hidden"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label={`Lihat info ${detail.title}`}
            className="shrink-0 rounded-full hover:opacity-80"
          >
            <ChatAvatar title={detail.title} size="lg" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold clara-text-primary">
              <button
                ref={infoTriggerRef}
                type="button"
                onClick={() => setShowInfo(true)}
                aria-expanded={showInfo}
                title="Lihat info customer"
                className="max-w-full truncate text-left hover:underline"
              >
                {customerLabel(detail.title).text}
              </button>
            </h1>
            <p className="truncate text-xs clara-text-muted">
              {customerLabel(detail.title).isUnsavedNumber ? (
                <button
                  type="button"
                  onClick={() => setShowInfo(true)}
                  className="font-semibold text-clara-warning hover:underline"
                >
                  Beri nama{" "}
                </button>
              ) : null}
              {customerLabel(detail.title).isUnsavedNumber ? "· " : ""}
              {provider === "manual" || provider === "unknown"
                ? channelLabel
                : `${channelLabel} · ${formatProviderLabel(provider)}`}{" "}
              · Aktivitas terakhir {formatRelativeTime(detail.last_message_at)}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {openChat ? (
              <a
                href={openChat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="clara-button clara-button-primary"
              >
                {openChat.label}
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  className="ml-2 h-3 w-3"
                  aria-hidden="true"
                />
              </a>
            ) : null}
            <Link
              href={buildContinuationHref(detail)}
              className="clara-button clara-button-secondary"
            >
              Tambah chat lanjutan
            </Link>
          </div>
        </div>

        {showReading && extraction ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <ValueTag table={TEMPERATURE} value={extraction.lead_temperature} />
            <ValueTag table={STAGE} value={extraction.pipeline_stage} />
            {extraction.risk_level !== "low" ? (
              <Tag tone={extraction.risk_level === "high" ? "danger" : "warn"}>
                {extraction.risk_level === "high"
                  ? "Risiko tinggi"
                  : "Risiko sedang"}
              </Tag>
            ) : null}
            {isExperimentalChannel(detail.source_channel) ? (
              <Tag tone="warn">Eksperimental</Tag>
            ) : null}
          </div>
        ) : null}
      </header>

      {uploadBanner ? (
        <div
          role="status"
          aria-live="polite"
          className={`m-3 mb-0 shrink-0 ${
            uploadBanner.tone === "success"
              ? "clara-alert clara-alert-success"
              : "clara-alert clara-alert-info"
          }`}
        >
          {uploadBanner.text}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
        <div className="relative flex min-h-[8rem] min-w-0 flex-1 flex-col bg-clara-sunken">
          <ol
            ref={timelineRef}
            data-onboarding-id="sales-conversation-timeline"
            aria-label="Pesan percakapan"
            onScroll={(event) => handleScroll(event.currentTarget)}
            className="clara-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
          >
            {hiddenCount > 0 ? (
              <li className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    // Sales ingin membaca yang lama, jadi layar tidak boleh loncat ke bawah.
                    stickToBottomRef.current = false;
                    setShowAll(true);
                  }}
                  className="clara-button clara-button-ghost"
                >
                  Tampilkan {hiddenCount} pesan lama
                </button>
              </li>
            ) : null}

            {messages.length === 0 ? (
              <li className="clara-empty-state text-sm">
                Belum ada pesan pada percakapan ini.
              </li>
            ) : null}

            {messages.map((message, index) => {
              const isSales = isSalesConversationMessage(message);
              const startsNewDay =
                index === 0 ||
                localDayKey(messages[index - 1].message_timestamp) !==
                  localDayKey(message.message_timestamp);

              return (
                <Fragment key={message.id}>
                  {startsNewDay ? (
                    <li
                      className="flex justify-center"
                      aria-label={formatDayHeading(message.message_timestamp)}
                    >
                      <span className="rounded-full border border-clara-line-subtle bg-clara-surface px-3 py-1 text-xs font-semibold clara-text-secondary">
                        {formatDayHeading(message.message_timestamp)}
                      </span>
                    </li>
                  ) : null}
                  <li
                    className={`flex min-w-0 ${isSales ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`min-w-0 max-w-[88%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[75%] ${
                        isSales
                          ? "rounded-tr-sm border-[var(--color-border-strong)] bg-[var(--color-warning-surface)]"
                          : "rounded-tl-sm border-[var(--color-border-default)] bg-[var(--color-surface-base)]"
                      }`}
                    >
                      {isSales ? (
                        <p className="mb-0.5 text-xs font-semibold clara-text-secondary">
                          {message.sender_name}
                        </p>
                      ) : null}
                      {message.reply_context_text ? (
                        <blockquote className="mb-2 min-w-0 rounded-lg border-l-4 border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs leading-5 clara-text-secondary">
                          <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {message.reply_context_text}
                          </p>
                        </blockquote>
                      ) : null}
                      <p className="break-words whitespace-pre-wrap text-[15px] leading-6 clara-text-primary [overflow-wrap:anywhere]">
                        {message.message_text}
                      </p>
                      <p className="mt-1 text-right text-xs clara-text-muted">
                        {formatClock(message.message_timestamp)}
                      </p>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>

          {unseenCount > 0 ? (
            <button
              type="button"
              onClick={scrollToLatest}
              className="clara-button clara-button-primary absolute bottom-3 left-1/2 -translate-x-1/2 shadow-[var(--shadow-floating)]"
            >
              <FontAwesomeIcon
                icon={faArrowDown}
                className="mr-2 h-3 w-3"
                aria-hidden="true"
              />
              {unseenCount} pesan baru
            </button>
          ) : null}
        </div>

        <div
          aria-label="Balas customer"
          className="clara-scrollbar max-h-[55%] shrink-0 overflow-y-auto border-t border-clara-line bg-clara-surface p-3 sm:p-4 @3xl:max-h-none @3xl:w-[23rem] @3xl:border-l @3xl:border-t-0 @6xl:w-[28rem]"
        >
          <SalesReplyFlow
            key={suggestion?.id ?? "no-suggestion"}
            compact
            conversationId={detail.conversation_id}
            extraction={extraction}
            suggestion={suggestion}
            sentMessages={detail.sent_messages}
            hasBeenSent={Boolean(
              suggestion &&
              detail.sent_messages.some(
                (sentMessage) =>
                  sentMessage.reply_suggestion_id === suggestion.id,
              ),
            )}
            analysisStale={analysisStale}
            suggestionStale={suggestionStale}
            latestCustomerMessage={
              latestCustomerMessage
                ? {
                    text: latestCustomerMessage.message_text,
                    senderName: latestCustomerMessage.sender_name,
                    timestamp: latestCustomerMessage.message_timestamp,
                  }
                : null
            }
            continuationHref={buildContinuationHref(detail)}
            openChat={openChat}
            isExperimental={isExperimentalChannel(detail.source_channel)}
            onUpdated={onUpdated}
          />
        </div>
      </div>

      {showInfo ? (
        <ContactInfoPanel
          title={detail.title}
          conversationId={detail.conversation_id}
          onRenamed={onUpdated}
          channelLabel={channelLabel}
          leadId={detail.lead_id ?? null}
          customerProfileId={detail.customer_profile_id ?? null}
          onClose={() => {
            setShowInfo(false);
            infoTriggerRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
