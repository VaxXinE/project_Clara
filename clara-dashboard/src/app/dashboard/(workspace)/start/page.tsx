"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RoleBasedStartGuide } from "@/components/dashboard/RoleBasedStartGuide";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  canAccessQueueAndActionCenter,
  isHeadRole,
  isManagerRole,
  isSuperadminRole,
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
      description="Panduan singkat alur Sales, Manager, dan Head."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
      actions={
        <>
          {(() => {
            const cannotUseQueue =
              currentUser && !canAccessQueueAndActionCenter(currentUser.role);
            const href = isSuperadminRole(currentUser?.role)
              ? "/dashboard/kpi"
              : isHeadRole(currentUser?.role)
                ? "/dashboard/manager-insights"
                : cannotUseQueue
                  ? "/dashboard/manager-insights"
                  : "/dashboard/follow-up";
            const label = isSuperadminRole(currentUser?.role)
              ? "Buka Ops Dashboard"
              : isHeadRole(currentUser?.role)
                ? "Buka Monitor Tim"
                : currentUser &&
                    isManagerRole(currentUser.role) &&
                    !canAccessQueueAndActionCenter(currentUser.role)
                  ? "Buka Monitor Tim"
                  : "Buka Action Center";
            const secondaryHref = isSuperadminRole(currentUser?.role)
              ? "/dashboard/marketing"
              : isHeadRole(currentUser?.role)
                ? "/dashboard/approvals"
                : isManagerRole(currentUser?.role)
                  ? "/dashboard/approvals"
                  : "/dashboard/upload";
            const secondaryLabel = isSuperadminRole(currentUser?.role)
              ? "Buka Chat Insight"
              : isHeadRole(currentUser?.role)
                ? "Buka Arahan Tim"
                : isManagerRole(currentUser?.role)
                  ? "Buka Review Sales"
                  : "Buka Lead Capture";

            return (
              <>
                <Link
                  href={href}
                  className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:bg-slate-800"
                >
                  {label}
                </Link>
                <Link
                  href={secondaryHref}
                  className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                >
                  {secondaryLabel}
                </Link>
              </>
            );
          })()}
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
