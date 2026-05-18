"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import type { CurrentUser, CustomerProfileSummaryItem } from "@/types/dashboard";

export default function CustomerProfilePage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfileSummaryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const [me, data] = await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<CustomerProfileSummaryItem>(`/customers/${customerId}`),
        ]);
        setCurrentUser(me);
        setProfile(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat customer profile."
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (customerId) {
      void loadProfile();
    }
  }, [customerId]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Unified customer identity"
      title={profile?.display_name ?? "Customer Profile"}
      description="Satu profil customer ini menggabungkan konteks lead dan channel, supaya tim tidak lagi melihat orang yang sama sebagai entitas terpisah."
      backHref="/dashboard/crm"
      backLabel="Kembali ke Lead Pipeline"
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading customer profile...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {profile && !isLoading && !errorMessage ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <Metric label="Lead Count" value={String(profile.lead_count)} />
              <Metric label="Conversation Count" value={String(profile.conversation_count)} />
              <Metric label="Last Contact" value={formatDateTime(profile.last_contact_at)} />
              <Metric label="PIC" value={profile.assigned_user_name ?? "Belum ada"} />
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <h2 className="text-xl font-semibold text-slate-950">Channel Coverage</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.source_labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <h2 className="text-xl font-semibold text-slate-950">Related Leads</h2>
              <div className="mt-5 space-y-4">
                {profile.related_leads.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">
                        {lead.display_name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                          lead.lead_temperature
                        )}`}
                      >
                        {lead.lead_temperature.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {lead.source_label}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Metric label="Stage" value={lead.current_stage.replaceAll("_", " ")} />
                      <Metric label="Last Contact" value={formatDateTime(lead.last_contact_at)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/crm/${lead.id}`}
                        className="inline-flex rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Buka Lead
                      </Link>
                      {lead.latest_conversation_id ? (
                        <Link
                          href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
                          className="inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Buka Conversation
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}
