"use client";

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

const SECTIONS: { key: PersonaSectionKey; label: string; description: string }[] = [
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
  const [effectiveSections, setEffectiveSections] = useState<EffectiveSection[]>(
    [],
  );
  const [versions, setVersions] = useState<PersonaVersion[]>([]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const effectiveSection = useMemo(
    () => effectiveSections.find((item) => item.section_key === sectionKey),
    [effectiveSections, sectionKey],
  );
  const sectionVersions = useMemo(
    () => versions.filter((item) => item.section_key === sectionKey),
    [versions, sectionKey],
  );
  async function loadPersona(nextVariant: PersonaVariant) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({ variant: nextVariant });
      const [effective, history] = await Promise.all([
        apiFetch<EffectiveSection[]>(
          `/ai-persona-config/effective?${params.toString()}`,
        ),
        apiFetch<PersonaVersion[]>(
          `/ai-persona-config?${params.toString()}`,
        ),
      ]);
      setEffectiveSections(effective);
      setVersions(history);
      setContent(
        effective.find((item) => item.section_key === sectionKey)?.content ?? "",
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
          error instanceof Error ? error.message : "Gagal memuat halaman admin.",
        );
        setIsLoading(false);
      }
    }
    void bootstrap();
    // Bootstrap only once; subsequent refreshes are explicit after user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function changeVariant(nextVariant: PersonaVariant) {
    setVariant(nextVariant);
    setSuccessMessage("");
    await loadPersona(nextVariant);
  }

  async function publishContent(contentToPublish = content) {
    const cleanedContent = contentToPublish.trim();
    if (!cleanedContent) {
      setErrorMessage("Isi persona tidak boleh kosong.");
      return;
    }
    if (!window.confirm("Simpan perubahan dan langsung gunakan untuk balasan AI?")) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiFetch<EffectiveSection>(
        `/ai-persona-config/${variant}/${sectionKey}/publish`,
        { method: "PUT", body: { content: cleanedContent } },
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
        `Kembalikan ${SECTIONS.find((item) => item.key === version.section_key)?.label} ke isi v${version.version_number}? Sistem akan membuat versi baru.`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiFetch<EffectiveSection>(
        `/ai-persona-config/${variant}/${version.section_key}/publish`,
        { method: "PUT", body: { content: version.content } },
      );
      setSuccessMessage(`Rollback dari versi ${version.version_number} berhasil.`);
      await loadPersona(variant);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal melakukan rollback.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Superadmin"
      title="AI Persona Clara"
      description="Ubah instruction, guardrail, flow, dan gaya komunikasi Clara tanpa deploy ulang aplikasi."
      backHref="/workspace"
      backLabel="Kembali ke workspace"
    >
      <div className="space-y-6">
        <section className="clara-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold clara-text-primary">
                Varian account
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Mini dan Reguler memiliki konfigurasi terpisah.
              </p>
            </div>
            <div className="flex rounded-xl border border-slate-200 p-1">
              {(["mini", "reguler"] as PersonaVariant[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void changeVariant(item)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    variant === item
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item === "mini" ? "Mini" : "Reguler"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {errorMessage && (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div role="status" className="clara-alert clara-alert-success">
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div role="status" className="clara-empty-state">
            Memuat konfigurasi persona...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
            <section className="clara-card p-3">
              <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Bagian prompt
              </p>
              <div className="space-y-1">
                {SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => {
                      setSectionKey(section.key);
                      setContent(
                        effectiveSections.find(
                          (item) => item.section_key === section.key,
                        )?.content ?? "",
                      );
                      setSuccessMessage("");
                    }}
                    className={`w-full rounded-xl p-3 text-left ${
                      sectionKey === section.key
                        ? "bg-amber-50 ring-1 ring-amber-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold clara-text-primary">
                      {section.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {section.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="clara-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold clara-text-primary">
                    {SECTIONS.find((item) => item.key === sectionKey)?.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Aktif dari {effectiveSection?.source === "database"
                      ? `database v${effectiveSection.version_number}`
                      : "file Markdown bawaan"}
                    .
                  </p>
                </div>
                <span className="clara-badge">
                  {variant === "mini" ? "Mini" : "Reguler"}
                </span>
              </div>

              <label
                htmlFor="persona-content"
                className="mt-5 block text-sm font-semibold text-slate-700"
              >
                Isi instruction
              </label>
              <textarea
                id="persona-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={50_000}
                rows={24}
                spellCheck={false}
                className="clara-input mt-2 min-h-[560px] w-full resize-y font-mono text-sm leading-6"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {content.length.toLocaleString("id-ID")} / 50.000 karakter
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setContent(effectiveSection?.content ?? "")}
                    className="clara-button clara-button-ghost"
                    disabled={isSubmitting}
                  >
                    Reset editor
                  </button>
                  <button
                    type="button"
                    onClick={() => void publishContent()}
                    className="clara-button clara-button-primary"
                    disabled={isSubmitting}
                  >
                    Simpan & langsung gunakan
                  </button>
                </div>
              </div>
            </section>

            <aside className="clara-card p-5">
              <h2 className="text-base font-bold clara-text-primary">
                Riwayat versi
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pulihkan versi lama tanpa menghapus histori.
              </p>
              <div className="mt-4 space-y-3">
                {sectionVersions.length === 0 ? (
                  <div className="clara-empty-state text-sm">
                    Belum ada versi database. Clara memakai file bawaan.
                  </div>
                ) : (
                  sectionVersions.map((version) => (
                    <article
                      key={version.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold clara-text-primary">
                          Versi {version.version_number}
                        </p>
                        <span className="clara-badge">{version.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDateTime(version.created_at)}
                      </p>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {version.content}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {version.status === "archived" && (
                          <button
                            type="button"
                            className="clara-button clara-button-ghost"
                            disabled={isSubmitting}
                            onClick={() => void rollbackVersion(version)}
                          >
                            Rollback
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
