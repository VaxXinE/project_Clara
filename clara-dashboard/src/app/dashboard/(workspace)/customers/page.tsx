"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import type {
  CurrentUser,
  CustomerProfileListItem,
} from "@/types/dashboard";

function buildCustomerListPath(filters: { q: string; status: string }) {
  const params = new URLSearchParams();
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default function CustomerListPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [customers, setCustomers] = useState<CustomerProfileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "all" });
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;

  useEffect(() => {
    async function loadCustomers() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [me, items] = await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<CustomerProfileListItem[]>(buildCustomerListPath(filters)),
        ]);
        setCurrentUser(me);
        setCustomers(items);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat daftar customer.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCustomers();
  }, [filters]);

  const activeCount = customers.filter((item) => item.status === "active").length;
  const hotCustomerCount = customers.filter(
    (item) => item.hot_lead_count > 0,
  ).length;
  const customersWithRecentActivity = customers.filter((item) => item.last_contact_at).length;
  const topCustomer = [...customers]
    .sort((left, right) => {
      const rightScore =
        right.hot_lead_count * 100 +
        right.active_lead_count * 10 +
        new Date(right.last_contact_at ?? 0).getTime() / 1_000_000_000;
      const leftScore =
        left.hot_lead_count * 100 +
        left.active_lead_count * 10 +
        new Date(left.last_contact_at ?? 0).getTime() / 1_000_000_000;
      return rightScore - leftScore;
    })[0] ?? null;
  const customersNeedingAttention = customers.filter(
    (item) => item.hot_lead_count > 0 || item.active_lead_count > 2,
  ).length;
  const pageTitle = isSalesWorkspace
    ? "Daftar Customer"
    : isLeadershipWorkspace
      ? "Customer Monitor"
      : "Customer List";
  const pageDescription = isSalesWorkspace
    ? "Halaman ini dipakai untuk melihat customer yang sudah dikenali Clara, lalu masuk ke profil atau lead yang paling relevan tanpa harus cari manual dari awal."
    : isLeadershipWorkspace
      ? "Halaman manager untuk membaca customer mana yang punya aktivitas tinggi, hot lead, atau beban follow-up paling padat, lalu turun ke profil customer saat memang perlu."
      : "Daftar ini dipakai untuk melihat semua customer yang sudah dikenali Clara. Dari sini user bisa cari customer, cek ringkasan singkatnya, lalu masuk ke detail customer.";
  const topCustomerSummary = topCustomer
    ? isLeadershipWorkspace
      ? `${topCustomer.display_name} sekarang paling layak dicek karena punya ${topCustomer.active_lead_count} lead aktif dan ${topCustomer.hot_lead_count} hot lead. Mulai dari profil customer, lalu lihat apakah owner dan ritme follow-up-nya sudah sehat.`
      : `Customer ini punya ${topCustomer.active_lead_count} lead aktif dan ${topCustomer.hot_lead_count} hot lead. Mulai dari profil customer, lalu turun ke lead atau percakapan yang paling relevan.`
    : isLeadershipWorkspace
      ? "Belum ada customer yang menonjol. Manager bisa pakai halaman ini untuk cari customer berdasarkan owner, status, atau intensitas aktivitas."
      : "Gunakan daftar ini untuk mencari customer berdasarkan nama, PIC, atau status, lalu buka profilnya untuk melihat lead terkait.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Daftar customer"
      title={pageTitle}
      description={pageDescription}
    >
      <div className="space-y-6">
        <section
          data-onboarding-id="sales-customers-hero"
          className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"
        >
          <article className="clara-card p-5 sm:p-6">
            <p className="clara-kicker text-xs">
              {isLeadershipWorkspace
                ? "Prioritas customer tim"
                : "Fokus customer sekarang"}
            </p>
            <h2 className="mt-2 break-words text-xl font-bold tracking-tight clara-text-primary sm:text-2xl">
              {topCustomer
                ? `${topCustomer.display_name} paling layak dibuka dulu.`
                : "Belum ada customer yang menonjol untuk diprioritaskan."}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 clara-text-secondary">
              {topCustomerSummary}
            </p>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Jumlah customer" value={String(customers.length)} />
            <MetricCard label="Customer aktif" value={String(activeCount)} />
            <MetricCard label="Punya hot lead" value={String(hotCustomerCount)} />
            <MetricCard
              label={
                isLeadershipWorkspace
                  ? "Perlu perhatian"
                  : "Pernah ada kontak"
              }
              value={String(
                isLeadershipWorkspace
                  ? customersNeedingAttention
                  : customersWithRecentActivity,
              )}
            />
          </div>
        </section>

        <section
          data-onboarding-id="sales-customers-filters"
          className="clara-card p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_auto]">
            <div>
              <label htmlFor="customer-search" className="clara-label">
                Cari Customer
              </label>
              <input
                id="customer-search"
                value={filters.q}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, q: event.target.value }));
                }}
                className="clara-input mt-2"
                placeholder="Cari nama, telepon, email, atau PIC..."
              />
            </div>
            <div>
              <label htmlFor="customer-status" className="clara-label">Status</label>
              <select
                id="customer-status"
                value={filters.status}
                onChange={(event) => {
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }));
                }}
                className="clara-select mt-2"
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak aktif</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilters({ q: "", status: "all" });
                }}
                className="clara-button clara-button-ghost"
              >
                Reset Filter
              </button>
            </div>
          </div>

          <div className="clara-card-soft mt-4 p-3 text-sm clara-text-secondary">
            Menampilkan <span className="font-semibold">{customers.length}</span>{" "}
            customer pada daftar ini.
            {isLeadershipWorkspace ? (
              <span className="ml-2 text-[#d2b57b]">
                Mulai dari customer yang punya hot lead atau lead aktif paling banyak.
              </span>
            ) : null}
          </div>
        </section>

        {isLoading ? (
          <div role="status" aria-live="polite" className="clara-empty-state">
            Memuat daftar customer...
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading ? (
          <section className="space-y-4">
            {customers.length === 0 ? (
              <div className="clara-empty-state text-sm leading-7">
                Belum ada customer yang cocok. Coba ubah pencarian atau status.
              </div>
            ) : (
              customers.map((customer, index) => (
                <article
                  key={customer.id}
                  data-onboarding-id={
                    index === 0 ? "sales-customers-list" : undefined
                  }
                  className="clara-card p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="min-w-0 break-words text-lg font-semibold clara-text-primary">
                          {customer.display_name}
                        </h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            customer.status === "active"
                              ? "bg-emerald-500/14 text-emerald-200"
                              : "bg-white/8 text-[#d7bb7e]"
                          }`}
                        >
                          {customer.status === "active" ? "Aktif" : "Tidak aktif"}
                        </span>
                        <span className="rounded-full bg-[#f0cb73]/12 px-3 py-1 text-xs font-semibold text-[#f3d694]">
                          {Math.round(customer.identity_confidence * 100)}%
                          {" "}keyakinan identitas
                        </span>
                        {isLeadershipWorkspace ? (
                          <span className="rounded-full border border-[#f0cb73]/18 bg-[#2b2013] px-3 py-1 text-xs font-semibold text-[#f0cb73]">
                            {customer.hot_lead_count > 0
                              ? "Butuh perhatian"
                              : customer.active_lead_count > 2
                                ? "Beban aktif tinggi"
                                : "Relatif stabil"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 break-words text-sm leading-6 clara-text-secondary">
                        PIC:{" "}
                        <span className="font-medium clara-text-primary">
                          {customer.assigned_user_name ?? "Belum ada"}
                        </span>
                        {" • "}Kontak terakhir:{" "}
                        <span className="font-medium clara-text-primary">
                          {formatDateTime(customer.last_contact_at)}
                        </span>
                      </p>
                      <p className="mt-3 text-sm leading-6 clara-text-secondary">
                        {customer.hot_lead_count > 0
                          ? isLeadershipWorkspace
                            ? `Customer ini sedang terkait dengan ${customer.hot_lead_count} hot lead. Manager cukup cek apakah owner, ritme follow-up, dan arah lead-nya masih sehat.`
                            : `Customer ini sedang terkait dengan ${customer.hot_lead_count} hot lead. Cocok dibuka dulu kalau tim butuh konteks follow-up yang lebih dekat ke closing.`
                          : customer.active_lead_count > 0
                            ? isLeadershipWorkspace
                              ? `Customer ini masih punya ${customer.active_lead_count} lead aktif. Buka profilnya untuk lihat apakah eksekusi sales tersebar rapi atau mulai menumpuk.`
                              : `Customer ini masih punya ${customer.active_lead_count} lead aktif. Buka profilnya untuk lihat lead mana yang paling perlu ditindak.`
                            : "Customer ini belum punya sinyal panas. Cocok dibuka kalau Anda ingin rapikan identitas atau cek histori relasinya."}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CompactMetric
                          label="Telepon"
                          value={customer.phone ?? "Belum diisi"}
                        />
                        <CompactMetric
                          label="Email"
                          value={customer.email ?? "Belum diisi"}
                        />
                        <CompactMetric
                          label="Lead aktif"
                          value={String(customer.active_lead_count)}
                        />
                        <CompactMetric
                          label="Hot lead"
                          value={String(customer.hot_lead_count)}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {customer.source_labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-white/7 px-3 py-1 text-xs font-semibold text-[#e5c98b]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-3 xl:w-56">
                      <CompactMetric
                        label={isLeadershipWorkspace ? "Total lead tim" : "Total lead"}
                        value={String(customer.lead_count)}
                      />
                      <CompactMetric
                        label={
                          isLeadershipWorkspace
                            ? "Total conversation"
                            : "Total conversation"
                        }
                        value={String(customer.conversation_count)}
                      />
                      {isLeadershipWorkspace ? (
                        <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[rgba(255,255,255,0.04)] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#caa45c]">
                            Fokus manager
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#fff0c9]">
                            {customer.hot_lead_count > 0
                              ? "Cek hot lead dan owner."
                              : customer.active_lead_count > 2
                                ? "Cek beban follow-up."
                                : "Validasi data customer."}
                          </p>
                        </div>
                      ) : null}
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="clara-button clara-button-primary"
                      >
                        {isLeadershipWorkspace
                          ? "Buka Monitor Customer"
                          : "Buka Profil Customer"}
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft p-4">
      <p className="text-sm clara-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold clara-text-primary">{value}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft min-w-0 p-4">
      <p className="text-xs font-semibold clara-text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold clara-text-primary">{value}</p>
    </div>
  );
}
