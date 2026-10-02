"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { NAV_GROUP_NAMES, PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { canLeadSalesTeam, isOwnerLike } from "@/lib/roles";
import type {
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
  SalesUnitItem,
  UpdateOrganizationRequest,
  UpdateSalesTeamRequest,
  UpdateSalesUnitRequest,
} from "@/types/dashboard";

import {
  EmptyText,
  getOrganizationLabel,
  getUserTeamDisplay,
  Panel,
} from "./shared";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";

export default function AdminAccessPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [units, setUnits] = useState<SalesUnitItem[]>([]);
  const [teams, setTeams] = useState<SalesTeamItem[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [hasLoadedAccessData, setHasLoadedAccessData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [editingOrganizationForm, setEditingOrganizationForm] =
    useState<UpdateOrganizationRequest>({
      name: "",
      slug: "",
    });
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitForm, setEditingUnitForm] = useState<UpdateSalesUnitRequest>({
    name: "",
    code: "",
  });
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamForm, setEditingTeamForm] = useState<UpdateSalesTeamRequest>({
    name: "",
    code: "",
    unit_id: null,
    manager_user_id: null,
  });
  const [structureActionKey, setStructureActionKey] = useState<string | null>(null);

  const userPageSize = 8;

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
    setHasLoadedAccessData(true);

    if (activeUser && !isOwnerLike(activeUser.role)) {
      router.replace("/workspace");
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isOwnerLike(me.role)) {
          router.replace("/workspace");
          return;
        }

        await loadPageData(me);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleToggleActive(user: CurrentUser) {
    const accepted = await confirm({
      title: user.is_active ? "Nonaktifkan akun ini?" : "Aktifkan akun ini?",
      message: user.is_active
        ? `${user.email} tidak bisa masuk ke Clara sampai akunnya diaktifkan lagi.`
        : `${user.email} bisa masuk ke Clara lagi.`,
      confirmLabel: user.is_active ? "Nonaktifkan" : "Aktifkan",
      tone: user.is_active ? "danger" : "default",
    });
    if (!accepted) return;

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
          ? "Pengguna dinonaktifkan."
          : "Pengguna diaktifkan.",
      );
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Status pengguna belum bisa diubah. Coba lagi.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function handleDeleteUser(user: CurrentUser) {
    const accepted = await confirm({
      title: "Hapus akun ini?",
      message: `${user.email} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Hapus akun",
      tone: "danger",
    });
    if (!accepted) return;

    setActionUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<void>(`/auth/users/${user.id}`, {
        method: "DELETE",
      });
      setSuccessMessage("Pengguna dihapus.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Pengguna belum bisa dihapus. Coba lagi.",
      );
    } finally {
      setActionUserId(null);
    }
  }

  function beginEditOrganization(organization: OrganizationItem) {
    setEditingOrganizationId(organization.id);
    setEditingOrganizationForm({
      name: organization.name,
      slug: organization.slug,
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  function beginEditUnit(unit: SalesUnitItem) {
    setEditingUnitId(unit.id);
    setEditingUnitForm({
      name: unit.name,
      code: unit.code,
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  function beginEditTeam(team: SalesTeamItem) {
    setEditingTeamId(team.id);
    setEditingTeamForm({
      name: team.name,
      code: team.code,
      unit_id: team.unit_id,
      manager_user_id: team.manager_user_id,
    });
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleUpdateOrganization(organizationId: string) {
    setStructureActionKey(`organization:${organizationId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<OrganizationItem>(`/organizations/${organizationId}`, {
        method: "PATCH",
        body: editingOrganizationForm,
      });
      setSuccessMessage("Organisasi diperbarui.");
      setEditingOrganizationId(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Organisasi belum bisa diperbarui. Coba lagi.",
      );
    } finally {
      setStructureActionKey(null);
    }
  }

  async function handleUpdateUnit(unitId: string) {
    setStructureActionKey(`unit:${unitId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<SalesUnitItem>(`/sales-structure/units/${unitId}`, {
        method: "PATCH",
        body: editingUnitForm,
      });
      setSuccessMessage("Unit sales diperbarui.");
      setEditingUnitId(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unit belum bisa diperbarui. Coba lagi.",
      );
    } finally {
      setStructureActionKey(null);
    }
  }

  async function handleUpdateTeam(teamId: string) {
    const team = teams.find((item) => item.id === teamId);
    if (
      team &&
      team.manager_user_id !== editingTeamForm.manager_user_id
    ) {
      const previousManager =
        users.find((user) => user.id === team.manager_user_id)?.email ??
        "tanpa manager";
      const nextManager =
        users.find((user) => user.id === editingTeamForm.manager_user_id)?.email ??
        "tanpa manager";

      const accepted = await confirm({
        title: "Ubah manager tim?",
        message: `Manager tim ${team.name} berubah dari ${previousManager} menjadi ${nextManager}.`,
        confirmLabel: "Ganti manager",
      });
      if (!accepted) return;
    }

    setStructureActionKey(`team:${teamId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<SalesTeamItem>(`/sales-structure/teams/${teamId}`, {
        method: "PATCH",
        body: editingTeamForm,
      });
      setSuccessMessage("Tim sales diperbarui.");
      setEditingTeamId(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Tim belum bisa diperbarui. Coba lagi.",
      );
    } finally {
      setStructureActionKey(null);
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
  const effectiveUserPage = Math.min(userPage, totalUserPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (effectiveUserPage - 1) * userPageSize;
    return filteredUsers.slice(startIndex, startIndex + userPageSize);
  }, [effectiveUserPage, filteredUsers]);
  const hasUsableAccessData =
    hasLoadedAccessData ||
    organizations.length > 0 ||
    units.length > 0 ||
    teams.length > 0 ||
    users.length > 0;
  const shouldRenderAccessWorkspace =
    !isLoading && (!errorMessage || hasUsableAccessData);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.admin}
      title={PAGE_NAMES.users}
      description="Atur siapa yang bisa masuk ke Clara, perannya, dan timnya."
      backHref="/workspace"
      backLabel="Kembali ke beranda"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/access/create/user" className="clara-button clara-button-primary">
            Buat pengguna
          </Link>
          <Link href="/admin/ops" className="clara-button clara-button-ghost">
            Buka Audit & Status Sistem
          </Link>
        </div>
      }
    >
      <div className="mx-auto space-y-6">
        {isLoading ? (
          <div role="status" className="clara-empty-state text-sm text-[#d6bb84]">
            Memuat pengguna dan akses...
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div role="status" className="clara-alert clara-alert-success">
            {successMessage}
          </div>
        ) : null}

        {shouldRenderAccessWorkspace &&
        currentUser &&
        isOwnerLike(currentUser.role) ? (
          <>
            <section className="grid gap-6 lg:grid-cols-3">
              <Panel
                title="Organisasi"
                description="Organisasi yang memakai Clara. Hanya superadmin yang bisa mengubahnya."
                className="h-full"
                contentClassName="h-full"
                action={
                  isOwnerLike(currentUser.role) ? (
                    <Link href="/admin/access/create/organization" className="clara-button clara-button-ghost">
                      Buat
                    </Link>
                  ) : null
                }
              >
                {organizations.length === 0 ? (
                  <EmptyText text="Belum ada organisasi." />
                ) : (
                  <div className="space-y-3">
                    {organizations.map((organization) => (
                      <div
                        key={organization.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        {editingOrganizationId === organization.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Organization Name
                              </label>
                              <input
                                value={editingOrganizationForm.name ?? ""}
                                onChange={(event) =>
                                  setEditingOrganizationForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="Nama organisasi"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Alamat singkat (slug)
                              </label>
                              <input
                                value={editingOrganizationForm.slug ?? ""}
                                onChange={(event) =>
                                  setEditingOrganizationForm((current) => ({
                                    ...current,
                                    slug: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="nama-organisasi"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleUpdateOrganization(organization.id)}
                                disabled={structureActionKey === `organization:${organization.id}`}
                                className="clara-button clara-button-primary"
                              >
                                {structureActionKey === `organization:${organization.id}`
                                  ? "Menyimpan..."
                                  : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOrganizationId(null)}
                                className="clara-button clara-button-ghost"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-[#fff0c9]">
                              {organization.name}
                            </p>
                            <p className="mt-1 text-xs text-[#b89a62]">
                              alamat singkat: {organization.slug}
                            </p>
                            <p className="mt-1 text-xs text-[#b89a62]">
                              dibuat: {formatDateTime(organization.created_at)}
                            </p>
                            {isOwnerLike(currentUser.role) ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => beginEditOrganization(organization)}
                                  className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c]"
                                >
                                  Ubah
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Unit Sales"
                description="Pengelompokan Sales per cabang atau area kerja, dipakai di laporan."
                className="h-full"
                contentClassName="h-full"
                action={
                  <Link href="/admin/access/create/unit" className="clara-button clara-button-ghost">
                    Buat
                  </Link>
                }
              >
                {units.length === 0 ? (
                  <EmptyText text="Belum ada unit sales." />
                ) : (
                  <div className="space-y-3">
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        {editingUnitId === unit.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Nama unit
                              </label>
                              <input
                                value={editingUnitForm.name ?? ""}
                                onChange={(event) =>
                                  setEditingUnitForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="Nama unit"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Kode unit
                              </label>
                              <input
                                value={editingUnitForm.code ?? ""}
                                onChange={(event) =>
                                  setEditingUnitForm((current) => ({
                                    ...current,
                                    code: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="kode-unit"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleUpdateUnit(unit.id)}
                                disabled={structureActionKey === `unit:${unit.id}`}
                                className="clara-button clara-button-primary"
                              >
                                {structureActionKey === `unit:${unit.id}` ? "Menyimpan..." : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUnitId(null)}
                                className="clara-button clara-button-ghost"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-[#fff0c9]">
                              {unit.name}
                            </p>
                            <p className="mt-1 text-xs text-[#b89a62]">kode: {unit.code}</p>
                            <p className="mt-1 text-xs text-[#b89a62]">
                              organisasi: {unit.organization_name ?? unit.organization_id}
                            </p>
                            <p className="mt-1 text-xs text-[#b89a62]">
                              jumlah tim: {unit.team_count}
                            </p>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => beginEditUnit(unit)}
                                className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c]"
                              >
                                Ubah
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Tim Sales"
                description="Tim menentukan siapa melapor ke manager mana."
                className="h-full"
                contentClassName="h-full"
                action={
                  <Link href="/admin/access/create/team" className="clara-button clara-button-ghost">
                    Buat
                  </Link>
                }
              >
                {teams.length === 0 ? (
                  <EmptyText text="Belum ada tim sales." />
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        {editingTeamId === team.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Nama tim
                              </label>
                              <input
                                value={editingTeamForm.name ?? ""}
                                onChange={(event) =>
                                  setEditingTeamForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="Nama tim"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Kode tim
                              </label>
                              <input
                                value={editingTeamForm.code ?? ""}
                                onChange={(event) =>
                                  setEditingTeamForm((current) => ({
                                    ...current,
                                    code: event.target.value,
                                  }))
                                }
                                className="clara-input mt-2"
                                placeholder="kode-tim"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Unit
                              </label>
                              <select
                                value={editingTeamForm.unit_id ?? ""}
                                onChange={(event) =>
                                  setEditingTeamForm((current) => ({
                                    ...current,
                                    unit_id: event.target.value || null,
                                  }))
                                }
                                className="clara-select mt-2"
                              >
                                <option value="">Tanpa unit</option>
                                {units
                                  .filter((unit) => unit.organization_id === team.organization_id)
                                  .map((unit) => (
                                    <option key={unit.id} value={unit.id}>
                                      {unit.name} ({unit.code})
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-[#f0cb73]">
                                Manager
                              </label>
                              <select
                                value={editingTeamForm.manager_user_id ?? ""}
                                onChange={(event) =>
                                  setEditingTeamForm((current) => ({
                                    ...current,
                                    manager_user_id: event.target.value || null,
                                  }))
                                }
                                className="clara-select mt-2"
                              >
                                <option value="">Belum ditunjuk</option>
                                {users
                                  .filter(
                                    (user) =>
                                      user.organization_id === team.organization_id &&
                                      canLeadSalesTeam(user.role),
                                  )
                                  .map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name} ({user.email})
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleUpdateTeam(team.id)}
                                disabled={structureActionKey === `team:${team.id}`}
                                className="clara-button clara-button-primary"
                              >
                                {structureActionKey === `team:${team.id}` ? "Menyimpan..." : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTeamId(null)}
                                className="clara-button clara-button-ghost"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-[#fff0c9]">
                              {team.name}
                            </p>
                            <div className="mt-1 space-y-1 text-xs text-[#b89a62]">
                              <p>kode: {team.code}</p>
                              <p>organisasi: {team.organization_name ?? team.organization_id}</p>
                              <p>unit: {team.unit_name ?? "-"}</p>
                              <p>manager: {team.manager_user_name ?? "-"}</p>
                              <p>anggota: {team.member_count}</p>
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => beginEditTeam(team)}
                                className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c]"
                              >
                                Ubah
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <section>
              <Panel
                title="Daftar Pengguna"
                description="Cari pengguna, ubah datanya, atau nonaktifkan akunnya."
                action={
                  <Link href="/admin/access/create/user" className="clara-button clara-button-primary">
                    Buat pengguna
                  </Link>
                }
              >
                {users.length === 0 ? (
                  <EmptyText text="Belum ada pengguna." />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-[#f0cb73]">
                            Cari pengguna
                          </label>
                          <input
                            value={userSearchQuery}
                            onChange={(event) => {
                              setUserSearchQuery(event.target.value);
                              setUserPage(1);
                            }}
                            placeholder="Cari nama, email, tim, atau unit"
                            className="clara-input mt-2"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-[#f0cb73]">
                            Peran
                          </label>
                          <select
                            value={userRoleFilter}
                            onChange={(event) => {
                              setUserRoleFilter(event.target.value);
                              setUserPage(1);
                            }}
                            className="clara-select mt-2"
                          >
                            <option value="all">Semua peran</option>
                            <option value="sales">sales</option>
                            <option value="manager">manager</option>
                            <option value="head">head</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-[#f0cb73]">
                            Status
                          </label>
                          <select
                            value={userStatusFilter}
                            onChange={(event) => {
                              setUserStatusFilter(event.target.value);
                              setUserPage(1);
                            }}
                            className="clara-select mt-2"
                          >
                            <option value="all">Semua status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#d6bb84]">
                        <p>
                          Menampilkan {paginatedUsers.length} dari {filteredUsers.length} pengguna
                        </p>
                        <p>
                          Halaman {effectiveUserPage} dari {totalUserPages}
                        </p>
                      </div>
                    </div>

                    {filteredUsers.length === 0 ? (
                      <EmptyText text="Tidak ada pengguna yang cocok. Ubah pencarian atau filter." />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.98)_100%)]">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-[#1d150d] text-[#b89a62]">
                              <tr>
                                <th className="px-4 py-3 font-medium">Pengguna</th>
                                <th className="px-4 py-3 font-medium">Peran</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Organisasi / Tim</th>
                                <th className="px-4 py-3 font-medium">Dibuat</th>
                                <th className="px-4 py-3 font-medium text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedUsers.map((user) => {
                                const isSelf = currentUser.id === user.id;
                                const teamDisplay = getUserTeamDisplay(user, teams);

                                return (
                                  <tr
                                    key={user.id}
                                    className="border-t border-[#f0cb73]/10 align-top"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-[#fff0c9]">
                                        {user.name}
                                      </div>
                                      <div className="mt-1 text-xs text-[#b89a62]">
                                        {user.email}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                                        {formatStatusLabel(user.role)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                          user.is_active
                                            ? "border border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
                                            : "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                        }`}
                                      >
                                        {user.is_active ? "aktif" : "nonaktif"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#d6bb84]">
                                      <div>
                                        {getOrganizationLabel(user.organization_id, organizations)}
                                      </div>
                                      <div className="mt-1">
                                        {teamDisplay.teamName}
                                        {teamDisplay.unitName !== "-"
                                          ? ` / ${teamDisplay.unitName}`
                                          : ""}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#d6bb84]">
                                      {formatDateTime(user.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex justify-end gap-2">
                                        <Link
                                          href={`/admin/access/${user.id}/edit/profile`}
                                          className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-3 py-2 text-sm font-semibold text-[#e1c27c]"
                                        >
                                          Ubah
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={() => void handleToggleActive(user)}
                                          disabled={actionUserId === user.id || isSelf}
                                          className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                            user.is_active
                                              ? "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                              : "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08]"
                                          }`}
                                        >
                                          {actionUserId === user.id
                                            ? "..."
                                            : user.is_active
                                              ? "Nonaktifkan"
                                              : "Aktifkan"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteUser(user)}
                                          disabled={actionUserId === user.id || isSelf}
                                          className="rounded-xl border border-[#6a421b] bg-[#2a170d] px-3 py-2 text-sm font-semibold text-[#f0cb73] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {actionUserId === user.id ? "..." : "Hapus"}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {filteredUsers.length > userPageSize ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.98)_100%)] p-4">
                        <p className="text-sm text-[#d6bb84]">Halaman daftar pengguna</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setUserPage((current) => Math.max(1, current - 1))
                            }
                            disabled={effectiveUserPage === 1}
                            className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-50"
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
                            disabled={effectiveUserPage === totalUserPages}
                            className="rounded-xl border border-[#3c2c16] bg-[#22190f] px-4 py-2 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-50"
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
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
