"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { getRoleDisplayLabel, isAdminLike, isOwnerLike } from "@/lib/roles";
import type {
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
  UpdateUserRequest,
} from "@/types/dashboard";

import {
  EMPTY_EDIT_FORM,
  getTeamOptions,
  InputField,
  SelectField,
} from "../../../shared";

export default function AdminAccessEditProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params.userId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [targetUser, setTargetUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [teams, setTeams] = useState<SalesTeamItem[]>([]);
  const [editForm, setEditForm] = useState<UpdateUserRequest>(EMPTY_EDIT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

        const [organizationData, teamData, userData] = await Promise.all([
          apiFetch<OrganizationItem[]>("/organizations"),
          apiFetch<SalesTeamItem[]>("/sales-structure/teams"),
          apiFetch<CurrentUser[]>("/auth/users"),
        ]);

        setOrganizations(organizationData);
        setTeams(teamData);

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

        setTargetUser(nextTargetUser);
        setEditForm({
          name: nextTargetUser.name,
          email: nextTargetUser.email,
          role: nextTargetUser.role,
          organization_id: nextTargetUser.organization_id,
          team_id: nextTargetUser.team_id,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat halaman edit profile.",
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
      await apiFetch<CurrentUser>(`/auth/users/${userId}`, {
        method: "PATCH",
        body: editForm,
      });
      router.replace("/admin/access");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal update user.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="Edit Profile User"
      description="Halaman khusus untuk mengubah profil user."
      backHref="/admin/access"
      backLabel="Kembali ke index access"
      actions={
        <Link href={`/admin/access/${userId}/edit/password`} className="clara-button clara-button-ghost">
          Buka Reset Password
        </Link>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading edit profile...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {targetUser && !isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-[30px] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Edit Profile User</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Ubah nama, email, role, organization, dan team user dari halaman khusus.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Name"
                value={editForm.name ?? ""}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, name: value }))
                }
                placeholder="Name"
              />
              <InputField
                label="Email"
                value={editForm.email ?? ""}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, email: value }))
                }
                placeholder="Email"
                type="email"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Role"
                value={editForm.role ?? "sales"}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, role: value }))
                }
                options={[
                  { value: "sales", label: getRoleDisplayLabel("sales") },
                  { value: "manager", label: getRoleDisplayLabel("manager") },
                  { value: "head", label: getRoleDisplayLabel("head") },
                  ...(currentUser && isOwnerLike(currentUser.role)
                    ? [{ value: "superadmin", label: getRoleDisplayLabel("superadmin") }]
                    : []),
                ]}
                disabled={currentUser?.id === targetUser.id}
              />
              <SelectField
                label="Organization"
                value={editForm.organization_id ?? ""}
                onChange={(value) =>
                  setEditForm((current) => ({
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
            </div>

            <SelectField
              label="Sales Team"
              value={editForm.team_id ?? ""}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, team_id: value || null }))
              }
              options={[
                { value: "", label: "Belum di-assign" },
                ...getTeamOptions(editForm.organization_id ?? null, teams).map((team) => ({
                  value: team.id,
                  label: `${team.name}${team.unit_name ? ` / ${team.unit_name}` : ""}`,
                })),
              ]}
            />

            <button
              type="submit"
              disabled={isSaving}
              className="clara-button clara-button-primary"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
