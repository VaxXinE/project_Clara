"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { isAdminLike, isOwnerLike } from "@/lib/roles";
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

        if (!isAdminLike(me.role)) {
          router.replace("/workspace");
          return;
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat halaman create organization.",
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
        error instanceof Error ? error.message : "Gagal membuat organization.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Create Organization"
      description="Form khusus untuk membuat organization baru."
      backHref="/admin/access"
      backLabel="Kembali ke index access"
      actions={
        <Link href="/admin/access/create/user" className="clara-button clara-button-ghost">
          Buka Create User
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading create organization...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">
                Organization Management
              </h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Create organization hanya dibuka untuk superadmin.
              </p>
            </div>

            <InputField
              label="Name"
              value={organizationForm.name}
              onChange={(value) =>
                setOrganizationForm((current) => ({ ...current, name: value }))
              }
              placeholder="Contoh: SGB Jakarta"
            />

            <InputField
              label="Slug"
              value={organizationForm.slug}
              onChange={(value) =>
                setOrganizationForm((current) => ({ ...current, slug: value }))
              }
              placeholder="sgb-jakarta"
            />

            {!canManageOrganizations ? (
              <p className="clara-card-soft rounded-xl p-3 text-sm text-[#f0cb73]">
                Head tidak bisa membuat organization baru dari UI ini.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canManageOrganizations || isSubmitting}
              className="clara-button clara-button-primary"
            >
              {isSubmitting ? "Creating organization..." : "Create Organization"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
