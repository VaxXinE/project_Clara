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
    title: "Cek Area yang Mulai Bocor",
    description: "Pilih lead atau area tim yang butuh perhatian lebih dulu.",
    href: "/dashboard/crm",
    cta: "Buka Lead Tim",
  },
  {
    step: "3",
    title: "Beri Arahan ke Tim",
    description:
      "Buka Arahan Tim, putuskan item yang macet, lalu kirim arahan dan langkah berikutnya.",
    href: "/dashboard/approvals",
    cta: "Buka Arahan Tim",
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
    description:
      "Baca balasan Sales, lalu putuskan apakah sudah aman, jelas, dan layak lanjut.",
    href: "/dashboard/approvals",
    cta: "Buka Review Sales",
  },
  {
    step: "3",
    title: "Kirim Arahan ke Sales",
    description: "Kirim feedback kalau masih perlu revisi atau tindak lanjut.",
    href: "/dashboard/approvals",
    cta: "Beri Arahan",
  },
] as const;

const SUPERADMIN_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Baca Dashboard dan Alert",
    description:
      "Mulai dari ops dashboard dan alert aktif untuk melihat kesehatan eksekusi, tim, dan sinyal anomali secara global.",
    href: "/dashboard/kpi",
    cta: "Buka Dashboard Operasional",
  },
  {
    step: "2",
    title: "Lihat Pola Lapangan",
    description:
      "Masuk ke chat insight untuk membaca objection, pola percakapan, dan sinyal yang perlu diterjemahkan jadi intervensi operasional.",
    href: "/dashboard/marketing",
    cta: "Buka Insight Pasar",
  },
  {
    step: "3",
    title: "Verifikasi Lapangan",
    description:
      "Kalau ada sinyal yang perlu dicek lebih dalam, turun ke lead management, queue, atau action center untuk melihat konteks operasionalnya.",
    href: "/dashboard/follow-up",
    cta: "Buka Tindak Lanjut",
  },
  {
    step: "4",
    title: "Intervensi Akses atau Pengetahuan",
    description:
      "Gunakan access control, system ops, atau knowledge base saat perlu membenahi governance, akses, atau landasan jawaban tim.",
    href: "/admin/access",
    cta: "Buka Pengguna & Akses",
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
        description: "Buka Dashboard Operasional.",
        href: "/dashboard/kpi",
      },
      {
        title: "Saya mau lihat pola objection lapangan",
        description: "Buka Insight Pasar.",
        href: "/dashboard/marketing",
      },
      {
        title: "Saya mau verifikasi eksekusi di level lead",
        description: "Turun ke lead atau Tindak Lanjut.",
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
      primaryLabel: "Buka Dashboard Operasional",
      secondaryHref: "/dashboard/marketing",
      secondaryLabel: "Buka Insight Pasar",
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
      <article className="rounded-3xl border border-clara-line bg-clara-raised p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold text-clara-ink-3">
              {roleStartCopy.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight clara-text-primary">
              {roleStartCopy.title}
            </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-clara-ink-2">
              {roleStartCopy.description}
            </p>
          </div>

          {!compact ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={roleStartCopy.primaryHref}
                className="clara-button clara-button-primary"
              >
                {roleStartCopy.primaryLabel}
              </Link>
              <Link
                href={roleStartCopy.secondaryHref}
                className="clara-button clara-button-secondary"
              >
                {roleStartCopy.secondaryLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div
          className={`mt-5 grid gap-4 ${
            workflowSteps.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"
          }`}
        >
          {workflowSteps.map((item) => (
            <article
              key={item.step}
              className="rounded-2xl border border-clara-line bg-clara-raised p-5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-clara-deep text-sm font-bold text-clara-cream">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold clara-text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-clara-ink-2">
                {item.description}
              </p>
              <Link
                href={item.href}
                className="clara-button clara-button-secondary mt-5"
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </article>

      {!compact ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-clara-line bg-clara-raised p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold text-clara-ink-3">
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
                    className={`rounded-2xl border p-5 transition ${
                      isHighlighted
                        ? "border-clara-line bg-clara-deep text-clara-cream shadow-[0_16px_32px_rgba(15,23,42,0.16)]"
                        : "border-clara-line bg-clara-raised"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          isHighlighted ? "text-clara-ink-3" : "text-clara-ink-3"
                        }`}
                      >
                        {featureSet.label}
                      </span>
                      {isHighlighted ? (
                        <span className="rounded-full border border-white/15 bg-clara-wash px-2.5 py-1 text-xs font-semibold text-clara-cream">
                          Role aktif
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={`mt-4 text-base font-semibold ${
                        isHighlighted ? "text-clara-cream" : "clara-text-primary"
                      }`}
                    >
                      {featureSet.title}
                    </h3>
                      <p
                        className={`mt-2 text-sm leading-5 ${
                          isHighlighted ? "text-clara-ink-3" : "text-clara-ink-2"
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
                              ? "border-clara-line bg-clara-wash text-clara-ink-3"
                              : "border-clara-line bg-clara-raised text-clara-ink-2"
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

          <article className="rounded-3xl border border-clara-line bg-clara-raised p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold text-clara-ink-3">
              Shortcut Sesuai Role
            </p>
            <div className="mt-5 space-y-4">
              {roleTasks.map((task) => (
                <Link
                  key={task.title}
                  href={task.href}
                  className="block rounded-2xl border border-clara-line bg-clara-raised p-4 transition hover:border-clara-line hover:bg-clara-raised"
                >
                  <h3 className="text-base font-semibold clara-text-primary">
                    {task.title}
                  </h3>
                   <p className="mt-2 text-sm leading-5 text-clara-ink-2">
                     {task.description}
                   </p>
                </Link>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-clara-line pt-6 text-sm leading-6 text-clara-ink-2">
              <p className="text-xs font-semibold text-clara-ink-3">
                Cara Baca Menu
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Chat Masuk</span>:
                chat yang harus ditangani.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Lead</span>:
                progres dan status lead.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Tindak Lanjut</span>:
                follow-up harian.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Review Sales</span>:
                review jawaban dan arahan ke Sales.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Alert</span>:
                alert follow-up tim.
              </p>
              <p>
                <span className="font-semibold clara-text-primary">Insight Pasar / Dashboard Operasional</span>:
                insight dan kondisi operasional.
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
