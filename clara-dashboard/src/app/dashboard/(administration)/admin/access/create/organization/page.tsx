"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { NAV_GROUP_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { isOwnerLike } from "@/lib/roles";
import type {
  CreateOrganizationRequest,
  CurrentUser,
  OrganizationItem,
} from "@/types/dashboard";

import { EMPTY_ORGANIZATION_FORM, InputField } from "../../shared";

export default function AdminAccessCreateOrganizationPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizationForm, setOrganizationForm] =
    useState<CreateOrganizationRequest>(EMPTY_ORGANIZATION_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canManageOrganizations = isOwnerLike(currentUser?.role);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isOwnerLike(me.role)) {
          router.replace("/workspace");
          return;
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Halaman ini belum bisa dimuat. Muat ulang.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await apiFetch<OrganizationItem>("/organizations", {
        method: "POST",
        body: organizationForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Organisasi belum bisa dibuat. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.admin}
      title="Buat Organisasi"
      description="Isi data organisasi yang baru."
      backHref="/admin/access"
      backLabel="Kembali ke Pengguna & Akses"
      actions={
        <Link href="/admin/access/create/user" className="clara-button clara-button-ghost">
          Buka Create User
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Memuat form organisasi...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-3xl p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">
                Organization Management
              </h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Create organization hanya dibuka untuk superadmin.
              </p>
            </div>

            <InputField
              label="Nama"
              value={organizationForm.name}
              onChange={(value) =>
                setOrganizationForm((current) => ({ ...current, name: value }))
              }
              placeholder="Contoh: SGB Jakarta"
            />

            <InputField
              label="Alamat singkat (slug)"
              value={organizationForm.slug}
              onChange={(value) =>
                setOrganizationForm((current) => ({ ...current, slug: value }))
              }
              placeholder="sgb-jakarta"
            />

            {!canManageOrganizations ? (
              <p className="clara-card-soft rounded-xl p-3 text-sm text-[#f0cb73]">
                Hanya superadmin yang bisa membuat organization baru dari UI ini.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canManageOrganizations || isSubmitting}
              className="clara-button clara-button-primary"
            >
              {isSubmitting ? "Membuat organisasi..." : "Buat organisasi"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
