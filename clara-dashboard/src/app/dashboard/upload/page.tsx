import Link from "next/link";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { WhatsAppUploadForm } from "@/components/dashboard/WhatsAppUploadForm";

export default function UploadWhatsAppPage() {
  return (
    <WorkspaceShell
      eyebrow="Data ingestion"
      title="Upload Chat Multi-Channel"
      description="Masukkan export chat dalam format .txt dan pilih channel yang sesuai. Clara akan mem-parse pesan, membuat conversation baru, lalu menyiapkan data untuk analysis berikutnya."
      backHref="/dashboard/sales"
      backLabel="Kembali ke inbox"
      actions={
        <Link
          href="/dashboard/sales"
          className="clara-button clara-button-ghost"
        >
          Lihat Inbox
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
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
{`12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?
12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.

[18.05.2026 09:12] Customer Leoni: Halo kak, saya tertarik.
[18.05.2026 09:13] Sales Aria: Siap kak, saya bantu jelaskan.`}
          </pre>
        </section>
      </div>
    </WorkspaceShell>
  );
}
