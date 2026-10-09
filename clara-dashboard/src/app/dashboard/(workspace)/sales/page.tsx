"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SalesWorkbench } from "@/components/dashboard/SalesWorkbench";
import { apiFetch } from "@/lib/api";
import { canAccessQueueAndActionCenter, normalizeWorkspaceRole } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

export default function SalesInboxPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function checkAccess() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        if (isCancelled) {
          return;
        }
        setCurrentUser(me);

        if (!canAccessQueueAndActionCenter(me.role)) {
          router.replace(
            normalizeWorkspaceRole(me.role) === "head" ? "/dashboard/approvals" : "/dashboard/manager-insights",
          );
        }
      } catch {
        // Sesi yang habis ditangani oleh layout dashboard. Daftar chat menampilkan pesan galatnya sendiri.
      }
    }

    void checkAccess();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return <SalesWorkbench currentUser={currentUser} selectedId={null} />;
}
