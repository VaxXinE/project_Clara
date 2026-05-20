"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
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

export default function CrmPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [sourceChannelFilter, setSourceChannelFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  async function loadCrmBoard() {
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
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat CRM board.",
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
  }, []);

  const stageBuckets = useMemo(() => {
    return STAGE_ORDER.map((stage) => ({
      stage,
      items: leads.filter((lead) => lead.current_stage === stage),
    }));
  }, [leads]);

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
      eyebrow="CRM foundation"
      title="Lead Pipeline"
      description="Board ini adalah fondasi Phase 2: setiap conversation sekarang mulai menempel ke lead yang bisa dipindah stage, dipantau follow-up-nya, dan dipakai sebagai dasar CRM Clara."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/sales"
            className="clara-button clara-button-ghost"
          >
            Chat Masuk
          </Link>
          <Link
            href="/dashboard/upload"
            className="clara-button clara-button-primary"
          >
            Upload Chat Baru
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading CRM board...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_45%,#f8fafc_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Langkah Berikutnya
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                    {leads.length === 0
                      ? "Belum ada lead yang bisa dibaca"
                      : "Buka detail lead yang paling panas atau paling dekat closing"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {leads.length === 0
                      ? "Kalau pipeline masih kosong, kembali ke Import Chat atau Chat Masuk lebih dulu. Lead akan muncul setelah conversation mulai terbentuk dan diproses."
                      : "CRM paling berguna saat dipakai untuk membaca konteks yang lebih stabil: stage, follow-up, deal, task, dan identity customer. Jangan berhenti di board saja kalau lead-nya sudah mulai serius."}
                  </p>
                </div>
                <Link
                  href={
                    leads[0] ? `/dashboard/crm/${leads[0].id}` : "/dashboard/upload"
                  }
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {leads[0] ? "Buka Lead Pertama" : "Import Chat"}
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Cara Pakai Halaman Ini
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <UsageHint
                  title="1. Baca stage dulu"
                  description="Board ini dipakai untuk membaca posisi lead saat ini, bukan untuk membalas chat langsung."
                />
                <UsageHint
                  title="2. Ubah stage seperlunya"
                  description="Pindahkan stage jika status lead memang berubah, misalnya dari education ke objection atau closing."
                />
                <UsageHint
                  title="3. Buka detail lead"
                  description="Masuk ke detail lead untuk edit follow-up, notes, task, deal, dan customer identity."
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              <BoardMetric
                label="Total Leads"
                value={String(leads.length)}
                hint="Semua lead yang sudah tercatat dari conversation."
              />
              <BoardMetric
                label="Perlu Ditindak"
                value={String(
                  leads.filter((lead) =>
                    [
                      "new_lead",
                      "qualification",
                      "objection",
                      "closing",
                    ].includes(lead.current_stage),
                  ).length,
                )}
                hint="Lead yang masih aktif di pipeline."
              />
              <BoardMetric
                label="Hot Leads"
                value={String(
                  leads.filter((lead) => lead.lead_temperature === "hot")
                    .length,
                )}
                hint="Lead dengan urgensi tertinggi saat ini."
              />
              <BoardMetric
                label="Won"
                value={String(
                  leads.filter((lead) => lead.current_stage === "won").length,
                )}
                hint="Lead yang sudah masuk tahap berhasil."
              />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Filter Channel
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Lihat pipeline per channel supaya lead WhatsApp dan Telegram
                    tidak tercampur.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SOURCE_CHANNEL_OPTIONS.map((option) => {
                    const isActive = sourceChannelFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSourceChannelFilter(option.value);
                        }}
                        className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
              {stageBuckets.map((bucket) => (
                <div
                  key={bucket.stage}
                  className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {STAGE_LABELS[bucket.stage]}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {bucket.items.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {bucket.items.length === 0 ? (
                      <div className="clara-empty-state p-4 text-sm text-slate-500">
                        Belum ada lead di stage ini.
                      </div>
                    ) : (
                      bucket.items.map((lead) => (
                        <article
                          key={lead.id}
                          className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-slate-950">
                              {lead.display_name}
                            </h2>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                                lead.lead_temperature,
                              )}`}
                            >
                              {lead.lead_temperature.toUpperCase()}
                            </span>
                          </div>

                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                            {lead.summary ??
                              "Belum ada summary lead. Jalankan AI analysis dulu."}
                          </p>

                          <div className="mt-4 space-y-2 text-xs text-slate-500">
                            <p>
                              Last contact:{" "}
                              {formatDateTime(lead.last_contact_at)}
                            </p>
                            <p>Conversation: {lead.conversation_count}</p>
                            <p>
                              Customer profile:{" "}
                              {lead.customer_profile_name ?? "Belum terhubung"}
                            </p>
                            <p>
                              Source: {lead.source_label} ({lead.source_channel}
                              )
                            </p>
                            <p>
                              Owner:{" "}
                              {lead.assigned_user_name ?? "Belum ada assignee"}
                            </p>
                          </div>

                          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Stage
                          </label>
                          <select
                            value={lead.current_stage}
                            onChange={(event) => {
                              void handleStageChange(
                                lead.id,
                                event.target.value,
                              );
                            }}
                            disabled={updatingLeadId === lead.id}
                            className="clara-select mt-2"
                          >
                            {STAGE_ORDER.map((stage) => (
                              <option key={stage} value={stage}>
                                {STAGE_LABELS[stage]}
                              </option>
                            ))}
                          </select>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={`/dashboard/crm/${lead.id}`}
                              className="clara-button clara-button-ghost px-3 py-2 text-xs"
                            >
                              Detail Lead
                            </Link>
                            {lead.latest_conversation_id && (
                              <Link
                                href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
                                className="clara-button clara-button-primary px-3 py-2 text-xs"
                              >
                                Buka Conversation
                              </Link>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function UsageHint({
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
    <article className="clara-card rounded-[24px] p-5">
      <p className="clara-kicker text-[11px] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}
