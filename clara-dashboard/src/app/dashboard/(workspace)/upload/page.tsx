"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { WhatsAppUploadForm } from "@/components/dashboard/WhatsAppUploadForm";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

export default function UploadWhatsAppPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);
      } catch {
        // WorkspaceShell already has a safe fallback menu for protected pages.
      }
    }

    void loadUser();
  }, []);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Data ingestion"
      title="Upload Chat Multi-Channel"
      description="Masukkan export chat dalam format .txt atau paste chat langsung. Clara sekarang membaca registry channel dari backend, bisa membantu auto-detect channel untuk paste chat, lalu membuat conversation baru yang siap dianalisis."
      backHref="/dashboard/sales"
      backLabel="Kembali ke inbox"
      actions={
        <>
          <Link
            href="/dashboard/channels"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Lihat Channel Overview
          </Link>
          <Link
            href="/dashboard/sales"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Lihat Inbox
          </Link>
        </>
      }
    >
      <div className="mx-auto space-y-6">
        <WhatsAppUploadForm />

        <section className="clara-card rounded-[28px] p-5 sm:p-6">
          <p className="clara-kicker">Supported Format</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            Format yang Didukung
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Untuk tahap ini, parser Clara mendukung format export WhatsApp dan
            Telegram TXT yang eksplisit seperti contoh berikut.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-[24px] bg-[#10172d] p-4 text-sm leading-7 text-slate-100 shadow-[0_18px_34px_rgba(16,23,45,0.2)]">
            {`{Whatsapp}
12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?
12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.

{Telegram}
[18.05.2026 09:12] Customer Leoni: Halo kak, saya tertarik.
[18.05.2026 09:13] Sales Aria: Siap kak, saya bantu jelaskan.`}
          </pre>
        </section>
      </div>
    </WorkspaceShell>
  );
}
