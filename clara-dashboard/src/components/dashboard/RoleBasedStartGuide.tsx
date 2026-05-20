"use client";

import Link from "next/link";

import { isAdminLike, isOwnerLike } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

const SALES_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Tangkap Lead Cepat",
    description:
      "Mulai dari Lead Capture. Upload file TXT atau paste chat langsung supaya lead dan conversation cepat masuk ke sistem.",
    href: "/dashboard/upload",
    cta: "Buka Lead Capture",
  },
  {
    step: "2",
    title: "Kerjakan Queue",
    description:
      "Setelah data masuk, buka Queue untuk review percakapan, jalankan AI analysis, lalu siapkan balasan atau next action.",
    href: "/dashboard/sales",
    cta: "Buka Queue",
  },
  {
    step: "3",
    title: "Rapikan Lead",
    description:
      "Masuk ke Lead Management untuk atur stage, owner, follow-up date, dan timeline lead yang sedang dikerjakan.",
    href: "/dashboard/crm",
    cta: "Buka Lead Management",
  },
  {
    step: "4",
    title: "Pantau Tindakan Harian",
    description:
      "Gunakan Action Center dan Review Queue untuk tahu item mana yang overdue, panas, atau butuh review manusia.",
    href: "/dashboard/follow-up",
    cta: "Buka Action Center",
  },
] as const;

const HEAD_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Cek Action Center",
    description:
      "Mulai dari action center untuk melihat overdue follow-up, hot lead belum disentuh, dan alert operasional yang perlu perhatian cepat.",
    href: "/dashboard/notifications",
    cta: "Buka Action Center",
  },
  {
    step: "2",
    title: "Review Queue dan Eskalasi",
    description:
      "Pastikan bottleneck tim terlihat dari review queue dan worklist sebelum Anda masuk ke insight yang lebih luas.",
    href: "/dashboard/approvals",
    cta: "Buka Review Queue",
  },
  {
    step: "3",
    title: "Rapikan Lead Tim",
    description:
      "Masuk ke lead management untuk memastikan lead aktif, hot lead, dan stage penting tidak tertinggal atau salah arah.",
    href: "/dashboard/crm",
    cta: "Buka Lead Management",
  },
  {
    step: "4",
    title: "Ambil Keputusan dari Dashboard",
    description:
      "Kalau operasional sudah cukup jelas, gunakan ops dashboard dan chat insight untuk membaca performa tim dan arah intervensi berikutnya.",
    href: "/dashboard/kpi",
    cta: "Buka Ops Dashboard",
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
    href: "/dashboard/admin/access",
    cta: "Buka Access Control",
  },
] as const;

function buildRoleTasks(role?: string) {
  const common = [
    {
      title: "Saya mau input chat baru",
      description: "Masuk ke Lead Capture untuk upload file atau paste chat manual.",
      href: "/dashboard/upload",
    },
    {
      title: "Saya mau balas customer",
      description: "Masuk ke Queue, buka detail conversation, lalu jalankan AI analysis dan draft reply.",
      href: "/dashboard/sales",
    },
    {
      title: "Saya mau lihat lead yang harus dikejar",
      description: "Masuk ke Lead Management atau Action Center tergantung Anda ingin lihat board atau prioritas harian.",
      href: "/dashboard/follow-up",
    },
  ];

  if (isAdminLike(role)) {
    return [
      ...common,
      {
        title: "Saya mau lihat kesehatan tim",
        description: "Buka ops dashboard untuk memantau KPI operasional, alert, dan tekanan harian tim.",
        href: "/dashboard/kpi",
      },
      {
        title: "Saya mau lihat pola objection",
        description: "Buka chat insight untuk membaca objection trend dan sinyal percakapan yang perlu ditindak.",
        href: "/dashboard/marketing",
      },
    ];
  }

  return common;
}

function buildWorkflowSteps(role?: string) {
  if (isOwnerLike(role)) {
    return SUPERADMIN_WORKFLOW_STEPS;
  }
  if (isAdminLike(role)) {
    return HEAD_WORKFLOW_STEPS;
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
      title: "Mulai dari bottleneck tim, lalu rapikan lead dan kontrol akses",
      description:
        "Sebagai head, workspace ini paling efektif saat Anda memakai action center, review queue, dan dashboard KPI untuk melihat titik macet tim sebelum masuk ke lead dan kontrol akses.",
      primaryHref: "/dashboard/notifications",
      primaryLabel: "Buka Action Center",
      secondaryHref: "/dashboard/approvals",
      secondaryLabel: "Buka Review Queue",
    };
  }

  return {
    eyebrow: "Sales flow",
    title: "Mulai dari queue, lalu ubah jadi lead dan tindakan harian",
    description:
      "Sebagai sales, alur kerja paling masuk akal tetap dimulai dari lead capture atau queue: review percakapan, analisis, lalu lanjutkan ke lead dan follow-up.",
    primaryHref: "/dashboard/upload",
    primaryLabel: "Mulai Lead Capture",
    secondaryHref: "/dashboard/sales",
    secondaryLabel: "Lihat Queue",
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
              Saya Mau...
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
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Cara Baca Menu
            </p>
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
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
                <span className="font-semibold text-slate-950">Review Queue</span>:
                antrian draft atau eskalasi yang perlu review manusia.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Notifications</span>:
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
