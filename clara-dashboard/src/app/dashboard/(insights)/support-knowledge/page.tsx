"use client";

import {
  faArrowLeft,
  faCircleCheck,
  faFilter,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faShieldHalved,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

type Article = {
  id: string;
  organization_id: string | null;
  title: string;
  topic: string;
  support_level: string;
  content: string;
  customer_safe: boolean;
  lifecycle_status: string;
  source: string;
  source_reference: string;
  risk_class: string;
  version: number;
};

const TOPICS = [
  "GENERAL_NAVIGATION",
  "OFFICIAL_CHANNEL",
  "ACCOUNT_ACCESS_GENERAL",
  "LOGIN_GENERAL",
  "PASSWORD_SAFETY",
  "REGISTRATION_GENERAL",
  "DOCUMENT_PREPARATION_GENERAL",
  "VERIFICATION_GENERAL",
  "ACTIVATION_GENERAL",
  "FUNDING_GENERAL",
  "WITHDRAWAL_GENERAL",
  "PLATFORM_GENERAL",
  "ERROR_MESSAGE_GENERAL",
  "POST_ACTIVATION_GENERAL",
  "STATUS_REQUEST",
  "SECURITY_CONCERN",
];

const EMPTY_FORM = {
  organization_id: null as string | null,
  title: "",
  topic: "LOGIN_GENERAL",
  support_level: "LEVEL_1",
  content: "",
  customer_safe: false,
  source: "manual_verified",
  source_reference: "",
  risk_class: "LOW",
};

function statusTone(status: string) {
  if (status === "ACTIVE" || status === "LEVEL_0")
    return "border-[var(--color-success)] bg-[var(--color-success-surface)] text-[var(--color-success)]";
  if (status === "RETIRED" || status === "HUMAN_REQUIRED" || status === "HIGH")
    return "border-[var(--color-danger)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]";
  if (status === "APPROVED" || status === "MEDIUM")
    return "border-[var(--color-warning)] bg-[var(--color-warning-surface)] text-[var(--color-warning)]";
  return "border-[var(--color-border-default)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]";
}

export default function SupportKnowledgePage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<Article[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canGovern = me?.role === "head" || me?.role === "superadmin";

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery = `${item.title} ${item.topic} ${item.content}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (levelFilter === "ALL" || item.support_level === levelFilter)
        );
      }),
    [items, levelFilter, query],
  );
  const selected =
    filteredItems.find((item) => item.id === selectedId) ??
    filteredItems[0] ??
    null;

  async function load() {
    const [user, articles] = await Promise.all([
      apiFetch<CurrentUser>("/auth/me"),
      apiFetch<Article[]>("/support-knowledge"),
    ]);
    setMe(user);
    setItems(articles);
    setSelectedId((current) =>
      articles.some((item) => item.id === current)
        ? current
        : (articles[0]?.id ?? null),
    );
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        await load();
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Gagal memuat knowledge.",
        );
      }
    }
    void bootstrap();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setMessage("");
    setEditorOpen(true);
  }

  function startRevision(article: Article) {
    setForm({
      organization_id: article.organization_id,
      title: article.title,
      topic: article.topic,
      support_level: article.support_level,
      content: article.content,
      customer_safe: article.customer_safe,
      source: article.source,
      source_reference: article.source_reference,
      risk_class: article.risk_class,
    });
    setMessage(`Konten ${article.title} disalin sebagai revisi baru.`);
    setEditorOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    setMessage("");
    try {
      await apiFetch("/support-knowledge/drafts", {
        method: "POST",
        body: {
          ...form,
          organization_id:
            me?.role === "superadmin"
              ? form.organization_id
              : me?.organization_id,
        },
      });
      setForm(EMPTY_FORM);
      setEditorOpen(false);
      setMessage("Revisi support knowledge berhasil disimpan sebagai draft.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal menyimpan draft.",
      );
    } finally {
      setBusy("");
    }
  }

  async function transition(article: Article, action: string) {
    if (
      action === "retire" &&
      !window.confirm(
        `Nonaktifkan "${article.title}"? Histori tetap tersimpan.`,
      )
    )
      return;
    setBusy(article.id);
    setError("");
    setMessage("");
    try {
      const scope =
        me?.role === "superadmin" && article.organization_id
          ? `?organization_id=${encodeURIComponent(article.organization_id)}`
          : "";
      await apiFetch(`/support-knowledge/${article.id}/${action}${scope}`, {
        method: "POST",
      });
      setMessage(
        action === "retire"
          ? "Support knowledge dinonaktifkan."
          : `Lifecycle berhasil di-${action}.`,
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lifecycle gagal.");
    } finally {
      setBusy("");
    }
  }

  const editor = (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] p-5 sm:p-6">
        <div>
          <p className="clara-kicker">Support knowledge</p>
          <h2 className="clara-section-title mt-2">Tambah atau buat revisi</h2>
          <p className="clara-helper mt-1">
            Konten disimpan sebagai draft dan harus melalui approval.
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
          <span className="clara-label">Judul</span>
          <input
            required
            maxLength={200}
            className="clara-input mt-2"
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="clara-label">Topik</span>
          <select
            className="clara-select mt-2"
            value={form.topic}
            onChange={(event) =>
              setForm({ ...form, topic: event.target.value })
            }
          >
            {TOPICS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="clara-label">Support level</span>
            <select
              className="clara-select mt-2"
              value={form.support_level}
              onChange={(event) =>
                setForm({ ...form, support_level: event.target.value })
              }
            >
              <option>LEVEL_0</option>
              <option>LEVEL_1</option>
              <option>HUMAN_REQUIRED</option>
            </select>
          </label>
          <label>
            <span className="clara-label">Risk class</span>
            <select
              className="clara-select mt-2"
              value={form.risk_class}
              onChange={(event) =>
                setForm({ ...form, risk_class: event.target.value })
              }
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="clara-label">Referensi sumber</span>
          <input
            required
            maxLength={500}
            className="clara-input mt-2"
            value={form.source_reference}
            onChange={(event) =>
              setForm({ ...form, source_reference: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="clara-label">Konten</span>
          <textarea
            required
            maxLength={50_000}
            className="clara-input clara-scrollbar mt-2 min-h-64 leading-7"
            value={form.content}
            onChange={(event) =>
              setForm({ ...form, content: event.target.value })
            }
          />
          <span className="clara-helper mt-1 block text-right tabular-nums">
            {form.content.length.toLocaleString("id-ID")} / 50.000 karakter
          </span>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-4">
          <input
            type="checkbox"
            checked={form.customer_safe}
            onChange={(event) =>
              setForm({ ...form, customer_safe: event.target.checked })
            }
          />
          <span className="text-sm font-semibold">
            Ditinjau sebagai customer-safe
          </span>
        </label>
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
      eyebrow="Customer service governance"
      title="Support Knowledge L0–L1"
      description="Kelola jawaban support terverifikasi dengan batas eskalasi dan trust metadata yang jelas."
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
                <span className="sr-only">Cari artikel support</span>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <input
                  className="clara-input pl-11"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari judul, topik, atau isi artikel..."
                />
              </label>
              <label className="relative min-w-[190px]">
                <span className="sr-only">Filter support level</span>
                <FontAwesomeIcon
                  icon={faFilter}
                  className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <select
                  className="clara-select pl-11"
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                >
                  <option value="ALL">Semua level</option>
                  <option>LEVEL_0</option>
                  <option>LEVEL_1</option>
                  <option>HUMAN_REQUIRED</option>
                </select>
              </label>
            </div>
            {canGovern ? (
              <button
                type="button"
                className="clara-button clara-button-primary"
                onClick={openCreate}
              >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" /> Artikel
                baru
              </button>
            ) : null}
          </div>
        </section>

        <div className="grid min-h-[650px] gap-5 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_250px]">
          <section
            className={`clara-card overflow-hidden rounded-2xl ${showDetail ? "hidden lg:block" : "block"}`}
            aria-label="Pustaka support knowledge"
          >
            <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
              <p className="font-semibold">Article library</p>
              <p className="clara-helper mt-1 tabular-nums">
                {filteredItems.length} dari {items.length} artikel
              </p>
            </div>
            <div className="clara-scrollbar max-h-[650px] space-y-2 overflow-y-auto p-3">
              {filteredItems.length ? (
                filteredItems.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(article.id);
                      setShowDetail(true);
                    }}
                    aria-current={
                      selected?.id === article.id ? "true" : undefined
                    }
                    className={`w-full rounded-xl border p-4 text-left ${selected?.id === article.id ? "border-[var(--color-accent)] bg-[var(--color-surface-muted)]" : "border-transparent hover:bg-[var(--color-surface-base)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {article.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone(article.support_level)}`}
                      >
                        {article.support_level.replace("LEVEL_", "L")}
                      </span>
                    </div>
                    <p className="clara-text-secondary mt-2 line-clamp-2 text-sm leading-5">
                      {article.content}
                    </p>
                    <p className="clara-text-muted mt-3 text-xs">
                      {article.topic} · v
                      <span className="tabular-nums">{article.version}</span>
                    </p>
                  </button>
                ))
              ) : (
                <div className="clara-empty-state text-sm">
                  Tidak ada artikel yang cocok.
                </div>
              )}
            </div>
          </section>

          <article
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
                      Kembali ke library
                    </button>
                    <p className="clara-kicker">{selected.topic}</p>
                    <h2 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">
                      {selected.title}
                    </h2>
                    <p className="clara-text-muted mt-2 text-sm">
                      Version{" "}
                      <span className="tabular-nums">{selected.version}</span> ·{" "}
                      {selected.lifecycle_status}
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
                <div className="p-5 sm:p-7">
                  <div className="mb-6 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone(selected.support_level)}`}
                    >
                      {selected.support_level}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone(selected.risk_class)}`}
                    >
                      Risk {selected.risk_class}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected.customer_safe ? statusTone("ACTIVE") : statusTone("HUMAN_REQUIRED")}`}
                    >
                      {selected.customer_safe
                        ? "Customer-safe"
                        : "Review required"}
                    </span>
                  </div>
                  <div className="clara-text-secondary whitespace-pre-wrap text-[15px] leading-8">
                    {selected.content}
                  </div>
                  <div className="mt-8 border-t border-[var(--color-border-subtle)] pt-6">
                    <p className="clara-kicker">Trust metadata</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="clara-panel-soft rounded-xl p-4">
                        <dt className="clara-helper">Source</dt>
                        <dd className="mt-1 font-semibold">
                          {selected.source}
                        </dd>
                      </div>
                      <div className="clara-panel-soft min-w-0 rounded-xl p-4">
                        <dt className="clara-helper">Reference</dt>
                        <dd className="mt-1 break-all text-sm">
                          {selected.source_reference}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </>
            ) : (
              <div className="clara-empty-state m-5">
                Pilih artikel untuk membacanya.
              </div>
            )}
          </article>

          <aside className="clara-card hidden h-fit rounded-2xl p-5 xl:block">
            <p className="clara-kicker">Governance</p>
            <h2 className="clara-card-title mt-2">Lifecycle artikel</h2>
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
                <div className="rounded-xl border border-[var(--color-border-subtle)] p-4 text-sm">
                  <FontAwesomeIcon
                    icon={
                      selected.customer_safe ? faCircleCheck : faShieldHalved
                    }
                    className="mr-2 h-4 w-4 text-[var(--color-accent)]"
                  />
                  {selected.customer_safe
                    ? "Aman untuk customer"
                    : "Butuh review manusia"}
                </div>
                {canGovern ? (
                  <div className="space-y-2 border-t border-[var(--color-border-subtle)] pt-4">
                    {selected.lifecycle_status === "DRAFT" ? (
                      <button
                        type="button"
                        disabled={busy === selected.id}
                        className="clara-button clara-button-ghost w-full"
                        onClick={() => void transition(selected, "approve")}
                      >
                        Approve
                      </button>
                    ) : null}
                    {selected.lifecycle_status === "APPROVED" ? (
                      <button
                        type="button"
                        disabled={busy === selected.id}
                        className="clara-button clara-button-primary w-full"
                        onClick={() => void transition(selected, "activate")}
                      >
                        Activate
                      </button>
                    ) : null}
                    {selected.lifecycle_status !== "RETIRED" ? (
                      <button
                        type="button"
                        disabled={busy === selected.id}
                        className="clara-button clara-button-danger w-full"
                        onClick={() => void transition(selected, "retire")}
                      >
                        Nonaktifkan
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="clara-helper mt-4">
                Pilih artikel untuk melihat lifecycle.
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
                  type="button"
                  disabled={busy === selected.id}
                  className="clara-button clara-button-ghost"
                  onClick={() => void transition(selected, "approve")}
                >
                  Approve
                </button>
              ) : null}
              {selected.lifecycle_status === "APPROVED" ? (
                <button
                  type="button"
                  disabled={busy === selected.id}
                  className="clara-button clara-button-primary"
                  onClick={() => void transition(selected, "activate")}
                >
                  Activate
                </button>
              ) : null}
              {selected.lifecycle_status !== "RETIRED" ? (
                <button
                  type="button"
                  disabled={busy === selected.id}
                  className="clara-button clara-button-danger"
                  onClick={() => void transition(selected, "retire")}
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
            aria-label="Editor support knowledge"
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
