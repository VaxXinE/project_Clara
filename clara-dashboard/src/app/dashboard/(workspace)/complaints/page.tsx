"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  complaintSeverityClass,
  formatComplaintCategory,
  formatComplaintReviewer,
  formatComplaintSeverity,
  formatComplaintStatus,
} from "@/lib/complaint-labels";
import { formatDateTime } from "@/lib/format";
import { NAV_GROUP_NAMES, PAGE_NAMES } from "@/lib/labels";
import type { CurrentUser } from "@/types/dashboard";

type Complaint = {
  id: string;
  category: string;
  severity: string;
  status: string;
  safe_summary: string;
  source_channel: string | null;
  reviewer_requirement: string;
  last_seen_at: string;
  version: number;
};

export default function ComplaintsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [user, complaints] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<Complaint[]>("/complaints"),
      ]);
      setCurrentUser(user);
      setItems(complaints);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat daftar komplain.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.daily}
      title={PAGE_NAMES.complaints}
      description="Keluhan customer yang perlu ditinjau manusia. Yang tampil adalah ringkasan aman, bukan isi chat."
      backHref="/dashboard"
      backLabel="Kembali ke beranda"
    >
      <div className="space-y-4">
        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={() => {
              setErrorMessage("");
              void load();
            }}
          />
        ) : null}

        {items === null && !errorMessage ? (
          <LoadingState message="Memuat daftar komplain..." />
        ) : null}

        {items !== null && items.length === 0 ? (
          <EmptyState
            title="Belum ada komplain"
            description="Komplain muncul di sini saat Clara mendeteksi keluhan, klaim, atau permintaan bicara dengan petugas, lalu menyerahkannya ke manusia."
          />
        ) : null}

        {items !== null && items.length > 0 ? (
          <div className="clara-card overflow-x-auto rounded-2xl p-2 sm:p-3">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Daftar komplain customer</caption>
              <thead>
                <tr className="clara-text-muted text-xs">
                  <th scope="col" className="px-3 py-2 font-semibold">Ringkasan</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Jenis</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Tingkat</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Terakhir terlihat</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--color-border-subtle)] align-top">
                    <td className="px-3 py-3">
                      <Link
                        className="font-semibold underline-offset-4 hover:underline"
                        href={`/complaints/${item.id}`}
                      >
                        {item.safe_summary}
                      </Link>
                      {item.source_channel ? (
                        <p className="clara-text-muted mt-1 text-xs">
                          Dari {item.source_channel}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{formatComplaintCategory(item.category)}</td>
                    <td className="px-3 py-3">
                      <span className={complaintSeverityClass(item.severity)}>
                        {formatComplaintSeverity(item.severity)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{formatComplaintStatus(item.status)}</p>
                      <p className="clara-text-muted mt-1 text-xs">
                        {formatComplaintReviewer(item.reviewer_requirement)}
                      </p>
                    </td>
                    <td className="px-3 py-3">{formatDateTime(item.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
