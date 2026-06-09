"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { getPasswordStrength } from "@/lib/format";
import { isOwnerLike } from "@/lib/roles";
import type { CurrentUser, ResetUserPasswordRequest } from "@/types/dashboard";

import {
  EMPTY_PASSWORD_FORM,
  InputField,
  PasswordStrengthHint,
} from "../../../shared";

export default function AdminAccessEditPasswordPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params.userId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [targetUser, setTargetUser] = useState<CurrentUser | null>(null);
  const [passwordForm, setPasswordForm] =
    useState<ResetUserPasswordRequest>(EMPTY_PASSWORD_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const passwordStrength = getPasswordStrength(passwordForm.password);
  const canResetPassword = useMemo(() => {
    return Boolean(currentUser && targetUser && isOwnerLike(currentUser.role));
  }, [currentUser, targetUser]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isOwnerLike(me.role)) {
          router.replace("/workspace");
          return;
        }

        const userData = await apiFetch<CurrentUser[]>("/auth/users");
        const nextTargetUser = userData.find((user) => user.id === userId) ?? null;

        if (!nextTargetUser) {
          setErrorMessage("User tidak ditemukan.");
          return;
        }

        setTargetUser(nextTargetUser);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman reset password.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [router, userId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSaving(true);

    try {
      await apiFetch<CurrentUser>(`/auth/users/${userId}/reset-password`, {
        method: "POST",
        body: passwordForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah password user.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Reset Password User"
      description="Halaman khusus untuk mengganti password user."
      backHref="/admin/access"
      backLabel="Kembali ke index access"
      actions={
        <Link href={`/admin/access/${userId}/edit/profile`} className="clara-button clara-button-ghost">
          Buka Edit Profile
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading reset password...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <div className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Reset Password</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Hanya superadmin yang bisa mengganti password user dari halaman ini.
              </p>
            </div>

            {canResetPassword ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label="New Password"
                  value={passwordForm.password}
                  onChange={(value) => setPasswordForm({ password: value })}
                  placeholder="Minimum 8 karakter"
                  type="password"
                />
                <PasswordStrengthHint
                  password={passwordForm.password}
                  strength={passwordStrength}
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="clara-button clara-button-primary"
                >
                  {isSaving ? "Saving..." : "Save New Password"}
                </button>
              </form>
            ) : (
              <p className="rounded-xl border border-[#f0cb73]/14 bg-[#241a10] p-3 text-xs text-[#f0cb73]">
                Aksi ini hanya tersedia untuk superadmin.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
