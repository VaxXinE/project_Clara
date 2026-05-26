"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RoleBasedStartGuide } from "@/components/dashboard/RoleBasedStartGuide";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

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

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Onboarding flow"
      title="Workflow Guide"
      description="Panduan ringkas ini dipakai kalau user masih bingung harus mulai dari halaman mana. Dashboard utama tetap jadi home, tapi halaman ini merangkum alur kerja Clara dengan istilah yang konsisten."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          <Link
            href="/dashboard/follow-up"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            Buka Action Center
          </Link>
          <Link
            href="/dashboard/upload"
            className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Buka Lead Capture
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

        <RoleBasedStartGuide currentUser={currentUser} />
      </div>
    </WorkspaceShell>
  );
}
