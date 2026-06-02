"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import type {
  CurrentUser,
  CustomerProfileMergeRequest,
  CustomerProfileSummaryItem,
  CustomerProfileUpdateRequest,
} from "@/types/dashboard";

export default function CustomerProfilePage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfileSummaryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [mergeNotes, setMergeNotes] = useState("");
  const [mergingCandidateId, setMergingCandidateId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [me, data] = await Promise.all([
          apiFetch<CurrentUser>("/auth/me"),
          apiFetch<CustomerProfileSummaryItem>(`/customers/${customerId}`),
        ]);
        setCurrentUser(me);
        setProfile(data);
        setProfileForm({
          display_name: data.display_name,
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          status: data.status,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat customer profile."
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal merge customer profile."
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

    try {
      const payload: CustomerProfileUpdateRequest = {
        display_name: profileForm.display_name.trim(),
        phone: profileForm.phone.trim() || null,
        email: profileForm.email.trim() || null,
        address: profileForm.address.trim() || null,
        status: profileForm.status,
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
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menyimpan data customer."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  const relatedLeads = profile?.related_leads ?? [];
  const hotLeadCount = relatedLeads.filter((lead) => lead.lead_temperature === "hot").length;
  const warmLeadCount = relatedLeads.filter((lead) => lead.lead_temperature === "warm").length;
  const activeLeadCount = relatedLeads.filter(
    (lead) => !["won", "lost", "archived"].includes(lead.current_stage)
  ).length;
  const topPriorityLead = [...relatedLeads].sort(compareCustomerLeadPriority)[0] ?? null;
  const latestLead = [...relatedLeads]
    .sort(
      (left, right) =>
        new Date(right.last_contact_at ?? 0).getTime() -
        new Date(left.last_contact_at ?? 0).getTime()
    )[0] ?? null;
  const dominantSourceLabel =
    profile?.source_labels.length === 1
      ? profile.source_labels[0]
      : profile?.source_labels.length
        ? `${profile.source_labels.length} channel`
        : "Belum ada channel";
  const identityConfidenceLabel = profile
    ? describeIdentityConfidence(profile.identity_confidence)
    : "";
  const overviewSummary = buildCustomerOverview({
    profile,
    activeLeadCount,
    hotLeadCount,
    warmLeadCount,
    dominantSourceLabel,
  });
  const actionSummary = buildCustomerActionSummary({
    topPriorityLead,
    latestLead,
    hotLeadCount,
    profile,
  });

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Unified customer identity"
      title={profile?.display_name ?? "Customer Profile"}
      description="Satu profil customer ini menggabungkan konteks lead dan channel, supaya tim tidak lagi melihat orang yang sama sebagai entitas terpisah."
      backHref="/dashboard/crm"
      backLabel="Kembali ke Lead Management"
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="rounded-[26px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-8 text-center text-sm text-[#d6bb84]">
            Loading customer profile...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-[26px] border border-[#e17c54]/28 bg-[linear-gradient(180deg,rgba(66,33,21,0.96)_0%,rgba(36,18,12,0.98)_100%)] p-5 text-sm text-[#f0bf9f]">
            {errorMessage}
          </div>
        )}

        {profile && !isLoading && !errorMessage ? (
          <>
            <section className="rounded-[30px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(35,26,17,0.96)_0%,rgba(20,15,11,0.96)_52%,rgba(58,42,18,0.92)_100%)] p-6 shadow-[0_16px_38px_rgba(0,0,0,0.22)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f0cb73]">
                    Ringkasan Customer
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[#fff0c9]">
                    {profile.display_name} itu satu customer yang sedang dibaca dari banyak lead dan channel.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d6bb84]">
                    {overviewSummary}
                  </p>
                </div>
                <div className="rounded-[26px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(21,15,10,0.98)_0%,rgba(12,9,6,0.98)_100%)] p-5 text-white shadow-[0_16px_34px_rgba(0,0,0,0.24)] lg:max-w-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f0cb73]">
                    Apa Yang Harus Dilakukan
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#fff0c9]">
                    {actionSummary}
                  </p>
                  {topPriorityLead ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/crm/${topPriorityLead.id}`}
                        className="inline-flex rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2 text-xs font-semibold text-[#140f08]"
                      >
                        Buka Detail Lead
                      </Link>
                      {topPriorityLead.latest_conversation_id ? (
                        <Link
                          href={`/dashboard/sales/conversations/${topPriorityLead.latest_conversation_id}`}
                          className="inline-flex rounded-full border border-[#f0cb73]/24 bg-[#1f170f] px-4 py-2 text-xs font-semibold text-[#f0cb73]"
                        >
                          Buka Chat Terbaru
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <Metric label="Lead Count" value={String(profile.lead_count)} />
              <Metric label="Conversation Count" value={String(profile.conversation_count)} />
              <Metric label="Last Contact" value={formatDateTime(profile.last_contact_at)} />
              <Metric label="PIC" value={profile.assigned_user_name ?? "Belum ada"} />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Metric
                label="Identity Confidence"
                value={`${Math.round(profile.identity_confidence * 100)}% | ${identityConfidenceLabel}`}
              />
              <Metric label="Active Leads" value={String(activeLeadCount)} />
              <Metric
                label="High Intent"
                value={`${hotLeadCount} hot | ${warmLeadCount} warm`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
                <h2 className="text-xl font-semibold text-[#fff0c9]">Profil Customer</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    label="Nama yang dipakai Clara"
                    value={profile.display_name}
                    description="Nama ini dipakai Clara untuk mengelompokkan lead yang kemungkinan berasal dari customer yang sama."
                  />
                  <InfoCard
                    label="Status profil"
                    value={profile.merged_into_profile_id ? "Sudah digabung" : "Masih aktif"}
                    description={
                      profile.merged_into_profile_id
                        ? "Profil ini sudah pernah digabung ke profil customer lain."
                        : "Profil ini masih menjadi profil utama yang aktif dipakai."
                    }
                  />
                  <InfoCard
                    label="Cara Clara mengenali customer ini"
                    value={profile.match_strategy}
                    description="Ini menjelaskan cara Clara menyatukan identitas customer, misalnya dari kemiripan nama atau normalisasi nama."
                  />
                  <InfoCard
                    label="Kekuatan identitas"
                    value={identityConfidenceLabel}
                    description="Semakin tinggi nilainya, semakin kecil kemungkinan customer ini salah gabung dengan orang lain."
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    label="Telepon"
                    value={profile.phone ?? "Belum diisi"}
                    description="Nomor ini penting untuk memastikan customer yang dibaca tim memang orang yang sama."
                  />
                  <InfoCard
                    label="Email"
                    value={profile.email ?? "Belum diisi"}
                    description="Gunakan email kalau customer sudah memberi kanal komunikasi formal atau identitas tambahan."
                  />
                </div>

                <div className="mt-4">
                  <InfoCard
                    label="Alamat"
                    value={profile.address ?? "Belum diisi"}
                    description="Alamat dipakai saat tim perlu konteks wilayah, domisili, atau kebutuhan operasional tertentu."
                  />
                </div>

                <div className="mt-5 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                    Channel Coverage
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.source_labels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-3 py-1 text-xs font-semibold text-[#f0cb73]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[#d6bb84]">
                    Bagian ini membantu tim melihat customer ini datang dari channel apa saja. Kalau channel-nya banyak, pastikan tim tidak membaca orang yang sama sebagai beberapa customer berbeda.
                  </p>
                </div>
              </article>

              <article className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
                <h2 className="text-xl font-semibold text-[#fff0c9]">Yang Perlu Dicek Dulu</h2>
                <div className="mt-5 space-y-3">
                  <ActionHint
                    title="1. Cek lead yang paling panas atau paling baru"
                    description={
                      topPriorityLead
                        ? `${topPriorityLead.display_name} adalah lead paling layak dibuka dulu dari profil customer ini.`
                        : "Belum ada lead yang cukup kuat untuk diprioritaskan."
                    }
                  />
                  <ActionHint
                    title="2. Pastikan chat terbaru masih nyambung"
                    description={
                      latestLead
                        ? `Kontak terakhir tercatat di lead ${latestLead.display_name} pada ${formatDateTime(
                            latestLead.last_contact_at
                          )}.`
                        : "Belum ada histori kontak terakhir yang jelas."
                    }
                  />
                  <ActionHint
                    title="3. Kalau data terasa pecah, cek kandidat merge"
                    description="Kalau ada nama atau channel yang mirip, gunakan merge candidates untuk memastikan satu customer tidak tersebar ke beberapa profil."
                  />
                </div>
              </article>
            </section>

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-semibold text-[#fff0c9]">Data Customer</h2>
                  <p className="mt-2 text-sm leading-7 text-[#d6bb84]">
                    Bagian ini dipakai untuk mengisi identitas customer yang lebih rapi seperti yang biasanya ada di sistem CRM klasik. Isi seperlunya, tapi pastikan nama, telepon, dan statusnya tidak ngawur karena data ini bisa dipakai tim lain juga.
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#f0cb73]/18 bg-[#2a1e12] px-4 py-3 text-sm text-[#e6c887] lg:max-w-sm">
                  Jangan isi data palsu. Kalau Anda belum yakin nomor, email, atau alamatnya benar, lebih baik kosongkan dulu daripada membuat tim salah membaca customer.
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[#d6bb84]">
                  <span className="font-semibold text-[#fff0c9]">Nama Customer</span>
                  <input
                    value={profileForm.display_name}
                    onChange={(event) => {
                      setProfileForm((prev) => ({
                        ...prev,
                        display_name: event.target.value,
                      }));
                    }}
                    className="w-full rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] px-4 py-3 text-sm text-[#f7e7b7] outline-none transition focus:border-[#f0cb73]/42"
                    placeholder="Masukkan nama customer"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#d6bb84]">
                  <span className="font-semibold text-[#fff0c9]">Telepon</span>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => {
                      setProfileForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }));
                    }}
                    className="w-full rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] px-4 py-3 text-sm text-[#f7e7b7] outline-none transition focus:border-[#f0cb73]/42"
                    placeholder="08xxxx atau +62xxxx"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#d6bb84]">
                  <span className="font-semibold text-[#fff0c9]">Email</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => {
                      setProfileForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }));
                    }}
                    className="w-full rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] px-4 py-3 text-sm text-[#f7e7b7] outline-none transition focus:border-[#f0cb73]/42"
                    placeholder="customer@email.com"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#d6bb84]">
                  <span className="font-semibold text-[#fff0c9]">Status Customer</span>
                  <select
                    value={profileForm.status}
                    onChange={(event) => {
                      setProfileForm((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }));
                    }}
                    className="w-full rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] px-4 py-3 text-sm text-[#f7e7b7] outline-none transition focus:border-[#f0cb73]/42"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Tidak aktif</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block space-y-2 text-sm text-[#d6bb84]">
                <span className="font-semibold text-[#fff0c9]">Alamat</span>
                <textarea
                  value={profileForm.address}
                  onChange={(event) => {
                    setProfileForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }));
                  }}
                  rows={4}
                  className="w-full rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] px-4 py-3 text-sm text-[#f7e7b7] outline-none transition focus:border-[#f0cb73]/42"
                  placeholder="Isi alamat customer jika memang sudah diketahui"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isSavingProfile || !profileForm.display_name.trim()}
                  onClick={() => {
                    void handleProfileSave();
                  }}
                  className="inline-flex rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-5 py-3 text-sm font-semibold text-[#140f08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProfile ? "Menyimpan..." : "Simpan Data Customer"}
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
                    });
                  }}
                  className="inline-flex rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-5 py-3 text-sm font-semibold text-[#f0cb73]"
                >
                  Reset Form
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#fff0c9]">
                    Merge Candidates
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[#d6bb84]">
                    Clara menampilkan kandidat profil customer lain yang kemungkinan adalah orang yang sama. Head atau superadmin bisa merge manual kalau identity otomatis masih pecah.
                  </p>
                </div>
                <textarea
                  value={mergeNotes}
                  onChange={(event) => {
                    setMergeNotes(event.target.value);
                  }}
                  placeholder="Catatan merge opsional..."
                  className="min-h-[88px] w-full rounded-2xl border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.98)_0%,rgba(15,10,7,0.94)_100%)] p-3 text-sm text-[#f7e7b7] lg:w-80"
                />
              </div>

              <div className="mt-5 space-y-4">
                {profile.merge_candidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#f0cb73]/24 bg-[#1c140d] p-5 text-sm text-[#c8ad75]">
                    Belum ada kandidat merge yang cukup kuat untuk profil ini.
                  </div>
                ) : (
                  profile.merge_candidates.map((candidate) => (
                    <article
                      key={candidate.id}
                      className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#fff0c9]">
                          {candidate.display_name}
                        </h3>
                        <span className="rounded-full border border-[#f0cb73]/18 bg-[#f0cb73]/10 px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                          Match {Math.round(candidate.match_score * 100)}%
                        </span>
                        <span className="rounded-full border border-[#f0cb73]/18 bg-[#2a1e12] px-2.5 py-1 text-xs font-semibold text-[#e3c990]">
                          Confidence {Math.round(candidate.identity_confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[#d6bb84]">
                        {candidate.overlap_reason}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Metric label="Lead Count" value={String(candidate.lead_count)} />
                        <Metric
                          label="Conversation Count"
                          value={String(candidate.conversation_count)}
                        />
                        <Metric
                          label="Last Contact"
                          value={formatDateTime(candidate.last_contact_at)}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {candidate.source_labels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-3 py-1 text-xs font-semibold text-[#f0cb73]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      {["head", "superadmin"].includes(currentUser?.role ?? "") ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            disabled={mergingCandidateId === candidate.id}
                            onClick={() => {
                              void handleMerge(candidate.id);
                            }}
                            className="inline-flex rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {mergingCandidateId === candidate.id
                              ? "Merging..."
                              : "Merge ke Profile Ini"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#f0cb73]/18 bg-[linear-gradient(180deg,rgba(28,21,15,0.96)_0%,rgba(16,12,9,0.98)_100%)] p-6 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#fff0c9]">Lead Terkait</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[#d6bb84]">
                    Bagian ini menunjukkan semua lead yang masih dianggap milik customer yang sama. Jangan buka semuanya sekaligus. Baca yang paling prioritas dulu, lalu baru turun ke lead lain kalau memang perlu.
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#f0cb73]/18 bg-[#22190f] px-4 py-3 text-sm text-[#d6bb84]">
                  Prioritas baca:
                  <span className="ml-2 font-semibold text-[#fff0c9]">
                    hot &gt; warm &gt; kontak terbaru
                  </span>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {[...profile.related_leads].sort(compareCustomerLeadPriority).map((lead, index) => (
                  <article
                    key={lead.id}
                    className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-2.5 py-1 text-[11px] font-semibold text-[#140f08]">
                        Prioritas {index + 1}
                      </span>
                      <h3 className="text-base font-semibold text-[#fff0c9]">{lead.display_name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                          lead.lead_temperature
                        )}`}
                      >
                        {formatTemperatureLabel(lead.lead_temperature)}
                      </span>
                      <span className="rounded-full border border-[#f0cb73]/18 bg-[#2a1e12] px-2.5 py-1 text-xs font-semibold text-[#e3c990]">
                        {formatStageLabel(lead.current_stage)}
                      </span>
                      <span className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-2.5 py-1 text-xs font-semibold text-[#f0cb73]">
                        {lead.source_label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#d6bb84]">
                      {buildLeadReadingHint(lead)}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Metric label="Stage" value={formatStageLabel(lead.current_stage)} />
                      <Metric label="Last Contact" value={formatDateTime(lead.last_contact_at)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/crm/${lead.id}`}
                        className="inline-flex rounded-full border border-[#f0cb73]/18 bg-[#22190f] px-3 py-2 text-xs font-semibold text-[#f0cb73]"
                      >
                        Buka Lead
                      </Link>
                      {lead.latest_conversation_id ? (
                        <Link
                          href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
                          className="inline-flex rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-3 py-2 text-xs font-semibold text-[#140f08]"
                        >
                          Buka Conversation
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-3 text-base font-semibold text-[#fff0c9]">{value}</p>
    </div>
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
    <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f0cb73]">
        {label}
      </p>
      <p className="mt-3 text-base font-semibold text-[#fff0c9]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{description}</p>
    </div>
  );
}

function ActionHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(31,23,16,0.96)_0%,rgba(18,13,10,0.96)_100%)] p-4">
      <p className="text-sm font-semibold text-[#fff0c9]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{description}</p>
    </div>
  );
}

function compareCustomerLeadPriority(
  left: CustomerProfileSummaryItem["related_leads"][number],
  right: CustomerProfileSummaryItem["related_leads"][number]
) {
  return (
    getLeadPriorityScore(right) - getLeadPriorityScore(left) ||
    new Date(right.last_contact_at ?? 0).getTime() -
      new Date(left.last_contact_at ?? 0).getTime()
  );
}

function getLeadPriorityScore(lead: CustomerProfileSummaryItem["related_leads"][number]) {
  const temperatureScore =
    lead.lead_temperature === "hot" ? 30 : lead.lead_temperature === "warm" ? 20 : 10;
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

function formatStageLabel(value: string) {
  const labels: Record<string, string> = {
    new_lead: "Lead baru",
    qualification: "Kualifikasi",
    objection: "Keberatan",
    negotiation: "Negosiasi",
    closing: "Closing",
    won: "Menang",
    lost: "Tidak jadi",
    archived: "Arsip",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function formatTemperatureLabel(value: string) {
  const labels: Record<string, string> = {
    hot: "HOT",
    warm: "WARM",
    cold: "COLD",
    unknown: "BELUM JELAS",
  };

  return labels[value] ?? value.toUpperCase();
}

function describeIdentityConfidence(value: number) {
  if (value >= 0.9) {
    return "sangat yakin";
  }
  if (value >= 0.75) {
    return "cukup yakin";
  }
  return "perlu dicek lagi";
}

function buildCustomerOverview({
  profile,
  activeLeadCount,
  hotLeadCount,
  warmLeadCount,
  dominantSourceLabel,
}: {
  profile: CustomerProfileSummaryItem | null;
  activeLeadCount: number;
  hotLeadCount: number;
  warmLeadCount: number;
  dominantSourceLabel: string;
}) {
  if (!profile) {
    return "";
  }

  return `${profile.display_name} saat ini tercatat punya ${profile.lead_count} lead dan ${profile.conversation_count} conversation. ${activeLeadCount} lead masih aktif dibaca tim. Channel yang terlihat paling dominan: ${dominantSourceLabel}. Sinyal minat saat ini: ${hotLeadCount} hot lead dan ${warmLeadCount} warm lead.`;
}

function buildCustomerActionSummary({
  topPriorityLead,
  latestLead,
  hotLeadCount,
  profile,
}: {
  topPriorityLead: CustomerProfileSummaryItem["related_leads"][number] | null;
  latestLead: CustomerProfileSummaryItem["related_leads"][number] | null;
  hotLeadCount: number;
  profile: CustomerProfileSummaryItem | null;
}) {
  if (!profile) {
    return "";
  }

  if (topPriorityLead) {
    return `Mulai dari lead ${topPriorityLead.display_name}. Lead ini paling layak dibaca dulu karena stage-nya ${formatStageLabel(
      topPriorityLead.current_stage
    ).toLowerCase()} dan temperaturnya ${formatTemperatureLabel(
      topPriorityLead.lead_temperature
    ).toLowerCase()}. ${
      hotLeadCount > 0
        ? "Karena ada hot lead, jangan terlalu lama membaca lead yang lain."
        : latestLead
          ? `Kalau konteksnya belum jelas, cocokkan lagi dengan kontak terakhir di ${latestLead.display_name}.`
          : "Kalau konteksnya belum jelas, cek histori lead dan chat terakhir."
    }`;
  }

  return "Belum ada lead yang terlihat dominan. Mulai dari kontak paling baru, lalu cek apakah ada lead yang perlu dirapikan atau digabung.";
}

function buildLeadReadingHint(
  lead: CustomerProfileSummaryItem["related_leads"][number]
) {
  const temperature = formatTemperatureLabel(lead.lead_temperature).toLowerCase();
  const stage = formatStageLabel(lead.current_stage).toLowerCase();
  return `Lead ini sedang ada di tahap ${stage} dengan suhu ${temperature}. Buka lead ini kalau Anda ingin memahami konteks customer dari jalur ${lead.source_label} dan memastikan langkah berikutnya tidak salah arah.`;
}
