"use client";

import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { WhatsAppUploadForm } from "@/components/dashboard/WhatsAppUploadForm";
import { apiFetch } from "@/lib/api";
import { normalizeWorkspaceRole } from "@/lib/roles";
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
      title={PAGE_NAMES.intake}
      description={
        isSalesWorkspace
          ? "Masukkan chat customer yang datang dari luar extension. Setelah diproses, chatnya muncul di Chat Masuk dan siap dibalas."
          : "Masukkan chat dari file atau tempel langsung untuk membuat percakapan dan lead baru yang bisa dibaca Clara."
      }
      backHref="/sales"
      backLabel="Kembali ke Chat Masuk"
    >
      <div className="space-y-5">
        <WhatsAppUploadForm />

        <section data-onboarding-id="sales-upload-example" className="clara-card-outline p-5 sm:p-6">
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
              Bentuk chat seperti apa yang bisa dibaca Clara?
            </summary>
            <p className="mt-2 text-sm leading-6 clara-text-secondary">
              Clara membaca hasil ekspor chat yang jelas nama pengirim, waktu, dan isi pesannya. Di WhatsApp: buka
              chat, ketuk nama customer, pilih Ekspor chat, lalu Tanpa media.
            </p>

            <p className="mt-4 text-sm font-semibold clara-text-primary">WhatsApp</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-clara-sunken p-4 font-mono text-sm leading-7 clara-text-secondary">
              {`12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?
12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.`}
            </pre>

            <p className="mt-4 text-sm font-semibold clara-text-primary">Telegram</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-clara-sunken p-4 font-mono text-sm leading-7 clara-text-secondary">
              {`[18.05.2026 09:12] Customer Leoni: Halo kak, saya tertarik.
[18.05.2026 09:13] Sales Aria: Siap kak, saya bantu jelaskan.`}
            </pre>
          </details>
        </section>
      </div>
    </WorkspaceShell>
  );
}
