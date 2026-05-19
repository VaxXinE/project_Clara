"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getLeadBadgeClass,
  getRiskBadgeClass,
} from "@/lib/format";
import type { CurrentUser, SalesConversationDetail } from "@/types/dashboard";

export default function SalesConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [detail, setDetail] = useState<SalesConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadConversationDetail = useCallback(async () => {
    if (!conversationId) {
      setDetail(null);
      setErrorMessage("Conversation ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const [data, me] = await Promise.all([
        apiFetch<SalesConversationDetail>(
          `/dashboard/sales/conversations/${conversationId}`,
        ),
        apiFetch<CurrentUser>("/auth/me"),
      ]);
      setDetail(data);
      setCurrentUser(me);
    } catch (error) {
      setDetail(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat detail conversation.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversationDetail();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadConversationDetail]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Conversation detail"
      title={detail?.title ?? "Detail percakapan"}
      description="Baca timeline chat, cek hasil analisis AI, dan review draft balasan dari satu layar kerja yang konsisten."
      backHref="/dashboard/sales"
      backLabel="Kembali ke inbox"
      actions={
        <Link
          href="/dashboard/follow-up"
          className="clara-button clara-button-ghost"
        >
          Buka Worklist
        </Link>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading conversation...
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="clara-alert clara-alert-danger">
            {errorMessage}. Coba kembali ke{" "}
            <Link href="/dashboard/sales" className="font-semibold underline">
              sales inbox
            </Link>
            .
          </div>
        )}

        {detail && !isLoading && !errorMessage && (
          <>
            <ConversationDetailHeader detail={detail} />
            <ConversationUsageGuide detail={detail} />
            <ConversationDetailContent
              detail={detail}
              onUpdated={loadConversationDetail}
            />
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function ConversationDetailHeader({
  detail,
}: {
  detail: SalesConversationDetail;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="clara-card rounded-[30px] p-6">
        <p className="clara-kicker">Conversation Signal</p>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          Ringkasan kondisi percakapan saat ini
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Last message: {formatDateTime(detail.last_message_at)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                extraction.lead_temperature,
              )}`}
            >
              {extraction.lead_temperature.toUpperCase()}
            </span>
          )}

          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadgeClass(
                extraction.risk_level,
              )}`}
            >
              Risk {extraction.risk_level}
            </span>
          )}

          {suggestion && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {formatStatusLabel(suggestion.approval_status)}
            </span>
          )}
        </div>
      </div>

      <div className="clara-card-dark rounded-[30px] p-6">
        <p className="clara-kicker text-[#d4b07b]">Snapshot</p>
        <div className="mt-4 space-y-3">
          <MetaPill
            label="Messages"
            value={String(detail.messages.length)}
            dark
          />
          <MetaPill
            label="Sent logs"
            value={String(detail.sent_messages.length)}
            dark
          />
          <MetaPill
            label="AI status"
            value={extraction ? "Analyzed" : "Pending"}
            dark
          />
        </div>
      </div>
    </section>
  );
}

function ConversationDetailContent({
  detail,
  onUpdated,
}: {
  detail: SalesConversationDetail;
  onUpdated: () => Promise<void>;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="clara-card rounded-[30px] p-5 sm:p-6">
        <div>
          <p className="clara-kicker">Chat Timeline</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            Timeline percakapan
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Pesan hasil parsing dari export WhatsApp.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {detail.messages.map((message) => {
            const isSales = message.sender_type === "sales";

            return (
              <div
                key={message.id}
                className={`flex ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[24px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${
                    isSales
                      ? "bg-[#10172d] text-white"
                      : "bg-[rgba(255,248,239,0.92)] text-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">
                      {message.sender_name}
                    </p>
                    <p
                      className={`text-xs ${
                        isSales ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {formatDateTime(message.message_timestamp)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                    {message.message_text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-6">
        <ConversationAiActions
          conversationId={detail.conversation_id}
          hasAiExtraction={Boolean(extraction)}
          hasReplySuggestion={Boolean(suggestion)}
          onUpdated={onUpdated}
        />

        <div className="clara-card rounded-[30px] p-5">
          <p className="clara-kicker">AI Analysis</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
            Hasil pembacaan Clara
          </h2>

          {extraction ? (
            <div className="mt-4 space-y-3 text-sm">
              <InfoBlock
                label="Pipeline stage"
                value={formatStatusLabel(extraction.pipeline_stage)}
              />
              <InfoBlock
                label="Sentiment"
                value={formatStatusLabel(extraction.sentiment)}
              />
              <div className="clara-card-soft rounded-[22px] p-4">
                <p className="clara-kicker text-[11px]">Main objections</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {extraction.main_objections.length > 0 ? (
                    extraction.main_objections.map((objection) => (
                      <span
                        key={objection}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {objection}
                      </span>
                    ))
                  ) : (
                    <p className="text-slate-600">Tidak ada objection.</p>
                  )}
                </div>
              </div>
              <InfoBlock
                label="Next best action"
                value={extraction.next_best_action}
              />
              <InfoBlock
                label="Confidence"
                value={`${(extraction.confidence_score * 100).toFixed(0)}%`}
              />
            </div>
          ) : (
            <div className="clara-card-outline mt-4 rounded-[24px] p-4 text-sm text-slate-600">
              Conversation ini belum dianalisis AI.
            </div>
          )}
        </div>

        {suggestion ? (
          <ReplySuggestionActions
            replySuggestionId={suggestion.id}
            suggestedReplies={suggestion.suggested_replies}
            approvalStatus={suggestion.approval_status}
            hasBeenSent={detail.sent_messages.some(
              (sentMessage) =>
                sentMessage.reply_suggestion_id === suggestion.id,
            )}
            onUpdated={onUpdated}
          />
        ) : (
          <div className="clara-card-outline rounded-[30px] p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Belum ada reply suggestion
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate reply suggestion dulu, lalu review approval status
              sebelum memutuskan kirim balasan.
            </p>
          </div>
        )}

        <div className="clara-card rounded-[30px] p-5">
          <p className="clara-kicker">Sent Messages</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-slate-950">
            Riwayat balasan terkirim
          </h2>

          {detail.sent_messages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {detail.sent_messages.map((sentMessage) => (
                <div
                  key={sentMessage.id}
                  className="rounded-[22px] border border-green-200/80 bg-green-50/88 p-4 text-sm text-green-900"
                >
                  <p className="font-semibold">
                    Sent by {sentMessage.sent_by_name}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    {formatDateTime(sentMessage.sent_at)} &bull;{" "}
                    {sentMessage.send_mode}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap leading-6">
                    {sentMessage.message_text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Belum ada pesan yang ditandai terkirim. Kalau balasan sudah
              benar-benar dikirim, pastikan status ini ikut tercatat.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

function MetaPill({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
        dark ? "bg-white/7 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <span className={dark ? "text-slate-300" : "text-slate-600"}>
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-[22px] p-4">
      <p className="clara-kicker text-[11px]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
