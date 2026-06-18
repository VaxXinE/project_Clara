"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, getLeadBadgeClass } from "@/lib/format";
import { isHeadRole, isManagerRole, normalizeWorkspaceRole } from "@/lib/roles";
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
    temperature: "unknown",
    account_category: "unknown",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [activePanel, setActivePanel] = useState<"leads" | "profile" | "merge">("profile");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const workspaceRole = currentUser ? normalizeWorkspaceRole(currentUser.role) : null;
  const isSalesWorkspace = workspaceRole === "sales";
  const isManagerWorkspace = isManagerRole(currentUser?.role);
  const isHeadWorkspace = isHeadRole(currentUser?.role);
  const isLeadershipWorkspace = isManagerWorkspace || isHeadWorkspace;

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
          temperature: data.temperature,
          account_category: deriveEditableAccountCategory(data.related_leads),
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
  const accountCategorySummary = buildAccountCategorySummary(relatedLeads);
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
  const canMergeProfiles = ["head", "superadmin"].includes(currentUser?.role ?? "");
  const mergeCandidateCount = profile?.merge_candidates.length ?? 0;
  const profileFocus = buildCustomerFocusSummary({
    profile,
    topPriorityLead,
    latestLead,
    isLeadershipWorkspace,
  });
  const managerProfileSummary =
    topPriorityLead
      ? `Customer ini masih aktif di tim dan lead paling penting saat ini adalah ${topPriorityLead.display_name}. Manager cukup pastikan owner, stage, dan follow-up lead ini masih sehat sebelum membaca lead lain.`
      : latestLead
        ? `Belum ada lead yang benar-benar dominan, jadi manager bisa mulai dari lead dengan kontak terbaru yaitu ${latestLead.display_name}.`
        : "Belum ada lead dominan maupun kontak terbaru yang kuat. Fokus manager cukup ke validitas identitas customer dan distribusi lead-nya.";
  const managerNextAction = topPriorityLead
    ? "Buka lead prioritas lalu cek apakah follow-up, stage, dan konteks customer masih sinkron."
    : latestLead
      ? "Buka lead dengan kontak terbaru untuk membaca ritme eksekusi terakhir."
      : "Validasi profil customer ini dulu sebelum turun ke lead lain.";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow="Profil customer"
      title={profile?.display_name ?? "Profil Customer"}
      description={
        isSalesWorkspace
          ? "Halaman ini merangkum satu customer lintas lead dan channel. Gunakan untuk memastikan identitasnya benar, lihat lead yang paling aktif, lalu lanjut kerja ke lead yang tepat."
          : isLeadershipWorkspace
            ? "Halaman manager untuk membaca satu customer lintas lead: siapa owner-nya, lead mana yang paling penting, dan apakah relasi customer ini masih sehat dibaca tim."
            : "Satu profil customer ini menggabungkan konteks lead dan channel, supaya tim tidak lagi melihat orang yang sama sebagai entitas terpisah."
      }
      backHref="/dashboard/crm"
      backLabel="Kembali ke lead"
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
            <section className="rounded-[34px] border border-[#f0cb73]/18 bg-[linear-gradient(135deg,rgba(31,23,16,0.96)_0%,rgba(22,16,12,0.96)_45%,rgba(71,49,19,0.94)_100%)] p-6 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f0cb73]">
                {isLeadershipWorkspace
                  ? "Fokus manager pada customer ini"
                  : "Fokus customer ini"}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#fff3cf]">
                {profileFocus.headline}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#e3c990]">
                {profileFocus.helper}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#e9d4a0]">
                <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                  Lead aktif: <span className="font-semibold text-[#fff3cf]">{activeLeadCount}</span>
                </span>
                <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                  Channel: <span className="font-semibold text-[#fff3cf]">{dominantSourceLabel}</span>
                </span>
                <span className="rounded-full border border-[#f0cb73]/18 bg-[#1e160f] px-3 py-1.5">
                  Kategori akun: <span className="font-semibold text-[#fff3cf]">{accountCategorySummary}</span>
                </span>
              </div>
            </section>

            <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px] xl:items-start">
                <div className="max-w-4xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                    {isLeadershipWorkspace
                      ? "Ringkasan monitor customer"
                      : "Ringkasan customer"}
                  </p>
                  <h2 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950">
                    {isLeadershipWorkspace
                      ? `${profile.display_name} dibaca Clara sebagai satu customer dengan beberapa lead yang perlu dijaga tetap sinkron.`
                      : `${profile.display_name} dibaca Clara sebagai satu customer meskipun muncul di beberapa lead atau channel.`}
                  </h2>
                  <p className="mt-4 max-w-3xl text-[15px] leading-8 text-slate-700">
                    {isLeadershipWorkspace
                      ? managerProfileSummary
                      : overviewSummary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <HeroPill
                      label="Kategori akun"
                      value={accountCategorySummary}
                      accent="amber"
                    />
                    <HeroPill
                      label="Channel utama"
                      value={dominantSourceLabel}
                      accent="slate"
                    />
                    <HeroPill
                      label="Keyakinan identitas"
                      value={`${Math.round(profile.identity_confidence * 100)}%`}
                      accent="emerald"
                    />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200">
                    Langkah berikutnya
                  </p>
                  <p className="mt-4 text-[15px] leading-8 text-slate-100">
                    {isLeadershipWorkspace
                      ? managerNextAction
                      : actionSummary}
                  </p>
                  {topPriorityLead ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/dashboard/crm/${topPriorityLead.id}`}
                        className="inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.22)] ring-1 ring-white/80"
                      >
                        Buka Lead Prioritas
                      </Link>
                      {topPriorityLead.latest_conversation_id ? (
                        <Link
                          href={`/dashboard/sales/conversations/${topPriorityLead.latest_conversation_id}`}
                          className="inline-flex rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          Buka Percakapan Terbaru
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Mulai dari sini
                  </p>
                  <p className="mt-3 text-[15px] leading-8 text-slate-700">
                    {isSalesWorkspace
                      ? "Cek dulu identitas customer dan lead yang paling aktif. Setelah itu baru turun ke lead terkait. Edit data customer hanya kalau memang ada data yang salah atau belum lengkap."
                      : isLeadershipWorkspace
                        ? "Mulai dari ringkasan customer dulu, lalu cek lead prioritas dan owner-nya. Edit atau merge profile hanya kalau data customer terlihat pecah atau salah baca."
                        : "Mulai dari profil customer dulu untuk memastikan identitas dan kategori akunnya benar. Setelah itu baru turun ke lead terkait kalau tujuan Anda adalah kerja operasional. Buka merge hanya kalau data customer terasa pecah."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-2">
                  <PanelChip
                    active={activePanel === "profile"}
                    label="Ringkasan customer"
                    onClick={() => setActivePanel("profile")}
                  />
                  <PanelChip
                    active={activePanel === "leads"}
                    label={`Lead terkait (${profile.related_leads.length})`}
                    onClick={() => setActivePanel("leads")}
                  />
                  {canMergeProfiles ? (
                    <PanelChip
                      active={activePanel === "merge"}
                      label={`Merge candidates (${mergeCandidateCount})`}
                      onClick={() => setActivePanel("merge")}
                    />
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Jumlah lead" value={String(profile.lead_count)} />
              <Metric label="Jumlah percakapan" value={String(profile.conversation_count)} />
              <Metric label="Kontak terakhir" value={formatDateTime(profile.last_contact_at)} />
              <Metric label="PIC" value={profile.assigned_user_name ?? "Belum ada"} />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Metric
                label="Keyakinan identitas"
                value={`${Math.round(profile.identity_confidence * 100)}% • ${identityConfidenceLabel}`}
              />
              <Metric label="Lead aktif" value={String(activeLeadCount)} />
              <Metric
                label="Minat tinggi"
                value={`${hotLeadCount} hot • ${warmLeadCount} warm`}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {isLeadershipWorkspace
                        ? "Status Customer"
                        : "Data Customer"}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {isLeadershipWorkspace
                        ? "Manager cukup cek apakah identitas customer, status, suhu, dan kategori akun sudah terbaca masuk akal oleh Clara."
                        : "Ringkasan dan edit data customer disatukan di sini supaya tim bisa langsung cek identitas, lalu rapikan datanya kalau memang perlu."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePanel("profile");
                      setIsEditingProfile((prev) => !prev);
                    }}
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    {isEditingProfile ? "Tutup Edit" : "Edit Data Customer"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <CompactInfoRow label="Nama customer" value={profile.display_name} />
                  <CompactInfoRow
                    label="Status profil"
                    value={profile.merged_into_profile_id ? "Sudah digabung" : "Masih aktif"}
                  />
                  <CompactInfoRow label="Telepon" value={profile.phone ?? "Belum diisi"} />
                  <CompactInfoRow label="Email" value={profile.email ?? "Belum diisi"} />
                  <CompactInfoRow label="Status customer" value={formatCustomerStatus(profile.status)} />
                  <CompactInfoRow
                    label="Suhu customer"
                    value={`${formatTemperatureLabel(profile.temperature)} • ${formatTemperatureSourceLabel(profile.temperature_source)}`}
                  />
                  <CompactInfoRow label="Kategori akun" value={accountCategorySummary} />
                  <CompactInfoRow
                    label="Kekuatan identitas"
                    value={`${Math.round(profile.identity_confidence * 100)}% • ${identityConfidenceLabel}`}
                  />
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Alamat
                  </p>
                  <p className="mt-3 text-base leading-7 text-slate-900">
                    {profile.address ?? "Belum diisi"}
                  </p>
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Cakupan channel
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.source_labels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Bagian ini membantu tim melihat customer ini muncul dari channel mana saja. Kalau channel-nya banyak, pastikan konteksnya tetap dibaca sebagai satu customer yang sama.
                  </p>
                </div>

                {isEditingProfile ? (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <h3 className="text-lg font-semibold text-slate-950">Edit data customer</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Isi seperlunya. Fokus ke nama, telepon, status customer, dan kategori akun supaya pembacaan tim tetap rapi.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          Kategori akun dibaca otomatis dari lead terkait. Kalau hasil ringkasannya terasa campuran, Anda bisa set manual di form ini untuk menyelaraskan pembacaan tim.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 lg:max-w-sm">
                        Jangan isi data palsu. Kalau belum yakin nomor, email, atau alamatnya benar, lebih baik kosongkan dulu.
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Nama Customer</span>
                        <input
                          value={profileForm.display_name}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              display_name: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                          placeholder="Masukkan nama customer"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Telepon</span>
                        <input
                          value={profileForm.phone}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              phone: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                          placeholder="08xxxx atau +62xxxx"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Email</span>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                          placeholder="customer@email.com"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Status Customer</span>
                        <select
                          value={profileForm.status}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              status: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                        >
                          <option value="active">Aktif</option>
                          <option value="inactive">Tidak aktif</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Temperature Customer</span>
                        <select
                          value={profileForm.temperature}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              temperature: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                        >
                          <option value="unknown">Belum ditentukan</option>
                          <option value="cold">Cold</option>
                          <option value="warm">Warm</option>
                          <option value="hot">Hot</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Kategori Akun</span>
                        <select
                          value={profileForm.account_category}
                          onChange={(event) => {
                            setProfileForm((prev) => ({
                              ...prev,
                              account_category: event.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                        >
                          <option value="unknown">Belum ditentukan</option>
                          <option value="mini">Mini</option>
                          <option value="reguler">Reguler</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-4 block space-y-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Alamat</span>
                      <textarea
                        value={profileForm.address}
                        onChange={(event) => {
                          setProfileForm((prev) => ({
                            ...prev,
                            address: event.target.value,
                          }));
                        }}
                        rows={4}
                        className="w-full rounded-[24px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
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
                        className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                            temperature: profile.temperature,
                            account_category: deriveEditableAccountCategory(profile.related_leads),
                          });
                          setIsEditingProfile(false);
                        }}
                        className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                      >
                        Reset Form
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>

              <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <h2 className="text-xl font-semibold text-slate-950">
                  {isLeadershipWorkspace
                    ? "Urutan baca manager"
                    : "Yang Perlu Dicek Dulu"}
                </h2>
                <div className="mt-5 space-y-3">
                  <ActionHint
                    title="1. Buka lead yang paling prioritas"
                    description={
                      topPriorityLead
                        ? `${topPriorityLead.display_name} adalah lead paling layak dibuka dulu dari profil customer ini.`
                        : "Belum ada lead yang cukup kuat untuk diprioritaskan."
                    }
                  />
                  <ActionHint
                    title="2. Cek percakapan terakhir"
                    description={
                      latestLead
                        ? `Kontak terakhir tercatat di lead ${latestLead.display_name} pada ${formatDateTime(
                            latestLead.last_contact_at
                          )}.`
                        : "Belum ada histori kontak terakhir yang jelas."
                    }
                  />
                  <ActionHint
                    title="3. Rapikan data kalau perlu"
                    description={
                      isSalesWorkspace
                        ? "Kalau nama, nomor, atau kategori akun belum rapi, edit seperlunya supaya tim berikutnya tidak bingung."
                        : isLeadershipWorkspace
                          ? "Kalau profil customer terasa pecah, owner-nya rancu, atau channel-nya tidak nyambung, baru lanjut ke merge candidates."
                          : "Kalau ada nama atau channel yang mirip, gunakan merge candidates untuk memastikan satu customer tidak tersebar ke beberapa profil."
                    }
                  />
                </div>
              </article>
            </section>

            {canMergeProfiles && activePanel === "merge" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      Merge Candidates
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Clara menampilkan kandidat profil customer lain yang kemungkinan adalah orang yang sama. Head atau superadmin bisa merge manual kalau identity otomatis masih pecah.
                    </p>
                  </div>
                  <textarea
                    value={mergeNotes}
                    onChange={(event) => {
                      setMergeNotes(event.target.value);
                    }}
                    placeholder="Catatan merge opsional..."
                    className="min-h-[88px] w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900 lg:w-80"
                  />
                </div>

                <div className="mt-5 space-y-4">
                  {profile.merge_candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      Belum ada kandidat merge yang cukup kuat untuk profil ini.
                    </div>
                  ) : (
                    profile.merge_candidates.map((candidate) => (
                      <article
                        key={candidate.id}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950">
                            {candidate.display_name}
                          </h3>
                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            Match {Math.round(candidate.match_score * 100)}%
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Confidence {Math.round(candidate.identity_confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
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
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
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
                              className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
            ) : null}

            {activePanel === "leads" ? (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Lead Terkait</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5a421f]">
                      {isLeadershipWorkspace
                        ? "Bagian ini menunjukkan semua lead yang masih dianggap milik customer yang sama. Manager tidak perlu buka semuanya. Mulai dari prioritas teratas, lalu cek apakah owner dan ritme follow-up-nya konsisten."
                        : "Bagian ini menunjukkan semua lead yang masih dianggap milik customer yang sama. Jangan buka semuanya sekaligus. Mulai dari yang paling prioritas, lalu turun ke lead lain kalau memang perlu."}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Prioritas baca:
                    <span className="ml-2 font-semibold text-slate-950">
                      hot &gt; warm &gt; kontak terbaru
                    </span>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {[...profile.related_leads].sort(compareCustomerLeadPriority).map((lead, index) => (
                    <article
                      key={lead.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                          Prioritas {index + 1}
                        </span>
                        <h3 className="text-base font-semibold text-slate-950">{lead.display_name}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getLeadBadgeClass(
                            lead.lead_temperature
                          )}`}
                        >
                          {formatTemperatureLabel(lead.lead_temperature)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {formatStageLabel(lead.current_stage)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountCategoryBadgeClass(
                            lead.account_category
                          )}`}
                        >
                          {formatAccountCategory(lead.account_category)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {lead.source_label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {buildLeadReadingHint(lead)}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InlineMetric label="Stage" value={formatStageLabel(lead.current_stage)} />
                        <InlineMetric label="Last Contact" value={formatDateTime(lead.last_contact_at)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/crm/${lead.id}`}
                          className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Buka Lead
                        </Link>
                        {lead.latest_conversation_id ? (
                          <Link
                            href={`/dashboard/sales/conversations/${lead.latest_conversation_id}`}
                            className="inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Buka Percakapan
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
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
      <p className="mt-3 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ActionHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function PanelChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function HeroPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "amber" | "slate" | "emerald";
}) {
  const toneClass =
    accent === "amber"
      ? "border-[#d5a548]/35 bg-[linear-gradient(135deg,rgba(74,47,14,0.72)_0%,rgba(49,31,12,0.92)_100%)] text-[#f0cb73]"
      : accent === "emerald"
        ? "border-[#1c8f78]/35 bg-[linear-gradient(135deg,rgba(10,56,50,0.72)_0%,rgba(8,35,32,0.92)_100%)] text-[#3fd0b3]"
        : "border-[#f0cb73]/22 bg-[linear-gradient(135deg,rgba(38,28,18,0.76)_0%,rgba(24,18,12,0.92)_100%)] text-[#f7e0a8]";

  return (
    <div className={`rounded-full border px-4 py-2 shadow-sm ${toneClass}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
        {label}
      </span>
      <span className="ml-2 text-sm font-bold">{value}</span>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value}</p>
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

function formatAccountCategory(value: string) {
  const labels: Record<string, string> = {
    mini: "Mini",
    reguler: "Reguler",
    unknown: "Belum ditentukan",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function getAccountCategoryBadgeClass(value: string) {
  if (value === "mini") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (value === "reguler") {
    return "bg-amber-100 text-amber-700";
  }
  return "border border-[#d9bf87] bg-[#f7ebc9] text-[#6a4a17]";
}

function formatCustomerStatus(value: string) {
  return value === "inactive" ? "Tidak aktif" : "Aktif";
}

function formatTemperatureSourceLabel(value: string) {
  return value === "manual" ? "manual" : "otomatis dari Clara";
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

function buildAccountCategorySummary(
  relatedLeads: CustomerProfileSummaryItem["related_leads"]
) {
  const normalizedCategories = Array.from(
    new Set(relatedLeads.map((lead) => lead.account_category))
  );

  if (normalizedCategories.length === 0) {
    return "Belum terbaca";
  }

  const knownCategories = normalizedCategories.filter(
    (category) => category !== "unknown"
  );

  if (knownCategories.length === 0) {
    return "Belum ditentukan";
  }

  if (knownCategories.length === 1) {
    return formatAccountCategory(knownCategories[0]);
  }

  return knownCategories.map(formatAccountCategory).join(" + ");
}

function deriveEditableAccountCategory(
  relatedLeads: CustomerProfileSummaryItem["related_leads"]
) {
  const normalizedCategories = Array.from(
    new Set(relatedLeads.map((lead) => lead.account_category))
  ).filter((category) => category !== "unknown");

  if (normalizedCategories.length === 1) {
    return normalizedCategories[0];
  }

  return "unknown";
}

function buildCustomerFocusSummary({
  profile,
  topPriorityLead,
  latestLead,
  isLeadershipWorkspace,
}: {
  profile: CustomerProfileSummaryItem | null;
  topPriorityLead: CustomerProfileSummaryItem["related_leads"][number] | null;
  latestLead: CustomerProfileSummaryItem["related_leads"][number] | null;
  isLeadershipWorkspace: boolean;
}) {
  if (!profile) {
    return {
      headline: "Profil customer belum dimuat.",
      helper: "Muat data customer dulu untuk melihat konteks lead terkait.",
    };
  }

  if (topPriorityLead) {
    return {
      headline: isLeadershipWorkspace
        ? `${topPriorityLead.display_name} adalah lead customer ini yang paling perlu dicek manager dulu.`
        : `${topPriorityLead.display_name} adalah lead utama yang perlu dibuka dulu.`,
      helper: latestLead
        ? `Customer ini terakhir terhubung lewat ${latestLead.display_name} pada ${formatDateTime(
            latestLead.last_contact_at
          )}. Cek lead prioritas dulu, lalu cocokkan dengan percakapan terakhir kalau butuh konteks.`
        : "Mulai dari lead prioritas dulu supaya arah follow-up ke customer ini tetap jelas.",
    };
  }

  return {
    headline: `${profile.display_name} belum punya lead yang menonjol untuk diprioritaskan.`,
    helper: "Mulai dari data customer ini dulu, lalu cek lead yang kontaknya paling baru untuk menentukan langkah berikutnya.",
  };
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
