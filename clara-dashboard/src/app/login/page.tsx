"use client";

import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getRoleDisplayLabel } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

type LoginResponse = {
  token_type: string;
  user: CurrentUser;
};

type LoginOptionItem = {
  role: string;
  name: string;
  email: string;
};

type LoginOptionsResponse = {
  items: LoginOptionItem[];
};

function getDashboardPathForRole(role: string): string {
  switch (role) {
    case "sales":
    case "manager":
    case "head":
    case "superadmin":
    default:
      return "/workspace";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const superadminTapCountRef = useRef(0);
  const superadminTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loginOptions, setLoginOptions] = useState<LoginOptionItem[]>([]);
  const [isSuperadminMode, setIsSuperadminMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [superadminEmail, setSuperadminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleOptions = useMemo(
    () => Array.from(new Set(loginOptions.map((item) => item.role))),
    [loginOptions],
  );

  const emailOptions = useMemo(() => {
    if (!selectedRole) {
      return [];
    }

    return loginOptions.filter((item) => item.role === selectedRole);
  }, [loginOptions, selectedRole]);

  useEffect(() => {
    let isCancelled = false;

    async function loadLoginOptions() {
      setIsLoadingOptions(true);
      setErrorMessage("");

      try {
        const response = await apiFetch<LoginOptionsResponse>("/auth/login-options");
        if (isCancelled) {
          return;
        }

        setLoginOptions(response.items);
        const firstRole = response.items[0]?.role ?? "";
        setSelectedRole(firstRole);
        setSelectedEmail(
          response.items.find((item) => item.role === firstRole)?.email ?? "",
        );
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Gagal memuat daftar akun login.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingOptions(false);
        }
      }
    }

    void loadLoginOptions();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRole) {
      setSelectedEmail("");
      return;
    }

    const firstEmailForRole = emailOptions[0]?.email ?? "";
    const selectedEmailStillValid = emailOptions.some(
      (item) => item.email === selectedEmail,
    );

    if (!selectedEmailStillValid) {
      setSelectedEmail(firstEmailForRole);
    }
  }, [emailOptions, selectedEmail, selectedRole]);

  useEffect(() => {
    return () => {
      if (superadminTapTimerRef.current) {
        clearTimeout(superadminTapTimerRef.current);
      }
    };
  }, []);

  function handleHiddenSuperadminUnlock() {
    if (isSuperadminMode) {
      return;
    }

    superadminTapCountRef.current += 1;

    if (superadminTapTimerRef.current) {
      clearTimeout(superadminTapTimerRef.current);
    }

    if (superadminTapCountRef.current >= 5) {
      superadminTapCountRef.current = 0;
      setIsSuperadminMode(true);
      setErrorMessage("");
      setPassword("");
      return;
    }

    superadminTapTimerRef.current = setTimeout(() => {
      superadminTapCountRef.current = 0;
    }, 1800);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const resolvedEmail = isSuperadminMode
      ? superadminEmail.trim().toLowerCase()
      : selectedEmail.trim().toLowerCase();

    if (isSuperadminMode) {
      if (!resolvedEmail) {
        setErrorMessage("Email superadmin wajib diisi.");
        return;
      }
    } else {
      if (!selectedRole) {
        setErrorMessage("Role wajib dipilih.");
        return;
      }

      if (!selectedEmail) {
        setErrorMessage("Email wajib dipilih.");
        return;
      }
    }

    if (!password.trim()) {
      setErrorMessage("Password wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
          email: resolvedEmail,
          password,
        },
      });

      router.push(getDashboardPathForRole(response.user.role));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-lg">
        <form
          onSubmit={handleSubmit}
          className="clara-card rounded-[34px] p-6 sm:p-8"
        >
          <div>
            <p
              className="clara-kicker cursor-default select-none"
              onClick={handleHiddenSuperadminUnlock}
            >
              Login Dashboard
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">
              Selamat datang di Clara Dashboard!
            </h2>
            {/* <p className="mt-3 text-sm leading-6 text-slate-600">
              Gunakan akun internal untuk membuka queue, review balasan AI, dan
              workspace operasional lainnya.
            </p> */}
          </div>

          <div className="mt-6 space-y-4">
            {isSuperadminMode ? (
              <div>
                <label className="clara-label">Email Superadmin</label>
                <input
                  value={superadminEmail}
                  onChange={(event) => setSuperadminEmail(event.target.value)}
                  type="email"
                  className="clara-input mt-2"
                  placeholder="Masukkan email superadmin"
                  autoComplete="username"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsSuperadminMode(false);
                    superadminTapCountRef.current = 0;
                    setSuperadminEmail("");
                    setErrorMessage("");
                  }}
                  className="mt-2 text-xs font-semibold text-[#8d6a29] hover:text-[#b8872f]"
                >
                  Kembali ke login role biasa
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="clara-label">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value)}
                    className="clara-input mt-2"
                    disabled={isLoadingOptions || roleOptions.length === 0}
                  >
                    <option value="">Pilih role dulu</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {getRoleDisplayLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="clara-label">Email</label>
                  <select
                    value={selectedEmail}
                    onChange={(event) => setSelectedEmail(event.target.value)}
                    className="clara-input mt-2"
                    disabled={
                      isLoadingOptions || !selectedRole || emailOptions.length === 0
                    }
                  >
                    <option value="">
                      {selectedRole ? "Pilih email sesuai role" : "Pilih role dulu"}
                    </option>
                    {emailOptions.map((item) => (
                      <option key={item.email} value={item.email}>
                        {item.email}
                      </option>
                    ))}
                  </select>
                  {selectedEmail ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Akun terpilih:{" "}
                      {emailOptions.find((item) => item.email === selectedEmail)?.name ??
                        selectedEmail}
                    </p>
                  ) : null}
                </div>
              </>
            )}

            <div>
              <label className="clara-label">Password</label>
              <div className="relative mt-2">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="clara-input pr-28"
                  placeholder="Masukkan password akun"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#d4b06a]/20 bg-[#17120d] text-[#cdb37a] hover:border-[#f0cb73]/34 hover:text-[#fff0c9]"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <FontAwesomeIcon icon={faEyeSlash} className="h-4 w-4" />
                  ) : (
                    <FontAwesomeIcon icon={faEye} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {errorMessage && (
            <p className="clara-alert clara-alert-danger mt-5">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isLoadingOptions}
            className="clara-button clara-button-primary mt-6 w-full"
          >
            {isLoadingOptions
              ? "Memuat akun..."
              : isSubmitting
                ? "Logging in..."
                : "Masuk ke Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
