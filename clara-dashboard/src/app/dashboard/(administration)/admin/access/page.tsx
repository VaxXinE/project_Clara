"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatStatusLabel } from "@/lib/format";
import { isAdminLike, isOwnerLike } from "@/lib/roles";
import type {
  CurrentUser,
  OrganizationItem,
  SalesTeamItem,
  SalesUnitItem,
} from "@/types/dashboard";

import {
  EmptyText,
  getOrganizationLabel,
  getUserTeamDisplay,
  Panel,
} from "./shared";

export default function AdminAccessPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [units, setUnits] = useState<SalesUnitItem[]>([]);
  const [teams, setTeams] = useState<SalesTeamItem[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);

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

    if (activeUser && !isAdminLike(activeUser.role)) {
      router.replace("/workspace");
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isAdminLike(me.role)) {
          router.replace("/workspace");
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

  async function handleDeleteUser(user: CurrentUser) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Hapus user ${user.email}? Aksi ini tidak bisa dibatalkan.`)
    ) {
      return;
    }

    setActionUserId(user.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<void>(`/auth/users/${user.id}`, {
        method: "DELETE",
      });
      setSuccessMessage("User berhasil dihapus.");
      await loadPageData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menghapus user.",
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
      description="Halaman index untuk membaca boundary akses, struktur organisasi, dan daftar user. Aksi create dan edit dipisah ke halaman khusus."
      backHref="/workspace"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/access/create/user" className="clara-button clara-button-primary">
            Create User
          </Link>
          <Link href="/admin/ops" className="clara-button clara-button-ghost">
            Buka System Ops
          </Link>
        </div>
      }
    >
      <div className="mx-auto space-y-6">
        {isLoading ? (
          <div className="clara-empty-state text-sm text-[#d6bb84]">
            Loading access management...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="clara-alert clara-alert-danger">{errorMessage}</div>
        ) : null}

        {successMessage ? (
          <div className="clara-alert clara-alert-success">{successMessage}</div>
        ) : null}

        {!isLoading && currentUser && isAdminLike(currentUser.role) ? (
          <>
            <section className="grid gap-6 lg:grid-cols-3">
              <Panel
                title="Available Organizations"
                description="Superadmin melihat semua organization. Head hanya organization miliknya."
                className="h-full"
                contentClassName="h-full"
                action={
                  isOwnerLike(currentUser.role) ? (
                    <Link href="/admin/access/create/organization" className="clara-button clara-button-ghost">
                      Create
                    </Link>
                  ) : null
                }
              >
                {organizations.length === 0 ? (
                  <EmptyText text="Belum ada organization." />
                ) : (
                  <div className="space-y-3">
                    {organizations.map((organization) => (
                      <div
                        key={organization.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <p className="text-sm font-semibold text-[#fff0c9]">
                          {organization.name}
                        </p>
                        <p className="mt-1 text-xs text-[#b89a62]">
                          slug: {organization.slug}
                        </p>
                        <p className="mt-1 text-xs text-[#b89a62]">
                          created: {formatDateTime(organization.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Sales Units"
                description="Baseline hierarchy untuk laporan cabang, cluster, atau area kerja."
                className="h-full"
                contentClassName="h-full"
                action={
                  <Link href="/admin/access/create/unit" className="clara-button clara-button-ghost">
                    Create
                  </Link>
                }
              >
                {units.length === 0 ? (
                  <EmptyText text="Belum ada sales unit." />
                ) : (
                  <div className="space-y-3">
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <p className="text-sm font-semibold text-[#fff0c9]">
                          {unit.name}
                        </p>
                        <p className="mt-1 text-xs text-[#b89a62]">code: {unit.code}</p>
                        <p className="mt-1 text-xs text-[#b89a62]">
                          org: {unit.organization_name ?? unit.organization_id}
                        </p>
                        <p className="mt-1 text-xs text-[#b89a62]">
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
                className="h-full"
                contentClassName="h-full"
                action={
                  <Link href="/admin/access/create/team" className="clara-button clara-button-ghost">
                    Create
                  </Link>
                }
              >
                {teams.length === 0 ? (
                  <EmptyText text="Belum ada sales team." />
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="rounded-xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4"
                      >
                        <p className="text-sm font-semibold text-[#fff0c9]">
                          {team.name}
                        </p>
                        <div className="mt-1 space-y-1 text-xs text-[#b89a62]">
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

            <section>
              <Panel
                title="Manage Users"
                description="Halaman index hanya menampilkan daftar user, status, dan link ke halaman edit."
                action={
                  <Link href="/admin/access/create/user" className="clara-button clara-button-primary">
                    Create User
                  </Link>
                }
              >
                {users.length === 0 ? (
                  <EmptyText text="Belum ada user." />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_42%,rgba(53,39,17,0.94)_100%)] p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                            Search User
                          </label>
                          <input
                            value={userSearchQuery}
                            onChange={(event) => setUserSearchQuery(event.target.value)}
                            placeholder="Cari nama, email, team, unit..."
                            className="clara-input mt-2"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                            Filter Role
                          </label>
                          <select
                            value={userRoleFilter}
                            onChange={(event) => setUserRoleFilter(event.target.value)}
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
                          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f0cb73]">
                            Filter Status
                          </label>
                          <select
                            value={userStatusFilter}
                            onChange={(event) => setUserStatusFilter(event.target.value)}
                            className="clara-select mt-2"
                          >
                            <option value="all">Semua status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#d6bb84]">
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
                      <div className="overflow-hidden rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.98)_100%)]">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-[#1d150d] text-[#b89a62]">
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
                                        {user.is_active ? "active" : "inactive"}
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
                                          Edit
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={() => void handleToggleActive(user)}
                                          disabled={actionUserId === user.id || isSelf}
                                          className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                            user.is_active
                                              ? "border border-[#f0cb73]/18 bg-[#4a3112] text-[#f0cb73]"
                                              : "border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08]"
                                          }`}
                                        >
                                          {actionUserId === user.id
                                            ? "..."
                                            : user.is_active
                                              ? "Deactivate"
                                              : "Activate"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteUser(user)}
                                          disabled={actionUserId === user.id || isSelf}
                                          className="rounded-xl border border-[#6a421b] bg-[#2a170d] px-3 py-2 text-sm font-semibold text-[#f0cb73] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {actionUserId === user.id ? "..." : "Delete"}
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
                        <p className="text-sm text-[#d6bb84]">Navigasi daftar user</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setUserPage((current) => Math.max(1, current - 1))
                            }
                            disabled={userPage === 1}
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
                            disabled={userPage === totalUserPages}
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
