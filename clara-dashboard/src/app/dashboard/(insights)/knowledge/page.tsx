"use client";

import {
  faArrowLeft,
  faCheck,
  faChevronDown,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faPowerOff,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(
    null,
  );
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
  const [proposalQueueOpen, setProposalQueueOpen] = useState(false);
  const [hasLoadedKnowledgeList, setHasLoadedKnowledgeList] = useState(false);

  const canManageKnowledge = currentUser?.role === "superadmin";
  const canReviewProposals = currentUser?.role === "superadmin";
  const canSeeProposalQueue = ["manager", "head", "superadmin"].includes(
    currentUser?.role ?? "",
  );
  const activeItemsCount = items.filter((item) => item.is_active).length;
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  );

  async function loadKnowledge(
    activeFilters?: ProductKnowledgeListFilters,
    options?: { includeProposalQueue?: boolean },
  ) {
    setErrorMessage("");
    try {
      const currentFilters = activeFilters ?? filters;
      const params = new URLSearchParams();
      if (currentFilters.q?.trim()) params.set("q", currentFilters.q.trim());
      if (currentFilters.category?.trim())
        params.set("category", currentFilters.category.trim());
      if (typeof currentFilters.is_active === "boolean")
        params.set("is_active", String(currentFilters.is_active));

      const path = params.size
        ? `/product-knowledge?${params.toString()}`
        : "/product-knowledge";
      const includeProposalQueue =
        options?.includeProposalQueue ?? canSeeProposalQueue;
      const [dataResult, proposalResult] = await Promise.allSettled([
        apiFetch<ProductKnowledgeItem[]>(path),
        includeProposalQueue
          ? apiFetch<KnowledgeUpdateProposalItem[]>(
              "/product-knowledge/proposals",
            )
          : Promise.resolve([]),
      ]);

      if (dataResult.status === "fulfilled") {
        setItems(dataResult.value);
        setHasLoadedKnowledgeList(true);
      }
      if (proposalResult.status === "fulfilled")
        setProposals(proposalResult.value);
      if (
        dataResult.status === "rejected" ||
        proposalResult.status === "rejected"
      ) {
        setErrorMessage(
          "Sebagian data knowledge gagal dimuat. Data yang berhasil dimuat tetap ditampilkan.",
        );
      }
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
        await loadKnowledge(undefined, {
          includeProposalQueue: ["manager", "head", "superadmin"].includes(
            me.role,
          ),
        });
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
      : (items[0]?.id ?? null);
  const selectedKnowledge =
    items.find((item) => item.id === effectiveSelectedKnowledgeId) ??
    items[0] ??
    null;
  const selectedKnowledgeStats = selectedKnowledge
    ? buildKnowledgeContentStats(selectedKnowledge.content)
    : null;
  const hasUsableKnowledgeData =
    hasLoadedKnowledgeList || items.length > 0 || proposals.length > 0;
  const shouldRenderWorkspace =
    !isLoading && (!errorMessage || hasUsableKnowledgeData);
  const hasFilters = Boolean(
    filters.q || filters.category || typeof filters.is_active === "boolean",
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrorMessage("");
    setSuccessMessage("");
    setEditorOpen(true);
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
    setEditorOpen(true);
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
      setForm(EMPTY_FORM);
      setEditingId(null);
      setEditorOpen(false);
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
      setSuccessMessage(
        "Knowledge entry dinonaktifkan dan tidak lagi dipakai Clara.",
      );
      setConfirmDeactivateId(null);
      await loadKnowledge();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menonaktifkan product knowledge.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleApplyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setSelectedKnowledgeId(null);
    await loadKnowledge(filters);
  }

  async function handleResetFilters() {
    const nextFilters = {};
    setFilters(nextFilters);
    setIsLoading(true);
    setSelectedKnowledgeId(null);
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

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Knowledge base"
      title="Knowledge Base"
      description="Temukan dan kelola sumber jawaban resmi tanpa memisahkan pencarian dari konteks yang sedang dibaca."
      backHref="/workspace"
      backLabel="Kembali ke overview"
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              type="button"
              aria-expanded={sourceMenuOpen}
              onClick={() => setSourceMenuOpen((current) => !current)}
              className="clara-button clara-button-ghost"
            >
              Sumber lain
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`h-3.5 w-3.5 transition-transform duration-150 ${sourceMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sourceMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] p-2 shadow-[var(--shadow-floating)]">
                {canManageKnowledge ? (
                  <SourceLink href="/admin/ai-config" label="AI Persona" />
                ) : null}
                <SourceLink href="/product-facts" label="Product Facts" />
                <SourceLink
                  href="/support-knowledge"
                  label="Support Knowledge"
                />
              </div>
            ) : null}
          </div>
          {canManageKnowledge ? (
            <button
              type="button"
              className="clara-button clara-button-primary"
              onClick={openCreate}
            >
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4" /> Tambah entry
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div role="status" className="clara-alert clara-alert-success">
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm text-[var(--color-text-secondary)]">
          <span>
            <strong className="tabular-nums text-[var(--color-text-primary)]">
              {items.length}
            </strong>{" "}
            total
          </span>
          <span>
            <strong className="tabular-nums text-[var(--color-success)]">
              {activeItemsCount}
            </strong>{" "}
            aktif
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />{" "}
            Grounding siap
          </span>
          <span>{canManageKnowledge ? "Akses kelola" : "Mode baca"}</span>
        </div>

        {isLoading ? (
          <div role="status" className="clara-empty-state">
            Memuat product knowledge...
          </div>
        ) : shouldRenderWorkspace ? (
          <section className="clara-card overflow-hidden rounded-2xl">
            <form
              onSubmit={handleApplyFilters}
              className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] p-4 lg:flex-row lg:items-center"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Cari knowledge</span>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <input
                  value={filters.q ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      q: event.target.value,
                    }))
                  }
                  className="clara-input pl-11"
                  placeholder="Cari judul, kategori, atau isi..."
                />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <label>
                  <span className="sr-only">Filter kategori</span>
                  <select
                    value={filters.category ?? ""}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        category: event.target.value || undefined,
                      }))
                    }
                    className="clara-select min-w-40"
                  >
                    <option value="">Semua kategori</option>
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter status</span>
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
                    className="clara-select min-w-36"
                  >
                    <option value="">Semua status</option>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </label>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-2 lg:justify-end">
                <span className="whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                  <strong className="tabular-nums text-[var(--color-text-primary)]">
                    {items.length}
                  </strong>{" "}
                  hasil
                </span>
                <button
                  type="submit"
                  className="clara-button clara-button-primary"
                >
                  Terapkan
                </button>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => void handleResetFilters()}
                    className="clara-button clara-button-ghost"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </form>

            <div className="grid min-h-[640px] lg:h-[calc(100vh-300px)] lg:min-h-[620px] lg:grid-cols-[390px_minmax(0,1fr)]">
              <div
                className={`${selectedKnowledgeId ? "hidden lg:block" : "block"} clara-scrollbar overflow-y-auto border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-3`}
              >
                {items.length ? (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const active = item.id === selectedKnowledge?.id;
                      const stats = buildKnowledgeContentStats(item.content);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedKnowledgeId(item.id);
                            setConfirmDeactivateId(null);
                          }}
                          aria-current={active ? "true" : undefined}
                          className={`w-full rounded-xl p-4 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96] ${active ? "bg-[var(--color-surface-muted)] shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-[var(--color-surface-raised)]"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="text-pretty text-[15px] font-semibold leading-6">
                              {item.title}
                            </h2>
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.is_active ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`}
                            >
                              <span className="sr-only">
                                {item.is_active ? "aktif" : "nonaktif"}
                              </span>
                            </span>
                          </div>
                          <p className="clara-text-secondary mt-2 line-clamp-2 text-pretty text-sm leading-5">
                            {buildPreviewText(item.content, 150)}
                          </p>
                          <div className="clara-text-muted mt-3 flex items-center justify-between gap-3 text-xs">
                            <span className="truncate">{item.category}</span>
                            <span className="whitespace-nowrap tabular-nums">
                              {stats.sectionCount} blok
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-72 place-items-center px-6 text-center">
                    <div>
                      <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className="clara-text-muted h-7 w-7"
                      />
                      <h2 className="mt-4 font-semibold">Tidak ada hasil</h2>
                      <p className="clara-helper mt-2">
                        Coba kata kunci lain atau reset filter.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`${selectedKnowledgeId ? "block" : "hidden lg:block"} min-w-0 bg-[var(--color-surface-raised)] lg:min-h-0 lg:overflow-hidden`}
              >
                {selectedKnowledge ? (
                  <article className="clara-scrollbar h-full overflow-y-auto">
                    <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/95 px-5 py-4 backdrop-blur-md sm:px-6">
                      <button
                        type="button"
                        onClick={() => setSelectedKnowledgeId(null)}
                        className="clara-button clara-button-ghost mb-3 lg:hidden"
                      >
                        <FontAwesomeIcon
                          icon={faArrowLeft}
                          className="h-4 w-4"
                        />{" "}
                        Kembali ke daftar
                      </button>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-balance text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                              {selectedKnowledge.title}
                            </h2>
                            <StatusBadge active={selectedKnowledge.is_active} />
                          </div>
                          <p className="clara-text-secondary mt-2 max-w-[70ch] text-pretty text-sm leading-6">
                            {buildPreviewText(selectedKnowledge.content, 190)}
                          </p>
                        </div>
                        {canManageKnowledge ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(selectedKnowledge)}
                              className="clara-button clara-button-ghost"
                            >
                              <FontAwesomeIcon
                                icon={faPenToSquare}
                                className="h-4 w-4"
                              />{" "}
                              Edit
                            </button>
                            {selectedKnowledge.is_active ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeactivateId(selectedKnowledge.id)
                                }
                                className="clara-button clara-button-danger"
                              >
                                <FontAwesomeIcon
                                  icon={faPowerOff}
                                  className="h-4 w-4"
                                />{" "}
                                Nonaktifkan
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <dl className="clara-text-muted mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <div>
                          <dt className="sr-only">Sumber</dt>
                          <dd>{selectedKnowledge.source_type}</dd>
                        </div>
                        <div>
                          <dt className="sr-only">Pemilik</dt>
                          <dd>
                            {selectedKnowledge.created_by_user_name ?? "-"}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">Terakhir diperbarui</dt>
                          <dd className="tabular-nums">
                            Diperbarui{" "}
                            {formatDateTime(selectedKnowledge.updated_at)}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">Jumlah blok</dt>
                          <dd className="tabular-nums">
                            {selectedKnowledgeStats?.sectionCount ?? 0} blok
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">Scope</dt>
                          <dd>{selectedKnowledge.scope_type}</dd>
                        </div>
                      </dl>
                    </header>

                    {confirmDeactivateId === selectedKnowledge.id ? (
                      <div
                        role="alert"
                        className="clara-alert clara-alert-danger mx-5 mt-5 sm:mx-6"
                      >
                        <p className="font-semibold">
                          Hentikan entry ini dari grounding Clara?
                        </p>
                        <p className="mt-1 text-sm">
                          Entry tetap disimpan untuk audit.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeactivateId(null)}
                            className="clara-button clara-button-ghost"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === selectedKnowledge.id}
                            onClick={() =>
                              void handleDelete(selectedKnowledge.id)
                            }
                            className="clara-button clara-button-danger"
                          >
                            {deletingId === selectedKnowledge.id
                              ? "Menonaktifkan..."
                              : "Ya, nonaktifkan"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="w-full px-5 py-7 sm:px-8 sm:py-9">
                      <p className="text-sm font-semibold text-[var(--color-accent)]">
                        Isi knowledge
                      </p>
                      <div className="mt-5">
                        {renderKnowledgeContent(selectedKnowledge.content)}
                      </div>
                    </div>
                  </article>
                ) : (
                  <div className="clara-empty-state m-5">
                    Pilih entry untuk membaca detail.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {canSeeProposalQueue ? (
          <section className="clara-card overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={() => setProposalQueueOpen((current) => !current)}
              aria-expanded={proposalQueueOpen}
              className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left hover:bg-[var(--color-surface-muted)]"
            >
              <div>
                <p className="font-semibold">Knowledge Update Queue</p>
                <p className="clara-helper mt-1">
                  Usulan dari coaching review yang menunggu keputusan
                  governance.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="clara-chip tabular-nums">
                  {proposals.length} proposal
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`h-4 w-4 transition-transform duration-150 ${proposalQueueOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {proposalQueueOpen ? (
              <div className="space-y-3 border-t border-[var(--color-border-subtle)] p-4 sm:p-5">
                {proposals.length ? (
                  proposals.map((proposal) => (
                    <article
                      key={proposal.id}
                      className="rounded-xl bg-[var(--color-surface-base)] p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{proposal.title}</h3>
                            <span className="clara-chip clara-chip-neutral">
                              {proposal.category}
                            </span>
                            <span className="clara-chip">
                              {proposal.status}
                            </span>
                          </div>
                          <p className="clara-text-secondary mt-2 text-sm">
                            Conversation: {proposal.conversation_title ?? "-"}
                          </p>
                          <p className="clara-text-secondary mt-3 whitespace-pre-wrap text-sm leading-6">
                            {expandedProposalId === proposal.id
                              ? proposal.proposed_content
                              : buildPreviewText(
                                  proposal.proposed_content,
                                  220,
                                )}
                          </p>
                          {proposal.proposed_content.length > 220 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProposalId((current) =>
                                  current === proposal.id ? null : proposal.id,
                                )
                              }
                              className="mt-2 min-h-11 text-sm font-semibold text-[var(--color-accent)]"
                            >
                              {expandedProposalId === proposal.id
                                ? "Tutup detail"
                                : "Lihat usulan lengkap"}
                            </button>
                          ) : null}
                          <p className="clara-text-muted mt-3 text-xs">
                            Pengusul: {proposal.proposed_by_user_name ?? "-"} ·{" "}
                            {proposal.source_type} ·{" "}
                            <span className="tabular-nums">
                              {formatDateTime(proposal.updated_at)}
                            </span>
                          </p>
                        </div>
                        {canReviewProposals &&
                        proposal.status === "pending_approval" ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={reviewingProposalId === proposal.id}
                              onClick={() =>
                                void handleReviewProposal(
                                  proposal.id,
                                  "rejected",
                                )
                              }
                              className="clara-button clara-button-danger"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={reviewingProposalId === proposal.id}
                              onClick={() =>
                                void handleReviewProposal(
                                  proposal.id,
                                  "approved",
                                )
                              }
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
                ) : (
                  <div className="clara-empty-state text-sm">
                    Belum ada proposal knowledge dari coaching case.
                  </div>
                )}
              </div>
            ) : null}
          </section>
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
            aria-labelledby="knowledge-editor-title"
            className="clara-card absolute inset-y-0 right-0 w-[min(560px,96vw)] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-5 sm:p-6">
                <div>
                  <h2
                    id="knowledge-editor-title"
                    className="clara-section-title"
                  >
                    {editingId ? "Edit knowledge" : "Tambah knowledge"}
                  </h2>
                  <p className="clara-helper mt-1">
                    Pastikan faktual dan sumbernya dapat diverifikasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  aria-label="Tutup editor"
                  className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-muted)]"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
                </button>
              </div>
              <div className="clara-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                <label className="block">
                  <span className="clara-label">Judul</span>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="clara-input mt-2"
                    maxLength={200}
                    placeholder="Contoh: Legalitas SGB Mini"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="clara-label">Kategori</span>
                    <input
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      className="clara-input mt-2"
                    />
                  </label>
                  <label>
                    <span className="clara-label">Tipe sumber</span>
                    <input
                      value={form.source_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          source_type: event.target.value,
                        }))
                      }
                      className="clara-input mt-2"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="clara-label">Isi knowledge</span>
                  <textarea
                    value={form.content}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    rows={12}
                    maxLength={50_000}
                    className="clara-input clara-scrollbar mt-2 min-h-72 resize-y leading-6"
                    placeholder="Tulis fakta yang boleh dipakai Clara..."
                  />
                  <span className="clara-helper mt-2 block text-right tabular-nums">
                    {form.content.length.toLocaleString("id-ID")} / 50.000
                  </span>
                </label>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-[var(--color-surface-muted)] px-4 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[var(--color-accent)]"
                  />
                  <span>Aktifkan untuk grounding Clara</span>
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border-subtle)] p-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="clara-button clara-button-ghost"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !form.title.trim() ||
                    !form.category.trim() ||
                    !form.content.trim() ||
                    !form.source_type.trim()
                  }
                  className="clara-button clara-button-primary"
                >
                  <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />{" "}
                  {isSubmitting
                    ? "Menyimpan..."
                    : editingId
                      ? "Simpan perubahan"
                      : "Tambah entry"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
    >
      {label}
    </Link>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-[var(--color-success-surface)] text-[var(--color-success)]" : "bg-[var(--color-warning-surface)] text-[var(--color-warning)]"}`}
    >
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function renderKnowledgeContent(content: string) {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !/^[-=*_•]{3,}$/.test(block.replace(/\s+/g, "")));

  return (
    <article className="w-full space-y-8 text-justify text-[15px] leading-8 text-[var(--color-text-secondary)] [text-align-last:left]">
      {blocks.map((block, blockIndex) => {
        const lines = mergeWrappedKnowledgeLines(
          block
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => line !== "---"),
        );
        const titleLine = lines[0] ?? "";
        const hasStructuredLead = /^(user|jawaban|q|a)\s*:/i.test(titleLine);
        return (
          <section
            key={`${blockIndex}-${block.slice(0, 40)}`}
            className="border-b border-[var(--color-border-subtle)] pb-8 last:border-0 last:pb-0"
          >
            <div className="space-y-3">
              {lines.map((line, lineIndex) => {
                const isLabelLine = /^(user|jawaban|q|a)\s*:/i.test(line);
                const isHeading =
                  (lineIndex === 0 &&
                    !hasStructuredLead &&
                    line.length <= 90) ||
                  /:$/.test(line);
                if (/^[-*•]\s+/.test(line)) {
                  return (
                    <div
                      key={`${blockIndex}-${lineIndex}`}
                      className="flex gap-3 pl-1 text-justify [text-align-last:left]"
                    >
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                      <p className="text-pretty">
                        {line.replace(/^[-*•]\s+/, "")}
                      </p>
                    </div>
                  );
                }
                if (isLabelLine) {
                  const [label, ...rest] = line.split(":");
                  return (
                    <p
                      key={`${blockIndex}-${lineIndex}`}
                      className="text-justify [text-align-last:left]"
                    >
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {label}:
                      </span>{" "}
                      {rest.join(":").trim()}
                    </p>
                  );
                }
                if (isHeading)
                  return (
                    <h3
                      key={`${blockIndex}-${lineIndex}`}
                      className="text-balance text-lg font-bold tracking-[-0.02em] text-[var(--color-text-primary)]"
                    >
                      {line}
                    </h3>
                  );
                return (
                  <p
                    key={`${blockIndex}-${lineIndex}`}
                    className="text-justify [text-align-last:left]"
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          </section>
        );
      })}
    </article>
  );
}

function mergeWrappedKnowledgeLines(lines: string[]) {
  return lines.reduce<string[]>((merged, line) => {
    const previous = merged.at(-1);
    const startsNewBlock =
      /^#{1,6}\s+/.test(line) ||
      /^[-*•]\s+/.test(line) ||
      /^(user|jawaban|q|a)\s*:/i.test(line) ||
      /^\|/.test(line) ||
      !previous ||
      /:$/.test(previous) ||
      /^#{1,6}\s+/.test(previous) ||
      /^\|/.test(previous);

    if (startsNewBlock) merged.push(line);
    else merged[merged.length - 1] = `${previous} ${line}`;
    return merged;
  }, []);
}

function buildKnowledgeContentStats(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return { sectionCount: 0, lineCount: 0 };
  const sectionCount = trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !/^[-=*_•]{3,}$/.test(block.replace(/\s+/g, ""))).length;
  const lineCount = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
  return { sectionCount, lineCount };
}

function buildPreviewText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength).trimEnd()}...`;
}
