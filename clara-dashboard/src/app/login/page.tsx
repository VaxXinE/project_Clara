"use client";

import { faEye, faEyeSlash } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

type LoginResponse = {
  token_type: string;
  user: CurrentUser;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSafeSsoReturnUrl(): string | null {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  const issuer = process.env.NEXT_PUBLIC_SSO_ISSUER;

  if (!returnTo || !issuer) {
    return null;
  }

  try {
    const target = new URL(returnTo);
    const allowedIssuer = new URL(issuer);
    const authorizePath = `${allowedIssuer.pathname.replace(/\/$/, "")}/oauth/authorize`;

    return target.origin === allowedIssuer.origin && target.pathname === authorizePath
      ? target.toString()
      : null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const resolvedEmail = email.trim().toLowerCase();
    const nextEmailError = !resolvedEmail
      ? "Isi email kamu."
      : !EMAIL_PATTERN.test(resolvedEmail)
        ? "Format email belum benar. Contoh: nama@perusahaan.com"
        : "";
    const nextPasswordError = password.trim() ? "" : "Isi password kamu.";

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      document
        .getElementById(nextEmailError ? "login-email" : "login-password")
        ?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email: resolvedEmail, password },
      });

      const ssoReturnUrl = getSafeSsoReturnUrl();
      if (ssoReturnUrl) {
        window.location.assign(ssoReturnUrl);
      } else {
        router.push("/workspace");
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Belum bisa masuk. Coba lagi.",
      );
      setPassword("");
      document.getElementById("login-password")?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="clara-card rounded-3xl p-6 sm:p-8"
        >
          <p className="clara-kicker">Masuk</p>
          <h1 className="clara-page-title mt-3">Selamat datang di Clara</h1>
          <p className="clara-helper mt-3 text-sm">
            Masuk dengan akun yang diberikan admin timmu.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="clara-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError("");
                }}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                className="clara-input mt-2"
                placeholder="nama@perusahaan.com"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "login-email-error" : undefined}
              />
              {emailError ? (
                <p
                  id="login-email-error"
                  className="mt-2 text-sm text-[var(--color-danger)]"
                >
                  {emailError}
                </p>
              ) : null}
            </div>

            <div>
              <label className="clara-label" htmlFor="login-password">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="login-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError("");
                  }}
                  type={showPassword ? "text" : "password"}
                  className="clara-input pr-14"
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? "login-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                  aria-pressed={showPassword}
                >
                  <FontAwesomeIcon
                    icon={showPassword ? faEyeSlash : faEye}
                    className="h-4 w-4"
                  />
                </button>
              </div>
              {passwordError ? (
                <p
                  id="login-password-error"
                  className="mt-2 text-sm text-[var(--color-danger)]"
                >
                  {passwordError}
                </p>
              ) : null}
            </div>
          </div>

          {formError ? (
            <p className="clara-alert clara-alert-danger mt-5" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="clara-button clara-button-primary mt-6 w-full"
          >
            {isSubmitting ? "Sedang masuk..." : "Masuk"}
          </button>

          <p className="clara-helper mt-5 text-center text-sm">
            Lupa password atau akun belum aktif? Hubungi admin tim kamu.
          </p>
        </form>
      </div>
    </main>
  );
}
