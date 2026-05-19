"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

const WORKFLOW_STEPS = [
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

export default function StartHerePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat panduan Clara."
        );
      }
    }

    void loadUser();
  }, []);

  const roleTasks = buildRoleTasks(currentUser?.role);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Onboarding flow"
      title="Mulai dari Sini"
      description="Halaman ini menjelaskan urutan pakai Clara dari sudut pandang user operasional. Kalau baru pertama kali masuk, ikuti alur ini dari atas ke bawah."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/upload"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Mulai Input Chat
          </Link>
          <Link
            href="/dashboard/sales"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Lihat Chat Masuk
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {errorMessage ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Alur Utama Clara
          </p>
          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => (
              <article
                key={item.step}
                className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                  {item.step}
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">
                  {item.title}
                </h2>
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
        </section>

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
                  <h2 className="text-base font-semibold text-slate-950">
                    {task.title}
                  </h2>
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
                area owner/admin untuk membaca insight dan kesehatan bisnis.
              </p>
            </div>
          </article>
        </section>
      </div>
    </WorkspaceShell>
  );
}
