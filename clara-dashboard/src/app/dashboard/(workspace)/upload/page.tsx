"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { WhatsAppUploadForm } from "@/components/dashboard/WhatsAppUploadForm";
import { apiFetch } from "@/lib/api";
import { isAdminLike, normalizeWorkspaceRole } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

export default function UploadWhatsAppPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";

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
      eyebrow="Input chat"
      title={isSalesWorkspace ? "Masukkan Chat Baru" : "Lead Capture"}
      description={
        isSalesWorkspace
          ? "Masukkan chat customer dari file .txt atau paste langsung. Setelah diproses, chat akan masuk ke Clara sebagai percakapan baru atau lanjutan yang siap ditindak."
          : "Masukkan export chat dalam format .txt atau paste chat langsung. Ini adalah pintu masuk utama untuk membuat conversation dan lead baru yang siap dianalisis Clara."
      }
      backHref="/dashboard/sales"
      backLabel="Kembali ke chat masuk"
      actions={
        <>
          {isAdminLike(currentUser?.role) ? (
            <Link
              href="/dashboard/channels"
              className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
            >
              Buka Channels
            </Link>
          ) : null}
          <Link
            href="/dashboard/sales"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Buka Chat Masuk
          </Link>
        </>
      }
    >
      <div className="mx-auto space-y-6">
        <section
          data-onboarding-id="sales-upload-steps"
          className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"
        >
          <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(71,49,19,0.94)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
              Alur paling cepat
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#fff3cf]">
              Tiga langkah buat masukin chat ke Clara
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <QuickStep
                number="1"
                title="Pilih sumber chat"
                description="Tentukan channel, isi nama customer, lalu pilih upload file atau paste chat."
              />
              <QuickStep
                number="2"
                title="Masukkan isi percakapan"
                description="Upload file .txt atau tempel isi chat yang mau dibaca Clara."
              />
              <QuickStep
                number="3"
                title="Proses dan lanjut kerja"
                description="Setelah berhasil, Clara langsung buka detail percakapan agar sales bisa lanjut analisis."
              />
            </div>
          </article>

          <article
            data-onboarding-id="sales-upload-safety"
            className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.94)_0%,rgba(18,13,10,0.96)_100%)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
              Supaya aman dibaca Clara
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#e3c990]">
              <li>Isi judul dengan nama customer yang konsisten.</li>
              <li>Pilih channel yang sesuai sebelum proses chat.</li>
              <li>Kalau lanjut percakapan lama, jangan ubah nama customer sembarangan.</li>
              <li>Untuk file, gunakan format `.txt` maksimal 5MB.</li>
            </ul>
          </article>
        </section>

        <WhatsAppUploadForm />

        <section
          data-onboarding-id="sales-upload-example"
          className="clara-card rounded-[28px] p-5 sm:p-6"
        >
          <p className="clara-kicker">Contoh format</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
            Format chat yang bisa dibaca Clara
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Untuk tahap ini, parser Clara paling aman membaca export TXT yang jelas nama pengirim, waktu, dan isi pesannya.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-3xl bg-[#10172d] p-4 text-sm leading-7 text-slate-100 shadow-[0_18px_34px_rgba(16,23,45,0.2)] font-mono">
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

function QuickStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(24,18,13,0.92)_0%,rgba(17,13,10,0.96)_100%)] p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-sm font-bold text-[#140f08]">
        {number}
      </span>
      <h3 className="mt-3 text-base font-semibold text-[#fff3cf]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#dcc28b]">{description}</p>
    </div>
  );
}
