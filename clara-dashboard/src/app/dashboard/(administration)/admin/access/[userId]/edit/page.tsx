"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { isAdminLike, isOwnerLike } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

export default function AdminAccessEditHubPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params.userId;

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");

        if (!isAdminLike(me.role)) {
          router.replace("/workspace");
          return;
        }

        const userData = await apiFetch<CurrentUser[]>("/auth/users");

        const nextTargetUser = userData.find((user) => user.id === userId) ?? null;
        if (!nextTargetUser) {
          setErrorMessage("User tidak ditemukan.");
          return;
        }

        if (
          !isOwnerLike(me.role) &&
          nextTargetUser.organization_id !== me.organization_id
        ) {
          router.replace("/admin/access");
          return;
        }

        router.replace(`/admin/access/${userId}/edit/profile`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman edit user.",
        );
      }
    }

    void bootstrap();
  }, [router, userId]);

  return errorMessage ? (
    <div className="clara-alert clara-alert-danger">{errorMessage}</div>
  ) : null;
}
