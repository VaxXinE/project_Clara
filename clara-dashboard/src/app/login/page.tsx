"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

type LoginResponse = {
  token_type: string;
  user: CurrentUser;
};

function getDashboardPathForRole(role: string): string {
  switch (role) {
    case "marketing":
      return "/dashboard";
    case "owner":
      return "/dashboard";
    case "admin":
    default:
      return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("owner@clara.local");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: {
          email,
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium text-slate-500">Clara</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Login Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Masuk untuk mengakses inbox operasional dan AI copilot.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-900">Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-600"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-900">
            Password
          </label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-600"
          />
        </div>

        {errorMessage && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
