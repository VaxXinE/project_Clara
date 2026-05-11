"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
          : "Gagal memuat product knowledge."
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
    if (item.scope_type === "global" && currentUser?.role !== "owner") {
      setErrorMessage(
        "Knowledge global milik owner hanya bisa diedit oleh owner."
      );
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

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        await apiFetch<ProductKnowledgeItem>(`/product-knowledge/${editingId}`, {
          method: "PATCH",
          body: form,
        });
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
          : "Gagal menyimpan product knowledge."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(knowledgeId: string) {
    const targetItem = items.find((item) => item.id === knowledgeId);
    if (
      targetItem?.scope_type === "global" &&
      currentUser?.role !== "owner"
    ) {
      setErrorMessage(
        "Knowledge global milik owner hanya bisa dihapus oleh owner."
      );
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
          : "Gagal menghapus product knowledge."
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/dashboard/sales"
              className="text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              ← Back to Sales Inbox
            </Link>

            <p className="mt-6 text-sm font-medium text-slate-500">
              Clara Knowledge Base
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
              Product Knowledge
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Simpan fakta produk, legalitas, policy, dan guidance resmi agar AI
              reply tidak mengarang saat membalas customer.
            </p>
            <p className="mt-2 max-w-3xl text-xs text-slate-500">
              Entry yang dibuat owner akan menjadi knowledge global: terlihat
              oleh semua organization, tetapi hanya owner yang boleh mengubahnya.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {editingId ? "Edit Knowledge Entry" : "Tambah Knowledge Entry"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Gunakan bahasa faktual. Hindari isi yang ambigu atau belum
                diverifikasi.
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
                className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                  className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                  className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Tuliskan fakta produk yang boleh dipakai AI saat generate reply."
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
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
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
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
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                  className="rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                  className="rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
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
                  className="rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                >
                  <option value="">All status</option>
                  <option value="true">Active only</option>
                  <option value="false">Inactive only</option>
                </select>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {isLoading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                Loading product knowledge...
              </div>
            )}

            {!isLoading && items.length === 0 && !errorMessage && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
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
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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
                        <span>•</span>
                        <span>Created by: {item.created_by_user_name ?? "-"}</span>
                        <span>•</span>
                        <span>Updated: {formatDateTime(item.updated_at)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={
                          item.scope_type === "global" &&
                          currentUser?.role !== "owner"
                        }
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={
                          deletingId === item.id ||
                          (item.scope_type === "global" &&
                            currentUser?.role !== "owner")
                        }
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    </main>
  );
}
