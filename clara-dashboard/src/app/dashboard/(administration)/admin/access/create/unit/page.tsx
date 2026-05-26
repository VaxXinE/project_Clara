"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { isAdminLike, isOwnerLike } from "@/lib/roles";
import type {
  CreateSalesUnitRequest,
  CurrentUser,
  OrganizationItem,
  SalesUnitItem,
} from "@/types/dashboard";

import { EMPTY_UNIT_FORM, InputField, SelectField } from "../../shared";

export default function AdminAccessCreateUnitPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [unitForm, setUnitForm] = useState<CreateSalesUnitRequest>(EMPTY_UNIT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isAdminScoped =
    currentUser !== null &&
    isAdminLike(currentUser.role) &&
    !isOwnerLike(currentUser.role);

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isAdminLike(me.role)) {
          router.replace("/workspace");
          return;
        }

        const organizationData = await apiFetch<OrganizationItem[]>("/organizations");
        setOrganizations(organizationData);
        setUnitForm((current) => ({
          ...current,
          organization_id: isOwnerLike(me.role)
            ? (current.organization_id ?? organizationData[0]?.id ?? null)
            : me.organization_id,
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman create unit.",
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
      await apiFetch<SalesUnitItem>("/sales-structure/units", {
        method: "POST",
        body: unitForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat sales unit.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Create Sales Unit"
      description="Form khusus untuk membuat sales unit baru."
      backHref="/admin/access"
      backLabel="Kembali ke index access"
      actions={
        <Link href="/admin/access/create/team" className="clara-button clara-button-ghost">
          Buka Create Team
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading create unit...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Create Sales Unit</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Strukturkan cabang, area, atau business cluster sebelum team dibuat.
              </p>
            </div>

            <SelectField
              label="Organization"
              value={unitForm.organization_id ?? ""}
              onChange={(value) =>
                setUnitForm((current) => ({ ...current, organization_id: value || null }))
              }
              options={[
                { value: "", label: "Pilih organization" },
                ...organizations.map((organization) => ({
                  value: organization.id,
                  label: `${organization.name} (${organization.slug})`,
                })),
              ]}
              disabled={isAdminScoped}
            />

            <InputField
              label="Unit Name"
              value={unitForm.name}
              onChange={(value) => setUnitForm((current) => ({ ...current, name: value }))}
              placeholder="Contoh: Jakarta Timur"
            />

            <InputField
              label="Unit Code"
              value={unitForm.code}
              onChange={(value) => setUnitForm((current) => ({ ...current, code: value }))}
              placeholder="jkt-timur"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="clara-button clara-button-primary"
            >
              {isSubmitting ? "Creating unit..." : "Create Unit"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
