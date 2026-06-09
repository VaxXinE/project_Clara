"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  CurrentUser,
  KnowledgeUpdateProposalItem,
  KnowledgeUpdateProposalReviewRequest,
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
  const [proposals, setProposals] = useState<KnowledgeUpdateProposalItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<ProductKnowledgeCreateRequest>(EMPTY_FORM);
  const [filters, setFilters] = useState<ProductKnowledgeListFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewingProposalId, setReviewingProposalId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(
    null,
  );
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(
    null,
  );
  const canManageKnowledge = currentUser?.role === "superadmin";
  const canReviewProposals = ["superadmin"].includes(
    currentUser?.role ?? "",
  );
  const canSeeProposalQueue = ["manager", "head", "superadmin"].includes(
    currentUser?.role ?? "",
  );

  async function loadKnowledge(
    activeFilters?: ProductKnowledgeListFilters,
    options?: { includeProposalQueue?: boolean },
  ) {
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

      const includeProposalQueue =
        options?.includeProposalQueue ?? canSeeProposalQueue;

      const [data, proposalData] = await Promise.all([
        apiFetch<ProductKnowledgeItem[]>(path),
        includeProposalQueue
          ? apiFetch<KnowledgeUpdateProposalItem[]>(
              "/product-knowledge/proposals",
            )
          : Promise.resolve([]),
      ]);
      setItems(data);
      setProposals(proposalData);
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
        const includeProposalQueue = ["manager", "head", "superadmin"].includes(
          me.role,
        );
        await loadKnowledge(undefined, { includeProposalQueue });
      } catch {
        await loadKnowledge(undefined, { includeProposalQueue: false });
      }
    }

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveSelectedKnowledgeId =
    selectedKnowledgeId && items.some((item) => item.id === selectedKnowledgeId)
      ? selectedKnowledgeId
      : items[0]?.id ?? null;

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(item: ProductKnowledgeItem) {
    if (!canManageKnowledge) {
      setErrorMessage(
        "Hanya superadmin yang boleh mengubah product knowledge.",
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

    if (!canManageKnowledge) {
      setErrorMessage(
        "Hanya superadmin yang boleh menambahkan product knowledge.",
      );
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
      setErrorMessage(
        "Hanya superadmin yang boleh menghapus product knowledge.",
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

  async function handleReviewProposal(
    proposalId: string,
    status: "approved" | "rejected",
  ) {
    if (!canReviewProposals) {
      setErrorMessage(
        "Hanya superadmin yang boleh approve atau reject proposal knowledge.",
      );
      return;
    }

    setReviewingProposalId(proposalId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body: KnowledgeUpdateProposalReviewRequest = {
        status,
        review_decision_note: null,
      };
      await apiFetch<KnowledgeUpdateProposalItem>(
        `/product-knowledge/proposals/${proposalId}/review`,
        {
          method: "PATCH",
          body,
        },
      );
      setSuccessMessage(
        status === "approved"
          ? "Proposal knowledge berhasil di-approve dan dipublish oleh superadmin."
          : "Proposal knowledge berhasil di-reject.",
      );
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memproses review proposal knowledge.",
      );
    } finally {
      setReviewingProposalId(null);
    }
  }

  const activeItemsCount = items.filter((item) => item.is_active).length;
  const selectedKnowledge =
    items.find((item) => item.id === effectiveSelectedKnowledgeId) ??
    items[0] ??
    null;

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
            value={canManageKnowledge ? "Superadmin" : "Read Only"}
            description="Hanya superadmin yang bisa menambah, mengubah, menghapus, dan publish knowledge resmi."
          />
        </section>

        {canSeeProposalQueue && (
          <section className="clara-card rounded-[30px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Knowledge Update Queue
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Usulan knowledge yang datang dari coaching review lapangan.
                  Manager dan head bisa mengoreksi lalu mengeskalasi, keputusan
                  approve dan publish final tetap di superadmin.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {proposals.length} proposal
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {proposals.length === 0 ? (
                <div className="clara-empty-state text-sm text-slate-600">
                  Belum ada proposal knowledge dari coaching case.
                </div>
              ) : (
                proposals.map((proposal) => (
                  <article
                    key={proposal.id}
                    className="rounded-[24px] border border-slate-200 bg-white/90 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950">
                            {proposal.title}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {proposal.category}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {proposal.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Conversation: {proposal.conversation_title ?? "-"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {expandedProposalId === proposal.id
                            ? proposal.proposed_content
                            : buildPreviewText(proposal.proposed_content, 180)}
                        </p>
                        {proposal.proposed_content.length > 180 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProposalId((current) =>
                                current === proposal.id ? null : proposal.id,
                              )
                            }
                            className="mt-2 text-xs font-semibold text-slate-700 underline underline-offset-4"
                          >
                            {expandedProposalId === proposal.id
                              ? "Tutup detail usulan"
                              : "Lihat usulan lengkap"}
                          </button>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Pengusul: {proposal.proposed_by_user_name ?? "-"}
                          </span>
                          <span>&bull;</span>
                          <span>Source: {proposal.source_type}</span>
                          <span>&bull;</span>
                          <span>
                            Updated: {formatDateTime(proposal.updated_at)}
                          </span>
                        </div>
                      </div>

                      {canReviewProposals &&
                      proposal.status === "pending_approval" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleReviewProposal(proposal.id, "rejected")
                            }
                            disabled={reviewingProposalId === proposal.id}
                            className="clara-button border border-red-200 bg-white/70 text-red-700"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleReviewProposal(proposal.id, "approved")
                            }
                            disabled={reviewingProposalId === proposal.id}
                            className="clara-button clara-button-primary"
                          >
                            {reviewingProposalId === proposal.id
                              ? "Memproses..."
                              : "Approve & Publish"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {canManageKnowledge && (
            <form
              onSubmit={handleSubmit}
              className="clara-card space-y-5 rounded-[30px] p-5 h-fit"
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

            {!isLoading && items.length > 0 && (
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Pilih satu entry di daftar untuk membaca isi lengkapnya di panel
                detail. Ini lebih cepat daripada scroll semua knowledge dari
                atas ke bawah.
              </div>
            )}

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

            {!isLoading && items.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-3 xl:max-h-[78vh] xl:overflow-y-auto xl:pr-1 clara-scrollbar">
                  {items.map((item) => {
                    const isSelected = item.id === selectedKnowledge?.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedKnowledgeId(item.id)}
                        className={`block w-full rounded-[24px] border p-4 text-left transition ${
                          isSelected
                            ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-base font-semibold ${
                              isSelected ? "text-white" : "text-slate-950"
                            }`}
                          >
                            {item.title}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isSelected
                                ? "bg-white/15 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.category}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.is_active
                                ? isSelected
                                  ? "bg-emerald-400/20 text-emerald-100"
                                  : "bg-green-100 text-green-700"
                                : isSelected
                                  ? "bg-amber-400/20 text-amber-100"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {item.is_active ? "active" : "inactive"}
                          </span>
                        </div>
                        <p
                          className={`mt-3 text-sm leading-6 ${
                            isSelected ? "text-slate-200" : "text-slate-600"
                          }`}
                        >
                          {buildPreviewText(item.content, 150)}
                        </p>
                        <div
                          className={`mt-3 flex flex-wrap gap-2 text-xs ${
                            isSelected ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          <span>{item.source_type}</span>
                          <span>&bull;</span>
                          <span>{formatDateTime(item.updated_at)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedKnowledge ? (
                  <article className="clara-card rounded-[30px] p-5 xl:sticky xl:top-28">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-slate-950">
                            {selectedKnowledge.title}
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              selectedKnowledge.scope_type === "global"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {selectedKnowledge.scope_type}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {selectedKnowledge.category}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              selectedKnowledge.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {selectedKnowledge.is_active
                              ? "active"
                              : "inactive"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Detail lengkap knowledge yang sedang dipilih. Pakai
                          panel ini saat benar-benar ingin membaca isi penuh
                          atau melakukan edit.
                        </p>
                      </div>

                      {canManageKnowledge ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(selectedKnowledge)}
                            className="clara-button clara-button-ghost"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(selectedKnowledge.id)
                            }
                            disabled={deletingId === selectedKnowledge.id}
                            className="clara-button border border-red-200 bg-white/70 text-red-700"
                          >
                            {deletingId === selectedKnowledge.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <MetaPill
                        label="Source"
                        value={selectedKnowledge.source_type}
                      />
                      <MetaPill
                        label="Created by"
                        value={selectedKnowledge.created_by_user_name ?? "-"}
                      />
                      <MetaPill
                        label="Updated"
                        value={formatDateTime(selectedKnowledge.updated_at)}
                      />
                    </div>

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Isi Knowledge
                      </p>
                      <div className="clara-scrollbar mt-4 max-h-[52vh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {selectedKnowledge.content}
                      </div>
                    </div>
                  </article>
                ) : null}
              </section>
            )}
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

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function buildPreviewText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
