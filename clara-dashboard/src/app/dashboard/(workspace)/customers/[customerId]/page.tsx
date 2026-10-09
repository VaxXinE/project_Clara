"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { customerLabel } from "@/lib/customer";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
import {
  ACCOUNT_CATEGORY,
  PROCESS_DECISION,
  PROCESS_SOURCE,
  PROCESS_STATE,
  STAGE,
  TEMPERATURE,
  labelOf,
} from "@/lib/vocab";
import type {
  CurrentUser,
  CustomerProfileMergeRequest,
  CustomerProfileSummaryItem,
  CustomerProfileUpdateRequest,
  CustomerProcessStateItem,
  ProcessStateEventItem,
  ProcessStateTransitionResponse,
} from "@/types/dashboard";

const PROCESS_STATES = [
  "UNKNOWN",
  "NEW_INQUIRY",
  "EXPLORATION",
  "READY_TO_PROCEED",
  "DATA_SUBMITTED",
  "VERIFICATION_IN_PROGRESS",
  "VERIFIED",
  "ONBOARDING_OR_ACTIVATION",
  "ACCOUNT_ACTIVE",
  "FUNDED",
  "ACTIVE_SUPPORT",
] as const;

export default function CustomerProfilePage() {
  const confirm = useConfirm();
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfileSummaryItem | null>(null);
  const [processState, setProcessState] = useState<CustomerProcessStateItem | null>(null);
  const [processHistory, setProcessHistory] = useState<ProcessStateEventItem[]>([]);
  const [proposedProcessState, setProposedProcessState] = useState("UNKNOWN");
  const processReasonCode = "MANUAL_CONFIRMATION";
  const [isSavingProcessState, setIsSavingProcessState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [mergeNotes, setMergeNotes] = useState("");
  const [mergingCandidateId, setMergingCandidateId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
    temperature: "unknown",
    account_category: "unknown",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;

  useEffect(() => {
    async function loadProfile() {
      try {
        const [me, data, currentProcessState, processEvents] = await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<CustomerProfileSummaryItem>(`/customers/${customerId}`),
          apiFetch<CustomerProcessStateItem>(`/customers/${customerId}/process-state`),
          apiFetch<ProcessStateEventItem[]>(`/customers/${customerId}/process-state/history`),
        ]);
        setCurrentUser(me);
        setProfile(data);
        setProcessState(currentProcessState);
        setProcessHistory(processEvents);
        setProposedProcessState(currentProcessState.current_state);
        setProfileForm({
          display_name: data.display_name,
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          status: data.status,
          temperature: data.temperature,
          account_category: deriveEditableAccountCategory(data.related_leads),
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Profil customer belum bisa dimuat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (customerId) {
      void loadProfile();
    }
  }, [customerId]);

  async function handleMerge(candidateId: string) {
    if (!profile) {
      return;
    }

    setMergingCandidateId(candidateId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: CustomerProfileMergeRequest = {
        source_profile_id: candidateId,
        target_profile_id: profile.id,
        merge_notes: mergeNotes.trim() || null,
      };
      const updated = await apiFetch<CustomerProfileSummaryItem>("/customers/merge", {
        method: "POST",
        body: payload,
      });
      setProfile(updated);
      setMergeNotes("");
      setSuccessMessage("Profil customer berhasil digabung.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Profil belum bisa digabung. Coba lagi."
      );
    } finally {
      setMergingCandidateId(null);
    }
  }

  async function handleProfileSave() {
    if (!profile) {
      return;
    }

    setIsSavingProfile(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: CustomerProfileUpdateRequest = {
        display_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        email: profileForm.email.trim() || null,
        address: profileForm.address.trim() || null,
        status: profileForm.status,
        temperature: profileForm.temperature,
        account_category: profileForm.account_category,
      };
      const updated = await apiFetch<CustomerProfileSummaryItem>(`/customers/${profile.id}`, {
        method: "PATCH",
        body: payload,
      });
      setProfile(updated);
      setProfileForm({
        display_name: updated.display_name,
        phone: updated.phone ?? "",
        email: updated.email ?? "",
        address: updated.address ?? "",
        status: updated.status,
        temperature: updated.temperature,
        account_category: deriveEditableAccountCategory(updated.related_leads),
      });
      setSuccessMessage("Data customer tersimpan.");
      setIsEditingProfile(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Data customer belum bisa disimpan. Coba lagi."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleProcessStateTransition() {
    if (!processState || !profile) {
      return;
    }
    setIsSavingProcessState(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiFetch<ProcessStateTransitionResponse>(
        `/customers/${profile.id}/process-state/transitions`,
        {
          method: "POST",
          body: {
            proposed_state: proposedProcessState,
            expected_version: processState.version,
            reason_code: processReasonCode.trim().toUpperCase(),
          },
        }
      );
      const history = await apiFetch<ProcessStateEventItem[]>(
        `/customers/${profile.id}/process-state/history`
      );
      setProcessState(result.current);
      setProcessHistory(history);
      setSuccessMessage(`Tahap proses tersimpan: ${labelOf(PROCESS_STATE, result.current.current_state)}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tahap proses belum bisa diubah. Coba lagi.");
    } finally {
      setIsSavingProcessState(false);
    }
  }

  const relatedLeads = profile?.related_leads ?? [];
  const sortedLeads = [...relatedLeads].sort(compareCustomerLeadPriority);
  const activeLeadCount = relatedLeads.filter(
    (lead) => !["won", "lost", "archived"].includes(lead.current_stage),
  ).length;
  const topPriorityLead = sortedLeads[0] ?? null;
  const latestLead =
    [...relatedLeads].sort(
      (left, right) =>
        new Date(right.last_contact_at ?? 0).getTime() - new Date(left.last_contact_at ?? 0).getTime(),
    )[0] ?? null;
  const dominantSourceLabel =
    profile?.source_labels.length === 1
      ? profile.source_labels[0]
      : profile?.source_labels.length
        ? `${profile.source_labels.length} channel`
        : "Belum ada channel";
  const accountCategorySummary = buildAccountCategorySummary(relatedLeads);
  const canMergeProfiles = ["head", "superadmin"].includes(currentUser?.role ?? "");
  const canSubmitProcessState =
    currentUser?.role !== "sales" ||
    (processState !== null &&
      PROCESS_STATES.indexOf(processState.current_state as (typeof PROCESS_STATES)[number]) <=
        PROCESS_STATES.indexOf("DATA_SUBMITTED"));
  const mergeCandidateCount = profile?.merge_candidates.length ?? 0;
  const nextStepText = topPriorityLead
    ? `Mulai dari lead ${topPriorityLead.display_name} (${labelOf(STAGE, topPriorityLead.current_stage)}).`
    : "Belum ada lead untuk customer ini. Cek data customer di bawah.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={profile ? customerLabel(profile.display_name).text : "Profil customer"}
      description={
        isSalesWorkspace
          ? "Semua tentang satu customer: lead, percakapan, dan datanya."
          : "Ringkasan satu customer lintas lead dan channel."
      }
      backHref="/customers"
      backLabel="Kembali ke daftar customer"
      actions={
        <>
          {latestLead?.latest_conversation_id ? (
            <Link
              href={`/sales/conversations/${latestLead.latest_conversation_id}`}
              className="clara-button clara-button-secondary"
            >
              Buka chat terbaru
            </Link>
          ) : null}
          {topPriorityLead ? (
            <Link href={`/crm/${topPriorityLead.id}`} className="clara-button clara-button-primary">
              Buka lead utama
            </Link>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        {isLoading ? <LoadingState message="Memuat profil customer..." /> : null}

        {errorMessage && !profile ? <ErrorState message={errorMessage} /> : null}

        {errorMessage && profile ? (
          <div role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div role="status" aria-live="polite" className="clara-alert clara-alert-success">
            {successMessage}
          </div>
        ) : null}

        {profile && !isLoading ? (
          <>
            <section
              data-onboarding-id="sales-customer-detail-focus"
              aria-label="Ringkasan customer"
              className="clara-card p-5 sm:p-6"
            >
              <div data-onboarding-id="sales-customer-detail-summary">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={profile.status === "inactive" ? "neutral" : "good"}>
                    {profile.status === "inactive" ? "Tidak aktif" : "Aktif"}
                  </Tag>
                  {profile.temperature !== "unknown" ? <ValueTag table={TEMPERATURE} value={profile.temperature} /> : null}
                  {profile.identity_confidence < 0.75 ? (
                    <Tag tone="warn" title="Clara belum sepenuhnya yakin data ini milik satu orang yang sama.">
                      Identitas perlu dicek
                    </Tag>
                  ) : null}
                </div>

                <h2 className="mt-3 text-xl font-bold clara-text-primary sm:text-2xl">{nextStepText}</h2>
                {isLeadershipWorkspace ? (
                  <p className="mt-1 text-sm clara-text-secondary">
                    Cek apakah pemilik dan jadwal follow-up lead utamanya sudah sesuai.
                  </p>
                ) : null}

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm md:grid-cols-3 xl:grid-cols-6">
                  <Fact label="Lead aktif" value={String(activeLeadCount)} />
                  <Fact label="Percakapan" value={String(profile.conversation_count)} />
                  <Fact label="Channel" value={dominantSourceLabel} />
                  <Fact label="Kategori akun" value={accountCategorySummary} />
                  <Fact label="Terakhir dihubungi" value={formatRelativeTime(profile.last_contact_at)} />
                  <Fact label="Sales" value={profile.assigned_user_name ?? "Belum ada"} />
                </dl>
              </div>
            </section>

            <section aria-labelledby="customer-leads-title" className="space-y-3">
              <h2 id="customer-leads-title" className="text-base font-semibold clara-text-primary">
                Lead customer ini <span className="font-normal clara-text-muted">({relatedLeads.length})</span>
              </h2>

              {sortedLeads.length === 0 ? (
                <EmptyState
                  title="Belum ada lead"
                  description="Lead dibuat otomatis saat ada chat dari customer ini."
                />
              ) : (
                <ul className="space-y-3">
                  {sortedLeads.map((lead, index) => (
                    <li key={lead.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-semibold clara-text-primary">{customerLabel(lead.display_name).text}</h3>
                            {index === 0 && sortedLeads.length > 1 ? <Tag tone="gold">Paling mendesak</Tag> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {lead.current_stage !== "unknown" ? <ValueTag table={STAGE} value={lead.current_stage} /> : null}
                            {lead.lead_temperature !== "unknown" ? (
                              <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
                            ) : null}
                            {lead.account_category !== "unknown" ? (
                              <Tag>{labelOf(ACCOUNT_CATEGORY, lead.account_category)}</Tag>
                            ) : null}
                            <Tag>{lead.source_label}</Tag>
                          </div>
                          <p className="mt-2 text-xs clara-text-muted">
                            Terakhir dihubungi {formatRelativeTime(lead.last_contact_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Link href={`/crm/${lead.id}`} className="clara-button clara-button-primary">
                            Buka lead
                          </Link>
                          {lead.latest_conversation_id ? (
                            <Link
                              href={`/sales/conversations/${lead.latest_conversation_id}`}
                              className="clara-button clara-button-secondary"
                            >
                              Buka chat
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              data-onboarding-id="sales-customer-detail-profile"
              aria-labelledby="customer-data-title"
              className="clara-card p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="customer-data-title" className="text-lg font-bold clara-text-primary">
                    Data customer
                  </h2>
                  <p className="mt-1 text-sm clara-text-secondary">
                    Rapikan kalau ada yang salah atau belum lengkap. Kosongkan kalau belum yakin, jangan diisi
                    asal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile((prev) => !prev)}
                  className="clara-button clara-button-secondary"
                  aria-expanded={isEditingProfile}
                >
                  {isEditingProfile ? "Tutup" : "Ubah data"}
                </button>
              </div>

              {!isEditingProfile ? (
                <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <Fact label="Nama" value={profile.display_name} />
                  <Fact label="Telepon" value={profile.phone ?? "Belum diisi"} />
                  <Fact label="Email" value={profile.email ?? "Belum diisi"} />
                  <Fact label="Alamat" value={profile.address ?? "Belum diisi"} />
                  <Fact
                    label="Suhu customer"
                    value={`${labelOf(TEMPERATURE, profile.temperature)}${
                      profile.temperature_source === "manual" ? " (diisi manual)" : " (dinilai Clara)"
                    }`}
                  />
                  <Fact label="Kekuatan identitas" value={describeIdentityConfidence(profile.identity_confidence)} />
                </dl>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nama customer">
                      <input
                        value={profileForm.display_name}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, display_name: event.target.value }))}
                        className="clara-input w-full"
                        placeholder="Nama lengkap customer"
                      />
                    </Field>
                    <Field label="Telepon">
                      <input
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                        className="clara-input w-full"
                        placeholder="08xxxx atau +62xxxx"
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                        className="clara-input w-full"
                        placeholder="nama@email.com"
                      />
                    </Field>
                    <Field label="Status customer">
                      <select
                        value={profileForm.status}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, status: event.target.value }))}
                        className="clara-select w-full"
                      >
                        <option value="active">Aktif</option>
                        <option value="inactive">Tidak aktif</option>
                      </select>
                    </Field>
                    <Field label="Suhu customer">
                      <select
                        value={profileForm.temperature}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, temperature: event.target.value }))}
                        className="clara-select w-full"
                      >
                        {["unknown", "cold", "warm", "hot"].map((value) => (
                          <option key={value} value={value}>
                            {labelOf(TEMPERATURE, value)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Kategori akun">
                      <select
                        value={profileForm.account_category}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, account_category: event.target.value }))
                        }
                        className="clara-select w-full"
                      >
                        {["unknown", "mini", "reguler"].map((value) => (
                          <option key={value} value={value}>
                            {value === "unknown" ? "Belum ditentukan" : labelOf(ACCOUNT_CATEGORY, value)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Alamat">
                    <textarea
                      value={profileForm.address}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
                      rows={3}
                      className="clara-textarea w-full"
                      placeholder="Isi kalau sudah diketahui"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isSavingProfile || !profileForm.display_name.trim()}
                      onClick={() => void handleProfileSave()}
                      className="clara-button clara-button-primary"
                    >
                      {isSavingProfile ? "Menyimpan..." : "Simpan data"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm({
                          display_name: profile.display_name,
                          phone: profile.phone ?? "",
                          email: profile.email ?? "",
                          address: profile.address ?? "",
                          status: profile.status,
                          temperature: profile.temperature,
                          account_category: deriveEditableAccountCategory(profile.related_leads),
                        });
                        setIsEditingProfile(false);
                      }}
                      className="clara-button clara-button-ghost"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </section>

            {processState ? (
              <details
                open={processState.reconciliation_required}
                className="clara-card group p-5 sm:p-6"
              >
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-lg font-bold clara-text-primary">
                  <span>
                    Tahap proses customer:{" "}
                    <span className="text-clara-gold">{labelOf(PROCESS_STATE, processState.current_state)}</span>
                  </span>
                  <span className="text-sm font-normal clara-text-secondary group-open:hidden">Tampilkan</span>
                </summary>
                <p className="mt-1 text-sm clara-text-secondary">
                  Sejauh mana customer ini sudah melangkah, dari bertanya sampai akunnya aktif. Ini terpisah dari
                  tahap lead.
                </p>

                {processState.reconciliation_required ? (
                  <div role="alert" className="clara-alert clara-alert-danger mt-4">
                    Setelah penggabungan profil, tahap proses customer ini bertabrakan. Manager atau head perlu
                    meninjaunya.
                  </div>
                ) : null}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm md:grid-cols-4">
                  <Fact label="Tahap proses" value={labelOf(PROCESS_STATE, processState.current_state)} />
                  <Fact label="Tahap lead" value={topPriorityLead ? labelOf(STAGE, topPriorityLead.current_stage) : "Belum ada"} />
                  <Fact label="Keyakinan Clara" value={`${Math.round(processState.confidence_score * 100)}%`} />
                  <Fact label="Terakhir dikonfirmasi" value={formatDateTime(processState.last_confirmed_at)} />
                </dl>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4">
                    <h3 className="font-semibold clara-text-primary">Koreksi tahap proses</h3>
                    {canSubmitProcessState ? (
                      <div className="mt-3 space-y-4">
                        <Field label="Tahap yang benar">
                          <select
                            className="clara-select w-full"
                            value={proposedProcessState}
                            onChange={(event) => setProposedProcessState(event.target.value)}
                          >
                            {PROCESS_STATES.filter(
                              (state) =>
                                currentUser?.role !== "sales" ||
                                (PROCESS_STATES.indexOf(state) >=
                                  PROCESS_STATES.indexOf(processState.current_state as (typeof PROCESS_STATES)[number]) &&
                                  PROCESS_STATES.indexOf(state) <= PROCESS_STATES.indexOf("DATA_SUBMITTED")),
                            ).map((state) => (
                              <option key={state} value={state}>
                                {labelOf(PROCESS_STATE, state)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <button
                          type="button"
                          className="clara-button clara-button-primary"
                          disabled={isSavingProcessState}
                          onClick={() => void handleProcessStateTransition()}
                        >
                          {isSavingProcessState ? "Menyimpan..." : "Simpan tahap proses"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 clara-text-secondary">
                        Tahap setelah &ldquo;Data sudah dikirim&rdquo; hanya bisa dikoreksi oleh manager, head, atau
                        superadmin.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-clara-line-subtle bg-clara-sunken p-4">
                    <h3 className="font-semibold clara-text-primary">Riwayat perubahan</h3>
                    {processHistory.length ? (
                      <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                        {processHistory.map((event) => (
                          <li key={event.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold clara-text-primary">
                                {labelOf(PROCESS_DECISION, event.decision)}
                              </span>
                              <span className="text-xs clara-text-muted">{formatRelativeTime(event.created_at)}</span>
                            </div>
                            <p className="mt-1 clara-text-secondary">
                              {labelOf(PROCESS_STATE, event.previous_state)} <span aria-hidden="true">→</span>
                              <span className="sr-only"> menjadi </span> {labelOf(PROCESS_STATE, event.proposed_state)}
                            </p>
                            <p className="mt-1 text-xs clara-text-muted">
                              Sumber: {labelOf(PROCESS_SOURCE, event.source_type)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm clara-text-secondary">Belum ada perubahan tahap proses.</p>
                    )}
                  </div>
                </div>
              </details>
            ) : null}

            {canMergeProfiles ? (
              <details className="clara-card-outline group p-5 sm:p-6">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-lg font-bold clara-text-primary">
                  <span>
                    Profil kembar yang mungkin sama{" "}
                    <span className="font-normal clara-text-muted">({mergeCandidateCount})</span>
                  </span>
                  <span className="text-sm font-normal clara-text-secondary group-open:hidden">Tampilkan</span>
                </summary>
                <p className="mt-1 text-sm leading-6 clara-text-secondary">
                  Clara menemukan profil lain yang kemungkinan orang yang sama. Gabungkan kalau memang sama, supaya
                  lead dan percakapannya jadi satu.
                </p>
                <p className="clara-alert clara-alert-danger mt-3">
                  Menggabungkan memindahkan lead dan percakapan profil lain ke profil ini. Pastikan keduanya benar-benar
                  customer yang sama.
                </p>

                <div className="mt-4">
                  <label htmlFor="customer-merge-notes" className="clara-label">
                    Alasan menggabungkan (boleh dikosongkan)
                  </label>
                  <textarea
                    id="customer-merge-notes"
                    value={mergeNotes}
                    onChange={(event) => setMergeNotes(event.target.value)}
                    placeholder="Contoh: nomor teleponnya sama"
                    className="clara-textarea mt-2 min-h-[88px] w-full"
                  />
                </div>

                {profile.merge_candidates.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-clara-dashed p-4 text-sm clara-text-secondary">
                    Belum ada profil lain yang cukup mirip dengan customer ini.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {profile.merge_candidates.map((candidate) => (
                      <li key={candidate.id} className="rounded-2xl border border-clara-line-subtle bg-clara-raised p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold clara-text-primary">{candidate.display_name}</h3>
                          <Tag tone="info">Kemiripan {Math.round(candidate.match_score * 100)}%</Tag>
                        </div>
                        <p className="mt-2 text-sm leading-6 clara-text-secondary">{candidate.overlap_reason}</p>
                        <p className="mt-2 text-xs clara-text-muted">
                          {candidate.lead_count} lead · {candidate.conversation_count} percakapan · terakhir dihubungi{" "}
                          {formatRelativeTime(candidate.last_contact_at)}
                        </p>
                        {candidate.source_labels.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {candidate.source_labels.map((label) => (
                              <Tag key={label}>{label}</Tag>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={mergingCandidateId !== null}
                            onClick={async () => {
                              const accepted = await confirm({
                                title: "Gabungkan profil customer?",
                                message: (
                                  <>
                                    Lead dan percakapan milik <strong>{candidate.display_name}</strong> akan
                                    dipindahkan ke profil <strong>{profile.display_name}</strong>. Pastikan keduanya
                                    memang customer yang sama.
                                  </>
                                ),
                                confirmLabel: "Gabungkan",
                                tone: "danger",
                              });
                              if (accepted) {
                                void handleMerge(candidate.id);
                              }
                            }}
                            className="clara-button clara-button-danger"
                          >
                            {mergingCandidateId === candidate.id ? "Menggabungkan..." : "Gabungkan ke profil ini"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="clara-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}

function compareCustomerLeadPriority(
  left: CustomerProfileSummaryItem["related_leads"][number],
  right: CustomerProfileSummaryItem["related_leads"][number],
) {
  return (
    getLeadPriorityScore(right) - getLeadPriorityScore(left) ||
    new Date(right.last_contact_at ?? 0).getTime() - new Date(left.last_contact_at ?? 0).getTime()
  );
}

function getLeadPriorityScore(lead: CustomerProfileSummaryItem["related_leads"][number]) {
  const temperatureScore = lead.lead_temperature === "hot" ? 30 : lead.lead_temperature === "warm" ? 20 : 10;
  const stageScore =
    lead.current_stage === "closing"
      ? 18
      : lead.current_stage === "negotiation"
        ? 15
        : lead.current_stage === "objection"
          ? 12
          : lead.current_stage === "qualification"
            ? 10
            : lead.current_stage === "won"
              ? 4
              : 6;
  return temperatureScore + stageScore;
}

function describeIdentityConfidence(value: number) {
  if (value >= 0.9) {
    return "Sangat yakin";
  }
  if (value >= 0.75) {
    return "Cukup yakin";
  }
  return "Perlu dicek lagi";
}

function buildAccountCategorySummary(relatedLeads: CustomerProfileSummaryItem["related_leads"]) {
  const normalizedCategories = Array.from(new Set(relatedLeads.map((lead) => lead.account_category)));

  if (normalizedCategories.length === 0) {
    return "Belum terbaca";
  }

  const knownCategories = normalizedCategories.filter((category) => category !== "unknown");

  if (knownCategories.length === 0) {
    return "Belum ditentukan";
  }

  return knownCategories.map((category) => labelOf(ACCOUNT_CATEGORY, category)).join(" + ");
}

function deriveEditableAccountCategory(relatedLeads: CustomerProfileSummaryItem["related_leads"]) {
  const normalizedCategories = Array.from(new Set(relatedLeads.map((lead) => lead.account_category))).filter(
    (category) => category !== "unknown",
  );

  if (normalizedCategories.length === 1) {
    return normalizedCategories[0];
  }

  return "unknown";
}
