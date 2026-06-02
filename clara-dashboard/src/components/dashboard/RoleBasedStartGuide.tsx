"use client";

import Link from "next/link";

import {
  isAdminLike,
  isManagerLike,
  isOwnerLike,
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
    title: "Terima Pertanyaan Nasabah",
    description:
      "Mulai dari Queue untuk membaca chat yang masuk dari nasabah dan buka detail conversation yang sedang aktif.",
    href: "/dashboard/sales",
    cta: "Buka Queue",
  },
  {
    step: "2",
    title: "Gunakan AI untuk Membantu Jawaban",
    description:
      "Di dalam conversation detail, jalankan AI analysis lalu pilih atau edit draft balasan sebelum dikirim ke nasabah.",
    href: "/dashboard/sales",
    cta: "Buka Conversation",
  },
  {
    step: "3",
    title: "Kirim Jawaban dan Pantau Prospect",
    description:
      "Setelah jawaban dikirim, cek progress prospect dan lihat apakah ada follow-up yang perlu dikerjakan lagi.",
    href: "/dashboard/crm",
    cta: "Buka Lead Management",
  },
  {
    step: "4",
    title: "Lakukan Follow-up Bila Dibutuhkan",
    description:
      "Gunakan Action Center untuk mengecek follow-up overdue, hot lead, dan notifikasi tindak lanjut yang harus dibersihkan hari ini.",
    href: "/dashboard/follow-up",
    cta: "Buka Action Center",
  },
] as const;

const HEAD_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Analisis Follow-up Tiap Sales",
    description:
      "Mulai dari Alert Center untuk melihat follow-up tiap sales yang overdue, hot lead yang belum disentuh, dan sales mana yang mulai bocor.",
    href: "/dashboard/notifications",
    cta: "Buka Alert Center",
  },
  {
    step: "2",
    title: "Identifikasi Prospect yang Kurang atau Berisiko",
    description:
      "Setelah terlihat owner-nya, buka lead atau conversation yang paling riskan untuk membaca konteks dan prioritas intervensinya.",
    href: "/dashboard/crm",
    cta: "Buka Lead Management",
  },
  {
    step: "3",
    title: "Follow-up ke CS",
    description:
      "Gunakan Chat Review Center atau conversation review untuk memberi tekanan, coaching, atau keputusan pada item yang macet di level CS.",
    href: "/dashboard/approvals",
    cta: "Buka Chat Review Center",
  },
  {
    step: "4",
    title: "Berikan Arahan dan Next Action",
    description:
      "Akhiri dengan arahan yang jelas: lead mana yang harus dikejar, follow-up mana yang harus dibersihkan, dan next action apa yang harus dipegang CS.",
    href: "/dashboard/notifications",
    cta: "Kembali ke Alert Center",
  },
] as const;

const MANAGER_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Lihat Progress Prospect CS",
    description:
      "Mulai dari Manager Insights untuk melihat kesehatan tim dan prospect CS yang sedang aktif atau mulai melambat.",
    href: "/dashboard/manager-insights",
    cta: "Buka Manager Insights",
  },
  {
    step: "2",
    title: "Lihat Jawaban yang Sudah Dikirim CS",
    description:
      "Masuk ke Chat Review Center untuk membaca jawaban, draft, dan percakapan yang sudah dikirim atau masih butuh dilihat ulang.",
    href: "/dashboard/approvals",
    cta: "Buka Chat Review Center",
  },
  {
    step: "3",
    title: "Analisis Kualitas Jawaban CS",
    description:
      "Fokuskan review pada akurasi, kelengkapan, tone, dan kepatuhan jawaban sebelum memutuskan apakah perlu diperbaiki.",
    href: "/dashboard/approvals",
    cta: "Review Jawaban CS",
  },
  {
    step: "4",
    title: "Kirim Feedback ke CS",
    description:
      "Kalau jawaban belum sesuai standar, kirim feedback atau coaching note ke CS supaya follow-up berikutnya lebih rapi.",
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
    label: "CS",
    title: "Menjawab nasabah dan menjaga follow-up tetap hidup",
    summary:
      "Role ini fokus ke eksekusi chat harian, bantuan AI, progress prospect, dan follow-up ke nasabah.",
    items: [
      "Menjawab pertanyaan nasabah dengan bantuan AI.",
      "Membuka conversation, memilih draft, lalu mengirim jawaban.",
      "Melihat progress prospect dan lead yang sedang aktif.",
      "Menerima notifikasi follow-up bila ada customer yang harus disentuh lagi.",
    ],
  },
  {
    roleKey: "manager",
    label: "Admin",
    title: "Mengecek kualitas jawaban CS sebelum dibiarkan jalan sendiri",
    summary:
      "Role ini dipakai reviewer untuk membaca progress prospect CS, menilai kualitas jawaban, lalu mengirim feedback.",
    items: [
      "Melihat progress prospect CS yang aktif atau mulai melambat.",
      "Membaca daftar jawaban CS yang sudah dikirim ke nasabah.",
      "Menganalisis akurasi, tone, kelengkapan, dan kepatuhan jawaban.",
      "Mengirim feedback atau coaching note ke CS untuk perbaikan.",
    ],
  },
  {
    roleKey: "head",
    label: "Head",
    title: "Membaca follow-up tim dan menekan area yang mulai bocor",
    summary:
      "Role ini dipakai untuk oversight follow-up sales, identifikasi prospect berisiko, lalu memberi arahan next action.",
    items: [
      "Menganalisis follow-up tiap sales dari alert dan worklist tim.",
      "Mengidentifikasi prospect CS yang kurang, lambat, atau berisiko.",
      "Follow-up ke CS bila eksekusi mulai macet atau arahnya salah.",
      "Memberi arahan, prioritas, dan next action yang harus dipegang tim.",
    ],
  },
] as const;

function getRoleFeatureHighlight(role?: string): RoleFeatureSet["roleKey"] {
  if (isOwnerLike(role) || isAdminLike(role)) {
    return "head";
  }
  if (isManagerLike(role)) {
    return "manager";
  }
  return "sales";
}

function buildRoleTasks(role?: string) {
  if (isOwnerLike(role)) {
    return [
      {
        title: "Saya mau baca health operasional",
        description: "Masuk ke Ops Dashboard untuk melihat KPI, tekanan lapangan, dan anomali lintas tim.",
        href: "/dashboard/kpi",
      },
      {
        title: "Saya mau lihat pola objection lapangan",
        description: "Buka Chat Insight untuk membaca pola keberatan customer dan sinyal yang perlu diterjemahkan jadi intervensi.",
        href: "/dashboard/marketing",
      },
      {
        title: "Saya mau verifikasi eksekusi di level lead",
        description: "Turun ke Lead Management atau Action Center saat perlu melihat konteks operasional yang spesifik.",
        href: "/dashboard/crm",
      },
    ];
  }

  if (isAdminLike(role)) {
    return [
      {
        title: "Saya mau cek follow-up per sales",
        description: "Masuk ke Alert Center untuk melihat follow-up siapa yang mulai overdue, macet, atau belum disentuh.",
        href: "/dashboard/notifications",
      },
      {
        title: "Saya mau lihat lead yang paling riskan",
        description: "Buka Lead Management untuk membaca prospect yang bocor, panas, atau butuh intervensi lebih dulu.",
        href: "/dashboard/crm",
      },
      {
        title: "Saya mau follow-up ke CS",
        description: "Masuk ke Chat Review Center untuk memberi arahan, tekanan, atau keputusan pada percakapan yang macet.",
        href: "/dashboard/approvals",
      },
    ];
  }

  if (isManagerLike(role)) {
      return [
      {
        title: "Saya mau lihat progress prospect CS",
        description: "Buka Manager Insights untuk membaca progress prospect, discipline tim, dan sinyal yang mulai bocor.",
        href: "/dashboard/manager-insights",
      },
      {
        title: "Saya mau cek jawaban CS",
        description: "Masuk ke Chat Review Center untuk membaca jawaban CS, approval, dan bottleneck percakapan tim.",
        href: "/dashboard/approvals",
      },
      {
        title: "Saya mau kirim feedback ke CS",
        description: "Buka conversation review untuk menulis coaching note, rework, atau keputusan review yang jelas.",
        href: "/dashboard/approvals",
      },
    ];
  }

  return [
    {
      title: "Saya mau input chat baru",
      description: "Masuk ke Lead Capture untuk upload file atau paste chat manual sebelum diproses jadi conversation kerja.",
      href: "/dashboard/upload",
    },
    {
      title: "Saya mau balas customer",
      description: "Masuk ke Queue, buka detail conversation, lalu jalankan AI analysis dan draft reply.",
      href: "/dashboard/sales",
    },
    {
      title: "Saya mau lihat progress prospect",
      description: "Masuk ke Lead Management untuk membaca lead aktif, status panasnya, dan konteks follow-up berikutnya.",
      href: "/dashboard/crm",
    },
    {
      title: "Saya mau lihat prioritas follow-up",
      description: "Masuk ke Action Center untuk melihat overdue follow-up, hot lead, dan task harian yang harus dibereskan dulu.",
      href: "/dashboard/follow-up",
    },
  ];
}

function buildWorkflowSteps(role?: string) {
  if (isOwnerLike(role)) {
    return SUPERADMIN_WORKFLOW_STEPS;
  }
  if (isAdminLike(role)) {
    return HEAD_WORKFLOW_STEPS;
  }
  if (isManagerLike(role)) {
    return MANAGER_WORKFLOW_STEPS;
  }
  return SALES_WORKFLOW_STEPS;
}

function buildRoleStartCopy(role?: string) {
  if (isOwnerLike(role)) {
    return {
      eyebrow: "Superadmin flow",
      title: "Mulai dari dashboard operasional, lalu turun ke queue bila perlu",
      description:
        "Sebagai superadmin, workspace ini paling berguna kalau dipakai dari atas ke bawah: baca health operasional dulu, lihat pola lapangan, lalu turun ke halaman eksekusi saat Anda butuh verifikasi atau intervensi.",
      primaryHref: "/dashboard/kpi",
      primaryLabel: "Buka Ops Dashboard",
      secondaryHref: "/dashboard/marketing",
      secondaryLabel: "Buka Chat Insight",
    };
  }

  if (isAdminLike(role)) {
    return {
      eyebrow: "Head flow",
      title: "Mulai dari follow-up tiap sales, lalu turun ke lead yang paling riskan",
      description:
        "Sebagai head, alur utamanya adalah membaca follow-up tiap sales dari Alert Center, identifikasi prospect yang kurang atau berisiko, lalu follow-up ke CS dengan arahan next action yang jelas.",
      primaryHref: "/dashboard/notifications",
      primaryLabel: "Buka Alert Center",
      secondaryHref: "/dashboard/approvals",
      secondaryLabel: "Buka Chat Review Center",
    };
  }

  if (isManagerLike(role)) {
    return {
      eyebrow: "Admin flow",
      title: "Mulai dari progress prospect CS, lalu cek kualitas jawaban",
      description:
        "Sebagai admin reviewer, alurnya adalah melihat progress prospect CS, membaca jawaban yang sudah dikirim, lalu memberi feedback kalau kualitas jawaban belum sesuai.",
      primaryHref: "/dashboard/manager-insights",
      primaryLabel: "Buka Manager Insights",
      secondaryHref: "/dashboard/manager-insights",
      secondaryLabel: "Lihat Progress Prospect",
    };
  }

  return {
    eyebrow: "CS flow",
    title: "Mulai dari chat masuk, jawab dengan bantuan AI, lalu lanjut follow-up",
    description:
      "Sebagai CS, alur kerja utamanya adalah menerima pertanyaan nasabah, memakai AI untuk membantu membuat jawaban, lalu memantau progress prospect dan follow-up berikutnya.",
    primaryHref: "/dashboard/sales",
    primaryLabel: "Buka Queue",
    secondaryHref: "/dashboard/sales",
    secondaryLabel: "Buka Conversation",
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
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              {roleStartCopy.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
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
              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
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
                const isHighlighted = featureSet.roleKey === highlightedRole;

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
                        isHighlighted ? "text-white" : "text-slate-950"
                      }`}
                    >
                      {featureSet.title}
                    </h3>
                    <p
                      className={`mt-2 text-sm leading-6 ${
                        isHighlighted ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {featureSet.summary}
                    </p>
                    <div className="mt-4 space-y-2">
                      {featureSet.items.map((item) => (
                        <p
                          key={item}
                          className={`rounded-2xl border px-3.5 py-3 text-sm leading-6 ${
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
                  <h3 className="text-base font-semibold text-slate-950">
                    {task.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {task.description}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-6 text-sm leading-7 text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cara Baca Menu
              </p>
              <p>
                <span className="font-semibold text-slate-950">Queue</span>:
                tempat eksekusi prioritas harian, bukan arsip semua percakapan.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Lead Management</span>:
                tempat melihat hasil chat yang sudah berubah jadi lead kerja.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Action Center</span>:
                daftar tekanan operasional harian, bukan arsip semua lead.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Chat Review Center</span>:
                antrian triase chat, draft, atau eskalasi yang perlu review manusia.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Alert Center</span>:
                sinyal operasional yang perlu acknowledge, resolve, atau escalate.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Chat Insight / Ops Dashboard</span>:
                area head dan superadmin untuk membaca pola lapangan dan kesehatan eksekusi.
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
