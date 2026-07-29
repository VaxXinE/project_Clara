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
              className="clara-button clara-button-ghost"
            >
              Buka Channels
            </Link>
          ) : null}
          <Link
            href="/dashboard/sales"
            className="clara-button clara-button-ghost"
          >
            Buka Chat Masuk
          </Link>
        </>
      }
    >
      <div className="mx-auto space-y-6">
        <section
          data-onboarding-id="sales-upload-steps"
          className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]"
        >
          <article className="clara-card p-5 sm:p-6">
            <p className="clara-kicker text-xs">Alur singkat</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight clara-text-primary">
              Lima langkah memasukkan chat
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <QuickStep
                number="1"
                title="Pilih input"
                description="Tentukan channel dan mode."
              />
              <QuickStep
                number="2"
                title="Beri identitas"
                description="Isi nama customer atau percakapan."
              />
              <QuickStep
                number="3"
                title="Tambah chat"
                description="Upload .txt atau paste isi chat."
              />
              <QuickStep
                number="4"
                title="Cek hasil"
                description="Periksa validasi atau deteksi channel."
              />
              <QuickStep
                number="5"
                title="Proses"
                description="Lanjut ke percakapan setelah berhasil."
              />
            </div>
          </article>

          <article
            data-onboarding-id="sales-upload-safety"
            className="clara-card-outline p-5"
          >
            <p className="clara-kicker text-xs">Sebelum memproses</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 clara-text-secondary">
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
          className="clara-card-outline p-5 sm:p-6"
        >
          <p className="clara-kicker">Contoh format</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] clara-text-primary">
            Format chat yang bisa dibaca Clara
          </h2>
          <p className="mt-2 text-sm leading-6 clara-text-secondary">
            Untuk tahap ini, parser Clara paling aman membaca export TXT yang jelas nama pengirim, waktu, dan isi pesannya.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#10172d] p-4 font-mono text-sm leading-7 text-slate-100">
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
    <div className="clara-card-soft p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold clara-text-primary">
        {number}
      </span>
      <h3 className="mt-3 text-base font-semibold clara-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 clara-text-secondary">{description}</p>
    </div>
  );
}
