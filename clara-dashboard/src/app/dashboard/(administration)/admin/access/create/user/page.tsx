"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { getRoleDisplayLabel, isAdminLike, isOwnerLike } from "@/lib/roles";
import type {
  CreateUserRequest,
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
} from "@/types/dashboard";

import {
  EMPTY_USER_FORM,
  getTeamOptions,
  InputField,
  SelectField,
} from "../../shared";

export default function AdminAccessCreateUserPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [teams, setTeams] = useState<SalesTeamItem[]>([]);
  const [userForm, setUserForm] = useState<CreateUserRequest>(EMPTY_USER_FORM);
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

        const [organizationData, teamData] = await Promise.all([
          apiFetch<OrganizationItem[]>("/organizations"),
          apiFetch<SalesTeamItem[]>("/sales-structure/teams"),
        ]);

        setOrganizations(organizationData);
        setTeams(teamData);
        setUserForm((current) => ({
          ...current,
          organization_id: isOwnerLike(me.role)
            ? (current.organization_id ?? organizationData[0]?.id ?? null)
            : me.organization_id,
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman create user.",
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
      await apiFetch<CurrentUser>("/auth/users", {
        method: "POST",
        body: userForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuat user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Create User"
      description="Form khusus untuk membuat user baru."
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
            Loading create user...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Create User</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Head otomatis terikat ke organization miliknya sendiri.
              </p>
            </div>

            <InputField
              label="Name"
              value={userForm.name}
              onChange={(value) => setUserForm((current) => ({ ...current, name: value }))}
              placeholder="Sales A"
            />

            <InputField
              label="Email"
              value={userForm.email}
              onChange={(value) => setUserForm((current) => ({ ...current, email: value }))}
              placeholder="sales@sgb.local"
              type="email"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Password"
                value={userForm.password}
                onChange={(value) =>
                  setUserForm((current) => ({ ...current, password: value }))
                }
                placeholder="Minimum 8 karakter"
                type="password"
              />
              <SelectField
                label="Role"
                value={userForm.role}
                onChange={(value) => setUserForm((current) => ({ ...current, role: value }))}
                options={[
                  { value: "sales", label: getRoleDisplayLabel("sales") },
                  { value: "manager", label: getRoleDisplayLabel("manager") },
                  { value: "head", label: getRoleDisplayLabel("head") },
                  ...(currentUser && isOwnerLike(currentUser.role)
                    ? [{ value: "superadmin", label: getRoleDisplayLabel("superadmin") }]
                    : []),
                ]}
              />
            </div>

            <SelectField
              label="Organization"
              value={userForm.organization_id ?? ""}
              onChange={(value) =>
                setUserForm((current) => ({
                  ...current,
                  organization_id: value || null,
                  team_id: null,
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

            <SelectField
              label="Sales Team"
              value={userForm.team_id ?? ""}
              onChange={(value) =>
                setUserForm((current) => ({ ...current, team_id: value || null }))
              }
              options={[
                { value: "", label: "Belum di-assign" },
                ...getTeamOptions(userForm.organization_id, teams).map((team) => ({
                  value: team.id,
                  label: `${team.name}${team.unit_name ? ` / ${team.unit_name}` : ""}`,
                })),
              ]}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="clara-button clara-button-primary"
            >
              {isSubmitting ? "Creating user..." : "Create User"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
