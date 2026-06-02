"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RoleBasedStartGuide } from "@/components/dashboard/RoleBasedStartGuide";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  canAccessQueueAndActionCenter,
  isManagerLike,
  normalizeWorkspaceRole,
} from "@/lib/roles";
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
      description="Panduan ini merangkum alur kerja per role: CS menjawab nasabah dengan bantuan AI, Admin mereview kualitas jawaban CS, dan Head mengecek follow-up tiap sales."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <>
          {(() => {
            const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
            const cannotUseQueue = currentUser && !canAccessQueueAndActionCenter(currentUser.role);
            const href =
              normalizedRole === "head"
                ? "/dashboard/notifications"
                : cannotUseQueue
                  ? "/dashboard/manager-insights"
                  : "/dashboard/follow-up";
            const label =
              normalizedRole === "head"
                ? "Buka Alert Center"
                : currentUser &&
                    isManagerLike(currentUser.role) &&
                    !canAccessQueueAndActionCenter(currentUser.role)
                  ? "Lihat Progress Prospect"
                  : "Buka Action Center";

            return (
          <Link
            href={href}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
          >
            {label}
          </Link>
            );
          })()}
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
