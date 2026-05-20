"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  formatDateTime,
  formatStatusLabel,
  getPasswordStrength,
} from "@/lib/format";
import {
  getRoleDisplayLabel,
  isAdminLike,
  isOwnerLike,
} from "@/lib/roles";
import type {
  CreateOrganizationRequest,
  CreateUserRequest,
  CurrentUser,
  OrganizationItem,
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
  role: "marketing",
  organization_id: null,
};

const EMPTY_EDIT_FORM: UpdateUserRequest = {
  name: "",
  email: "",
  role: "marketing",
  organization_id: null,
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

export default function AdminAccessPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [organizationForm, setOrganizationForm] =
    useState<CreateOrganizationRequest>(EMPTY_ORGANIZATION_FORM);
  const [userForm, setUserForm] = useState<CreateUserRequest>(EMPTY_USER_FORM);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canManageOrganizations = isOwnerLike(currentUser?.role);
  const isAdminScoped =
    currentUser !== null &&
    isAdminLike(currentUser.role) &&
    !isOwnerLike(currentUser.role);

  async function loadPageData(me?: CurrentUser) {
    const activeUser = me ?? currentUser;
    const [organizationData, userData] = await Promise.all([
      apiFetch<OrganizationItem[]>("/organizations"),
      apiFetch<CurrentUser[]>("/auth/users"),
    ]);

    setOrganizations(organizationData);
    setUsers(userData);

    if (activeUser && isAdminLike(activeUser.role) && !isOwnerLike(activeUser.role)) {
      setUserForm((current) => ({
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
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);

        if (!isAdminLike(me.role)) {
          setErrorMessage(
            "Halaman ini hanya bisa diakses oleh head atau superadmin.",
          );
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
  }, []);

  function beginEdit(user: CurrentUser) {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  function beginPasswordReset(userId: string) {
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
        role: "marketing",
        organization_id: isAdminScoped
          ? (currentUser?.organization_id ?? null)
          : (organizations[0]?.id ?? null),
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
                          value: "marketing",
                          label: getRoleDisplayLabel("marketing"),
                        },
                        {
                          value: "admin",
                          label: getRoleDisplayLabel("admin"),
                        },
                        ...(isOwnerLike(currentUser.role)
                          ? [
                              {
                                value: "owner",
                                label: getRoleDisplayLabel("owner"),
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

                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="clara-button clara-button-primary"
                  >
                    {isSubmittingUser ? "Creating user..." : "Create User"}
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

                <Panel
                  title="Manage Users"
                  description="Edit profil user, ubah role, dan aktif atau nonaktifkan akun tanpa menghapus histori."
                >
                  {users.length === 0 ? (
                    <EmptyText text="Belum ada user." />
                  ) : (
                    <div className="space-y-4">
                      {users.map((user) => {
                        const isEditing = editingUserId === user.id;
                        const isResettingPassword =
                          resettingPasswordUserId === user.id;
                        const isSelf = currentUser.id === user.id;
                        const canResetPassword =
                          isOwnerLike(currentUser.role) ||
                          user.created_by_user_id === currentUser.id;
                        const passwordStrength = getPasswordStrength(
                          passwordForm.password,
                        );

                        return (
                          <article
                            key={user.id}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            {isEditing ? (
                              <div className="space-y-4">
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
                                    value={editForm.role ?? "marketing"}
                                    onChange={(value) =>
                                      setEditForm((current) => ({
                                        ...current,
                                        role: value,
                                      }))
                                    }
                                    options={[
                                      {
                                        value: "marketing",
                                        label: getRoleDisplayLabel("marketing"),
                                      },
                                      {
                                        value: "admin",
                                        label: getRoleDisplayLabel("admin"),
                                      },
                                      ...(isOwnerLike(currentUser.role)
                                        ? [
                                            {
                                              value: "owner",
                                              label: getRoleDisplayLabel("owner"),
                                            },
                                          ]
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
                                      }))
                                    }
                                    options={[
                                      {
                                        value: "",
                                        label: "Pilih organization",
                                      },
                                      ...organizations.map((organization) => ({
                                        value: organization.id,
                                        label: `${organization.name} (${organization.slug})`,
                                      })),
                                    ]}
                                    disabled={isAdminScoped}
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveEdit(user.id)}
                                    disabled={actionUserId === user.id}
                                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {actionUserId === user.id
                                      ? "Saving..."
                                      : "Save Changes"}
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
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    Reset password untuk {user.email}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Superadmin bisa mengganti semua password user.
                                    Head hanya bisa mengganti password user
                                    yang dia buat sendiri.
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
                                    onClick={() =>
                                      void handleResetPassword(user.id)
                                    }
                                    disabled={actionUserId === user.id}
                                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {actionUserId === user.id
                                      ? "Saving..."
                                      : "Save New Password"}
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
                              <>
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-950">
                                        {user.email}
                                      </p>
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                        {formatStatusLabel(user.role)}
                                      </span>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                          user.is_active
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {user.is_active ? "active" : "inactive"}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {user.name}
                                    </p>
                                    <div className="mt-2 grid gap-1 text-xs text-slate-500">
                                      <p>
                                        org:{" "}
                                        {getOrganizationLabel(
                                          user.organization_id,
                                          organizations,
                                        )}
                                      </p>
                                      <p>
                                        created by:{" "}
                                        {user.created_by_user_name ?? "-"}
                                      </p>
                                      <p>
                                        created:{" "}
                                        {formatDateTime(user.created_at)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => beginEdit(user)}
                                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        beginPasswordReset(user.id)
                                      }
                                      disabled={!canResetPassword}
                                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Reset Password
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleToggleActive(user)
                                      }
                                      disabled={
                                        actionUserId === user.id || isSelf
                                      }
                                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                        user.is_active
                                          ? "border border-red-300 text-red-700"
                                          : "border border-green-300 text-green-700"
                                      }`}
                                    >
                                      {actionUserId === user.id
                                        ? "Processing..."
                                        : user.is_active
                                          ? "Deactivate"
                                          : "Activate"}
                                    </button>
                                  </div>
                                </div>

                                {isSelf && (
                                  <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
                                    Akun yang sedang Anda pakai tidak bisa
                                    dinonaktifkan dari sesi ini sendiri.
                                  </p>
                                )}

                                {!canResetPassword && (
                                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
                                    Head hanya bisa mengganti password user
                                    yang dibuat dari akunnya sendiri.
                                  </p>
                                )}
                              </>
                            )}
                          </article>
                        );
                      })}
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
