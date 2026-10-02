"use client";

import { useEffect, useId, useState } from "react";

import { ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatPasswordStrengthLabel, getPasswordStrength } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
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
  const [profileForm, setProfileForm] = useState<UpdateUserRequest>(EMPTY_PROFILE_FORM);
  const [passwordForm, setPasswordForm] = useState<ChangePasswordRequest>(EMPTY_PASSWORD_FORM);
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
    setExtensionBuild(await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds"));
  }

  async function loadProfile() {
    setLoadErrorMessage("");

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);
      setProfileForm({ name: me.name, email: me.email });
      await loadExtensionBuilds();
    } catch (error) {
      setLoadErrorMessage(error instanceof Error ? error.message : "Profil belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        body: { name: profileForm.name, email: profileForm.email },
      });
      setCurrentUser(updatedUser);
      setProfileForm({ name: updatedUser.name, email: updatedUser.email });
      setProfileSuccessMessage("Data akun sudah disimpan.");
    } catch (error) {
      setProfileErrorMessage(error instanceof Error ? error.message : "Data akun belum bisa disimpan. Coba lagi.");
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
      setPasswordErrorMessage("Kata sandi baru dan pengulangannya harus sama.");
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
      setPasswordSuccessMessage("Kata sandi sudah diganti.");
    } catch (error) {
      setPasswordErrorMessage(error instanceof Error ? error.message : "Kata sandi belum bisa diganti. Coba lagi.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleUploadExtensionBuild(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExtensionErrorMessage("");
    setExtensionSuccessMessage("");

    if (!extensionUploadFile) {
      setExtensionErrorMessage("Pilih berkas ekstensi (.zip atau .crx) dulu.");
      return;
    }

    if (extensionUploadVersion.trim().length < 2) {
      setExtensionErrorMessage("Isi nomor versi dulu.");
      return;
    }

    setIsUploadingExtension(true);

    try {
      const formData = new FormData();
      formData.set("version", extensionUploadVersion.trim());
      formData.set("file", extensionUploadFile);

      await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds", { method: "POST", body: formData });

      await loadExtensionBuilds();
      setExtensionUploadFile(null);
      setExtensionUploadVersion("");
      setExtensionSuccessMessage("Ekstensi baru sudah diunggah dan siap diunduh semua pengguna.");
    } catch (error) {
      setExtensionErrorMessage(error instanceof Error ? error.message : "Ekstensi belum bisa diunggah. Coba lagi.");
    } finally {
      setIsUploadingExtension(false);
    }
  }

  const passwordStrength = getPasswordStrength(passwordForm.new_password);
  const canManageExtensionBuilds = canAccessAdminPages(currentUser?.role);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.profile}
      description="Ubah data akunmu, ganti kata sandi, dan unduh Ekstensi Clara."
      backHref="/workspace"
      backLabel="Kembali ke beranda"
    >
      <div className="space-y-6">
        {isLoading ? <LoadingState message="Memuat profil..." /> : null}

        {!isLoading && loadErrorMessage ? <ErrorState message={loadErrorMessage} onRetry={() => void loadProfile()} /> : null}

        {currentUser && !isLoading && !loadErrorMessage ? (
          <>
            <section
              data-onboarding-id="profile-extension-download"
              aria-labelledby="profile-extension"
              className="clara-card space-y-3 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="profile-extension" className="text-xl font-bold clara-text-primary">
                  Ekstensi Clara untuk Chrome
                </h2>
                {extensionBuild?.available ? <Tag tone="good">Versi {extensionBuild.version || "-"}</Tag> : <Tag>Belum tersedia</Tag>}
              </div>
              <p className="text-sm leading-6 clara-text-secondary">
                Ekstensi membaca chat yang sedang kamu buka di halaman chat (misalnya WhatsApp Web) lalu mengirimnya ke Clara. Satu berkas yang sama dipakai semua pengguna.
              </p>
              {extensionErrorMessage ? (
                <div role="alert" className="clara-alert clara-alert-danger">
                  {extensionErrorMessage}
                </div>
              ) : null}
              {extensionSuccessMessage ? (
                <div role="status" className="clara-alert clara-alert-success">
                  {extensionSuccessMessage}
                </div>
              ) : null}
              {extensionBuild?.available ? (
                <>
                  <p className="text-xs clara-text-muted">
                    {extensionBuild.file_name ?? "Berkas ekstensi"}
                    {extensionBuild.uploaded_at ? ` · diunggah ${formatDateTime(extensionBuild.uploaded_at)}` : ""}
                    {extensionBuild.uploaded_by_email ? ` oleh ${extensionBuild.uploaded_by_email}` : ""}
                  </p>
                  <a href="/api/dashboard/extension-builds/download" className="clara-button clara-button-primary">
                    Unduh ekstensi
                  </a>
                </>
              ) : (
                <p className="text-sm clara-text-secondary">
                  Superadmin belum mengunggah ekstensi. Setelah diunggah, tombol unduh muncul di sini.
                </p>
              )}
            </section>

            <section aria-labelledby="profile-account" className="clara-card p-5 sm:p-6">
              <h2 id="profile-account" className="text-xl font-bold clara-text-primary">
                Data akun
              </h2>
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                {profileErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger">
                    {profileErrorMessage}
                  </div>
                ) : null}
                {profileSuccessMessage ? (
                  <div role="status" className="clara-alert clara-alert-success">
                    {profileSuccessMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Nama lengkap"
                    value={profileForm.name ?? ""}
                    onChange={(value) => setProfileForm((current) => ({ ...current, name: value }))}
                    placeholder="Nama kamu"
                    autoComplete="name"
                  />
                  <InputField
                    label="Email (untuk masuk)"
                    value={profileForm.email ?? ""}
                    onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))}
                    placeholder="nama@perusahaan.com"
                    type="email"
                    autoComplete="email"
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                  <ReadOnly label="Peran" value={getRoleDisplayLabel(currentUser.role)} />
                  <ReadOnly label="Organisasi" value={currentUser.organization_name ?? "-"} />
                  <ReadOnly label="Tim" value={currentUser.team_name ?? "-"} />
                  <ReadOnly label="Akun dibuat" value={formatDateTime(currentUser.created_at)} />
                </dl>

                <button type="submit" disabled={isSavingProfile} className="clara-button clara-button-primary">
                  {isSavingProfile ? "Menyimpan..." : "Simpan data akun"}
                </button>
              </form>
            </section>

            <section aria-labelledby="profile-password" className="clara-card p-5 sm:p-6">
              <h2 id="profile-password" className="text-xl font-bold clara-text-primary">
                Ganti kata sandi
              </h2>
              <form onSubmit={handleSavePassword} className="mt-4 space-y-4">
                {passwordErrorMessage ? (
                  <div role="alert" className="clara-alert clara-alert-danger">
                    {passwordErrorMessage}
                  </div>
                ) : null}
                {passwordSuccessMessage ? (
                  <div role="status" className="clara-alert clara-alert-success">
                    {passwordSuccessMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-3">
                  <InputField
                    label="Kata sandi sekarang"
                    value={passwordForm.current_password}
                    onChange={(value) => setPasswordForm((current) => ({ ...current, current_password: value }))}
                    placeholder="Kata sandi yang kamu pakai sekarang"
                    type="password"
                    autoComplete="current-password"
                  />
                  <InputField
                    label="Kata sandi baru"
                    value={passwordForm.new_password}
                    onChange={(value) => setPasswordForm((current) => ({ ...current, new_password: value }))}
                    placeholder="Minimal 8 karakter"
                    type="password"
                    autoComplete="new-password"
                  />
                  <InputField
                    label="Ulangi kata sandi baru"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Ketik ulang kata sandi baru"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>

                {passwordForm.new_password ? (
                  <div className="space-y-2" aria-live="polite">
                    <p className="text-sm clara-text-secondary">
                      Kekuatan:{" "}
                      <Tag tone={passwordStrength.label === "strong" ? "good" : passwordStrength.label === "medium" ? "warn" : "danger"}>
                        {formatPasswordStrengthLabel(passwordStrength.label)}
                      </Tag>
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {passwordStrength.checks.map((check) => (
                        <li key={check.label}>
                          <Tag tone={check.passed ? "good" : "neutral"}>
                            {check.passed ? "Sudah: " : "Belum: "}
                            {check.label}
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <button type="submit" disabled={isSavingPassword} className="clara-button clara-button-secondary">
                  {isSavingPassword ? "Menyimpan..." : "Ganti kata sandi"}
                </button>
              </form>
            </section>

            {canManageExtensionBuilds ? (
              <details data-onboarding-id="profile-extension-upload" className="clara-card p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                  Unggah versi baru ekstensi (khusus admin)
                </summary>
                <form onSubmit={handleUploadExtensionBuild} className="mt-3 space-y-4">
                  <p className="text-sm leading-6 clara-text-secondary">
                    Unggah sekali untuk semua pengguna. Berkas lama langsung tergantikan.
                  </p>
                  <InputField
                    label="Nomor versi"
                    value={extensionUploadVersion}
                    onChange={setExtensionUploadVersion}
                    placeholder="Contoh: v0.1.2"
                  />
                  <div>
                    <label htmlFor="extension-file" className="clara-label">
                      Berkas ekstensi (.zip atau .crx)
                    </label>
                    <input
                      id="extension-file"
                      accept=".zip,.crx"
                      onChange={(event) => setExtensionUploadFile(event.target.files?.[0] ?? null)}
                      type="file"
                      className="clara-file-input mt-2"
                    />
                  </div>
                  <button type="submit" disabled={isUploadingExtension} className="clara-button clara-button-primary">
                    {isUploadingExtension ? "Mengunggah..." : "Unggah ekstensi"}
                  </button>
                </form>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft min-w-0 p-3">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="clara-label">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        className="clara-input mt-2 w-full"
        placeholder={placeholder}
      />
    </div>
  );
}
