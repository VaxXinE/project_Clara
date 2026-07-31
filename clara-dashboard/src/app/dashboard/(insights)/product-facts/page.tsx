"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CurrentUser, ProductFactItem } from "@/types/dashboard";

const FACT_KEYS = [
  "account.minimum_opening_amount",
  "account.minimum_lot",
  "account.eligible_products",
  "account.currency",
  "trading.spread",
  "trading.commission",
  "trading.margin",
  "trading.swap",
  "trading.rollover",
  "trading.overnight_requirement",
  "trading.instruments",
  "company.regulatory_status",
  "company.regulator",
  "company.license_reference",
  "process.initial_data",
  "process.kyc_requirements",
  "process.verification_steps",
  "process.activation_steps",
  "process.funding_steps",
  "process.withdrawal_steps",
  "promotion.current_terms",
] as const;

const EMPTY_FORM = {
  fact_key: FACT_KEYS[0],
  account_category: "global",
  value_type: "text",
  value: "",
  unit: "",
  source_type: "manual_verified",
  source_reference: "",
  freshness_class: "MEDIUM_VOLATILITY",
  effective_from: "",
  effective_until: "",
};

export default function ProductFactsPage() {
  const [items, setItems] = useState<ProductFactItem[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canGovern = me?.role === "head" || me?.role === "superadmin";

  async function load() {
    const [user, facts] = await Promise.all([
      apiFetch<CurrentUser>("/auth/me"),
      apiFetch<ProductFactItem[]>("/product-facts"),
    ]);
    setMe(user);
    setItems(facts);
  }

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Gagal memuat fakta."),
    );
  }, []);

  function parseValue() {
    if (form.value_type === "integer") return Number.parseInt(form.value, 10);
    if (form.value_type === "decimal") return Number.parseFloat(form.value);
    if (form.value_type === "boolean") return form.value === "true";
    if (form.value_type === "json") return JSON.parse(form.value);
    return form.value;
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      await apiFetch<ProductFactItem>("/product-facts/drafts", {
        method: "POST",
        body: {
          ...form,
          value: parseValue(),
          unit: form.unit || null,
          effective_from: form.effective_from || null,
          effective_until: form.effective_until || null,
          last_verified_at: null,
          source_hash: null,
          sensitivity_class: "CUSTOMER_SAFE",
          organization_id: me?.role === "superadmin" ? null : me?.organization_id,
        },
      });
      setForm(EMPTY_FORM);
      setMessage("Draft fakta berhasil dibuat.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal membuat draft.");
    } finally {
      setBusy("");
    }
  }

  async function transition(item: ProductFactItem, action: string) {
    setBusy(item.id);
    setError("");
    try {
      await apiFetch<ProductFactItem>(`/product-facts/${item.id}/${action}`, {
        method: "POST",
      });
      setMessage(`Fakta berhasil di-${action}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aksi lifecycle gagal.");
    } finally {
      setBusy("");
    }
  }

  return (
    <WorkspaceShell
      currentUser={me}
      eyebrow="Product fact governance"
      title="Product Fact Registry"
      description="Kelola revisi, sumber, masa berlaku, dan freshness fakta customer-facing."
      backHref="/dashboard/knowledge"
      backLabel="Kembali ke Knowledge Base"
      actions={<Link className="clara-button clara-button-ghost" href="/dashboard/knowledge">Knowledge Base</Link>}
    >
      <div className="space-y-6">
        {error ? <div className="clara-alert clara-alert-danger" role="alert">{error}</div> : null}
        {message ? <div className="clara-alert clara-alert-success" role="status">{message}</div> : null}

        {canGovern ? (
          <form onSubmit={createDraft} className="clara-card grid gap-4 p-5 md:grid-cols-2">
            <h2 className="md:col-span-2 text-lg font-semibold">Buat revisi draft</h2>
            <label className="space-y-1"><span>Fact key</span><select className="clara-input" value={form.fact_key} onChange={(e) => setForm({...form, fact_key: e.target.value as typeof form.fact_key})}>{FACT_KEYS.map((key) => <option key={key}>{key}</option>)}</select></label>
            <label className="space-y-1"><span>Scope akun</span><select className="clara-input" value={form.account_category} onChange={(e) => setForm({...form, account_category: e.target.value})}><option value="global">global</option><option value="mini">mini</option><option value="regular">regular</option></select></label>
            <label className="space-y-1"><span>Jenis nilai</span><select className="clara-input" value={form.value_type} onChange={(e) => setForm({...form, value_type: e.target.value})}><option value="text">text</option><option value="integer">integer</option><option value="decimal">decimal</option><option value="boolean">boolean</option><option value="date">date</option><option value="json">json</option></select></label>
            <label className="space-y-1"><span>Nilai</span><textarea required className="clara-input min-h-24" value={form.value} onChange={(e) => setForm({...form, value: e.target.value})} /></label>
            <label className="space-y-1"><span>Source reference</span><input required className="clara-input" value={form.source_reference} onChange={(e) => setForm({...form, source_reference: e.target.value})} /></label>
            <label className="space-y-1"><span>Freshness</span><select className="clara-input" value={form.freshness_class} onChange={(e) => setForm({...form, freshness_class: e.target.value})}><option>HIGH_VOLATILITY</option><option>MEDIUM_VOLATILITY</option><option>LOW_VOLATILITY</option></select></label>
            <label className="space-y-1"><span>Efektif mulai</span><input type="datetime-local" className="clara-input" value={form.effective_from} onChange={(e) => setForm({...form, effective_from: e.target.value})} /></label>
            <label className="space-y-1"><span>Efektif sampai</span><input type="datetime-local" className="clara-input" value={form.effective_until} onChange={(e) => setForm({...form, effective_until: e.target.value})} /></label>
            <button disabled={busy === "create"} className="clara-button clara-button-primary md:col-span-2">{busy === "create" ? "Menyimpan..." : "Simpan draft"}</button>
          </form>
        ) : null}

        <div className="clara-card overflow-x-auto p-5">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b"><th className="p-2">Fact / revisi</th><th className="p-2">Status</th><th className="p-2">Freshness</th><th className="p-2">Sumber</th><th className="p-2">Periode</th><th className="p-2">Aksi</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-b align-top"><td className="p-2"><strong>{item.fact_key}</strong><div>{item.account_category} · rev {item.revision}</div><div className="max-w-xs break-words text-xs opacity-70">{JSON.stringify(item.value)}</div></td><td className="p-2">{item.lifecycle_status}{item.resolution_status === "CONFLICT" ? <div className="text-red-600">CONFLICT</div> : null}</td><td className="p-2">{item.freshness_status}</td><td className="p-2"><div>{item.source_type}</div><div className="max-w-xs break-all text-xs opacity-70">{item.source_reference}</div></td><td className="p-2">{item.effective_from ? formatDateTime(item.effective_from) : "sekarang"}<br />s.d. {item.effective_until ? formatDateTime(item.effective_until) : "tanpa batas"}</td><td className="p-2">{canGovern && item.lifecycle_status === "DRAFT" ? <button disabled={busy === item.id} onClick={() => void transition(item, "approve")} className="clara-button clara-button-ghost">Approve</button> : null}{canGovern && item.lifecycle_status === "APPROVED" ? <button disabled={busy === item.id} onClick={() => void transition(item, "activate")} className="clara-button clara-button-primary">Activate</button> : null}{canGovern && item.lifecycle_status === "ACTIVE" ? <div className="flex gap-2"><button disabled={busy === item.id} onClick={() => void transition(item, "expire")} className="clara-button clara-button-ghost">Expire</button><button disabled={busy === item.id} onClick={() => void transition(item, "revoke")} className="clara-button clara-button-ghost">Revoke</button></div> : null}</td></tr>)}</tbody>
          </table>
          {!items.length ? <p className="py-8 text-center opacity-70">Belum ada product fact.</p> : null}
        </div>
      </div>
    </WorkspaceShell>
  );
}
