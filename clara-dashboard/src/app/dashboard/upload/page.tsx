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
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          Lihat Inbox
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <WhatsAppUploadForm />

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-semibold text-slate-950">
            Format yang Didukung
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Untuk tahap ini, parser Clara mendukung format export WhatsApp dan
            Telegram TXT yang eksplisit seperti contoh berikut.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-[22px] bg-slate-950 p-4 text-sm text-slate-100">
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
