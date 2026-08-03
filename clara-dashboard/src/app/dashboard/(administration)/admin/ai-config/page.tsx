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

type BundleSection = {
  section_key: PersonaSectionKey;
  persona_config_version_id: string;
  version_number: number;
  content: string;
  content_sha256: string;
  character_count: number;
  source_type: string;
  published_at: string | null;
};

type PersonaBundle = {
  id: string;
  variant: PersonaVariant;
  bundle_version: number;
  status: "draft" | "validated" | "published" | "archived" | "rejected";
  bundle_sha256: string | null;
  validation_status: "pending" | "valid" | "invalid";
  validation_report: {
    warnings?: { code: string; section_key: PersonaSectionKey | null }[];
    blocking_errors?: { code: string; section_key: PersonaSectionKey | null }[];
  };
  validation_report_hash: string | null;
  source_bundle_id: string | null;
  created_at: string;
  published_at: string | null;
  sections: BundleSection[];
};

type BundleValidation = {
  complete: boolean;
  blocking_errors: { code: string; section_key: PersonaSectionKey | null }[];
  warnings: { code: string; section_key: PersonaSectionKey | null }[];
  bundle_hash: string;
  changed_section_keys: PersonaSectionKey[];
};

type BundleDiff = {
  changed_section_keys: PersonaSectionKey[];
  truncated: boolean;
  sections: {
    section_key: PersonaSectionKey;
    changed: boolean;
    added_lines: number;
    removed_lines: number;
    diff: string;
  }[];
};

type EffectiveBundleState = {
  effective_source: string;
  fallback_reason: string | null;
  persona_authority_mode: string;
  legacy_overlay_present: boolean;
};

type EvaluationRun = {
  id: string;
  persona_bundle_id: string;
  persona_bundle_hash: string;
  dataset_version: string;
  dataset_hash: string;
  evaluator_version: string;
  configuration_profile: string;
  status: string;
  automated_verdict: string | null;
  passed_case_count: number;
  failed_case_count: number;
  critical_failure_count: number;
  human_review_status: string;
  human_review_count: number;
  certification_status: string;
  report_hash: string | null;
  superseded_at: string | null;
};

type EvaluationCase = {
  case_id: string;
  category: string;
  authority_mode: string;
  automated_verdict: string;
  findings: { reason_codes?: string[] };
  review_count: number;
};

type BundleCertification = {
  certified: boolean;
  bundle_hash_match: boolean;
  run: EvaluationRun | null;
  message: string;
};

const REVIEW_DIMENSIONS = [
  "factual_correctness",
  "directness",
  "relevance",
  "trust",
  "risk_transparency",
  "process_continuity",
  "tone_fit",
  "cta_appropriateness",
  "operational_usefulness",
  "compliance_safety",
] as const;

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
  const [bundles, setBundles] = useState<PersonaBundle[]>([]);
  const [bundleValidation, setBundleValidation] =
    useState<BundleValidation | null>(null);
  const [bundleDiff, setBundleDiff] = useState<BundleDiff | null>(null);
  const [previewedBundleId, setPreviewedBundleId] = useState<string | null>(null);
  const [effectiveBundleState, setEffectiveBundleState] =
    useState<EffectiveBundleState | null>(null);
  const [evaluationRun, setEvaluationRun] = useState<EvaluationRun | null>(null);
  const [evaluationCases, setEvaluationCases] = useState<EvaluationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [reviewScores, setReviewScores] = useState<Record<string, number>>(
    Object.fromEntries(REVIEW_DIMENSIONS.map((key) => [key, 5])),
  );
  const [certification, setCertification] =
    useState<BundleCertification | null>(null);

  const currentBundle = bundles.find((bundle) => bundle.status === "published");
  const candidateBundle = bundles.find(
    (bundle) => bundle.status === "draft" || bundle.status === "validated",
  );

  const effectiveSection = useMemo(
    () => effectiveSections.find((item) => item.section_key === sectionKey),
    [effectiveSections, sectionKey],
  );
  const sectionVersions = useMemo(
    () => versions.filter((item) => item.section_key === sectionKey),
    [versions, sectionKey],
  );
  const latestDraft = sectionVersions.find((item) => item.status === "draft");

  async function loadPersona(nextVariant: PersonaVariant) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({ variant: nextVariant });
      const [effective, history, bundleHistory, bundleState, evaluationHistory] = await Promise.all([
        apiFetch<EffectiveSection[]>(
          `/ai-persona-config/effective?${params.toString()}`,
        ),
        apiFetch<PersonaVersion[]>(
          `/ai-persona-config?${params.toString()}`,
        ),
        nextVariant === "mini"
          ? apiFetch<PersonaBundle[]>(
              `/ai-persona-config/bundles?${params.toString()}`,
            )
          : Promise.resolve([]),
        nextVariant === "mini"
          ? apiFetch<EffectiveBundleState>(
              `/ai-persona-config/bundles/effective/current?${params.toString()}`,
            )
          : Promise.resolve(null),
        nextVariant === "mini"
          ? apiFetch<EvaluationRun[]>("/clara-evaluations")
          : Promise.resolve([]),
      ]);
      setEffectiveSections(effective);
      setVersions(history);
      setBundles(bundleHistory);
      setEffectiveBundleState(bundleState);
      const candidate = bundleHistory.find(
        (bundle) => bundle.status === "draft" || bundle.status === "validated",
      );
      const latestRun = candidate
        ? evaluationHistory.find((run) => run.persona_bundle_id === candidate.id) ?? null
        : null;
      setEvaluationRun(latestRun);
      if (candidate) {
        const certificationState = await apiFetch<BundleCertification>(
          `/clara-evaluations/bundles/${candidate.id}/certification`,
        );
        setCertification(certificationState);
      } else {
        setCertification(null);
      }
      if (latestRun) {
        const cases = await apiFetch<EvaluationCase[]>(
          `/clara-evaluations/${latestRun.id}/cases`,
        );
        const personaCases = cases.filter((item) => item.authority_mode === "PERSONA");
        setEvaluationCases(personaCases);
        setSelectedCaseId((current) => current || personaCases[0]?.case_id || "");
      } else {
        setEvaluationCases([]);
        setSelectedCaseId("");
      }
      const draftSection = bundleHistory
        .find(
          (bundle) => bundle.status === "draft" || bundle.status === "validated",
        )
        ?.sections.find((item) => item.section_key === sectionKey);
      setContent(
        draftSection?.content ??
          effective.find((item) => item.section_key === sectionKey)?.content ??
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

  async function saveDraft() {
    const cleanedContent = content.trim();
    if (!cleanedContent) {
      setErrorMessage("Isi persona tidak boleh kosong.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const saved = await apiFetch<PersonaVersion>(
        `/ai-persona-config/${variant}/${sectionKey}/drafts`,
        { method: "POST", body: { content: cleanedContent } },
      );
      if (variant === "mini") {
        if (!candidateBundle) {
          throw new Error(
            "Import current effective terlebih dahulu untuk membuat kandidat bundle.",
          );
        }
        await apiFetch<PersonaBundle>(
          `/ai-persona-config/bundles/${candidateBundle.id}/sections/${sectionKey}`,
          {
            method: "PUT",
            body: { persona_config_version_id: saved.id },
          },
        );
        setBundleValidation(null);
        setBundleDiff(null);
        setPreviewedBundleId(null);
        setSuccessMessage("Draft tersimpan dan dipilih ke kandidat bundle Mini.");
      } else {
        setSuccessMessage("Draft berhasil disimpan. Publish untuk mengaktifkannya.");
      }
      await loadPersona(variant);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan draft.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function importCurrentBundle() {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<PersonaBundle>("/ai-persona-config/bundles/import-current", {
        method: "POST",
      });
      setSuccessMessage("Current effective berhasil diimpor sebagai kandidat bundle.");
      setBundleValidation(null);
      setBundleDiff(null);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuat bundle.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function selectVersionForCandidate(version: PersonaVersion) {
    if (!candidateBundle) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<PersonaBundle>(
        `/ai-persona-config/bundles/${candidateBundle.id}/sections/${version.section_key}`,
        {
          method: "PUT",
          body: { persona_config_version_id: version.id },
        },
      );
      setBundleValidation(null);
      setBundleDiff(null);
      setPreviewedBundleId(null);
      setSuccessMessage(
        `${version.section_key} v${version.version_number} dipilih ke kandidat bundle.`,
      );
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal memilih versi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function validateCandidate() {
    if (!candidateBundle) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const [validation, diff] = await Promise.all([
        apiFetch<BundleValidation>(
          `/ai-persona-config/bundles/${candidateBundle.id}/validate`,
          { method: "POST" },
        ),
        apiFetch<BundleDiff>("/ai-persona-config/bundles/diff", {
          method: "POST",
          body: {
            old_bundle_id: currentBundle?.id ?? null,
            new_bundle_id: candidateBundle.id,
          },
        }),
      ]);
      setBundleValidation(validation);
      setBundleDiff(diff);
      setSuccessMessage(
        validation.complete
          ? "Bundle lengkap dan tervalidasi. Review preview/diff sebelum publish."
          : "Validasi selesai dengan blocker.",
      );
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Validasi gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function publishCandidate() {
    if (
      !candidateBundle ||
      !bundleValidation?.complete ||
      !certification?.certified ||
      !certification.bundle_hash_match
    ) return;
    const versions = candidateBundle.sections
      .map((item) => `${item.section_key} v${item.version_number}`)
      .join("\n");
    const warningCodes = [...new Set(bundleValidation.warnings.map((item) => item.code))];
    if (
      !window.confirm(
        `Publish complete Mini bundle?\n\n${versions}\n\nCurrent: ${currentBundle?.bundle_sha256 ?? "none"}\nCandidate: ${bundleValidation.bundle_hash}\nWarnings: ${warningCodes.join(", ") || "none"}\n\nPublication affects Clara's effective five-prompt source.`,
      )
    ) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<PersonaBundle>(
        `/ai-persona-config/bundles/${candidateBundle.id}/publish`,
        {
          method: "POST",
          body: {
            expected_current_bundle_hash: currentBundle?.bundle_sha256 ?? null,
            acknowledged_warning_codes: warningCodes,
          },
        },
      );
      setSuccessMessage("Complete Mini bundle berhasil dipublish secara atomik.");
      setBundleValidation(null);
      setBundleDiff(null);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Publish gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function previewCandidate() {
    if (!candidateBundle) return;
    setIsSubmitting(true);
    try {
      await apiFetch<unknown>(
        `/ai-persona-config/bundles/${candidateBundle.id}/preview`,
      );
      setPreviewedBundleId(candidateBundle.id);
      setSuccessMessage(
        "Preview exact five-section bundle dan provenance berhasil dimuat.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Preview gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createEvaluationRun() {
    if (!candidateBundle || candidateBundle.status !== "validated") return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<EvaluationRun>("/clara-evaluations", {
        method: "POST",
        body: {
          persona_bundle_id: candidateBundle.id,
          configuration_profile: "GOVERNED_OFFLINE_SIMULATION",
        },
      });
      setSuccessMessage("Run Golden V2 dibuat. Jalankan fixture deterministic berikutnya.");
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal membuat evaluation run.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runFixtureEvaluation() {
    if (!evaluationRun || evaluationRun.status !== "DRAFT") return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<EvaluationRun>(`/clara-evaluations/${evaluationRun.id}/evaluate`, {
        method: "POST",
        body: { fixture_mode: true },
      });
      setSuccessMessage("Evaluasi fixture selesai. Lanjutkan human review sebelum sertifikasi.");
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Evaluasi gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitHumanReview() {
    if (!evaluationRun || !selectedCaseId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch(`/clara-evaluations/${evaluationRun.id}/cases/${selectedCaseId}/reviews`, {
        method: "POST",
        body: {
          scores: reviewScores,
          hard_fail: false,
          reason_codes: ["SUPERADMIN_REVIEWED"],
        },
      });
      setSuccessMessage(`Human review ${selectedCaseId} tersimpan.`);
      const nextCase = evaluationCases.find(
        (item) => item.case_id !== selectedCaseId && item.review_count === 0,
      );
      if (nextCase) setSelectedCaseId(nextCase.case_id);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Human review gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function decideCertification(decision: "CERTIFY" | "REJECT") {
    if (!evaluationRun) return;
    if (!window.confirm(`${decision} evaluation run ini? Sertifikasi tidak mengaktifkan production.`)) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch<EvaluationRun>(`/clara-evaluations/${evaluationRun.id}/certification`, {
        method: "POST",
        body: { decision },
      });
      setSuccessMessage(`Evaluation run ${decision.toLowerCase()}.`);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Keputusan sertifikasi gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reconcileSelectedCase() {
    if (!evaluationRun || !selectedCaseId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await apiFetch(`/clara-evaluations/${evaluationRun.id}/cases/${selectedCaseId}/reconcile`, {
        method: "POST",
        body: { reconciled_scores: reviewScores },
      });
      setSuccessMessage(`Konflik review ${selectedCaseId} direkonsiliasi.`);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rekonsiliasi gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadSafeReport() {
    if (!evaluationRun) return;
    try {
      const report = await apiFetch<Record<string, unknown>>(
        `/clara-evaluations/${evaluationRun.id}/report`,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `clara-golden-v2-${evaluationRun.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Report gagal diunduh.");
    }
  }

  async function cloneHistorical(bundle: PersonaBundle) {
    setIsSubmitting(true);
    try {
      await apiFetch<PersonaBundle>(
        `/ai-persona-config/bundles/${bundle.id}/clone`,
        { method: "POST" },
      );
      setSuccessMessage(`Bundle v${bundle.bundle_version} diklon sebagai draft baru.`);
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Clone gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function rollbackWholeBundle(bundle: PersonaBundle) {
    if (!currentBundle) return;
    setIsSubmitting(true);
    try {
      const validation = await apiFetch<BundleValidation>(
        `/ai-persona-config/bundles/${bundle.id}/validate`,
        { method: "POST" },
      );
      const warningCodes = [
        ...new Set(validation.warnings.map((item) => item.code)),
      ];
      if (
        !window.confirm(
          `Rollback seluruh bundle ke v${bundle.bundle_version}?\n\nWarnings: ${warningCodes.join(", ") || "none"}\nCurrent: ${currentBundle.bundle_sha256}\nTarget source: ${bundle.bundle_sha256}`,
        )
      ) return;
      await apiFetch<PersonaBundle>(
        `/ai-persona-config/bundles/${bundle.id}/rollback`,
        {
          method: "POST",
          body: {
            expected_current_bundle_hash: currentBundle.bundle_sha256,
            acknowledged_warning_codes: warningCodes,
          },
        },
      );
      setSuccessMessage("Whole-bundle rollback berhasil dipublish.");
      await loadPersona("mini");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Rollback gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function publishVersion(version: PersonaVersion) {
    if (
      !window.confirm(
        `Publish ${SECTIONS.find((item) => item.key === version.section_key)?.label} v${version.version_number}? Perubahan langsung dipakai Clara.`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiFetch<PersonaVersion>(
        `/ai-persona-config/versions/${version.id}/publish`,
        { method: "POST" },
      );
      setSuccessMessage(`Versi ${version.version_number} berhasil dipublish.`);
      await loadPersona(variant);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal mempublish versi.",
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
      await apiFetch<PersonaVersion>(
        `/ai-persona-config/versions/${version.id}/rollback`,
        { method: "POST" },
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

        {variant === "mini" && (
          <section className="clara-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                  Mini Bundle Workspace
                </p>
                <h2 className="mt-1 text-lg font-bold clara-text-primary">
                  Governed Five-Prompt Bundle
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review: Guardrail → Instruction → Conversation Flow → Personality → Auto Adapt.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Runtime order tetap: Instruction → Guardrail → Flow → Personality Mode → Auto Adapt.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  Authority: {effectiveBundleState?.persona_authority_mode ?? "-"} · Legacy overlay: {effectiveBundleState?.legacy_overlay_present ? "aktif" : "nonaktif"} · Source: {effectiveBundleState?.effective_source ?? "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!candidateBundle && (
                  <button
                    type="button"
                    className="clara-button clara-button-primary"
                    disabled={isSubmitting}
                    onClick={() => void importCurrentBundle()}
                  >
                    Import current effective
                  </button>
                )}
                {candidateBundle && (
                  <>
                    <button
                      type="button"
                      className="clara-button clara-button-ghost"
                      disabled={isSubmitting}
                      onClick={() => void validateCandidate()}
                    >
                      Validate bundle
                    </button>
                    <button
                      type="button"
                      className="clara-button clara-button-ghost"
                      disabled={isSubmitting}
                      onClick={() => void previewCandidate()}
                    >
                      Preview exact bundle
                    </button>
                    <button
                      type="button"
                      className="clara-button clara-button-primary"
                      disabled={
                        isSubmitting ||
                        !bundleValidation?.complete ||
                        previewedBundleId !== candidateBundle.id ||
                        !certification?.certified ||
                        !certification.bundle_hash_match
                      }
                      onClick={() => void publishCandidate()}
                    >
                      Publish complete bundle
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Current effective</p>
                <p className="mt-1 font-semibold clara-text-primary">
                  {currentBundle ? `Bundle v${currentBundle.bundle_version}` : "Legacy section / Markdown fallback"}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {currentBundle?.bundle_sha256 ?? "Belum ada complete published bundle"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {currentBundle?.published_at
                    ? `Published ${formatDateTime(currentBundle.published_at)}`
                    : `Fallback: ${effectiveBundleState?.fallback_reason ?? "none"}`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Candidate</p>
                <p className="mt-1 font-semibold clara-text-primary">
                  {candidateBundle ? `Bundle v${candidateBundle.bundle_version} · ${candidateBundle.status}` : "Belum ada kandidat"}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {candidateBundle?.bundle_sha256 ?? "Import current effective untuk mulai"}
                </p>
              </div>
            </div>

            {bundleValidation && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-red-900">Blocking errors</p>
                  <p className="mt-1 text-red-700">
                    {bundleValidation.blocking_errors.length
                      ? bundleValidation.blocking_errors.map((item) => `${item.code}${item.section_key ? ` (${item.section_key})` : ""}`).join(", ")
                      : "Tidak ada"}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <p className="font-semibold text-amber-900">Warnings — acknowledged saat publish</p>
                  <p className="mt-1 text-amber-700">
                    {bundleValidation.warnings.length
                      ? bundleValidation.warnings.map((item) => `${item.code}${item.section_key ? ` (${item.section_key})` : ""}`).join(", ")
                      : "Tidak ada"}
                  </p>
                </div>
              </div>
            )}

            {candidateBundle && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Golden V2 Evaluation & Certification
                    </p>
                    <p className="mt-1 text-sm font-semibold clara-text-primary">
                      {evaluationRun
                        ? `${evaluationRun.status} · automated ${evaluationRun.automated_verdict ?? "pending"}`
                        : "Belum ada evaluation run untuk kandidat ini"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dataset {evaluationRun?.dataset_version ?? "2.0"} · Evaluator {evaluationRun?.evaluator_version ?? "2.0"}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      Dataset hash: {evaluationRun?.dataset_hash ?? "dibuat saat evaluation run"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Certification is not production activation.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!evaluationRun && (
                      <button
                        type="button"
                        className="clara-button clara-button-ghost"
                        disabled={isSubmitting || candidateBundle.status !== "validated"}
                        onClick={() => void createEvaluationRun()}
                      >
                        Create run
                      </button>
                    )}
                    {evaluationRun?.status === "DRAFT" && (
                      <button
                        type="button"
                        className="clara-button clara-button-ghost"
                        disabled={isSubmitting}
                        onClick={() => void runFixtureEvaluation()}
                      >
                        Run offline fixture
                      </button>
                    )}
                    {evaluationRun && (
                      <button
                        type="button"
                        className="clara-button clara-button-ghost"
                        onClick={() => void downloadSafeReport()}
                      >
                        Download safe report
                      </button>
                    )}
                    {evaluationRun?.status === "HUMAN_REVIEW_PENDING" && (
                      <>
                        <button
                          type="button"
                          className="clara-button clara-button-primary"
                          disabled={isSubmitting}
                          onClick={() => void decideCertification("CERTIFY")}
                        >
                          Certify
                        </button>
                        <button
                          type="button"
                          className="clara-button clara-button-ghost"
                          disabled={isSubmitting}
                          onClick={() => void decideCertification("REJECT")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {evaluationRun && (
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                    <div>PASS: {evaluationRun.passed_case_count}</div>
                    <div>FAIL: {evaluationRun.failed_case_count}</div>
                    <div>Critical: {evaluationRun.critical_failure_count}</div>
                    <div>Human review: {evaluationRun.human_review_status}</div>
                    <div>Reviews: {evaluationRun.human_review_count}</div>
                    <div>Certification: {evaluationRun.certification_status}</div>
                    <div>Hash match: {certification?.bundle_hash_match ? "yes" : "no"}</div>
                    <div>Superseded: {evaluationRun.superseded_at ? "yes" : "no"}</div>
                  </div>
                )}

                {evaluationCases.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Category completion: {[...new Set(evaluationCases.map((item) => item.category))]
                      .map((category) => `${category} ${evaluationCases.filter((item) => item.category === category).length}/5`)
                      .join(" · ")}
                  </p>
                )}

                {evaluationRun?.status === "HUMAN_REVIEW_PENDING" && evaluationCases.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <label className="text-sm font-semibold clara-text-primary" htmlFor="evaluation-case">
                      PERSONA case untuk human review
                    </label>
                    <select
                      id="evaluation-case"
                      className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
                      value={selectedCaseId}
                      onChange={(event) => setSelectedCaseId(event.target.value)}
                    >
                      {evaluationCases.map((item) => (
                        <option key={item.case_id} value={item.case_id}>
                          {item.case_id} · {item.category} · {item.automated_verdict} · {item.review_count} review
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {REVIEW_DIMENSIONS.map((dimension) => (
                        <label key={dimension} className="text-xs text-slate-600">
                          {dimension.replaceAll("_", " ")}
                          <input
                            type="number"
                            min={1}
                            max={5}
                            required
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                            value={reviewScores[dimension]}
                            onChange={(event) =>
                              setReviewScores((current) => ({
                                ...current,
                                [dimension]: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="clara-button clara-button-ghost mt-3"
                      disabled={isSubmitting}
                      onClick={() => void submitHumanReview()}
                    >
                      Submit human review
                    </button>
                    <button
                      type="button"
                      className="clara-button clara-button-ghost mt-3 ml-2"
                      disabled={isSubmitting}
                      onClick={() => void reconcileSelectedCase()}
                    >
                      Reconcile conflict
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Safe findings: {evaluationCases.find((item) => item.case_id === selectedCaseId)?.findings.reason_codes?.join(", ") || "none"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      COMPLAINT dan ADVERSARIAL_COMPLIANCE wajib direview dua superadmin berbeda; konflik harus direkonsiliasi reviewer ketiga.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

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
                        candidateBundle?.sections.find(
                          (item) => item.section_key === section.key,
                        )?.content ??
                          effectiveSections.find(
                            (item) => item.section_key === section.key,
                          )?.content ??
                          "",
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
                    {variant === "mini" && candidateBundle
                      ? `Kandidat bundle v${candidateBundle.bundle_version}`
                      : "Aktif dari "}
                    {!(variant === "mini" && candidateBundle) && (effectiveSection?.source === "database"
                      ? `database v${effectiveSection.version_number}`
                      : "file Markdown bawaan")}
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
                    onClick={() => void saveDraft()}
                    className="clara-button clara-button-primary"
                    disabled={isSubmitting}
                  >
                    Simpan draft
                  </button>
                  {variant === "reguler" && latestDraft && (
                    <button
                      type="button"
                      onClick={() => void publishVersion(latestDraft)}
                      className="clara-button"
                      disabled={isSubmitting}
                    >
                      Publish v{latestDraft.version_number}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <aside className="clara-card p-5">
              <h2 className="text-base font-bold clara-text-primary">
                Riwayat versi
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Publish atau pulihkan versi lama tanpa menghapus histori.
              </p>
              <div className="mt-4 space-y-3">
                {variant === "mini" && bundleDiff && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs">
                    <p className="font-semibold text-amber-900">Section diff</p>
                    {bundleDiff.sections
                      .filter((item) => item.section_key === sectionKey)
                      .map((item) => (
                        <div key={item.section_key} className="mt-2">
                          <p className="text-amber-800">
                            +{item.added_lines} / -{item.removed_lines} · {item.changed ? "changed" : "unchanged"}
                          </p>
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">
                            {item.diff || "Tidak ada perubahan."}
                          </pre>
                        </div>
                      ))}
                  </div>
                )}
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
                        {variant === "mini" && candidateBundle && (
                          <button
                            type="button"
                            className="clara-button clara-button-ghost"
                            disabled={isSubmitting}
                            onClick={() => void selectVersionForCandidate(version)}
                          >
                            Pilih ke bundle
                          </button>
                        )}
                        {variant === "reguler" && version.status === "draft" && (
                          <button
                            type="button"
                            className="clara-button clara-button-primary"
                            disabled={isSubmitting}
                            onClick={() => void publishVersion(version)}
                          >
                            Publish
                          </button>
                        )}
                        {variant === "reguler" && version.status === "archived" && (
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
              {variant === "mini" && bundles.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <p className="text-sm font-bold clara-text-primary">Riwayat bundle Mini</p>
                  <div className="mt-3 space-y-2">
                    {bundles.map((bundle) => (
                      <div key={bundle.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">Bundle v{bundle.bundle_version}</span>
                          <span className="clara-badge">{bundle.status}</span>
                        </div>
                        <p className="mt-1 text-slate-500">{formatDateTime(bundle.created_at)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {bundle.status === "archived" && (
                            <>
                              <button type="button" className="clara-button clara-button-ghost" disabled={isSubmitting || Boolean(candidateBundle)} onClick={() => void cloneHistorical(bundle)}>
                                Clone draft
                              </button>
                              <button type="button" className="clara-button clara-button-ghost" disabled={isSubmitting || !currentBundle} onClick={() => void rollbackWholeBundle(bundle)}>
                                Rollback whole bundle
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
