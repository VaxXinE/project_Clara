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
          error instanceof Error ? error.message : "Gagal memuat daftar customer."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCustomers();
  }, [filters]);

  const activeCount = customers.filter((item) => item.status === "active").length;
  const hotCustomerCount = customers.filter((item) => item.hot_lead_count > 0).length;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Customer Directory"
      title="Customer List"
      description="Daftar ini dipakai untuk melihat semua customer yang sudah dikenali Clara. Dari sini user bisa cari customer, cek ringkasan singkatnya, lalu masuk ke detail customer."
    >
      <div className="space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#fff7ed_100%)] p-6 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                Direktori Customer
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Cari customer dari satu halaman, lalu buka detailnya saat butuh konteks lebih dalam.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Halaman ini cocok dipakai kalau tim sudah tahu nama customer atau ingin memastikan apakah satu customer punya beberapa lead aktif. Fokusnya bukan mengedit semua hal sekaligus, tetapi menemukan customer yang tepat lalu turun ke detailnya.
              </p>
            </div>
            <div className="rounded-[26px] bg-slate-950 p-5 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] lg:max-w-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/90">
                Cara Pakai
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-100">
                <li>1. Cari nama customer atau kontaknya.</li>
                <li>2. Lihat jumlah lead aktif dan hot lead.</li>
                <li>3. Tekan tombol detail kalau butuh konteks penuh.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Total Customer" value={String(customers.length)} />
          <MetricCard label="Customer Aktif" value={String(activeCount)} />
          <MetricCard label="Punya Hot Lead" value={String(hotCustomerCount)} />
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_auto]">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Cari Customer</span>
              <input
                value={filters.q}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, q: event.target.value }));
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                placeholder="Cari nama, telepon, email, atau PIC..."
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, status: event.target.value }));
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
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
                className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Reset Filter
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] bg-slate-950 px-4 py-3 text-sm text-slate-100">
            Menampilkan <span className="font-semibold">{customers.length}</span> customer pada daftar ini.
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Memuat daftar customer...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <section className="space-y-4">
            {customers.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-7 text-slate-500">
                Belum ada customer yang cocok dengan filter ini.
              </div>
            ) : (
              customers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">
                          {customer.display_name}
                        </h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            customer.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {customer.status === "active" ? "Aktif" : "Tidak aktif"}
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          {Math.round(customer.identity_confidence * 100)}% identity confidence
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        PIC: <span className="font-medium text-slate-900">{customer.assigned_user_name ?? "Belum ada"}</span>
                        {" • "}
                        Kontak terakhir:{" "}
                        <span className="font-medium text-slate-900">
                          {formatDateTime(customer.last_contact_at)}
                        </span>
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <CompactMetric label="Telepon" value={customer.phone ?? "Belum diisi"} />
                        <CompactMetric label="Email" value={customer.email ?? "Belum diisi"} />
                        <CompactMetric label="Lead aktif" value={String(customer.active_lead_count)} />
                        <CompactMetric label="Hot lead" value={String(customer.hot_lead_count)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {customer.source_labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-3 xl:w-56">
                      <CompactMetric label="Total lead" value={String(customer.lead_count)} />
                      <CompactMetric
                        label="Total conversation"
                        value={String(customer.conversation_count)}
                      />
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
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
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
