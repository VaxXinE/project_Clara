"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
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

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Customer Directory"
      title="Customer List"
      description="Daftar ini dipakai untuk melihat semua customer yang sudah dikenali Clara. Dari sini user bisa cari customer, cek ringkasan singkatnya, lalu masuk ke detail customer."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Total Customer" value={String(customers.length)} />
          <MetricCard label="Customer Aktif" value={String(activeCount)} />
          <MetricCard label="Punya Hot Lead" value={String(hotCustomerCount)} />
        </section>

        <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_auto]">
            <label className="space-y-2 text-sm text-[#d8b977]">
              <span className="font-semibold text-[#fff0c9]">
                Cari Customer
              </span>
              <input
                value={filters.q}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, q: event.target.value }));
                }}
                className="w-full rounded-2xl border border-[#f0cb73]/18 bg-[rgba(20,14,10,0.92)] px-4 py-3 text-sm text-[#fff0c9] outline-none transition placeholder:text-[#a7864d] focus:border-[#f0cb73]/42"
                placeholder="Cari nama, telepon, email, atau PIC..."
              />
            </label>
            <label className="space-y-2 text-sm text-[#d8b977]">
              <span className="font-semibold text-[#fff0c9]">Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setFilters((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-[#f0cb73]/18 bg-[rgba(20,14,10,0.92)] px-4 py-3 text-sm text-[#fff0c9] outline-none transition focus:border-[#f0cb73]/42"
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak aktif</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilters({ q: "", status: "all" });
                }}
                className="inline-flex rounded-full border border-[#7a5520]/24 bg-[rgba(43,28,15,0.94)] px-5 py-3 text-sm font-semibold text-[#e1c27c] transition hover:bg-[#362312]"
              >
                Reset Filter
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] bg-[rgba(24,17,11,0.92)] px-4 py-3 text-sm text-[#f3d694]">
            Menampilkan <span className="font-semibold">{customers.length}</span>{" "}
            customer pada daftar ini.
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-8 text-center text-sm text-[#e5c98b]">
            Memuat daftar customer...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-[#9c4f28]/30 bg-[linear-gradient(180deg,rgba(68,39,17,0.94)_0%,rgba(44,27,15,0.96)_100%)] p-5 text-sm text-[#f3d694]">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <section className="space-y-4">
            {customers.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[#f0cb73]/24 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-8 text-center text-sm leading-7 text-[#d7bb7e]">
                Belum ada customer yang cocok dengan filter ini.
              </div>
            ) : (
              customers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(20,14,10,0.98)_46%,rgba(50,36,17,0.94)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#fff0c9]">
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
                          {" "}identity confidence
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[#d7bb7e]">
                        PIC:{" "}
                        <span className="font-medium text-[#fff0c9]">
                          {customer.assigned_user_name ?? "Belum ada"}
                        </span>
                        {" • "}Kontak terakhir:{" "}
                        <span className="font-medium text-[#fff0c9]">
                          {formatDateTime(customer.last_contact_at)}
                        </span>
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
                        label="Total lead"
                        value={String(customer.lead_count)}
                      />
                      <CompactMetric
                        label="Total conversation"
                        value={String(customer.conversation_count)}
                      />
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-5 py-3 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:brightness-105"
                      >
                        Lihat Detail Customer
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
    <div className="rounded-[24px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(29,21,15,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[#fff0c9]">{value}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[rgba(255,255,255,0.04)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#caa45c]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#fff0c9]">{value}</p>
    </div>
  );
}
