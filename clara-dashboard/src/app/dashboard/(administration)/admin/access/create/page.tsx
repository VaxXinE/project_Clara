"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { isOwnerLike } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

export default function AdminAccessCreateHubPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");

        if (!isOwnerLike(me.role)) {
          router.replace("/workspace");
          return;
        }

        router.replace("/admin/access/create/user");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman create access.",
        );
      }
    }

    void bootstrap();
  }, [router]);

  return errorMessage ? (
    <div className="clara-alert clara-alert-danger">{errorMessage}</div>
  ) : null;
}
