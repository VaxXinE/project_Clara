"use client";

import Link from "next/link";

import type { CurrentUser } from "@/types/dashboard";

const MARKETING_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Masukkan Chat",
    description:
      "Mulai dari halaman Import Chat. Upload file TXT atau paste chat langsung, lalu pilih channel yang benar.",
    href: "/dashboard/upload",
    cta: "Buka Import Chat",
  },
  {
    step: "2",
    title: "Buka Chat Masuk",
    description:
      "Setelah chat masuk, buka Chat Masuk untuk review percakapan, jalankan AI analysis, lalu generate draft balasan.",
    href: "/dashboard/sales",
    cta: "Buka Chat Masuk",
  },
  {
    step: "3",
    title: "Ubah Jadi Lead Kerja",
    description:
      "Masuk ke Lead Pipeline untuk melihat lead yang terbentuk, ubah stage, atur follow-up, dan cek customer identity.",
    href: "/dashboard/crm",
    cta: "Buka Lead Pipeline",
  },
  {
    step: "4",
    title: "Kelola Tindakan Harian",
    description:
      "Gunakan AI Worklist, Approvals, dan Notifications untuk tahu siapa yang harus dihubungi, direview, atau dieskalasi.",
    href: "/dashboard/follow-up",
    cta: "Buka AI Worklist",
  },
] as const;

const ADMIN_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Cek Notification Center",
    description:
      "Mulai dari notifikasi operasional untuk melihat apakah ada overdue follow-up, approval kritis, atau alert yang perlu perhatian cepat.",
    href: "/dashboard/notifications",
    cta: "Buka Notifications",
  },
  {
    step: "2",
    title: "Review Approval & Worklist",
    description:
      "Pastikan bottleneck tim terlihat dari Approval Queue dan AI Worklist sebelum Anda masuk ke area insight yang lebih luas.",
    href: "/dashboard/approvals",
    cta: "Buka Approvals",
  },
  {
    step: "3",
    title: "Rapikan Pipeline Tim",
    description:
      "Masuk ke Lead Pipeline untuk memastikan lead aktif, hot lead, dan stage penting tidak tertinggal atau salah arah.",
    href: "/dashboard/crm",
    cta: "Buka Lead Pipeline",
  },
  {
    step: "4",
    title: "Ambil Keputusan dari KPI",
    description:
      "Kalau operasional sudah cukup jelas, gunakan KPI dan Marketing Insights untuk membaca performa org dan arah intervensi berikutnya.",
    href: "/dashboard/kpi",
    cta: "Buka KPI",
  },
] as const;

const OWNER_WORKFLOW_STEPS = [
  {
    step: "1",
    title: "Baca KPI dan Alert",
    description:
      "Mulai dari KPI Command Center dan notifikasi aktif untuk melihat kesehatan bisnis, tim, dan sinyal anomali secara global.",
    href: "/dashboard/kpi",
    cta: "Buka KPI",
  },
  {
    step: "2",
    title: "Lihat Arah Market",
    description:
      "Masuk ke Marketing Insights untuk membaca objection, content brief, execution board, dan hasil campaign yang teratribusi.",
    href: "/dashboard/marketing",
    cta: "Buka Marketing",
  },
  {
    step: "3",
    title: "Verifikasi Lapangan",
    description:
      "Kalau ada sinyal yang perlu dicek lebih dalam, turun ke Lead Pipeline, Chat Masuk, atau AI Worklist untuk melihat konteks operasionalnya.",
    href: "/dashboard/follow-up",
    cta: "Buka AI Worklist",
  },
  {
    step: "4",
    title: "Intervensi Akses atau Pengetahuan",
    description:
      "Gunakan Users, Admin Ops, atau Knowledge saat perlu membenahi kontrol organisasi, akses, atau landasan jawaban AI.",
    href: "/dashboard/admin/access",
    cta: "Buka Users",
  },
] as const;

function buildRoleTasks(role?: string) {
  const common = [
    {
      title: "Saya mau input chat baru",
      description: "Masuk ke Import Chat untuk upload file atau paste chat manual.",
      href: "/dashboard/upload",
    },
    {
      title: "Saya mau balas customer",
      description: "Masuk ke Chat Masuk, buka detail conversation, lalu jalankan AI analysis dan draft reply.",
      href: "/dashboard/sales",
    },
    {
      title: "Saya mau lihat lead yang harus dikejar",
      description: "Masuk ke Lead Pipeline atau AI Worklist tergantung Anda ingin lihat board atau prioritas harian.",
      href: "/dashboard/follow-up",
    },
  ];

  if (role === "owner" || role === "admin") {
    return [
      ...common,
      {
        title: "Saya mau lihat kesehatan tim",
        description: "Buka KPI untuk memantau leaderboard sales, alert, dan business signal.",
        href: "/dashboard/kpi",
      },
      {
        title: "Saya mau lihat insight marketing",
        description: "Buka Marketing untuk membaca objection trend, brief konten, execution board, dan outcome campaign.",
        href: "/dashboard/marketing",
      },
    ];
  }

  return common;
}

function buildWorkflowSteps(role?: string) {
  if (role === "owner") {
    return OWNER_WORKFLOW_STEPS;
  }
  if (role === "admin") {
    return ADMIN_WORKFLOW_STEPS;
  }
  return MARKETING_WORKFLOW_STEPS;
}

function buildRoleStartCopy(role?: string) {
  if (role === "owner") {
    return {
      eyebrow: "Owner flow",
      title: "Mulai dari KPI, alert, lalu turun ke operasional bila perlu",
      description:
        "Sebagai owner, Clara paling berguna kalau dipakai dari atas ke bawah: baca health bisnis dulu, lihat market signal, lalu turun ke halaman operasional hanya saat Anda butuh verifikasi atau intervensi.",
      primaryHref: "/dashboard/kpi",
      primaryLabel: "Buka KPI",
      secondaryHref: "/dashboard/marketing",
      secondaryLabel: "Buka Marketing",
    };
  }

  if (role === "admin") {
    return {
      eyebrow: "Admin flow",
      title: "Mulai dari bottleneck tim, lalu rapikan pipeline dan kontrol org",
      description:
        "Sebagai admin, Clara paling efektif saat Anda memakai notifikasi, approvals, dan KPI untuk melihat titik macet tim sebelum masuk ke pipeline dan akses organisasi.",
      primaryHref: "/dashboard/notifications",
      primaryLabel: "Buka Notifications",
      secondaryHref: "/dashboard/approvals",
      secondaryLabel: "Buka Approvals",
    };
  }

  return {
    eyebrow: "Marketing flow",
    title: "Mulai dari chat, lalu ubah jadi lead dan tindakan harian",
    description:
      "Sebagai marketing atau operator, alur Clara yang paling masuk akal tetap dimulai dari chat customer: import, review, analisis, lalu lanjutkan ke lead dan follow-up.",
    primaryHref: "/dashboard/upload",
    primaryLabel: "Mulai Input Chat",
    secondaryHref: "/dashboard/sales",
    secondaryLabel: "Lihat Chat Masuk",
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
                <span className="font-semibold text-slate-950">Chat Masuk</span>:
                tempat baca percakapan dan generate tindakan AI.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Lead Pipeline</span>:
                tempat melihat hasil chat yang sudah berubah jadi lead kerja.
              </p>
              <p>
                <span className="font-semibold text-slate-950">AI Worklist</span>:
                daftar prioritas harian, bukan arsip semua lead.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Approvals</span>:
                antrian draft yang perlu review manusia.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Notifications</span>:
                sinyal operasional yang perlu acknowledge, resolve, atau escalate.
              </p>
              <p>
                <span className="font-semibold text-slate-950">Marketing / KPI</span>:
                area owner/admin untuk membaca insight, eksekusi marketing, dan kesehatan bisnis.
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
