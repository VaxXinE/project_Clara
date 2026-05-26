"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getPasswordStrength,
} from "@/lib/format";
import {
  canLeadSalesTeam,
  getRoleDisplayLabel,
  isAdminLike,
  isOwnerLike,
} from "@/lib/roles";
import type {
  CreateSalesTeamRequest,
  CreateSalesUnitRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
  SalesUnitItem,
  ResetUserPasswordRequest,
  UpdateUserRequest,
} from "@/types/dashboard";

const EMPTY_ORGANIZATION_FORM: CreateOrganizationRequest = {
  name: "",
  slug: "",
};

const EMPTY_USER_FORM: CreateUserRequest = {
  name: "",
  email: "",
  password: "",
  role: "sales",
  organization_id: null,
  team_id: null,
};

const EMPTY_EDIT_FORM: UpdateUserRequest = {
  name: "",
  email: "",
  role: "sales",
  organization_id: null,
  team_id: null,
};

const EMPTY_UNIT_FORM: CreateSalesUnitRequest = {
  organization_id: null,
  name: "",
  code: "",
};

const EMPTY_TEAM_FORM: CreateSalesTeamRequest = {
  organization_id: null,
  unit_id: null,
  manager_user_id: null,
  name: "",
  code: "",
};

function getOrganizationLabel(
  organizationId: string | null,
  organizations: OrganizationItem[],
): string {
  if (!organizationId) {
    return "-";
  }

  return (
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? organizationId
  );
}

function getTeamOptions(
  organizationId: string | null,
  teams: SalesTeamItem[],
): SalesTeamItem[] {
  if (!organizationId) {
    return [];
  }

  return teams.filter((team) => team.organization_id === organizationId);
}

function getManagedTeamsForUser(
  userId: string,
  teams: SalesTeamItem[],
): SalesTeamItem[] {
  return teams.filter((team) => team.manager_user_id === userId);
}

function getUserTeamDisplay(
  user: CurrentUser,
  teams: SalesTeamItem[],
): { teamName: string; unitName: string; managedTeamLabel: string | null } {
  if (user.team_name || user.unit_name) {
    return {
      teamName: user.team_name ?? "-",
      unitName: user.unit_name ?? "-",
      managedTeamLabel: null,
    };
  }

  const managedTeams = getManagedTeamsForUser(user.id, teams);
  if (managedTeams.length === 0) {
    return {
      teamName: "-",
      unitName: "-",
      managedTeamLabel: null,
    };
  }

  const primaryManagedTeam = managedTeams[0];
  const managedTeamLabel =
    managedTeams.length === 1
      ? primaryManagedTeam.name
      : `${primaryManagedTeam.name} +${managedTeams.length - 1} team lain`;

  return {
    teamName: primaryManagedTeam.name,
    unitName: primaryManagedTeam.unit_name ?? "-",
    managedTeamLabel,
  };
}

export default function AdminAccessPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [units, setUnits] = useState<SalesUnitItem[]>([]);
  const [teams, setTeams] = useState<SalesTeamItem[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [organizationForm, setOrganizationForm] =
    useState<CreateOrganizationRequest>(EMPTY_ORGANIZATION_FORM);
  const [unitForm, setUnitForm] = useState<CreateSalesUnitRequest>(EMPTY_UNIT_FORM);
  const [teamForm, setTeamForm] = useState<CreateSalesTeamRequest>(EMPTY_TEAM_FORM);
  const [userForm, setUserForm] = useState<CreateUserRequest>(EMPTY_USER_FORM);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>(EMPTY_EDIT_FORM);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<
    string | null
  >(null);
  const [passwordForm, setPasswordForm] = useState<ResetUserPasswordRequest>({
    password: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingOrganization, setIsSubmittingOrganization] =
    useState(false);
  const [isSubmittingUnit, setIsSubmittingUnit] = useState(false);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);

  const canManageOrganizations = isOwnerLike(currentUser?.role);
  const isAdminScoped =
    currentUser !== null &&
    isAdminLike(currentUser.role) &&
    !isOwnerLike(currentUser.role);
  const userPageSize = 5;

  async function loadPageData(me?: CurrentUser) {
    const activeUser = me ?? currentUser;
    const [organizationData, unitData, teamData, userData] = await Promise.all([
      apiFetch<OrganizationItem[]>("/organizations"),
      apiFetch<SalesUnitItem[]>("/sales-structure/units"),
      apiFetch<SalesTeamItem[]>("/sales-structure/teams"),
      apiFetch<CurrentUser[]>("/auth/users"),
    ]);

    setOrganizations(organizationData);
    setUnits(unitData);
    setTeams(teamData);
    setUsers(userData);

    if (activeUser && isAdminLike(activeUser.role) && !isOwnerLike(activeUser.role)) {
      setUserForm((current) => ({
        ...current,
        organization_id: activeUser.organization_id,
      }));
      setUnitForm((current) => ({
        ...current,
        organization_id: activeUser.organization_id,
      }));
      setTeamForm((current) => ({
        ...current,
        organization_id: activeUser.organization_id,
      }));
    } else if (
      activeUser &&
      isOwnerLike(activeUser.role) &&
      organizationData.length > 0 &&
      !userForm.organization_id
    ) {
      setUserForm((current) => ({
        ...current,
        organization_id: current.organization_id ?? organizationData[0].id,
      }));
      setUnitForm((current) => ({
        ...current,
        organization_id: current.organization_id ?? organizationData[0].id,
      }));
      setTeamForm((current) => ({
        ...current,
        organization_id: current.organization_id ?? organizationData[0].id,
      }));
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isAdminLike(me.role)) {
          router.replace("/dashboard");
          return;
        }

        await loadPageData(me);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat halaman user management.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function beginEdit(user: CurrentUser) {
    setExpandedUserId(user.id);
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      team_id: user.team_id,
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  function beginPasswordReset(userId: string) {
    setExpandedUserId(userId);
    setResettingPasswordUserId(userId);
    setPasswordForm({ password: "" });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelPasswordReset() {
    setResettingPasswordUserId(null);
    setPasswordForm({ password: "" });
  }

  async function handleCreateOrganization(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmittingOrganization(true);

    try {
      await apiFetch<OrganizationItem>("/organizations", {
        method: "POST",
        body: organizationForm,
      });
      setOrganizationForm(EMPTY_ORGANIZATION_FORM);
      setSuccessMessage("Organization berhasil dibuat.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat organization.",
      );
    } finally {
      setIsSubmittingOrganization(false);
    }
  }

  async function handleCreateUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmittingUnit(true);

    try {
      await apiFetch<SalesUnitItem>("/sales-structure/units", {
        method: "POST",
        body: unitForm,
      });
      setUnitForm({
        ...EMPTY_UNIT_FORM,
        organization_id: isAdminScoped
          ? (currentUser?.organization_id ?? null)
          : (organizations[0]?.id ?? null),
      });
      setSuccessMessage("Sales unit berhasil dibuat.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat sales unit.",
      );
    } finally {
      setIsSubmittingUnit(false);
    }
  }

  async function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmittingTeam(true);

    try {
      await apiFetch<SalesTeamItem>("/sales-structure/teams", {
        method: "POST",
        body: teamForm,
      });
      setTeamForm({
        ...EMPTY_TEAM_FORM,
        organization_id: isAdminScoped
          ? (currentUser?.organization_id ?? null)
          : (organizations[0]?.id ?? null),
      });
      setSuccessMessage("Sales team berhasil dibuat.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat sales team.",
      );
    } finally {
      setIsSubmittingTeam(false);
    }
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmittingUser(true);

    try {
      await apiFetch<CurrentUser>("/auth/users", {
        method: "POST",
        body: userForm,
      });
      setUserForm({
        ...EMPTY_USER_FORM,
        role: "sales",
        organization_id: isAdminScoped
          ? (currentUser?.organization_id ?? null)
          : (organizations[0]?.id ?? null),
        team_id: null,
      });
      setSuccessMessage("User berhasil dibuat.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal membuat user.",
      );
    } finally {
      setIsSubmittingUser(false);
    }
  }

  async function handleSaveEdit(userId: string) {
    setActionUserId(userId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<CurrentUser>(`/auth/users/${userId}`, {
        method: "PATCH",
        body: editForm,
      });
      setSuccessMessage("User berhasil diupdate.");
      cancelEdit();
      setExpandedUserId(userId);
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal update user.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function handleToggleActive(user: CurrentUser) {
    setActionUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<CurrentUser>(
        `/auth/users/${user.id}/${user.is_active ? "deactivate" : "activate"}`,
        { method: "POST" },
      );
      setSuccessMessage(
        user.is_active
          ? "User berhasil dinonaktifkan."
          : "User berhasil diaktifkan.",
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah status user.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function handleResetPassword(userId: string) {
    setActionUserId(userId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<CurrentUser>(`/auth/users/${userId}/reset-password`, {
        method: "POST",
        body: passwordForm,
      });
      setSuccessMessage("Password user berhasil diubah.");
      cancelPasswordReset();
      setExpandedUserId(userId);
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal mengubah password user.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalizedQuery = userSearchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          user.name,
          user.email,
          user.role,
          user.created_by_user_name ?? "",
          user.team_name ?? "",
          user.unit_name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesRole =
        userRoleFilter === "all" || user.role === userRoleFilter;

      const matchesStatus =
        userStatusFilter === "all" ||
        (userStatusFilter === "active" && user.is_active) ||
        (userStatusFilter === "inactive" && !user.is_active);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [userRoleFilter, userSearchQuery, userStatusFilter, users]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / userPageSize),
  );

  const paginatedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * userPageSize;
    return filteredUsers.slice(startIndex, startIndex + userPageSize);
  }, [filteredUsers, userPage]);

  useEffect(() => {
    setUserPage(1);
  }, [userRoleFilter, userSearchQuery, userStatusFilter]);

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages);
    }
  }, [totalUserPages, userPage]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Access management"
      title="User & Organization Setup"
      description="Kelola struktur organisasi, akses user, dan boundary role supaya workspace SCC tetap aman dan rapi."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <Link
          href="/dashboard/admin/ops"
          className="clara-button clara-button-ghost"
        >
          Buka System Ops
        </Link>
      }
    >
      <div className="mx-auto space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            label="Operator"
            value={currentUser ? formatStatusLabel(currentUser.role) : "..."}
            description={
              currentUser
                ? `Login sebagai ${currentUser.email}`
                : "Memuat profil operator."
            }
          />
          <InfoCard
            label="Boundary"
            value={isAdminScoped ? "Scoped" : "Global"}
            description={
              isAdminScoped
                ? "Head dibatasi pada organization miliknya sendiri."
                : "Superadmin bisa melihat dan mengelola semua organization."
            }
          />
          <InfoCard
            label="Current Org"
            value={
              currentUser
                ? getOrganizationLabel(
                    currentUser.organization_id,
                    organizations,
                  )
                : "..."
            }
            description="Histori user dipertahankan agar audit trail dan conversation tetap aman."
          />
        </section>

        {isLoading && (
          <div className="clara-empty-state text-sm text-slate-600">
            Loading access management...
          </div>
        )}

        {errorMessage && (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        )}

        {successMessage && (
          <div className="clara-alert clara-alert-success">
            {successMessage}
          </div>
        )}

        {!isLoading &&
          currentUser &&
          isAdminLike(currentUser.role) && (
            <>
              <section className="grid gap-6 lg:grid-cols-2">
                <form
                  onSubmit={handleCreateOrganization}
                  className="clara-card space-y-5 rounded-[30px] p-5"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Organization Management
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Create organization hanya dibuka untuk superadmin.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-900">
                      Name
                    </label>
                    <input
                      value={organizationForm.name}
                      onChange={(event) =>
                        setOrganizationForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      disabled={
                        !canManageOrganizations || isSubmittingOrganization
                      }
                      className="clara-input mt-2"
                      placeholder="Contoh: SGB Jakarta"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-900">
                      Slug
                    </label>
                    <input
                      value={organizationForm.slug}
                      onChange={(event) =>
                        setOrganizationForm((current) => ({
                          ...current,
                          slug: event.target.value,
                        }))
                      }
                      disabled={
                        !canManageOrganizations || isSubmittingOrganization
                      }
                      className="clara-input mt-2"
                      placeholder="sgb-jakarta"
                    />
                  </div>

                  {!canManageOrganizations && (
                    <p className="clara-card-soft rounded-xl p-3 text-sm text-amber-700">
                      Head tidak bisa membuat organization baru dari UI ini.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !canManageOrganizations || isSubmittingOrganization
                    }
                    className="clara-button clara-button-primary"
                  >
                    {isSubmittingOrganization
                      ? "Creating organization..."
                      : "Create Organization"}
                  </button>
                </form>

                <form
                  onSubmit={handleCreateUser}
                  className="clara-card space-y-5 rounded-[30px] p-5"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Create User
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Head otomatis terikat ke organization miliknya sendiri.
                    </p>
                  </div>

                  <InputField
                    label="Name"
                    value={userForm.name}
                    onChange={(value) =>
                      setUserForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Sales A"
                  />

                  <InputField
                    label="Email"
                    value={userForm.email}
                    onChange={(value) =>
                      setUserForm((current) => ({ ...current, email: value }))
                    }
                    placeholder="sales@sgb.local"
                    type="email"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Password"
                      value={userForm.password}
                      onChange={(value) =>
                        setUserForm((current) => ({
                          ...current,
                          password: value,
                        }))
                      }
                      placeholder="Minimum 8 karakter"
                      type="password"
                    />

                    <SelectField
                      label="Role"
                      value={userForm.role}
                      onChange={(value) =>
                        setUserForm((current) => ({ ...current, role: value }))
                      }
                      options={[
                        {
                          value: "sales",
                          label: getRoleDisplayLabel("sales"),
                        },
                        {
                          value: "manager",
                          label: getRoleDisplayLabel("manager"),
                        },
                        {
                          value: "head",
                          label: getRoleDisplayLabel("head"),
                        },
                        ...(isOwnerLike(currentUser.role)
                          ? [
                              {
                                value: "superadmin",
                                label: getRoleDisplayLabel("superadmin"),
                              },
                            ]
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
                      setUserForm((current) => ({
                        ...current,
                        team_id: value || null,
                      }))
                    }
                    options={[
                      { value: "", label: "Belum di-assign" },
                      ...getTeamOptions(userForm.organization_id, teams).map((team) => ({
                        value: team.id,
                        label: `${team.name}${team.unit_name ? ` • ${team.unit_name}` : ""}`,
                      })),
                    ]}
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="clara-button clara-button-primary"
                  >
                    {isSubmittingUser ? "Creating user..." : "Create User"}
                  </button>
                </form>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <form
                  onSubmit={handleCreateUnit}
                  className="clara-card space-y-5 rounded-[30px] p-5"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Create Sales Unit
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Strukturkan cabang, area, atau business cluster sebelum
                      team dan assignment user dibuat.
                    </p>
                  </div>

                  <SelectField
                    label="Organization"
                    value={unitForm.organization_id ?? ""}
                    onChange={(value) =>
                      setUnitForm((current) => ({
                        ...current,
                        organization_id: value || null,
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

                  <InputField
                    label="Unit Name"
                    value={unitForm.name}
                    onChange={(value) =>
                      setUnitForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Contoh: Jakarta Timur"
                  />

                  <InputField
                    label="Unit Code"
                    value={unitForm.code}
                    onChange={(value) =>
                      setUnitForm((current) => ({ ...current, code: value }))
                    }
                    placeholder="jkt-timur"
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingUnit}
                    className="clara-button clara-button-primary"
                  >
                    {isSubmittingUnit ? "Creating unit..." : "Create Unit"}
                  </button>
                </form>

                <form
                  onSubmit={handleCreateTeam}
                  className="clara-card space-y-5 rounded-[30px] p-5"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Create Sales Team
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Team selalu terikat ke organization dan bisa dipetakan ke
                      unit serta head yang memimpin.
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
                      onChange={(value) =>
                        setTeamForm((current) => ({ ...current, name: value }))
                      }
                      placeholder="Team A"
                    />
                    <InputField
                      label="Team Code"
                      value={teamForm.code}
                      onChange={(value) =>
                        setTeamForm((current) => ({ ...current, code: value }))
                      }
                      placeholder="team-a"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Unit"
                      value={teamForm.unit_id ?? ""}
                      onChange={(value) =>
                        setTeamForm((current) => ({
                          ...current,
                          unit_id: value || null,
                        }))
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
                        setTeamForm((current) => ({
                          ...current,
                          manager_user_id: value || null,
                        }))
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
                    disabled={isSubmittingTeam}
                    className="clara-button clara-button-primary"
                  >
                    {isSubmittingTeam ? "Creating team..." : "Create Team"}
                  </button>
                </form>
              </section>

              <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <Panel
                  title="Available Organizations"
                  description="Superadmin melihat semua organization. Head hanya organization miliknya."
                >
                  {organizations.length === 0 ? (
                    <EmptyText text="Belum ada organization." />
                  ) : (
                    <div className="space-y-3">
                      {organizations.map((organization) => (
                        <div
                          key={organization.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {organization.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            slug: {organization.slug}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            created: {formatDateTime(organization.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <Panel
                  title="Sales Units"
                  description="Baseline hierarchy untuk laporan cabang, cluster, atau area kerja."
                >
                  {units.length === 0 ? (
                    <EmptyText text="Belum ada sales unit." />
                  ) : (
                    <div className="space-y-3">
                      {units.map((unit) => (
                        <div
                          key={unit.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {unit.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            code: {unit.code}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            org: {unit.organization_name ?? unit.organization_id}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            teams: {unit.team_count}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Sales Teams"
                  description="Team jadi boundary assignment user dan titik awal manager scope per unit."
                >
                  {teams.length === 0 ? (
                    <EmptyText text="Belum ada sales team." />
                  ) : (
                    <div className="space-y-3">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {team.name}
                          </p>
                          <div className="mt-1 space-y-1 text-xs text-slate-500">
                            <p>code: {team.code}</p>
                            <p>org: {team.organization_name ?? team.organization_id}</p>
                            <p>unit: {team.unit_name ?? "-"}</p>
                            <p>manager: {team.manager_user_name ?? "-"}</p>
                            <p>members: {team.member_count}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </section>

              <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <Panel
                  title="Manage Users"
                  description="Edit profil user, ubah role, dan aktif atau nonaktifkan akun tanpa menghapus histori."
                >
                  {users.length === 0 ? (
                    <EmptyText text="Belum ada user." />
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_42%,#fff7ed_100%)] p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Search User
                            </label>
                            <input
                              value={userSearchQuery}
                              onChange={(event) =>
                                setUserSearchQuery(event.target.value)
                              }
                              placeholder="Cari nama, email, team, unit..."
                              className="clara-input mt-2"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Filter Role
                            </label>
                            <select
                              value={userRoleFilter}
                              onChange={(event) =>
                                setUserRoleFilter(event.target.value)
                              }
                              className="clara-select mt-2"
                            >
                              <option value="all">Semua role</option>
                              <option value="sales">sales</option>
                              <option value="manager">manager</option>
                              <option value="head">head</option>
                              <option value="superadmin">superadmin</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Filter Status
                            </label>
                            <select
                              value={userStatusFilter}
                              onChange={(event) =>
                                setUserStatusFilter(event.target.value)
                              }
                              className="clara-select mt-2"
                            >
                              <option value="all">Semua status</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                          <p>
                            Menampilkan {paginatedUsers.length} dari {filteredUsers.length} user
                          </p>
                          <p>
                            Halaman {userPage} dari {totalUserPages}
                          </p>
                        </div>
                      </div>

                      {filteredUsers.length === 0 ? (
                        <EmptyText text="Tidak ada user yang cocok dengan filter saat ini." />
                      ) : (
                        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                  <th className="px-4 py-3 font-medium">User</th>
                                  <th className="px-4 py-3 font-medium">Role</th>
                                  <th className="px-4 py-3 font-medium">Status</th>
                                  <th className="px-4 py-3 font-medium">Org / Team</th>
                                  <th className="px-4 py-3 font-medium">Created</th>
                                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedUsers.map((user) => {
                                  const isEditing = editingUserId === user.id;
                                  const isResettingPassword =
                                    resettingPasswordUserId === user.id;
                                  const isExpanded = expandedUserId === user.id;
                                  const isSelf = currentUser.id === user.id;
                                  const teamDisplay = getUserTeamDisplay(user, teams);
                                  const canResetPassword =
                                    isOwnerLike(currentUser.role) ||
                                    user.created_by_user_id === currentUser.id;
                                  const passwordStrength = getPasswordStrength(
                                    passwordForm.password,
                                  );

                                  return (
                                    <Fragment key={user.id}>
                                      <tr
                                        className="border-t border-slate-100 align-top"
                                      >
                                        <td className="px-4 py-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedUserId((current) =>
                                                current === user.id ? null : user.id,
                                              )
                                            }
                                            className="text-left"
                                          >
                                            <div className="font-semibold text-slate-950">
                                              {user.name}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                              {user.email}
                                            </div>
                                          </button>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                            {formatStatusLabel(user.role)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                              user.is_active
                                                ? "bg-green-100 text-green-700"
                                                : "bg-red-100 text-red-700"
                                            }`}
                                          >
                                            {user.is_active ? "active" : "inactive"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                          <div>{getOrganizationLabel(user.organization_id, organizations)}</div>
                                          <div className="mt-1">
                                            {teamDisplay.teamName} {teamDisplay.unitName !== "-" ? `• ${teamDisplay.unitName}` : ""}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                          {formatDateTime(user.created_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => beginEdit(user)}
                                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => beginPasswordReset(user.id)}
                                              disabled={!canResetPassword}
                                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Reset
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void handleToggleActive(user)}
                                              disabled={actionUserId === user.id || isSelf}
                                              className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                                user.is_active
                                                  ? "border border-red-300 text-red-700"
                                                  : "border border-green-300 text-green-700"
                                              }`}
                                            >
                                              {actionUserId === user.id
                                                ? "..."
                                                : user.is_active
                                                  ? "Deactivate"
                                                  : "Activate"}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>

                                      {isExpanded ? (
                                        <tr className="border-t border-slate-100 bg-slate-50/60">
                                          <td colSpan={6} className="px-4 py-4">
                                            {isEditing ? (
                                              <div className="space-y-4 rounded-[20px] border border-slate-200 bg-white p-4">
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                  <InputField
                                                    label="Name"
                                                    value={editForm.name ?? ""}
                                                    onChange={(value) =>
                                                      setEditForm((current) => ({
                                                        ...current,
                                                        name: value,
                                                      }))
                                                    }
                                                    placeholder="Name"
                                                  />
                                                  <InputField
                                                    label="Email"
                                                    value={editForm.email ?? ""}
                                                    onChange={(value) =>
                                                      setEditForm((current) => ({
                                                        ...current,
                                                        email: value,
                                                      }))
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
                                                      setEditForm((current) => ({
                                                        ...current,
                                                        role: value,
                                                      }))
                                                    }
                                                    options={[
                                                      { value: "sales", label: getRoleDisplayLabel("sales") },
                                                      { value: "manager", label: getRoleDisplayLabel("manager") },
                                                      { value: "head", label: getRoleDisplayLabel("head") },
                                                      ...(isOwnerLike(currentUser.role)
                                                        ? [{ value: "superadmin", label: getRoleDisplayLabel("superadmin") }]
                                                        : []),
                                                    ]}
                                                    disabled={isSelf}
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
                                                    setEditForm((current) => ({
                                                      ...current,
                                                      team_id: value || null,
                                                    }))
                                                  }
                                                  options={[
                                                    { value: "", label: "Belum di-assign" },
                                                    ...getTeamOptions(editForm.organization_id ?? null, teams).map((team) => ({
                                                      value: team.id,
                                                      label: `${team.name}${team.unit_name ? ` • ${team.unit_name}` : ""}`,
                                                    })),
                                                  ]}
                                                />

                                                <div className="flex flex-wrap gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleSaveEdit(user.id)}
                                                    disabled={actionUserId === user.id}
                                                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                  >
                                                    {actionUserId === user.id ? "Saving..." : "Save Changes"}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={cancelEdit}
                                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : isResettingPassword ? (
                                              <div className="space-y-4 rounded-[20px] border border-slate-200 bg-white p-4">
                                                <div>
                                                  <p className="text-sm font-semibold text-slate-950">
                                                    Reset password untuk {user.email}
                                                  </p>
                                                  <p className="mt-1 text-sm text-slate-600">
                                                    Superadmin bisa mengganti semua password user. Head hanya bisa mengganti password user yang dia buat sendiri.
                                                  </p>
                                                </div>

                                                <InputField
                                                  label="New Password"
                                                  value={passwordForm.password}
                                                  onChange={(value) =>
                                                    setPasswordForm({ password: value })
                                                  }
                                                  placeholder="Minimum 8 karakter"
                                                  type="password"
                                                />

                                                <PasswordStrengthHint
                                                  password={passwordForm.password}
                                                  strength={passwordStrength}
                                                />

                                                <div className="flex flex-wrap gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleResetPassword(user.id)}
                                                    disabled={actionUserId === user.id}
                                                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                  >
                                                    {actionUserId === user.id ? "Saving..." : "Save New Password"}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={cancelPasswordReset}
                                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                                                <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                                  <p>org: {getOrganizationLabel(user.organization_id, organizations)}</p>
                                                  <p>created by: {user.created_by_user_name ?? "-"}</p>
                                                  <p>team: {teamDisplay.teamName}</p>
                                                  <p>unit: {teamDisplay.unitName}</p>
                                                  {teamDisplay.managedTeamLabel ? (
                                                    <p>manager of: {teamDisplay.managedTeamLabel}</p>
                                                  ) : null}
                                                  <p>created: {formatDateTime(user.created_at)}</p>
                                                </div>

                                                <div className="space-y-2">
                                                  {isSelf ? (
                                                    <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
                                                      Akun yang sedang Anda pakai tidak bisa dinonaktifkan dari sesi ini sendiri.
                                                    </p>
                                                  ) : null}
                                                  {!canResetPassword ? (
                                                    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                                                      Head hanya bisa mengganti password user yang dibuat dari akunnya sendiri.
                                                    </p>
                                                  ) : null}
                                                </div>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ) : null}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {filteredUsers.length > userPageSize ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm text-slate-600">
                            Navigasi daftar user
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setUserPage((current) => Math.max(1, current - 1))
                              }
                              disabled={userPage === 1}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Sebelumnya
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setUserPage((current) =>
                                  Math.min(totalUserPages, current + 1),
                                )
                              }
                              disabled={userPage === totalUserPages}
                              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </Panel>
              </section>
            </>
          )}
      </div>
    </WorkspaceShell>
  );
}

function InfoCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="clara-card rounded-[24px] p-5">
      <p className="clara-kicker text-xs text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="clara-card rounded-[28px] p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-900">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="clara-input mt-2"
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-900">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="clara-select mt-2"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PasswordStrengthHint({
  password,
  strength,
}: {
  password: string;
  strength: ReturnType<typeof getPasswordStrength>;
}) {
  if (!password) {
    return (
      <p className="clara-card-soft rounded-xl p-3 text-xs text-slate-600">
        Hint: gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.
      </p>
    );
  }

  return (
    <div className="clara-card-soft rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Password Strength
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${strength.badgeClassName}`}
        >
          {strength.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {strength.checks.map((check) => (
          <span
            key={check.label}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              check.passed
                ? "bg-green-100 text-green-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}
