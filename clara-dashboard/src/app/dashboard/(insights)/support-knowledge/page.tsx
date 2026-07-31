"use client";

import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/dashboard";

type Article = { id: string; title: string; topic: string; support_level: string; lifecycle_status: string; source_reference: string; version: number };
const TOPICS = ["GENERAL_NAVIGATION", "OFFICIAL_CHANNEL", "ACCOUNT_ACCESS_GENERAL", "LOGIN_GENERAL", "PASSWORD_SAFETY", "REGISTRATION_GENERAL", "DOCUMENT_PREPARATION_GENERAL", "VERIFICATION_GENERAL", "ACTIVATION_GENERAL", "FUNDING_GENERAL", "WITHDRAWAL_GENERAL", "PLATFORM_GENERAL", "ERROR_MESSAGE_GENERAL", "POST_ACTIVATION_GENERAL", "STATUS_REQUEST", "SECURITY_CONCERN"];

export default function SupportKnowledgePage() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<Article[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", topic: "LOGIN_GENERAL", support_level: "LEVEL_1", content: "", customer_safe: false, source: "manual_verified", source_reference: "", risk_class: "LOW" });
  const canGovern = me?.role === "head" || me?.role === "superadmin";
  async function load() { const [user, articles] = await Promise.all([apiFetch<CurrentUser>("/auth/me"), apiFetch<Article[]>("/support-knowledge")]); setMe(user); setItems(articles); }
  useEffect(() => { void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat knowledge.")); }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(""); try { await apiFetch("/support-knowledge/drafts", { method: "POST", body: { ...form, organization_id: me?.role === "superadmin" ? null : me?.organization_id } }); setForm({ ...form, title: "", content: "", source_reference: "" }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Gagal menyimpan draft."); } }
  async function transition(id: string, action: string) { try { await apiFetch(`/support-knowledge/${id}/${action}`, { method: "POST" }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Lifecycle gagal."); } }
  return <WorkspaceShell currentUser={me} eyebrow="Customer service governance" title="Support Knowledge L0–L1" description="Knowledge CS terverifikasi; draft tidak pernah masuk jawaban customer." backHref="/dashboard/knowledge" backLabel="Knowledge Base">
    <div className="space-y-6">{error ? <div className="clara-alert clara-alert-danger">{error}</div> : null}
      {canGovern ? <form onSubmit={submit} className="clara-card grid gap-3 p-5 md:grid-cols-2"><input required maxLength={200} className="clara-input" placeholder="Judul" value={form.title} onChange={(e) => setForm({...form, title:e.target.value})}/><select className="clara-input" value={form.topic} onChange={(e) => setForm({...form, topic:e.target.value})}>{TOPICS.map((v)=><option key={v}>{v}</option>)}</select><select className="clara-input" value={form.support_level} onChange={(e)=>setForm({...form,support_level:e.target.value})}><option>LEVEL_0</option><option>LEVEL_1</option><option>HUMAN_REQUIRED</option></select><input required maxLength={500} className="clara-input" placeholder="Referensi sumber" value={form.source_reference} onChange={(e)=>setForm({...form,source_reference:e.target.value})}/><textarea required maxLength={50000} className="clara-input min-h-40 md:col-span-2" placeholder="Konten customer-safe (maks. 50.000 karakter)" value={form.content} onChange={(e)=>setForm({...form,content:e.target.value})}/><label><input type="checkbox" checked={form.customer_safe} onChange={(e)=>setForm({...form,customer_safe:e.target.checked})}/> Ditinjau sebagai customer-safe</label><button className="clara-button clara-button-primary">Simpan draft</button></form> : null}
      <div className="clara-card overflow-x-auto p-5"><table className="w-full text-left text-sm"><thead><tr><th>Artikel</th><th>Level</th><th>Status</th><th>Sumber</th><th>Aksi</th></tr></thead><tbody>{items.map((x)=><tr key={x.id} className="border-t"><td className="py-3"><strong>{x.title}</strong><div>{x.topic} · v{x.version}</div></td><td>{x.support_level}</td><td>{x.lifecycle_status}</td><td>{x.source_reference}</td><td>{canGovern && x.lifecycle_status === "DRAFT" ? <button className="clara-button clara-button-ghost" onClick={()=>void transition(x.id,"approve")}>Approve</button>:null}{canGovern && x.lifecycle_status === "APPROVED" ? <button className="clara-button clara-button-primary" onClick={()=>void transition(x.id,"activate")}>Activate</button>:null}{canGovern && x.lifecycle_status === "ACTIVE" ? <button className="clara-button clara-button-ghost" onClick={()=>void transition(x.id,"retire")}>Retire</button>:null}</td></tr>)}</tbody></table>{!items.length?<p className="py-8 text-center opacity-70">Belum ada artikel aktif atau draft.</p>:null}</div>
    </div></WorkspaceShell>;
}
