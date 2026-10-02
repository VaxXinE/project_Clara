"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import {
  COMPLAINT_ACTION_LABELS,
  COMPLAINT_ALLOWED_TRANSITIONS,
  canChangeComplaint,
  complaintSeverityClass,
  formatComplaintCategory,
  formatComplaintReviewer,
  formatComplaintSeverity,
  formatComplaintStatus,
} from "@/lib/complaint-labels";
import { NAV_GROUP_NAMES } from "@/lib/labels";
import { normalizeWorkspaceRole } from "@/lib/roles";
import type { CurrentUser } from "@/types/dashboard";

type Complaint = {
  id: string;
  category: string;
  severity: string;
  status: string;
  safe_summary: string;
  requested_outcome: string | null;
  reviewer_requirement: string;
  version: number;
};

export default function ComplaintDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const confirm = useConfirm();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [item, setItem] = useState<Complaint | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [user, complaint] = await Promise.all([
        apiFetch<CurrentUser>("/auth/me"),
        apiFetch<Complaint>(`/complaints/${caseId}`),
      ]);
      setCurrentUser(user);
      setItem(complaint);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat komplain ini.",
      );
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveTo(status: string) {
    if (!item) return;

    if (status === "CLOSED") {
      const accepted = await confirm({
        title: "Tutup kasus ini?",
        message: "Kasus yang sudah ditutup hanya bisa dibuka lagi lewat tombol Buka lagi.",
        confirmLabel: "Tutup kasus",
        tone: "danger",
      });
      if (!accepted) return;
    }

    setPendingStatus(status);
    setErrorMessage("");
    try {
      await apiFetch(`/complaints/${item.id}/status/${status}`, {
        method: "POST",
        body: { expected_version: item.version, reason_codes: ["operator_update"] },
      });
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Status komplain belum bisa diubah.",
      );
    } finally {
      setPendingStatus(null);
    }
  }

  const role = normalizeWorkspaceRole(currentUser?.role);
  const nextStatuses = item ? (COMPLAINT_ALLOWED_TRANSITIONS[item.status] ?? []) : [];
  const canChange = item ? canChangeComplaint(role, item.severity) : false;
  const needsHeadReview =
    item !== null &&
    (item.severity === "HIGH" || item.severity === "CRITICAL") &&
    role === "manager";

  return (
    <WorkspaceShell
      currentUser={currentUser}
      eyebrow={NAV_GROUP_NAMES.daily}
      title={item ? formatComplaintCategory(item.category) : "Detail komplain"}
      description="Yang tampil adalah ringkasan aman, bukan isi chat customer."
      backHref="/dashboard/complaints"
      backLabel="Kembali ke daftar komplain"
    >
      <div className="clara-card space-y-5 rounded-2xl p-5">
        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={() => void load()} />
        ) : null}

        {!item && !errorMessage ? <LoadingState message="Memuat komplain..." /> : null}

        {item ? (
          <>
            <p className="text-base leading-7">{item.safe_summary}</p>

            {item.requested_outcome ? (
              <div className="clara-card-soft rounded-xl p-4">
                <p className="clara-label">Yang diminta customer</p>
                <p className="clara-text-secondary mt-1 text-sm leading-6">
                  {item.requested_outcome}
                </p>
              </div>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="clara-text-muted text-xs font-semibold">Status</dt>
                <dd className="mt-1 font-medium">{formatComplaintStatus(item.status)}</dd>
              </div>
              <div>
                <dt className="clara-text-muted text-xs font-semibold">Tingkat</dt>
                <dd className="mt-1">
                  <span className={complaintSeverityClass(item.severity)}>
                    {formatComplaintSeverity(item.severity)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="clara-text-muted text-xs font-semibold">Ditinjau oleh</dt>
                <dd className="mt-1 font-medium">
                  {formatComplaintReviewer(item.reviewer_requirement)}
                </dd>
              </div>
            </dl>

            {role === "sales" ? (
              <p className="clara-helper">
                Perubahan status komplain dilakukan oleh Manager atau Head.
              </p>
            ) : needsHeadReview ? (
              <p className="clara-helper">
                Komplain berisiko tinggi hanya bisa diubah oleh Head.
              </p>
            ) : canChange && nextStatuses.length > 0 ? (
              <div>
                <p className="clara-label">Langkah berikutnya</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={pendingStatus !== null}
                      onClick={() => void moveTo(status)}
                      className={`clara-button ${
                        status === "RESOLVED" || status === "IN_REVIEW"
                          ? "clara-button-primary"
                          : "clara-button-ghost"
                      }`}
                    >
                      {pendingStatus === status
                        ? "Menyimpan..."
                        : (COMPLAINT_ACTION_LABELS[status] ?? status)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
