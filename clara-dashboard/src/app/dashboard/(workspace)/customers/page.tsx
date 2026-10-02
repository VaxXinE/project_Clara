"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Tag } from "@/components/dashboard/Tag";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import type { CurrentUser, CustomerProfileListItem } from "@/types/dashboard";

const VISIBLE_STEP = 20;

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
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const [reloadKey, setReloadKey] = useState(0);
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";
  const isLeadershipWorkspace = isManagerRole(currentUser?.role) || isHeadRole(currentUser?.role);

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
        setErrorMessage(error instanceof Error ? error.message : "Daftar customer belum bisa dimuat.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadCustomers();
  }, [filters, reloadKey]);

  const shown = customers.slice(0, visibleCount);
  const hiddenCount = customers.length - shown.length;
  const hasUsableData = customers.length > 0;
  const shouldRender = !isLoading && (!errorMessage || hasUsableData);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.customers}
      description={
        isSalesWorkspace
          ? "Customer yang sudah dikenali Clara. Buka profilnya untuk melihat lead dan percakapan mereka."
          : "Semua customer yang sudah dikenali Clara. Cari berdasarkan nama atau penanggung jawab, lalu buka profilnya."
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat daftar customer..." /> : null}

        {!isLoading && errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : null}

        {shouldRender ? (
          <section
            data-onboarding-id="sales-customers-filters"
            aria-label="Cari customer"
            className="clara-card space-y-3 p-4 sm:p-5"
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="customer-search" className="clara-label">
                  Cari customer
                </label>
                <input
                  id="customer-search"
                  type="search"
                  value={filters.q}
                  onChange={(event) => {
                    setVisibleCount(VISIBLE_STEP);
                    setFilters((prev) => ({ ...prev, q: event.target.value }));
                  }}
                  className="clara-input mt-2 w-full"
                  placeholder="Nama, telepon, email, atau penanggung jawab"
                />
              </div>
              <div>
                <label htmlFor="customer-status" className="clara-label">
                  Status
                </label>
                <select
                  id="customer-status"
                  value={filters.status}
                  onChange={(event) => {
                    setVisibleCount(VISIBLE_STEP);
                    setFilters((prev) => ({ ...prev, status: event.target.value }));
                  }}
                  className="clara-select mt-2 w-full"
                >
                  <option value="all">Semua</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Tidak aktif</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVisibleCount(VISIBLE_STEP);
                  setFilters({ q: "", status: "all" });
                }}
                className="clara-button clara-button-ghost"
              >
                Hapus filter
              </button>
            </div>

            <p role="status" aria-live="polite" className="text-sm clara-text-secondary">
              {customers.length} customer
            </p>
          </section>
        ) : null}

        {shouldRender ? (
          customers.length === 0 ? (
            <EmptyState
              title={filters.q || filters.status !== "all" ? "Tidak ada customer yang cocok" : "Belum ada customer"}
              description={
                filters.q || filters.status !== "all"
                  ? "Ubah kata pencarian atau pilih status lain."
                  : "Customer dibuat otomatis saat chat pertama dari mereka masuk ke Clara."
              }
              actionHref={!(filters.q || filters.status !== "all") && isSalesWorkspace ? "/upload" : undefined}
              actionLabel={!(filters.q || filters.status !== "all") && isSalesWorkspace ? "Masukkan chat" : undefined}
            />
          ) : (
            <section data-onboarding-id="sales-customers-list" aria-label="Daftar customer" className="space-y-3">
              <ul className="space-y-3">
                {shown.map((customer) => (
                  <li
                    key={customer.id}
                    className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="min-w-0 break-words text-base font-semibold clara-text-primary">
                            {customer.display_name}
                          </h2>
                          <Tag tone={customer.status === "active" ? "good" : "neutral"}>
                            {customer.status === "active" ? "Aktif" : "Tidak aktif"}
                          </Tag>
                          {customer.hot_lead_count > 0 ? (
                            <Tag tone="danger">{customer.hot_lead_count} lead panas</Tag>
                          ) : null}
                          {customer.identity_confidence < 0.5 ? (
                            <Tag tone="warn" title="Clara belum yakin data customer ini milik orang yang sama.">
                              Identitas perlu dicek
                            </Tag>
                          ) : null}
                        </div>

                        <p className="mt-2 text-sm clara-text-secondary">
                          {customer.active_lead_count} lead aktif · {customer.conversation_count} percakapan · terakhir
                          dihubungi {formatRelativeTime(customer.last_contact_at)}
                        </p>

                        <p className="mt-1 break-words text-xs clara-text-muted">
                          {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Kontak belum diisi"}
                          {isLeadershipWorkspace || !isSalesWorkspace
                            ? ` · Sales: ${customer.assigned_user_name ?? "belum ada"}`
                            : ""}
                        </p>

                        {customer.source_labels.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {customer.source_labels.map((label) => (
                              <Tag key={label}>{label}</Tag>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <Link href={`/customers/${customer.id}`} className="clara-button clara-button-primary shrink-0">
                        Buka profil
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + VISIBLE_STEP)}
                  className="clara-button clara-button-ghost"
                >
                  Tampilkan {Math.min(hiddenCount, VISIBLE_STEP)} customer lagi ({hiddenCount} tersisa)
                </button>
              ) : null}
            </section>
          )
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
