import Link from "next/link";

const featureCards = [
  {
    title: "Inbox Operasional",
    description:
      "Upload chat WhatsApp, review percakapan aktif, lalu teruskan follow-up dari satu workspace yang rapi.",
    eyebrow: "Operations",
  },
  {
    title: "AI Analysis",
    description:
      "Clara membaca intent, objection, sentiment, risk, dan next best action dari percakapan customer.",
    eyebrow: "Signals",
  },
  {
    title: "Grounded Reply",
    description:
      "Draft balasan tetap diarahkan product knowledge agar tim tidak mengirim jawaban yang ngawur.",
    eyebrow: "Response",
  },
  {
    title: "Marketing Insight",
    description:
      "Owner dan admin bisa menangkap pola kebutuhan pasar dari data chat yang terus masuk setiap hari.",
    eyebrow: "Insight",
  },
] as const;

const workflowSteps = [
  {
    step: "1",
    title: "Masukkan chat harian",
    description:
      "Upload file TXT export WhatsApp dari tim operasional agar percakapan mulai dipetakan Clara.",
  },
  {
    step: "2",
    title: "Biarkan Clara membaca pola",
    description:
      "Chat di-parse menjadi conversation terstruktur lalu dianalisis untuk intent, objection, dan risiko.",
  },
  {
    step: "3",
    title: "Review draft dan tindakan",
    description:
      "Tim bisa meninjau reply suggestion yang sudah digrounding knowledge base sebelum dipakai ke customer.",
  },
  {
    step: "4",
    title: "Naikkan jadi insight bisnis",
    description:
      "Owner dan admin membaca sinyal pasar, tren objection, dan prioritas eksekusi dari workflow yang sama.",
  },
] as const;

const platformSignals = [
  {
    value: "Multi-tenant",
    label: "Organization isolation",
  },
  {
    value: "AI + KB",
    label: "Grounded reply system",
  },
  {
    value: "Audit trail",
    label: "Operational traceability",
  },
] as const;

const operatingNotes = [
  "Cocok untuk tim owner, admin, dan marketing yang butuh workflow cepat tanpa kehilangan konteks percakapan.",
  "Dashboard, extension, dan backend memakai alur kerja yang saling terhubung agar review dan eksekusi tetap sinkron.",
  "Desain Clara sengaja dibuat hangat, fokus, dan minim distraksi supaya area operasional terasa lebih tenang dipakai harian.",
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(212,176,123,0.26),_transparent_62%)]" />
      <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(16,23,45,0.12),_transparent_68%)] blur-3xl" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(212,176,123,0.12),_transparent_72%)] blur-3xl" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="clara-surface rounded-[30px] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="clara-kicker">Clara Workspace</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                AI workspace untuk membaca pasar dari chat customer
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="clara-button clara-button-primary">
                Masuk ke Dashboard
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="clara-button clara-button-ghost"
              >
                Lihat Repository
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="">
            <article className="clara-card rounded-[36px] p-6 sm:p-8 h-fit">
              <span className="clara-chip">Internal AI CRM Intelligence</span>
              <h2 className="mt-5 max-w-4xl text-4xl font-bold tracking-[-0.06em] text-slate-950 sm:text-[3.5rem] sm:leading-[1.02]">
                Dari chat harian tim operasional menjadi insight yang siap
                dipakai ambil keputusan.
              </h2>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                Clara membantu tim membaca objection customer, menyusun draft
                balasan yang lebih aman, dan mengubah percakapan menjadi arah
                konten, KPI, serta sinyal kebutuhan pasar tanpa perlu bongkar
                chat satu per satu.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="clara-button clara-button-primary"
                >
                  Buka Workspace
                </Link>
                <Link
                  href="/dashboard/start"
                  className="clara-button clara-button-secondary"
                >
                  Lihat Core Workflow
                </Link>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {platformSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="clara-card-soft rounded-[24px] px-4 py-4"
                  >
                    <p className="text-xl font-bold tracking-tight text-slate-950">
                      {signal.value}
                    </p>
                    <p className="mt-1.5 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {signal.label}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="clara-card rounded-[34px] p-6 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="clara-kicker text-xs">Platform Modules</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    Satu bahasa desain untuk seluruh workflow Clara
                  </h2>
                </div>
                <Link href="/login" className="clara-button clara-button-ghost">
                  Masuk dan mulai kerja
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {featureCards.map((card) => (
                  <article
                    key={card.title}
                    className="clara-card-soft rounded-[26px] p-5"
                  >
                    <p className="clara-kicker text-xs">{card.eyebrow}</p>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.description}
                    </p>
                  </article>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <section className="clara-card-dark rounded-[34px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4b07b]">
                Core Workflow
              </p>
              <ol className="mt-5 space-y-3">
                {workflowSteps.map((item) => (
                  <li
                    key={item.step}
                    className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                        {item.step}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="clara-panel-soft rounded-[30px] p-5">
              <p className="clara-kicker text-xs">Operating Notes</p>
              <div className="mt-4 space-y-3">
                {operatingNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-600"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <article className="clara-card rounded-[34px] p-6 sm:p-7">
            <p className="clara-kicker text-xs">Why Clara</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
              Dibuat untuk tim yang perlu cepat, tapi tetap rapi
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Clara tidak berhenti di parsing chat. Platform ini menyambungkan
              data mentah, analisis AI, grounded reply, dan insight agregat
              dalam satu ritme kerja yang konsisten.
            </p>

            <div className="mt-6 space-y-4">
              <InfoBlock
                title="Operasional lebih fokus"
                description="Tim marketing dan admin bisa bergerak dari inbox ke follow-up tanpa kehilangan konteks percakapan."
              />
              <InfoBlock
                title="Insight lebih bisa dipertanggungjawabkan"
                description="Balasan dan pembacaan AI ditopang knowledge base, audit trail, dan boundary role yang jelas."
              />
              <InfoBlock
                title="Owner lebih cepat membaca pasar"
                description="Objection, kebutuhan, dan risiko customer naik menjadi sinyal keputusan yang lebih nyata."
              />
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function InfoBlock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="clara-card-soft rounded-[24px] p-4">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
