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
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(240,203,115,0.24),_transparent_65%)]" />
      <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(194,144,50,0.14),_transparent_70%)] blur-3xl" />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="clara-card-dark rounded-[34px] p-7 sm:p-8">
          <span className="clara-chip clara-chip-dark">SGB SCC</span>
          <h1 className="mt-5 max-w-xl text-4xl font-bold tracking-[-0.05em] text-white sm:text-3xl">
            Satu pintu untuk queue operasional, lead management, dan kontrol tim.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-200 sm:text-[15px]">
            Masuk ke Sales Command Center untuk memantau percakapan pelanggan,
            meninjau rekomendasi AI, dan menjaga workflow tim tetap rapi.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/7 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                Queue
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-100">
                Percakapan dan prioritas harian ada di satu alur kerja.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/7 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                AI Review
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-100">
                Draft balasan, analisis, dan approval lebih cepat dipindai.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/7 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cb73]">
                Governance
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-100">
                Role, knowledge, dan akses tetap terkendali.
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="clara-card rounded-[34px] p-6 sm:p-8"
        >
          <div>
            <p className="clara-kicker">Login Dashboard</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">
              Masuk ke workspace SCC
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Gunakan akun internal untuk membuka queue, review balasan AI, dan
              workspace operasional lainnya.
            </p>
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

          <p className="clara-helper mt-4">
            Kalau email belum terdaftar, minta {getRoleDisplayLabel("head")} atau{" "}
            {getRoleDisplayLabel("superadmin")} untuk membuatkan akun Anda terlebih dulu.
          </p>

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
