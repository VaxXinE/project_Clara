"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RoleBasedStartGuide } from "@/components/dashboard/RoleBasedStartGuide";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { NAV_GROUP_NAMES, PAGE_NAMES } from "@/lib/labels";
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
      eyebrow={NAV_GROUP_NAMES.guide}
      title={PAGE_NAMES.guide}
      description="Panduan singkat alur kerja untuk Sales, Manager, dan Head."
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
              ? "Buka Dashboard Operasional"
              : isHeadRole(currentUser?.role)
                ? "Buka Monitor Tim"
                : currentUser &&
                    isManagerRole(currentUser.role) &&
                    !canAccessQueueAndActionCenter(currentUser.role)
                  ? "Buka Monitor Tim"
                  : "Buka Tindak Lanjut";
            const secondaryHref = isSuperadminRole(currentUser?.role)
              ? "/dashboard/marketing"
              : isHeadRole(currentUser?.role)
                ? "/dashboard/approvals"
                : isManagerRole(currentUser?.role)
                  ? "/dashboard/approvals"
                  : "/dashboard/upload";
            const secondaryLabel = isSuperadminRole(currentUser?.role)
              ? "Buka Insight Pasar"
              : isHeadRole(currentUser?.role)
                ? "Buka Arahan Tim"
                : isManagerRole(currentUser?.role)
                  ? "Buka Review Sales"
                  : "Buka Input Chat";

            return (
              <>
                <Link
                  href={href}
                  className="clara-button clara-button-primary"
                >
                  {label}
                </Link>
                <Link
                  href={secondaryHref}
                  className="clara-button clara-button-secondary"
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
          <section className="rounded-2xl border border-clara-danger-line bg-clara-danger-surface p-5 text-sm text-clara-danger">
            {errorMessage}
          </section>
        ) : null}

        <RoleBasedStartGuide currentUser={currentUser} />
      </div>
    </WorkspaceShell>
  );
}
