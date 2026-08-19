"use client";

import {
  faArrowLeft,
  faCircleCheck,
  faClock,
  faFilter,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CurrentUser, ProductFactItem } from "@/types/dashboard";

const FACT_KEYS = [
  "account.minimum_opening_amount",
  "account.minimum_lot",
  "account.eligible_products",
  "account.currency",
  "trading.spread",
  "trading.commission",
  "trading.margin",
  "trading.swap",
  "trading.rollover",
  "trading.storage_fee",
  "trading.overnight_requirement",
  "trading.instruments",
  "company.regulatory_status",
  "company.regulator",
  "company.license_reference",
  "process.initial_data",
  "process.kyc_requirements",
  "process.verification_steps",
  "process.activation_steps",
  "process.funding_steps",
  "process.withdrawal_steps",
  "promotion.current_terms",
] as const;

const EMPTY_FORM = {
  organization_id: null as string | null,
  fact_key: FACT_KEYS[0] as (typeof FACT_KEYS)[number],
  account_category: "global",
  product_code: "",
  value_type: "text",
  value: "",
  unit: "",
  source_type: "manual_verified",
  source_reference: "",
  freshness_class: "MEDIUM_VOLATILITY",
  effective_from: "",
  effective_until: "",
};

function displayValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function statusTone(status: string) {
  if (["ACTIVE", "FRESH"].includes(status))
    return "border-[var(--color-success)] bg-[var(--color-success-surface)] text-[var(--color-success)]";
  if (["REVOKED", "CONFLICT"].includes(status))
    return "border-[var(--color-danger)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]";
  if (["EXPIRED", "STALE"].includes(status))
    return "border-[var(--color-warning)] bg-[var(--color-warning-surface)] text-[var(--color-warning)]";
  return "border-[var(--color-border-default)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]";
}

export default function ProductFactsPage() {
  const [items, setItems] = useState<ProductFactItem[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canGovern = me?.role === "head" || me?.role === "superadmin";

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery =
          `${item.fact_key} ${item.product_code ?? ""} ${displayValue(item.value)}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (statusFilter === "ALL" || item.lifecycle_status === statusFilter)
        );
      }),
    [items, query, statusFilter],
  );
  const selected =
    filteredItems.find((item) => item.id === selectedId) ??
    filteredItems[0] ??
    null;

  async function load() {
    const [user, facts] = await Promise.all([
      apiFetch<CurrentUser>("/auth/me"),
      apiFetch<ProductFactItem[]>("/product-facts"),
    ]);
    setMe(user);
    setItems(facts);
    setSelectedId((current) =>
      facts.some((item) => item.id === current)
        ? current
        : (facts[0]?.id ?? null),
    );
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        await load();
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Gagal memuat fakta.",
        );
      }
    }
    void bootstrap();
  }, []);

  function parseValue() {
    if (form.value_type === "integer") return Number.parseInt(form.value, 10);
    if (form.value_type === "decimal") return Number.parseFloat(form.value);
    if (form.value_type === "boolean") return form.value === "true";
    if (form.value_type === "json") return JSON.parse(form.value);
    return form.value;
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setMessage("");
    setEditorOpen(true);
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    setMessage("");
    try {
      await apiFetch<ProductFactItem>("/product-facts/drafts", {
        method: "POST",
        body: {
          ...form,
          product_code: form.product_code || null,
          value: parseValue(),
          unit: form.unit || null,
          effective_from: form.effective_from || null,
          effective_until: form.effective_until || null,
          last_verified_at: null,
          source_hash: null,
          sensitivity_class: "CUSTOMER_SAFE",
          organization_id:
            me?.role === "superadmin"
              ? form.organization_id
              : me?.organization_id,
        },
      });
      setForm(EMPTY_FORM);
      setEditorOpen(false);
      setMessage("Draft fakta berhasil dibuat.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal membuat draft.",
      );
    } finally {
      setBusy("");
    }
  }

  function startRevision(item: ProductFactItem) {
    setForm({
      organization_id: item.organization_id,
      fact_key: item.fact_key as typeof form.fact_key,
      account_category: item.account_category,
      product_code: item.product_code ?? "",
      value_type: item.value_type,
      value:
        item.value_type === "json"
          ? JSON.stringify(item.value, null, 2)
          : String(item.value),
      unit: item.unit ?? "",
      source_type: item.source_type,
      source_reference: item.source_reference,
      freshness_class: item.freshness_class,
      effective_from: "",
      effective_until: "",
    });
    setMessage(`Fakta ${item.fact_key} disalin sebagai revisi baru.`);
    setEditorOpen(true);
  }

  async function transition(item: ProductFactItem, action: string) {
    if (
      action === "revoke" &&
      !window.confirm(
        `Nonaktifkan ${item.fact_key} revisi ${item.revision}? Histori tetap tersimpan.`,
      )
    )
      return;
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      await apiFetch<ProductFactItem>(`/product-facts/${item.id}/${action}`, {
        method: "POST",
      });
      setMessage(
        action === "revoke"
          ? "Fakta dinonaktifkan dan tidak lagi dipakai Clara."
          : `Fakta berhasil di-${action}.`,
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Aksi lifecycle gagal.",
      );
    } finally {
      setBusy("");
    }
  }

  const editor = (
    <form onSubmit={createDraft} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-5 sm:p-6">
        <div>
          <p className="clara-kicker">Product fact</p>
          <h2 className="clara-section-title mt-2">Buat revisi draft</h2>
          <p className="clara-helper mt-1">
            Perubahan baru aktif setelah melewati approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-muted)]"
          aria-label="Tutup editor"
        >
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
        </button>
      </div>
      <div className="clara-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
        <label className="block">
          <span className="clara-label">Fact key</span>
          <select
            className="clara-select mt-2"
            value={form.fact_key}
            onChange={(event) =>
              setForm({
                ...form,
                fact_key: event.target.value as typeof form.fact_key,
              })
            }
          >
            {FACT_KEYS.map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="clara-label">Scope akun</span>
            <select
              className="clara-select mt-2"
              value={form.account_category}
              onChange={(event) =>
                setForm({ ...form, account_category: event.target.value })
              }
            >
              <option value="global">global</option>
              <option value="mini">mini</option>
              <option value="regular">regular</option>
            </select>
          </label>
          <label>
            <span className="clara-label">Product code</span>
            <input
              className="clara-input mt-2"
              value={form.product_code}
              onChange={(event) =>
                setForm({ ...form, product_code: event.target.value })
              }
              placeholder="Opsional"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="clara-label">Jenis nilai</span>
            <select
              className="clara-select mt-2"
              value={form.value_type}
              onChange={(event) =>
                setForm({ ...form, value_type: event.target.value })
              }
            >
              <option value="text">text</option>
              <option value="integer">integer</option>
              <option value="decimal">decimal</option>
              <option value="boolean">boolean</option>
              <option value="date">date</option>
              <option value="json">json</option>
            </select>
          </label>
          <label>
            <span className="clara-label">Unit</span>
            <input
              className="clara-input mt-2"
              value={form.unit}
              onChange={(event) =>
                setForm({ ...form, unit: event.target.value })
              }
              placeholder="Contoh: USD"
            />
          </label>
        </div>
        <label className="block">
          <span className="clara-label">Nilai</span>
          <textarea
            required
            className="clara-input clara-scrollbar mt-2 min-h-32 font-mono text-sm"
            value={form.value}
            onChange={(event) =>
              setForm({ ...form, value: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="clara-label">Referensi sumber</span>
          <input
            required
            className="clara-input mt-2"
            value={form.source_reference}
            onChange={(event) =>
              setForm({ ...form, source_reference: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="clara-label">Freshness</span>
          <select
            className="clara-select mt-2"
            value={form.freshness_class}
            onChange={(event) =>
              setForm({ ...form, freshness_class: event.target.value })
            }
          >
            <option>HIGH_VOLATILITY</option>
            <option>MEDIUM_VOLATILITY</option>
            <option>LOW_VOLATILITY</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="clara-label">Efektif mulai</span>
            <input
              type="datetime-local"
              className="clara-input mt-2"
              value={form.effective_from}
              onChange={(event) =>
                setForm({ ...form, effective_from: event.target.value })
              }
            />
          </label>
          <label>
            <span className="clara-label">Efektif sampai</span>
            <input
              type="datetime-local"
              className="clara-input mt-2"
              value={form.effective_until}
              onChange={(event) =>
                setForm({ ...form, effective_until: event.target.value })
              }
            />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--color-border-subtle)] p-5">
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          className="clara-button clara-button-ghost"
        >
          Batal
        </button>
        <button
          disabled={busy === "create"}
          className="clara-button clara-button-primary"
        >
          {busy === "create" ? "Menyimpan..." : "Simpan draft"}
        </button>
      </div>
    </form>
  );

  return (
    <WorkspaceShell
      currentUser={me}
      eyebrow="Product fact governance"
      title="Product Fact Registry"
      description="Kelola fakta customer-facing dengan sumber, freshness, dan lifecycle yang bisa diaudit."
      backHref="/knowledge"
      backLabel="Knowledge Base"
      actions={
        <Link className="clara-button clara-button-ghost" href="/knowledge">
          Semua Knowledge
        </Link>
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="clara-alert clara-alert-danger" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="clara-alert clara-alert-success" role="status">
            {message}
          </div>
        ) : null}

        <section className="clara-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap gap-3">
              <label className="relative min-w-[220px] flex-1">
                <span className="sr-only">Cari product fact</span>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <input
                  className="clara-input pl-11"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari fact key, product, atau nilai..."
                />
              </label>
              <label className="relative min-w-[190px]">
                <span className="sr-only">Filter status lifecycle</span>
                <FontAwesomeIcon
                  icon={faFilter}
                  className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <select
                  className="clara-select pl-11"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">Semua status</option>
                  <option>DRAFT</option>
                  <option>APPROVED</option>
                  <option>ACTIVE</option>
                  <option>EXPIRED</option>
                  <option>REVOKED</option>
                </select>
              </label>
            </div>
            {canGovern ? (
              <button
                type="button"
                className="clara-button clara-button-primary"
                onClick={openCreate}
              >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" /> Fact baru
              </button>
            ) : null}
          </div>
        </section>

        <div className="grid min-h-[650px] gap-5 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_250px]">
          <section
            className={`clara-card overflow-hidden rounded-2xl ${showDetail ? "hidden lg:block" : "block"}`}
            aria-label="Daftar product fact"
          >
            <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
              <p className="font-semibold">Registry</p>
              <p className="clara-helper mt-1 tabular-nums">
                {filteredItems.length} dari {items.length} fakta
              </p>
            </div>
            <div className="clara-scrollbar max-h-[650px] space-y-2 overflow-y-auto p-3">
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setShowDetail(true);
                    }}
                    aria-current={selected?.id === item.id ? "true" : undefined}
                    className={`w-full rounded-xl border p-4 text-left ${selected?.id === item.id ? "border-[var(--color-accent)] bg-[var(--color-surface-muted)]" : "border-transparent hover:bg-[var(--color-surface-base)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold">
                        {item.fact_key}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone(item.lifecycle_status)}`}
                      >
                        {item.lifecycle_status}
                      </span>
                    </div>
                    <p className="clara-text-secondary mt-2 line-clamp-2 break-words text-sm">
                      {displayValue(item.value)}
                    </p>
                    <p className="clara-text-muted mt-3 text-xs">
                      {item.account_category}
                      {item.product_code ? ` · ${item.product_code}` : ""} · rev{" "}
                      <span className="tabular-nums">{item.revision}</span>
                    </p>
                  </button>
                ))
              ) : (
                <div className="clara-empty-state text-sm">
                  Tidak ada fakta yang cocok.
                </div>
              )}
            </div>
          </section>

          <section
            className={`clara-card min-w-0 rounded-2xl ${showDetail ? "block" : "hidden lg:block"}`}
          >
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-5 sm:p-6">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="clara-text-secondary mb-4 flex min-h-11 items-center gap-2 text-sm lg:hidden"
                      onClick={() => setShowDetail(false)}
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" />{" "}
                      Kembali ke registry
                    </button>
                    <p className="clara-kicker">Fact detail</p>
                    <h2 className="mt-2 break-words text-xl font-bold sm:text-2xl">
                      {selected.fact_key}
                    </h2>
                    <p className="clara-text-muted mt-2 text-sm">
                      {selected.account_category}
                      {selected.product_code
                        ? ` · ${selected.product_code}`
                        : ""}{" "}
                      · revision{" "}
                      <span className="tabular-nums">{selected.revision}</span>
                    </p>
                  </div>
                  {canGovern ? (
                    <button
                      type="button"
                      className="clara-button clara-button-ghost"
                      onClick={() => startRevision(selected)}
                    >
                      <FontAwesomeIcon
                        icon={faPenToSquare}
                        className="h-4 w-4"
                      />{" "}
                      Buat revisi
                    </button>
                  ) : null}
                </div>
                <div className="space-y-6 p-5 sm:p-6">
                  <div>
                    <p className="clara-kicker">Nilai aktif</p>
                    <pre className="clara-panel-soft clara-scrollbar mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl p-5 font-mono text-sm leading-6">
                      {displayValue(selected.value)}
                    </pre>
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="clara-panel-soft rounded-xl p-4">
                      <dt className="clara-helper">Jenis / unit</dt>
                      <dd className="mt-1 font-semibold">
                        {selected.value_type}
                        {selected.unit ? ` · ${selected.unit}` : ""}
                      </dd>
                    </div>
                    <div className="clara-panel-soft rounded-xl p-4">
                      <dt className="clara-helper">Freshness</dt>
                      <dd className="mt-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(selected.freshness_status)}`}
                        >
                          {selected.freshness_status}
                        </span>
                      </dd>
                    </div>
                    <div className="clara-panel-soft rounded-xl p-4">
                      <dt className="clara-helper">Efektif mulai</dt>
                      <dd className="mt-1 text-sm tabular-nums">
                        {selected.effective_from
                          ? formatDateTime(selected.effective_from)
                          : "Sekarang"}
                      </dd>
                    </div>
                    <div className="clara-panel-soft rounded-xl p-4">
                      <dt className="clara-helper">Efektif sampai</dt>
                      <dd className="mt-1 text-sm tabular-nums">
                        {selected.effective_until
                          ? formatDateTime(selected.effective_until)
                          : "Tanpa batas"}
                      </dd>
                    </div>
                  </dl>
                  <div>
                    <p className="clara-kicker">Sumber terverifikasi</p>
                    <div className="mt-3 rounded-2xl border border-[var(--color-border-subtle)] p-4">
                      <p className="font-semibold">{selected.source_type}</p>
                      <p className="clara-text-secondary mt-2 break-all text-sm">
                        {selected.source_reference}
                      </p>
                    </div>
                  </div>
                  {selected.resolution_status === "CONFLICT" ||
                  selected.warnings.length ? (
                    <div className="clara-alert clara-alert-warning">
                      <p className="font-semibold">
                        <FontAwesomeIcon
                          icon={faTriangleExclamation}
                          className="mr-2 h-4 w-4"
                        />
                        Perlu ditinjau
                      </p>
                      {selected.warnings.map((warning) => (
                        <p key={warning} className="mt-1 text-sm">
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="clara-empty-state m-5">
                Pilih fakta untuk melihat detail.
              </div>
            )}
          </section>

          <aside className="clara-card hidden h-fit rounded-2xl p-5 xl:block">
            <p className="clara-kicker">Lifecycle</p>
            <h2 className="clara-card-title mt-2">Status governance</h2>
            {selected ? (
              <div className="mt-5 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${statusTone(selected.lifecycle_status)}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Status saat ini
                  </p>
                  <p className="mt-1 font-bold">{selected.lifecycle_status}</p>
                </div>
                <div className="space-y-2 text-sm">
                  {selected.lifecycle_status === "DRAFT" ? (
                    <p>
                      <FontAwesomeIcon
                        icon={faClock}
                        className="mr-2 h-4 w-4"
                      />
                      Menunggu approval
                    </p>
                  ) : (
                    <p>
                      <FontAwesomeIcon
                        icon={faCircleCheck}
                        className="mr-2 h-4 w-4"
                      />
                      Tahap draft selesai
                    </p>
                  )}
                </div>
                {canGovern ? (
                  <div className="space-y-2 border-t border-[var(--color-border-subtle)] pt-4">
                    {selected.lifecycle_status === "DRAFT" ? (
                      <button
                        disabled={busy === selected.id}
                        onClick={() => void transition(selected, "approve")}
                        className="clara-button clara-button-ghost w-full"
                      >
                        Approve
                      </button>
                    ) : null}
                    {selected.lifecycle_status === "APPROVED" ? (
                      <button
                        disabled={busy === selected.id}
                        onClick={() => void transition(selected, "activate")}
                        className="clara-button clara-button-primary w-full"
                      >
                        Activate
                      </button>
                    ) : null}
                    {selected.lifecycle_status === "ACTIVE" ? (
                      <button
                        disabled={busy === selected.id}
                        onClick={() => void transition(selected, "expire")}
                        className="clara-button clara-button-ghost w-full"
                      >
                        Expire
                      </button>
                    ) : null}
                    {!["EXPIRED", "REVOKED"].includes(
                      selected.lifecycle_status,
                    ) ? (
                      <button
                        disabled={busy === selected.id}
                        onClick={() => void transition(selected, "revoke")}
                        className="clara-button clara-button-danger w-full"
                      >
                        Nonaktifkan
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="clara-helper mt-4">
                Pilih fakta untuk melihat lifecycle.
              </p>
            )}
          </aside>
        </div>

        {selected && canGovern ? (
          <div className="clara-card rounded-2xl p-4 xl:hidden">
            <p className="clara-kicker">Lifecycle action</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.lifecycle_status === "DRAFT" ? (
                <button
                  disabled={busy === selected.id}
                  onClick={() => void transition(selected, "approve")}
                  className="clara-button clara-button-ghost"
                >
                  Approve
                </button>
              ) : null}
              {selected.lifecycle_status === "APPROVED" ? (
                <button
                  disabled={busy === selected.id}
                  onClick={() => void transition(selected, "activate")}
                  className="clara-button clara-button-primary"
                >
                  Activate
                </button>
              ) : null}
              {selected.lifecycle_status === "ACTIVE" ? (
                <button
                  disabled={busy === selected.id}
                  onClick={() => void transition(selected, "expire")}
                  className="clara-button clara-button-ghost"
                >
                  Expire
                </button>
              ) : null}
              {!["EXPIRED", "REVOKED"].includes(selected.lifecycle_status) ? (
                <button
                  disabled={busy === selected.id}
                  onClick={() => void transition(selected, "revoke")}
                  className="clara-button clara-button-danger"
                >
                  Nonaktifkan
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70"
          onClick={() => setEditorOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Editor product fact"
            className="clara-card absolute inset-y-0 right-0 w-[min(620px,96vw)] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            {editor}
          </aside>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
