"use client";

import {
  faBuildingShield,
  faCloudArrowDown,
  faCloudArrowUp,
  faEnvelope,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getPasswordStrength } from "@/lib/format";
import { canAccessAdminPages, getRoleDisplayLabel } from "@/lib/roles";
import type {
  ChangePasswordRequest,
  CurrentUser,
  ExtensionBuildItem,
  UpdateUserRequest,
} from "@/types/dashboard";

const EMPTY_PROFILE_FORM: UpdateUserRequest = {
  name: "",
  email: "",
};

const EMPTY_PASSWORD_FORM: ChangePasswordRequest = {
  current_password: "",
  new_password: "",
};

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [extensionBuild, setExtensionBuild] = useState<ExtensionBuildItem | null>(null);
  const [profileForm, setProfileForm] = useState<UpdateUserRequest>(
    EMPTY_PROFILE_FORM,
  );
  const [passwordForm, setPasswordForm] = useState<ChangePasswordRequest>(
    EMPTY_PASSWORD_FORM,
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [profileErrorMessage, setProfileErrorMessage] = useState("");
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [extensionErrorMessage, setExtensionErrorMessage] = useState("");
  const [extensionSuccessMessage, setExtensionSuccessMessage] = useState("");
  const [isUploadingExtension, setIsUploadingExtension] = useState(false);
  const [extensionUploadVersion, setExtensionUploadVersion] = useState("");
  const [extensionUploadFile, setExtensionUploadFile] = useState<File | null>(null);

  async function loadExtensionBuilds() {
    const build = await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds");
    setExtensionBuild(build);
  }

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      setLoadErrorMessage("");

      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);
        setProfileForm({
          name: me.name,
          email: me.email,
        });
        await loadExtensionBuilds();
      } catch (error) {
        setLoadErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat profil akun.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileErrorMessage("");
    setProfileSuccessMessage("");
    setPasswordErrorMessage("");
    setPasswordSuccessMessage("");
    setIsSavingProfile(true);

    try {
      const updatedUser = await apiFetch<CurrentUser>("/auth/me", {
        method: "PATCH",
        body: {
          name: profileForm.name,
          email: profileForm.email,
        },
      });
      setCurrentUser(updatedUser);
      setProfileForm({
        name: updatedUser.name,
        email: updatedUser.email,
      });
      setProfileSuccessMessage("Profil akun berhasil diperbarui.");
    } catch (error) {
      setProfileErrorMessage(
        error instanceof Error ? error.message : "Gagal memperbarui profil akun.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSavePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordErrorMessage("");
    setPasswordSuccessMessage("");
    setProfileErrorMessage("");
    setProfileSuccessMessage("");

    if (passwordForm.new_password !== confirmPassword) {
      setPasswordErrorMessage("Confirm password harus sama dengan password baru.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const updatedUser = await apiFetch<CurrentUser>("/auth/change-password", {
        method: "POST",
        body: passwordForm,
      });
      setCurrentUser(updatedUser);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setConfirmPassword("");
      setPasswordSuccessMessage("Password akun berhasil diperbarui.");
    } catch (error) {
      setPasswordErrorMessage(
        error instanceof Error ? error.message : "Gagal memperbarui password akun.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleUploadExtensionBuild(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setExtensionErrorMessage("");
    setExtensionSuccessMessage("");

    if (!extensionUploadFile) {
      setExtensionErrorMessage("Pilih file extension .zip atau .crx dulu.");
      return;
    }

    if (extensionUploadVersion.trim().length < 2) {
      setExtensionErrorMessage("Versi extension wajib diisi.");
      return;
    }

    setIsUploadingExtension(true);

    try {
      const formData = new FormData();
      formData.set("version", extensionUploadVersion.trim());
      formData.set("file", extensionUploadFile);

      await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds", {
        method: "POST",
        body: formData,
      });

      await loadExtensionBuilds();
      setExtensionUploadFile(null);
      setExtensionUploadVersion("");
      setExtensionSuccessMessage("Package extension berhasil diupload.");
    } catch (error) {
      setExtensionErrorMessage(
        error instanceof Error ? error.message : "Gagal upload package extension.",
      );
    } finally {
      setIsUploadingExtension(false);
    }
  }

  const passwordStrength = getPasswordStrength(passwordForm.new_password);
  const canManageExtensionBuilds = canAccessAdminPages(currentUser?.role);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Account profile"
      title="Profile"
      description="Kelola identitas akun aktif dan perbarui password dari satu halaman."
      backHref="/workspace"
      backLabel="Kembali ke beranda"
    >
      <div className="space-y-6">
        {isLoading ? (
          <section className="clara-empty-state text-sm text-[#d6bb84]">
            Loading profile...
          </section>
        ) : null}

        {loadErrorMessage ? (
          <section className="clara-alert clara-alert-danger">
            {loadErrorMessage}
          </section>
        ) : null}

        {currentUser && !isLoading && !loadErrorMessage ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <ProfileStat
                icon={faUser}
                label="Nama Akun"
                value={currentUser.name}
                hint="Nama yang sedang dipakai di workspace."
              />
              <ProfileStat
                icon={faEnvelope}
                label="Email"
                value={currentUser.email}
                hint="Email login untuk akun ini."
              />
              <ProfileStat
                icon={faBuildingShield}
                label="Role"
                value={getRoleDisplayLabel(currentUser.role)}
                hint={currentUser.is_active ? "Akun aktif" : "Akun tidak aktif"}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_0.95fr]">
              <Panel title="Edit Profile" eyebrow="Identity">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {profileErrorMessage ? (
                    <div className="rounded-2xl border border-[#7a5520]/18 bg-[#38250f] px-4 py-3 text-sm text-[#e1c27c]">
                      {profileErrorMessage}
                    </div>
                  ) : null}

                  {profileSuccessMessage ? (
                    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[#20170f] px-4 py-3 text-sm text-[#f0cb73]">
                      {profileSuccessMessage}
                    </div>
                  ) : null}

                  <InputField
                    label="Nama lengkap"
                    value={profileForm.name ?? ""}
                    onChange={(value) =>
                      setProfileForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Nama akun"
                  />
                  <InputField
                    label="Email"
                    value={profileForm.email ?? ""}
                    onChange={(value) =>
                      setProfileForm((current) => ({ ...current, email: value }))
                    }
                    placeholder="email@company.com"
                    type="email"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ProfileField
                      label="Role"
                      value={getRoleDisplayLabel(currentUser.role)}
                    />
                    <ProfileField
                      label="Dibuat pada"
                      value={formatDateTime(currentUser.created_at)}
                    />
                    <ProfileField
                      label="Organization"
                      value={currentUser.organization_name ?? "-"}
                    />
                    <ProfileField
                      label="Sales Team"
                      value={currentUser.team_name ?? "-"}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_12px_28px_rgba(0,0,0,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
              </Panel>

              <Panel title="Update Password" eyebrow="Security">
                <form onSubmit={handleSavePassword} className="space-y-4">
                  {passwordErrorMessage ? (
                    <div className="rounded-2xl border border-[#7a5520]/18 bg-[#38250f] px-4 py-3 text-sm text-[#e1c27c]">
                      {passwordErrorMessage}
                    </div>
                  ) : null}

                  {passwordSuccessMessage ? (
                    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[#20170f] px-4 py-3 text-sm text-[#f0cb73]">
                      {passwordSuccessMessage}
                    </div>
                  ) : null}

                  <InputField
                    label="Current Password"
                    value={passwordForm.current_password}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        current_password: value,
                      }))
                    }
                    placeholder="Password saat ini"
                    type="password"
                  />
                  <InputField
                    label="New Password"
                    value={passwordForm.new_password}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        new_password: value,
                      }))
                    }
                    placeholder="Minimum 8 karakter"
                    type="password"
                  />
                  <InputField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Ulangi password baru"
                    type="password"
                  />

                  <PasswordStrengthHint strength={passwordStrength} />

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#e1c27c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingPassword ? "Saving..." : "Update Password"}
                  </button>
                </form>
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
              <Panel title="Clara Extension" eyebrow="Distribution">
                {extensionErrorMessage ? (
                  <div className="rounded-2xl border border-[#7a5520]/18 bg-[#38250f] px-4 py-3 text-sm text-[#e1c27c]">
                    {extensionErrorMessage}
                  </div>
                ) : null}

                {extensionSuccessMessage ? (
                  <div className="rounded-2xl border border-[#f0cb73]/18 bg-[#20170f] px-4 py-3 text-sm text-[#f0cb73]">
                    {extensionSuccessMessage}
                  </div>
                ) : null}

                <article
                  data-onboarding-id="profile-extension-download"
                  className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8d6737]">
                        Package Global
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#fff0c9]">
                        {extensionBuild?.available
                          ? extensionBuild.version || "Tanpa versi"
                          : "Belum ada package"}
                      </p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                      <FontAwesomeIcon icon={faCloudArrowDown} className="h-4 w-4" />
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#d6bb84]">
                    {extensionBuild?.available
                      ? `File: ${extensionBuild.file_name ?? "-"}`
                      : "Superadmin belum upload package extension global."}
                  </p>
                  <p className="mt-2 text-xs text-[#b89a62]">
                    {extensionBuild?.uploaded_at
                      ? `Upload: ${formatDateTime(extensionBuild.uploaded_at)} • ${extensionBuild.uploaded_by_email ?? "-"}`
                      : "Begitu package global diupload, semua role akan download file yang sama dari sini."}
                  </p>

                  {extensionBuild?.available ? (
                    <a
                      href="/api/dashboard/extension-builds/download"
                      className="mt-4 inline-flex rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08]"
                    >
                      Download Extension
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex rounded-full border border-[#3c2c16] bg-[#22190f] px-4 py-2.5 text-sm font-semibold text-[#8d6737] disabled:cursor-not-allowed"
                    >
                      Belum bisa didownload
                    </button>
                  )}
                </article>
              </Panel>

              {canManageExtensionBuilds ? (
                <Panel
                  title="Upload Extension Package"
                  eyebrow="Admin Only"
                  onboardingId="profile-extension-upload"
                >
                  <form onSubmit={handleUploadExtensionBuild} className="space-y-4">
                    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.92)_0%,rgba(18,13,10,0.92)_100%)] p-4 text-sm leading-6 text-[#d6bb84]">
                      Superadmin upload sekali untuk semua user. File lama langsung tergantikan dan semua role akan download package yang sama.
                    </div>

                    <InputField
                      label="Versi package"
                      value={extensionUploadVersion}
                      onChange={setExtensionUploadVersion}
                      placeholder="Contoh: v0.1.2"
                    />

                    <div>
                      <label className="text-sm font-semibold text-[#fff0c9]">File extension</label>
                      <input
                        accept=".zip,.crx"
                        onChange={(event) =>
                          setExtensionUploadFile(event.target.files?.[0] ?? null)
                        }
                        type="file"
                        className="mt-2 block w-full rounded-2xl border border-[#f0cb73]/20 bg-[#17120d]/90 px-4 py-3 text-sm text-[#f7e7b7] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#f0cb73] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#140f08]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isUploadingExtension}
                      className="inline-flex items-center gap-2 rounded-full border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_12px_28px_rgba(0,0,0,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FontAwesomeIcon icon={faCloudArrowUp} className="h-4 w-4" />
                      {isUploadingExtension ? "Uploading..." : "Upload Package"}
                    </button>
                  </form>
                </Panel>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Panel({
  eyebrow,
  title,
  onboardingId,
  children,
}: {
  eyebrow: string;
  title: string;
  onboardingId?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-onboarding-id={onboardingId} className="clara-card rounded-[30px] p-6">
      <p className="clara-kicker text-xs">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: typeof faUser;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="clara-card rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          <p className="mt-3 text-xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft rounded-[22px] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8d6737]">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
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
      <label className="text-sm font-semibold text-[#fff0c9]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="mt-2 w-full rounded-2xl border border-[#f0cb73]/20 bg-[#17120d]/90 px-4 py-3 text-sm text-[#f7e7b7] outline-none focus:border-[#f0cb73]"
        placeholder={placeholder}
      />
    </div>
  );
}

function PasswordStrengthHint({
  strength,
}: {
  strength: ReturnType<typeof getPasswordStrength>;
}) {
  return (
    <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(33,24,17,0.92)_0%,rgba(18,13,10,0.92)_100%)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6737]">
          Password Strength
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            strength.label === "strong"
              ? "border border-[#f0cb73]/18 bg-[#f0cb73]/12 text-[#f7dfa2]"
              : strength.label === "medium"
                ? "border border-[#d3a74b]/18 bg-[#5c4015] text-[#f0cb73]"
                : "border border-[#7a5520]/18 bg-[#38250f] text-[#d6bb84]"
          }`}
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
                ? "border border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
                : "border border-[#3c2c16] bg-[#22190f] text-[#c8ad75]"
            }`}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}
