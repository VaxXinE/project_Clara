"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { NAV_GROUP_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { getRoleDisplayLabel, isOwnerLike } from "@/lib/roles";
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

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isOwnerLike(me.role)) {
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
          organization_id: current.organization_id ?? organizationData[0]?.id ?? null,
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Halaman ini belum bisa dimuat. Muat ulang.",
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
      setErrorMessage(error instanceof Error ? error.message : "Pengguna belum bisa dibuat. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.admin}
      title="Buat Pengguna"
      description="Isi data akun yang baru."
      backHref="/admin/access"
      backLabel="Kembali ke Pengguna & Akses"
      actions={
        <Link href="/admin/access/create/team" className="clara-button clara-button-ghost">
          Buka Create Team
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Memuat form pengguna...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {!isLoading ? (
          <form onSubmit={handleSubmit} className="clara-card space-y-5 rounded-3xl p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#fff0c9]">Buat pengguna</h2>
              <p className="mt-1 text-sm text-[#d6bb84]">
                Hanya superadmin yang bisa membuat user dari halaman ini.
              </p>
            </div>

            <InputField
              label="Nama"
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
                placeholder="Minimal 8 karakter"
                type="password"
              />
              <SelectField
                label="Peran"
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
              label="Organisasi"
              value={userForm.organization_id ?? ""}
              onChange={(value) =>
                setUserForm((current) => ({
                  ...current,
                  organization_id: value || null,
                  team_id: null,
                }))
              }
              options={[
                { value: "", label: "Pilih organisasi" },
                ...organizations.map((organization) => ({
                  value: organization.id,
                  label: `${organization.name} (${organization.slug})`,
                })),
              ]}
            />

            <SelectField
              label="Tim Sales"
              value={userForm.team_id ?? ""}
              onChange={(value) =>
                setUserForm((current) => ({ ...current, team_id: value || null }))
              }
              options={[
                { value: "", label: "Belum ditentukan" },
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
              {isSubmitting ? "Membuat pengguna..." : "Buat pengguna"}
            </button>
          </form>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
