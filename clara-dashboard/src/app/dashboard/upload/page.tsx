import Link from "next/link";

import { WhatsAppUploadForm } from "@/components/dashboard/WhatsAppUploadForm";

export default function UploadWhatsAppPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link
            href="/dashboard/sales"
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            ← Back to Sales Inbox
          </Link>

          <p className="mt-6 text-sm font-medium text-slate-500">
            Clara Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Upload WhatsApp Chat
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Upload file export WhatsApp dalam format .txt. Clara akan parse
            pesan dan menyimpannya sebagai conversation baru.
          </p>
        </section>

        <WhatsAppUploadForm />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Format yang didukung
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Untuk MVP ini, parser Clara mendukung format umum export WhatsApp
            seperti:
          </p>

          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
{`12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?
12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.`}
          </pre>
        </section>
      </div>
    </main>
  );
}