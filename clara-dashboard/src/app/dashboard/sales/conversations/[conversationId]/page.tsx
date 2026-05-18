"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ConversationAiActions } from "@/components/dashboard/ConversationAiActions";
import { ReplySuggestionActions } from "@/components/dashboard/ReplySuggestionActions";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getLeadBadgeClass,
  getRiskBadgeClass,
} from "@/lib/format";
import type { SalesConversationDetail } from "@/types/dashboard";

export default function SalesConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const [detail, setDetail] = useState<SalesConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadConversationDetail() {
    if (!conversationId) {
      setDetail(null);
      setErrorMessage("Conversation ID tidak valid.");
      setIsLoading(false);
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const data = await apiFetch<SalesConversationDetail>(
        `/dashboard/sales/conversations/${conversationId}`
      );
      setDetail(data);
    } catch (error) {
      setDetail(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat detail conversation."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConversationDetail();
  }, [conversationId]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <Link
            href="/dashboard/sales"
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            ← Kembali ke Chat Masuk
          </Link>
        </section>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading conversation...
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
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
    </main>
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
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Detail Percakapan</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {detail.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pesan terakhir: {formatDateTime(detail.last_message_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeadBadgeClass(
                extraction.lead_temperature
              )}`}
            >
              {extraction.lead_temperature.toUpperCase()}
            </span>
          )}

          {extraction && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadgeClass(
                extraction.risk_level
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
    </section>
  );
}

function ConversationUsageGuide({
  detail,
}: {
  detail: SalesConversationDetail;
}) {
  const extraction = detail.latest_ai_extraction;
  const suggestion = detail.latest_reply_suggestion;
  const sentCount = detail.sent_messages.length;

  const nextStep = !extraction
    ? {
        title: "Jalankan AI analysis dulu",
        description:
          "Tanpa AI analysis, Anda belum punya ringkasan stage, risiko, objection, dan next best action. Ini langkah pertama yang paling masuk akal.",
      }
    : !suggestion
      ? {
          title: "Buat draft balasan",
          description:
            "Analisis sudah ada. Langkah berikutnya adalah menghasilkan reply suggestion supaya conversation ini bisa ditindaklanjuti dengan cepat.",
        }
      : sentCount === 0
        ? {
            title: "Review lalu kirim atau approve draft",
            description:
              "Draft sudah tersedia. Sekarang fokus Anda adalah mengecek kesesuaian bahasa, approval status, dan apakah balasan sudah siap dikirim.",
          }
        : {
            title: "Naikkan konteksnya ke lead dan follow-up",
            description:
              "Percakapan ini sudah punya jejak balasan. Pastikan lead stage, task, dan follow-up berikutnya di CRM sudah ikut rapi.",
          };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Langkah Berikutnya
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            {nextStep.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {nextStep.description}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <UsageCard
            title="1. Baca chat dulu"
            description="Pahami konteks terbaru sebelum melihat analisis atau draft."
          />
          <UsageCard
            title="2. Lihat AI analysis"
            description="Gunakan stage, risk, objection, dan next action sebagai panduan keputusan."
          />
          <UsageCard
            title="3. Putuskan aksi"
            description="Entah generate draft, approve/kirim, atau pindah ke lead detail untuk follow-up."
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
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Chat Timeline
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Pesan hasil parsing dari channel customer yang masuk ke Clara.
          </p>
        </div>

        <div className="space-y-3">
          {detail.messages.map((message) => {
            const isSales = message.sender_type === "sales";

            return (
              <div
                key={message.id}
                className={`flex ${isSales ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    isSales
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">{message.sender_name}</p>
                    <p
                      className={`text-xs ${
                        isSales ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {formatDateTime(message.message_timestamp)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">AI Analysis</h2>

          {extraction ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Pipeline stage</p>
                <p className="mt-1 text-slate-600">
                  {formatStatusLabel(extraction.pipeline_stage)}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Sentiment</p>
                <p className="mt-1 text-slate-600">
                  {formatStatusLabel(extraction.sentiment)}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Main objections</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {extraction.main_objections.length > 0 ? (
                    extraction.main_objections.map((objection) => (
                      <span
                        key={objection}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {objection}
                      </span>
                    ))
                  ) : (
                    <p className="text-slate-600">Tidak ada objection.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Next best action</p>
                <p className="mt-1 text-slate-600">
                  {extraction.next_best_action}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Confidence</p>
                <p className="mt-1 text-slate-600">
                  {(extraction.confidence_score * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Conversation ini belum dianalisis AI. Mulai dari tombol AI analysis di panel aksi.
            </p>
          )}
        </div>

        {suggestion ? (
          <ReplySuggestionActions
            replySuggestionId={suggestion.id}
            suggestedReplies={suggestion.suggested_replies}
            approvalStatus={suggestion.approval_status}
            hasBeenSent={detail.sent_messages.some(
              (sentMessage) => sentMessage.reply_suggestion_id === suggestion.id
            )}
            onUpdated={onUpdated}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Belum ada reply suggestion
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate reply suggestion dulu, lalu review approval status sebelum memutuskan kirim balasan.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Sent Messages
          </h2>

          {detail.sent_messages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {detail.sent_messages.map((sentMessage) => (
                <div
                  key={sentMessage.id}
                  className="rounded-xl bg-green-50 p-4 text-sm text-green-900"
                >
                  <p className="font-semibold">
                    Sent by {sentMessage.sent_by_name}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    {formatDateTime(sentMessage.sent_at)} • {sentMessage.send_mode}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap">
                    {sentMessage.message_text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Belum ada pesan yang ditandai terkirim. Kalau balasan sudah benar-benar dikirim, pastikan status ini ikut tercatat.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

function UsageCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
