"use client";

import Link from "next/link";

import {
  isHeadRole,
  isManagerRole,
  isSuperadminRole,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

type RoleFeatureSet = {
  roleKey: "sales" | "manager" | "head";
  label: string;
  title: string;
  summary: string;
  items: readonly string[];
};

const SALES_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Buka Chat Masuk",
    description: "Mulai dari chat yang paling perlu respons.",
    href: "/dashboard/sales",
    cta: "Buka Chat Masuk",
  },
  {
    step: "2",
    title: "Tinjau Konteks",
    description: "Baca percakapan, hasil AI, dan langkah berikutnya.",
    href: "/dashboard/sales",
    cta: "Pilih Percakapan",
  },
  {
    step: "3",
    title: "Selesaikan Follow-up",
    description: "Kerjakan yang overdue dan jatuh tempo hari ini.",
    href: "/dashboard/follow-up",
    cta: "Buka Tindak Lanjut",
  },
  {
    step: "4",
    title: "Input Chat Baru",
    description: "Upload atau paste chat yang datang dari luar extension.",
    href: "/dashboard/upload",
    cta: "Buka Input Chat",
  },
] as const;

const HEAD_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Pantau Kondisi Tim",
    description: "Buka Monitor Tim untuk lihat progres, risiko, dan hambatan.",
    href: "/dashboard/manager-insights",
    cta: "Buka Monitor Tim",
  },
  {
    step: "2",
    title: "Cek Area Yang Mulai Bocor",
    description: "Pilih lead atau area tim yang butuh perhatian lebih dulu.",
    href: "/dashboard/crm",
    cta: "Buka Lead Tim",
  },
  {
    step: "3",
    title: "Buka Arahan Tim",
    description: "Masuk ke item yang macet atau perlu keputusan lanjut.",
    href: "/dashboard/approvals",
    cta: "Buka Arahan Tim",
  },
  {
    step: "4",
    title: "Beri Arahan Perbaikan",
    description: "Kirim rekomendasi dan next action ke tim.",
    href: "/dashboard/notifications",
    cta: "Kembali ke Alert Tim",
  },
] as const;

const MANAGER_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Pantau Tim Dulu",
    description: "Buka Monitor Tim untuk lihat progres dan hambatan.",
    href: "/dashboard/manager-insights",
    cta: "Buka Monitor Tim",
  },
  {
    step: "2",
    title: "Cek Balasan Sales",
    description: "Buka Review Sales.",
    href: "/dashboard/approvals",
    cta: "Buka Review Sales",
  },
  {
    step: "3",
    title: "Tentukan Arah Perbaikan",
    description: "Cek apakah balasan sudah aman, jelas, dan layak lanjut.",
    href: "/dashboard/approvals",
    cta: "Review Jawaban Sales",
  },
  {
    step: "4",
    title: "Kirim Arahan ke Sales",
    description: "Kirim feedback kalau masih perlu revisi atau tindak lanjut.",
    href: "/dashboard/approvals",
    cta: "Kirim Feedback",
  },
] as const;

const SUPERADMIN_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Baca Dashboard dan Alert",
    description:
      "Mulai dari ops dashboard dan alert aktif untuk melihat kesehatan eksekusi, tim, dan sinyal anomali secara global.",
    href: "/dashboard/kpi",
    cta: "Buka Ops Dashboard",
  },
  {
    step: "2",
    title: "Lihat Pola Lapangan",
    description:
      "Masuk ke chat insight untuk membaca objection, pola percakapan, dan sinyal yang perlu diterjemahkan jadi intervensi operasional.",
    href: "/dashboard/marketing",
    cta: "Buka Chat Insight",
  },
  {
    step: "3",
    title: "Verifikasi Lapangan",
    description:
      "Kalau ada sinyal yang perlu dicek lebih dalam, turun ke lead management, queue, atau action center untuk melihat konteks operasionalnya.",
    href: "/dashboard/follow-up",
    cta: "Buka Action Center",
  },
  {
    step: "4",
    title: "Intervensi Akses atau Pengetahuan",
    description:
      "Gunakan access control, system ops, atau knowledge base saat perlu membenahi governance, akses, atau landasan jawaban tim.",
    href: "/admin/access",
    cta: "Buka Access Control",
  },
] as const;

const ROLE_FEATURE_SETS: readonly RoleFeatureSet[] = [
  {
    roleKey: "sales",
    label: "Sales",
    title: "Jawab nasabah",
    summary: "Fokus pada chat, AI, prospect, dan follow-up.",
    items: [
      "Jawab chat dengan bantuan AI.",
      "Kirim jawaban ke nasabah.",
      "Lihat progres prospect.",
      "Terima notifikasi follow-up.",
    ],
  },
  {
    roleKey: "manager",
    label: "Manager",
    title: "Pantau tim dan arahkan Sales",
    summary: "Fokus pada progres tim, review balasan, dan arahan.",
    items: [
      "Lihat progres lead tim.",
      "Cek balasan Sales yang perlu ditinjau.",
      "Tentukan apakah perlu revisi atau lanjut.",
      "Kirim arahan yang jelas ke Sales.",
    ],
  },
  {
    roleKey: "head",
    label: "Head",
    title: "Arahkan follow-up tim",
    summary: "Fokus pada risiko, follow-up, dan arahan.",
    items: [
      "Analisis prospect Sales.",
      "Identifikasi lead berisiko.",
      "Follow-up ke Sales.",
      "Beri arahan perbaikan.",
    ],
  },
] as const;

function getRoleFeatureHighlight(
  role?: string
): RoleFeatureSet["roleKey"] | null {
  if (isHeadRole(role)) {
    return "head";
  }
  if (isManagerRole(role)) {
    return "manager";
  }
  if (normalizeWorkspaceRole(role) === "sales") {
    return "sales";
  }
  if (isSuperadminRole(role)) {
    return null;
  }
  return "sales";
}

function buildRoleTasks(role?: string) {
  if (isSuperadminRole(role)) {
    return [
      {
        title: "Saya mau baca health operasional",
        description: "Buka Ops Dashboard.",
        href: "/dashboard/kpi",
      },
      {
        title: "Saya mau lihat pola objection lapangan",
        description: "Buka Chat Insight.",
        href: "/dashboard/marketing",
      },
      {
        title: "Saya mau verifikasi eksekusi di level lead",
        description: "Turun ke lead atau action center.",
        href: "/dashboard/crm",
      },
    ];
  }

  if (isHeadRole(role)) {
    return [
      {
        title: "Saya mau analisis prospect tim",
        description: "Buka Monitor Tim.",
        href: "/dashboard/manager-insights",
      },
      {
        title: "Saya mau lihat lead yang paling riskan",
        description: "Lihat lead tim yang perlu intervensi.",
        href: "/dashboard/crm",
      },
      {
        title: "Saya mau follow-up ke Sales",
        description: "Buka Arahan Tim.",
        href: "/dashboard/approvals",
      },
    ];
  }

  if (isManagerRole(role)) {
    return [
      {
        title: "Saya mau pantau progres tim",
        description: "Buka Monitor Tim.",
        href: "/dashboard/manager-insights",
      },
      {
        title: "Saya mau cek jawaban Sales",
        description: "Buka Review Sales.",
        href: "/dashboard/approvals",
      },
      {
        title: "Saya mau kasih arahan ke Sales",
        description: "Tulis feedback atau coaching note yang jelas.",
        href: "/dashboard/approvals",
      },
    ];
  }

  return [
    {
      title: "Saya mau balas customer",
      description: "Buka chat yang paling perlu respons.",
      href: "/dashboard/sales",
    },
    {
      title: "Saya mau meninjau konteks",
      description: "Pilih percakapan lalu baca konteks dan hasil AI.",
      href: "/dashboard/sales",
    },
    {
      title: "Saya mau menyelesaikan follow-up",
      description: "Kerjakan yang overdue atau jatuh tempo hari ini.",
      href: "/dashboard/follow-up",
    },
    {
      title: "Saya mau input chat baru",
      description: "Upload file .txt atau paste chat baru.",
      href: "/dashboard/upload",
    },
  ];
}

function buildWorkflowSteps(role?: string) {
  if (isSuperadminRole(role)) {
    return SUPERADMIN_WORKFLOW_STEPS;
  }
  if (isHeadRole(role)) {
    return HEAD_WORKFLOW_STEPS;
  }
  if (isManagerRole(role)) {
    return MANAGER_WORKFLOW_STEPS;
  }
  return SALES_WORKFLOW_STEPS;
}

function buildRoleStartCopy(role?: string) {
  if (isSuperadminRole(role)) {
    return {
      eyebrow: "Superadmin flow",
      title: "Mulai dari dashboard operasional",
      description:
        "Lihat kondisi operasional dulu, lalu turun ke halaman eksekusi bila perlu.",
      primaryHref: "/dashboard/kpi",
      primaryLabel: "Buka Ops Dashboard",
      secondaryHref: "/dashboard/marketing",
      secondaryLabel: "Buka Chat Insight",
    };
  }

  if (isHeadRole(role)) {
    return {
      eyebrow: "Head flow",
      title: "Mulai dari monitor tim dulu",
      description:
        "Pantau tim, cek area berisiko, lalu beri arahan tindak lanjut.",
      primaryHref: "/dashboard/manager-insights",
      primaryLabel: "Buka Monitor Tim",
      secondaryHref: "/dashboard/approvals",
      secondaryLabel: "Buka Arahan Tim",
    };
  }

  if (isManagerRole(role)) {
    return {
      eyebrow: "Manager flow",
      title: "Mulai dari monitor tim dulu",
      description:
        "Pantau tim, cek balasan Sales, lalu kirim arahan.",
      primaryHref: "/dashboard/manager-insights",
      primaryLabel: "Buka Monitor Tim",
      secondaryHref: "/dashboard/approvals",
      secondaryLabel: "Buka Review Sales",
    };
  }

  return {
    eyebrow: "Sales flow",
    title: "Mulai dari chat masuk",
    description:
      "Buka chat, tinjau konteks, selesaikan follow-up, lalu input chat baru bila dibutuhkan.",
    primaryHref: "/dashboard/sales",
    primaryLabel: "Buka Chat Masuk",
    secondaryHref: "/dashboard/follow-up",
    secondaryLabel: "Buka Tindak Lanjut",
  };
}

export function RoleBasedStartGuide({
  currentUser,
  compact = false,
}: {
  currentUser: CurrentUser | null;
  compact?: boolean;
}) {
  const roleTasks = buildRoleTasks(currentUser?.role);
  const workflowSteps = buildWorkflowSteps(currentUser?.role);
  const roleStartCopy = buildRoleStartCopy(currentUser?.role);
  const highlightedRole = getRoleFeatureHighlight(currentUser?.role);

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {roleStartCopy.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight clara-text-primary">
              {roleStartCopy.title}
            </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {roleStartCopy.description}
            </p>
          </div>

          {!compact ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={roleStartCopy.primaryHref}
                className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
              >
                {roleStartCopy.primaryLabel}
              </Link>
              <Link
                href={roleStartCopy.secondaryHref}
                className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                {roleStartCopy.secondaryLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {workflowSteps.map((item) => (
            <article
              key={item.step}
              className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold clara-text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
              <Link
                href={item.href}
                className="mt-5 inline-flex rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </article>

      {!compact ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fitur Setiap Role
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {ROLE_FEATURE_SETS.map((featureSet) => {
                const isHighlighted =
                  highlightedRole !== null &&
                  featureSet.roleKey === highlightedRole;

                return (
                  <article
                    key={featureSet.roleKey}
                    className={`rounded-[24px] border p-5 transition ${
                      isHighlighted
                        ? "border-slate-900 bg-slate-950 text-white shadow-[0_16px_32px_rgba(15,23,42,0.16)]"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                          isHighlighted ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {featureSet.label}
                      </span>
                      {isHighlighted ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                          Role aktif
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={`mt-4 text-base font-semibold ${
                        isHighlighted ? "text-white" : "clara-text-primary"
                      }`}
                    >
                      {featureSet.title}
                    </h3>
                      <p
                        className={`mt-2 text-sm leading-5 ${
                          isHighlighted ? "text-slate-300" : "text-slate-600"
                        }`}
                    >
                      {featureSet.summary}
                    </p>
                    <div className="mt-4 space-y-2">
                      {featureSet.items.map((item) => (
                        <p
                          key={item}
                          className={`rounded-2xl border px-3.5 py-3 text-sm leading-5 ${
                            isHighlighted
                              ? "border-white/10 bg-white/5 text-slate-100"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Shortcut Sesuai Role
            </p>
            <div className="mt-5 space-y-4">
              {roleTasks.map((task) => (
                <Link
                  key={task.title}
                  href={task.href}
                  className="block rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <h3 className="text-base font-semibold clara-text-primary">
                    {task.title}
                  </h3>
                   <p className="mt-2 text-sm leading-5 text-slate-600">
                     {task.description}
                   </p>
                </Link>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cara Baca Menu
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Queue</span>:
                chat yang harus ditangani.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Lead Management</span>:
                progres dan status lead.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Action Center</span>:
                follow-up harian.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Review Sales</span>:
                review jawaban dan arahan ke Sales.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Alert Center</span>:
                alert follow-up tim.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Chat Insight / Ops Dashboard</span>:
                insight dan kondisi operasional.
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
