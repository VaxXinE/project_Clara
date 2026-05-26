"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { canLeadSalesTeam, isAdminLike, isOwnerLike } from "@/lib/roles";
import type {
  CreateSalesTeamRequest,
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
  SalesUnitItem,
} from "@/types/dashboard";

import { EMPTY_TEAM_FORM, InputField, SelectField } from "../../shared";

export default function AdminAccessCreateTeamPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [units, setUnits] = useState<SalesUnitItem[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [teamForm, setTeamForm] = useState<CreateSalesTeamRequest>(EMPTY_TEAM_FORM);
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

        const [organizationData, unitData, userData] = await Promise.all([
          apiFetch<OrganizationItem[]>("/organizations"),
          apiFetch<SalesUnitItem[]>("/sales-structure/units"),
          apiFetch<CurrentUser[]>("/auth/users"),
        ]);

        setOrganizations(organizationData);
        setUnits(unitData);
        setUsers(userData);
        setTeamForm((current) => ({
          ...current,
          organization_id: isOwnerLike(me.role)
            ? (current.organization_id ?? organizationData[0]?.id ?? null)
            : me.organization_id,
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman create team.",
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
      await apiFetch<SalesTeamItem>("/sales-structure/teams", {
        method: "POST",
        body: teamForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat sales team.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Create Sales Team"
      description="Form khusus untuk membuat sales team baru."
      backHref="/admin/access"
      backLabel="Kembali ke index access"
      actions={
        <Link href="/admin/access/create/unit" className="clara-button clara-button-ghost">
          Buka Create Unit
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading create team...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Create Sales Team</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Team selalu terikat ke organization dan bisa dipetakan ke unit serta manager.
              </p>
            </div>

            <SelectField
              label="Organization"
              value={teamForm.organization_id ?? ""}
              onChange={(value) =>
                setTeamForm((current) => ({
                  ...current,
                  organization_id: value || null,
                  unit_id: null,
                  manager_user_id: null,
                }))
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

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Team Name"
                value={teamForm.name}
                onChange={(value) => setTeamForm((current) => ({ ...current, name: value }))}
                placeholder="Team A"
              />
              <InputField
                label="Team Code"
                value={teamForm.code}
                onChange={(value) => setTeamForm((current) => ({ ...current, code: value }))}
                placeholder="team-a"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Unit"
                value={teamForm.unit_id ?? ""}
                onChange={(value) =>
                  setTeamForm((current) => ({ ...current, unit_id: value || null }))
                }
                options={[
                  { value: "", label: "Tanpa unit spesifik" },
                  ...units
                    .filter((unit) => unit.organization_id === teamForm.organization_id)
                    .map((unit) => ({
                      value: unit.id,
                      label: `${unit.name} (${unit.code})`,
                    })),
                ]}
              />
              <SelectField
                label="Manager"
                value={teamForm.manager_user_id ?? ""}
                onChange={(value) =>
                  setTeamForm((current) => ({ ...current, manager_user_id: value || null }))
                }
                options={[
                  { value: "", label: "Belum ditunjuk" },
                  ...users
                    .filter(
                      (user) =>
                        user.organization_id === teamForm.organization_id &&
                        canLeadSalesTeam(user.role),
                    )
                    .map((user) => ({
                      value: user.id,
                      label: `${user.name} (${user.email})`,
                    })),
                ]}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="clara-button clara-button-primary"
            >
              {isSubmitting ? "Creating team..." : "Create Team"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
