"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  CurrentUser,
  ProductKnowledgeCreateRequest,
  ProductKnowledgeItem,
  ProductKnowledgeListFilters,
} from "@/types/dashboard";

const EMPTY_FORM: ProductKnowledgeCreateRequest = {
  title: "",
  category: "general",
  content: "",
  source_type: "manual_note",
  is_active: true,
};

export default function ProductKnowledgePage() {
  const [items, setItems] = useState<ProductKnowledgeItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<ProductKnowledgeCreateRequest>(EMPTY_FORM);
  const [filters, setFilters] = useState<ProductKnowledgeListFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canManageKnowledge = currentUser?.role === "owner";

  async function loadKnowledge(activeFilters?: ProductKnowledgeListFilters) {
    setErrorMessage("");

    try {
      const currentFilters = activeFilters ?? filters;
      const params = new URLSearchParams();

      if (currentFilters.q?.trim()) {
        params.set("q", currentFilters.q.trim());
      }

      if (currentFilters.category?.trim()) {
        params.set("category", currentFilters.category.trim());
      }

      if (typeof currentFilters.is_active === "boolean") {
        params.set("is_active", String(currentFilters.is_active));
      }

      const path = params.size
        ? `/product-knowledge?${params.toString()}`
        : "/product-knowledge";

      const data = await apiFetch<ProductKnowledgeItem[]>(path);
      setItems(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat product knowledge.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const me = await apiFetch<CurrentUser>("/auth/me");
        setCurrentUser(me);
      } catch {
        // apiFetch will already handle auth redirect when needed
      }

      await loadKnowledge();
    }

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: ProductKnowledgeItem) {
    if (!canManageKnowledge) {
      setErrorMessage("Hanya owner yang boleh mengubah product knowledge.");
      return;
    }

    setForm({
      title: item.title,
      category: item.category,
      content: item.content,
      source_type: item.source_type,
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageKnowledge) {
      setErrorMessage("Hanya owner yang boleh menambahkan product knowledge.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        await apiFetch<ProductKnowledgeItem>(
          `/product-knowledge/${editingId}`,
          {
            method: "PATCH",
            body: form,
          },
        );
        setSuccessMessage("Knowledge base berhasil diupdate.");
      } else {
        await apiFetch<ProductKnowledgeItem>("/product-knowledge", {
          method: "POST",
          body: form,
        });
        setSuccessMessage("Knowledge base berhasil ditambahkan.");
      }

      resetForm();
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan product knowledge.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(knowledgeId: string) {
    if (!canManageKnowledge) {
      setErrorMessage("Hanya owner yang boleh menghapus product knowledge.");
      return;
    }

    setDeletingId(knowledgeId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch<void>(`/product-knowledge/${knowledgeId}`, {
        method: "DELETE",
      });
      setSuccessMessage("Knowledge entry berhasil dihapus.");
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menghapus product knowledge.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleApplyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    await loadKnowledge(filters);
  }

  async function handleResetFilters() {
    const nextFilters = {};
    setFilters(nextFilters);
    setIsLoading(true);
    await loadKnowledge(nextFilters);
  }

  const activeItemsCount = items.filter((item) => item.is_active).length;

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Knowledge base"
      title="Product Knowledge"
      description="Kelola sumber fakta resmi untuk menjaga jawaban Clara tetap akurat, aman, dan grounded."
      backHref="/dashboard"
      backLabel="Kembali ke overview"
      actions={
        <Link
          href="/dashboard/sales"
          className="clara-button clara-button-ghost"
        >
          Buka Inbox
        </Link>
      }
    >
      <div className="mx-auto space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            label="Total Entry"
            value={isLoading ? "..." : String(items.length)}
            description="Seluruh knowledge yang tersedia untuk dibaca dari workspace."
          />
          <InfoCard
            label="Entry Aktif"
            value={isLoading ? "..." : String(activeItemsCount)}
            description="Entry aktif akan dipakai Clara sebagai grounding jawaban."
          />
          <InfoCard
            label="Hak Akses"
            value={canManageKnowledge ? "Owner" : "Read Only"}
            description="Owner bisa menambah dan mengubah isi, role lain tetap bisa membaca."
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {canManageKnowledge && (
            <form
              onSubmit={handleSubmit}
              className="clara-card space-y-5 rounded-[30px] p-5"
            >
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingId
                    ? "Edit Knowledge Entry"
                    : "Tambah Knowledge Entry"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Gunakan bahasa faktual. Hindari isi yang ambigu atau belum
                  diverifikasi.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Entry yang aktif akan otomatis tersedia sebagai sumber fakta
                  saat Clara menyiapkan draft balasan.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900">
                  Title
                </label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="clara-input mt-2"
                  placeholder="Contoh: Legalitas SGB Mini"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-900">
                    Category
                  </label>
                  <input
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="clara-input mt-2"
                    placeholder="legalitas / promo / policy"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-900">
                    Source Type
                  </label>
                  <input
                    value={form.source_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        source_type: event.target.value,
                      }))
                    }
                    className="clara-input mt-2"
                    placeholder="manual_note"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900">
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  rows={8}
                  className="clara-textarea mt-2"
                  placeholder="Tuliskan fakta produk yang boleh dipakai AI saat generate reply."
                />
              </div>

              <label className="clara-card-soft flex items-center gap-3 rounded-xl p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />
                Entry aktif dan boleh dipakai untuk grounding AI
              </label>

              {errorMessage && (
                <p className="clara-alert clara-alert-danger">{errorMessage}</p>
              )}

              {successMessage && (
                <p className="clara-alert clara-alert-success">
                  {successMessage}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    form.title.trim().length === 0 ||
                    form.category.trim().length === 0 ||
                    form.content.trim().length === 0 ||
                    form.source_type.trim().length === 0
                  }
                  className="clara-button clara-button-primary"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Update Entry"
                      : "Add Entry"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="clara-button clara-button-ghost"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          )}

          <section className="space-y-4">
            <div className="clara-card rounded-[30px] p-5">
              <h2 className="text-lg font-semibold text-slate-950">
                Current Knowledge Entries
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Entry aktif akan ikut menjadi grounding context untuk AI reply.
              </p>

              <form
                onSubmit={handleApplyFilters}
                className="mt-5 grid gap-3 md:grid-cols-[1.5fr_1fr_auto_auto]"
              >
                <input
                  value={filters.q ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      q: event.target.value,
                    }))
                  }
                  className="clara-input"
                  placeholder="Cari title, kategori, atau isi"
                />

                <input
                  value={filters.category ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="clara-input"
                  placeholder="Filter kategori"
                />

                <select
                  value={
                    typeof filters.is_active === "boolean"
                      ? String(filters.is_active)
                      : ""
                  }
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      is_active:
                        event.target.value === ""
                          ? undefined
                          : event.target.value === "true",
                    }))
                  }
                  className="clara-select"
                >
                  <option value="">All status</option>
                  <option value="true">Active only</option>
                  <option value="false">Inactive only</option>
                </select>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="clara-button clara-button-primary"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="clara-button clara-button-ghost"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {!canManageKnowledge && errorMessage && (
              <div className="clara-alert clara-alert-danger">
                {errorMessage}
              </div>
            )}

            {!canManageKnowledge && successMessage && (
              <div className="clara-alert clara-alert-success">
                {successMessage}
              </div>
            )}

            {isLoading && (
              <div className="clara-empty-state text-sm text-slate-600">
                Loading product knowledge...
              </div>
            )}

            {!isLoading && items.length === 0 && !errorMessage && (
              <div className="clara-empty-state">
                <h2 className="text-lg font-semibold text-slate-900">
                  Belum ada knowledge entry
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Tambahkan legalitas, policy, FAQ, atau info produk resmi dulu.
                </p>
              </div>
            )}

            {!isLoading &&
              items.map((item) => (
                <article
                  key={item.id}
                  className="clara-card rounded-[28px] p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-950">
                          {item.title}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.scope_type === "global"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.scope_type}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.category}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.is_active ? "active" : "inactive"}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {item.content}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Source: {item.source_type}</span>
                        <span>&bull;</span>
                        <span>
                          Created by: {item.created_by_user_name ?? "-"}
                        </span>
                        <span>&bull;</span>
                        <span>Updated: {formatDateTime(item.updated_at)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={!canManageKnowledge}
                        className="clara-button clara-button-ghost"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={deletingId === item.id || !canManageKnowledge}
                        className="clara-button border border-red-200 bg-white/70 text-red-700"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </section>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function InfoCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="clara-card rounded-[24px] p-5">
      <p className="clara-kicker text-xs text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
