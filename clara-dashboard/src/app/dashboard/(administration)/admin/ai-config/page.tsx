"use client";

import {
  faArrowRotateLeft,
  faClockRotateLeft,
  faFloppyDisk,
  faShieldHalved,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { canAccessAdminPages } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

type PersonaVariant = "mini" | "reguler";
type PersonaSectionKey =
  | "instruction"
  | "guardrail"
  | "flow"
  | "personality_mode"
  | "auto_adapt";

type EffectiveSection = {
  variant: PersonaVariant;
  section_key: PersonaSectionKey;
  content: string;
  source: "database" | "markdown";
  version_id: string | null;
  version_number: number | null;
};

type PersonaVersion = {
  id: string;
  variant: PersonaVariant;
  section_key: PersonaSectionKey;
  version_number: number;
  status: "draft" | "published" | "archived";
  content: string;
  created_at: string;
  published_at: string | null;
};

const SECTIONS: {
  key: PersonaSectionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "guardrail",
    label: "Guardrail",
    description: "Batas keamanan, compliance, dan larangan.",
  },
  {
    key: "instruction",
    label: "Instruction",
    description: "Tujuan utama dan aturan kerja Clara.",
  },
  {
    key: "flow",
    label: "Conversation Flow",
    description: "Urutan Clara memahami dan membalas chat.",
  },
  {
    key: "personality_mode",
    label: "Personality",
    description: "Nada bicara dan karakter Clara.",
  },
  {
    key: "auto_adapt",
    label: "Auto Adapt",
    description: "Cara Clara menyesuaikan respons dengan customer.",
  },
];

export default function AiPersonaConfigPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [variant, setVariant] = useState<PersonaVariant>("mini");
  const [sectionKey, setSectionKey] =
    useState<PersonaSectionKey>("instruction");
  const [effectiveSections, setEffectiveSections] = useState<
    EffectiveSection[]
  >([]);
  const [versions, setVersions] = useState<PersonaVersion[]>([]);
  const [content, setContent] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedSection =
    SECTIONS.find((item) => item.key === sectionKey) ?? SECTIONS[0];
  const effectiveSection = useMemo(
    () => effectiveSections.find((item) => item.section_key === sectionKey),
    [effectiveSections, sectionKey],
  );
  const sectionVersions = useMemo(
    () => versions.filter((item) => item.section_key === sectionKey),
    [versions, sectionKey],
  );
  const hasChanges = content !== (effectiveSection?.content ?? "");

  async function loadPersona(
    nextVariant: PersonaVariant,
    nextSection = sectionKey,
  ) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({ variant: nextVariant });
      const [effective, history] = await Promise.all([
        apiFetch<EffectiveSection[]>(
          `/ai-persona-config/effective?${params.toString()}`,
        ),
        apiFetch<PersonaVersion[]>(`/ai-persona-config?${params.toString()}`),
      ]);
      setEffectiveSections(effective);
      setVersions(history);
      setContent(
        effective.find((item) => item.section_key === nextSection)?.content ??
          "",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat konfigurasi AI Clara.",
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
        if (!canAccessAdminPages(me.role)) {
          router.replace("/workspace");
          return;
        }
        await loadPersona("mini");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Gagal memuat halaman admin.",
        );
        setIsLoading(false);
      }
    }
    void bootstrap();
    // Bootstrap only once; subsequent refreshes are explicit after user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function changeVariant(nextVariant: PersonaVariant) {
    if (
      nextVariant === variant ||
      (hasChanges &&
        !window.confirm("Buang perubahan editor yang belum disimpan?"))
    )
      return;
    setVariant(nextVariant);
    setSuccessMessage("");
    await loadPersona(nextVariant);
  }

  function changeSection(nextSection: PersonaSectionKey) {
    if (
      nextSection === sectionKey ||
      (hasChanges &&
        !window.confirm("Buang perubahan editor yang belum disimpan?"))
    )
      return;
    setSectionKey(nextSection);
    setContent(
      effectiveSections.find((item) => item.section_key === nextSection)
        ?.content ?? "",
    );
    setSuccessMessage("");
  }

  async function publishContent(contentToPublish = content) {
    const cleanedContent = contentToPublish.trim();
    if (!cleanedContent) {
      setErrorMessage("Isi persona tidak boleh kosong.");
      return;
    }
    if (
      !window.confirm("Simpan perubahan dan langsung gunakan untuk balasan AI?")
    )
      return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiFetch<EffectiveSection>(
        `/ai-persona-config/${variant}/${sectionKey}/publish`,
        {
          method: "PUT",
          body: { content: cleanedContent },
        },
      );
      setSuccessMessage("Perubahan tersimpan dan langsung digunakan Clara.");
      await loadPersona(variant);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan perubahan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function rollbackVersion(version: PersonaVersion) {
    if (
      !window.confirm(
        `Publikasikan kembali ${selectedSection.label} v${version.version_number}? Sistem akan membuat versi baru.`,
      )
    )
      return;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiFetch<EffectiveSection>(
        `/ai-persona-config/${variant}/${version.section_key}/publish`,
        {
          method: "PUT",
          body: { content: version.content },
        },
      );
      setSuccessMessage(
        `Rollback dari versi ${version.version_number} berhasil.`,
      );
      setHistoryOpen(false);
      await loadPersona(variant);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal melakukan rollback.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const history = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-5">
        <div>
          <h2 className="clara-card-title flex items-center gap-2">
            <FontAwesomeIcon
              icon={faClockRotateLeft}
              className="h-4 w-4 text-[var(--color-accent)]"
            />
            Riwayat versi
          </h2>
          <p className="clara-helper mt-1">
            Publikasikan kembali versi lama tanpa menghapus histori.
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[var(--color-surface-muted)] xl:hidden"
          onClick={() => setHistoryOpen(false)}
          aria-label="Tutup riwayat versi"
        >
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
        </button>
      </div>
      <div className="clara-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {sectionVersions.length === 0 ? (
          <div className="clara-empty-state text-sm">
            Belum ada versi database. Clara memakai file bawaan.
          </div>
        ) : (
          sectionVersions.map((version) => (
            <article
              key={version.id}
              className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  Versi{" "}
                  <span className="tabular-nums">{version.version_number}</span>
                </p>
                <span className="clara-chip clara-chip-neutral">
                  {version.status}
                </span>
              </div>
              <p className="clara-text-muted mt-2 text-xs tabular-nums">
                {formatDateTime(version.created_at)}
              </p>
              <p className="clara-text-secondary mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5">
                {version.content}
              </p>
              {version.status === "archived" ? (
                <button
                  type="button"
                  className="clara-button clara-button-ghost mt-4 w-full"
                  disabled={isSubmitting}
                  onClick={() => void rollbackVersion(version)}
                >
                  <FontAwesomeIcon
                    icon={faArrowRotateLeft}
                    className="h-4 w-4"
                  />{" "}
                  Publikasikan kembali
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Superadmin"
      title="AI Persona Clara"
      description="Kendalikan instruction, guardrail, flow, dan gaya komunikasi Clara dalam satu workspace."
      backHref="/knowledge"
      backLabel="Knowledge Base"
      actions={
        <Link className="clara-button clara-button-ghost" href="/knowledge">
          Semua Knowledge
        </Link>
      }
    >
      <div className="space-y-5">
        <section className="clara-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold">Varian account</p>
              <p className="clara-helper mt-0.5">
                Setiap varian memiliki aturan terpisah.
              </p>
            </div>
          </div>
          <div
            className="flex rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)] p-1"
            aria-label="Pilih varian account"
          >
            {(["mini", "reguler"] as PersonaVariant[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void changeVariant(item)}
                aria-pressed={variant === item}
                className={`min-h-10 rounded-lg px-5 text-sm font-semibold ${variant === item ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] shadow-sm" : "clara-text-secondary hover:bg-[var(--color-surface-muted)]"}`}
              >
                {item === "mini" ? "Mini" : "Reguler"}
              </button>
            ))}
          </div>
        </section>

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

        {isLoading ? (
          <div role="status" className="clara-empty-state">
            Memuat konfigurasi persona...
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_310px]">
            <nav
              className="clara-card h-fit rounded-2xl p-3"
              aria-label="Bagian prompt"
            >
              <p className="clara-kicker px-3 pb-3 pt-2">Bagian prompt</p>
              <div className="space-y-1">
                {SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => changeSection(section.key)}
                    aria-current={
                      sectionKey === section.key ? "page" : undefined
                    }
                    className={`w-full rounded-xl border p-3 text-left ${sectionKey === section.key ? "border-[var(--color-border-default)] bg-[var(--color-surface-muted)]" : "border-transparent hover:bg-[var(--color-surface-base)]"}`}
                  >
                    <span
                      className={`block text-sm font-semibold ${sectionKey === section.key ? "text-[var(--color-accent)]" : ""}`}
                    >
                      {section.label}
                    </span>
                    <span className="clara-text-muted mt-1 block text-xs leading-5">
                      {section.description}
                    </span>
                  </button>
                ))}
              </div>
            </nav>

            <section className="clara-card min-w-0 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] p-5">
                <div>
                  <h2 className="clara-section-title">
                    {selectedSection.label}
                  </h2>
                  <p className="clara-helper mt-1">
                    Aktif dari{" "}
                    {effectiveSection?.source === "database"
                      ? `database v${effectiveSection.version_number}`
                      : "file Markdown bawaan"}
                    .
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges ? (
                    <span className="clara-chip">Belum disimpan</span>
                  ) : (
                    <span className="clara-chip clara-chip-neutral">
                      Tersimpan
                    </span>
                  )}
                  <button
                    type="button"
                    className="clara-button clara-button-ghost xl:hidden"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <FontAwesomeIcon
                      icon={faClockRotateLeft}
                      className="h-4 w-4"
                    />{" "}
                    Riwayat
                  </button>
                </div>
              </div>
              <div className="p-5">
                <label htmlFor="persona-content" className="clara-label">
                  Isi {selectedSection.label.toLowerCase()}
                </label>
                <textarea
                  id="persona-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={50_000}
                  rows={22}
                  spellCheck={false}
                  className="clara-input clara-scrollbar mt-2 min-h-[520px] resize-y font-mono text-sm leading-6"
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="clara-helper tabular-nums">
                    {content.length.toLocaleString("id-ID")} / 50.000 karakter
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setContent(effectiveSection?.content ?? "")
                      }
                      className="clara-button clara-button-ghost"
                      disabled={isSubmitting || !hasChanges}
                    >
                      <FontAwesomeIcon
                        icon={faArrowRotateLeft}
                        className="h-4 w-4"
                      />{" "}
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => void publishContent()}
                      className="clara-button clara-button-primary"
                      disabled={isSubmitting || !hasChanges}
                    >
                      <FontAwesomeIcon
                        icon={faFloppyDisk}
                        className="h-4 w-4"
                      />{" "}
                      {isSubmitting ? "Menyimpan..." : "Simpan & gunakan"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <aside className="clara-card hidden h-[720px] overflow-hidden rounded-2xl xl:block">
              {history}
            </aside>
          </div>
        )}
      </div>

      {historyOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 xl:hidden"
          onClick={() => setHistoryOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Riwayat versi"
            className="clara-card absolute inset-y-0 right-0 w-[min(390px,92vw)] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            {history}
          </aside>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
