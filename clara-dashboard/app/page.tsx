import Link from "next/link";

const featureCards = [
  {
    title: "Inbox Operasional",
    description:
      "Upload chat WhatsApp, pantau percakapan, dan kelola follow-up dari satu dashboard.",
  },
  {
    title: "AI Analysis",
    description:
      "Ekstraksi intent, objection, sentiment, risk, dan next best action dari chat customer.",
  },
  {
    title: "Grounded Reply",
    description:
      "Draft balasan AI diarahkan oleh product knowledge agar tidak mudah mengarang.",
  },
  {
    title: "Marketing Insight",
    description:
      "Owner dan admin bisa membaca pola objection, tren kebutuhan pasar, dan snapshot insight.",
  },
];

const workflowSteps = [
  "Upload file .txt export WhatsApp dari tim operasional.",
  "Clara mem-parse chat menjadi conversation dan message terstruktur.",
  "AI menganalisis percakapan lalu menghasilkan insight dan draft balasan.",
  "Owner/admin membaca snapshot market signal dari data percakapan yang masuk.",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#ffffff_100%)] text-slate-950">
      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 sm:px-8 lg:px-10">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_35%)]" />

        <header className="flex flex-col gap-4 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Clara
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              AI workspace untuk membaca pasar dari chat customer
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Masuk ke Dashboard
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Lihat Repository
            </a>
          </div>
        </header>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:py-14">
          <div className="space-y-8">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Internal AI CRM Intelligence
              </div>
              <h2 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Dari chat harian tim operasional menjadi insight yang bisa
                dipakai ambil keputusan.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Clara membantu tim membaca objection customer, menyusun draft
                balasan yang lebih aman, dan mengubah data percakapan menjadi
                arah konten, KPI, serta sinyal kebutuhan pasar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur"
                >
                  <h3 className="text-base font-semibold text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                Core Workflow
              </p>
              <ol className="mt-5 space-y-4">
                {workflowSteps.map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-200">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard value="Multi-tenant" label="Organization isolation" />
                <MetricCard value="AI + KB" label="Grounded reply system" />
                <MetricCard value="Audit" label="Operational traceability" />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cocok untuk
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tim owner, admin, dan marketing yang ingin membaca pola pasar
                  dari percakapan customer tanpa harus bongkar chat satu per
                  satu.
                </p>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-lg font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  );
}
