"use client";

import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { getRoleDisplayLabel } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

type LoginResponse = {
  token_type: string;
  user: CurrentUser;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

  const [email, setEmail] = useState("owner@clara.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    setErrorMessage("");

    if (!normalizedEmail) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage("Format email belum valid.");
      return;
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
          email: normalizedEmail,
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
            <p className="clara-kicker">Login Dashboard</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">
              Selamat datang di Clara Dashboard!
            </h2>
            {/* <p className="mt-3 text-sm leading-6 text-slate-600">
              Gunakan akun internal untuk membuka queue, review balasan AI, dan
              workspace operasional lainnya.
            </p> */}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="clara-label">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="clara-input mt-2"
                placeholder="owner@clara.local"
                autoComplete="email"
              />
            </div>

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
            disabled={isSubmitting}
            className="clara-button clara-button-primary mt-6 w-full"
          >
            {isSubmitting ? "Logging in..." : "Masuk ke Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
