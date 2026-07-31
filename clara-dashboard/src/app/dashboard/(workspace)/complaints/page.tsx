"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CurrentUser } from "@/types/dashboard";

type Complaint = { id:string; category:string; severity:string; status:string; safe_summary:string; source_channel:string|null; reviewer_requirement:string; last_seen_at:string; version:number };
export default function ComplaintsPage(){const [me,setMe]=useState<CurrentUser|null>(null);const [items,setItems]=useState<Complaint[]>([]);const [error,setError]=useState("");useEffect(()=>{void Promise.all([apiFetch<CurrentUser>("/auth/me"),apiFetch<Complaint[]>("/complaints")]).then(([u,c])=>{setMe(u);setItems(c)}).catch((e:unknown)=>setError(e instanceof Error?e.message:"Gagal memuat kasus."))},[]);return <WorkspaceShell currentUser={me} eyebrow="Governed complaint intake" title="Complaint Queue" description="Kasus terpisah dari sales flow dan selalu membutuhkan review manusia." backHref="/dashboard" backLabel="Dashboard"><div className="clara-card overflow-x-auto p-5">{error?<div className="clara-alert clara-alert-danger">{error}</div>:null}<table className="w-full min-w-[760px] text-left text-sm"><thead><tr><th>Ringkasan aman</th><th>Kategori</th><th>Severity</th><th>Status</th><th>Terakhir terlihat</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-t"><td className="py-3"><Link className="underline" href={`/dashboard/complaints/${x.id}`}>{x.safe_summary}</Link><div>{x.source_channel??"unknown"}</div></td><td>{x.category}</td><td>{x.severity}</td><td>{x.status}<div>{x.reviewer_requirement}</div></td><td>{formatDateTime(x.last_seen_at)}</td></tr>)}</tbody></table>{!items.length?<p className="py-8 text-center opacity-70">Belum ada complaint case.</p>:null}</div></WorkspaceShell>}
