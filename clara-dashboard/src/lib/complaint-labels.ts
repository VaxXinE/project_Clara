/** Label yang terbaca manusia untuk nilai enum komplain dari backend. */

const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL_COMPLAINT: "Keluhan pribadi",
  FINANCIAL_LOSS_CLAIM: "Klaim kerugian dana",
  REFUND_OR_COMPENSATION: "Permintaan refund atau kompensasi",
  LEGAL_OR_REGULATOR_THREAT: "Ancaman hukum atau lapor regulator",
  FRAUD_ALLEGATION: "Tuduhan penipuan",
  HUMAN_REQUEST: "Minta bicara dengan petugas",
  HIGH_EMOTION: "Customer sangat emosi",
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Baru",
  TRIAGE_REQUIRED: "Perlu dipilah",
  IN_REVIEW: "Sedang ditinjau",
  WAITING_CUSTOMER: "Menunggu customer",
  ESCALATED: "Dieskalasi",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
  REOPENED: "Dibuka lagi",
};

const REVIEWER_LABELS: Record<string, string> = {
  SALES_REVIEW: "Review Sales",
  MANAGER_REVIEW: "Review Manager",
  COMPLIANCE_REVIEW: "Review Compliance",
  SUPERVISOR_OR_COMPLIANCE_REVIEW: "Review Supervisor atau Compliance",
  NO_REVIEW_ALLOWED: "Hanya petugas berwenang",
};

/** Tombol aksi per status tujuan. Urutan transisi mengikuti aturan di backend. */
export const COMPLAINT_ACTION_LABELS: Record<string, string> = {
  TRIAGE_REQUIRED: "Tandai perlu dipilah",
  IN_REVIEW: "Mulai tinjau",
  WAITING_CUSTOMER: "Tunggu customer",
  ESCALATED: "Eskalasikan",
  RESOLVED: "Tandai selesai",
  CLOSED: "Tutup kasus",
  REOPENED: "Buka lagi",
};

export const COMPLAINT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["TRIAGE_REQUIRED", "IN_REVIEW", "ESCALATED", "RESOLVED"],
  TRIAGE_REQUIRED: ["IN_REVIEW", "ESCALATED"],
  IN_REVIEW: ["WAITING_CUSTOMER", "ESCALATED", "RESOLVED"],
  WAITING_CUSTOMER: ["IN_REVIEW", "ESCALATED", "RESOLVED"],
  ESCALATED: ["IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_REVIEW", "ESCALATED", "RESOLVED"],
  CLOSED: ["REOPENED"],
};

function readable(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value.replaceAll("_", " ").toLowerCase();
}

export const formatComplaintCategory = (value: string) => readable(value, CATEGORY_LABELS);
export const formatComplaintSeverity = (value: string) => readable(value, SEVERITY_LABELS);
export const formatComplaintStatus = (value: string) => readable(value, STATUS_LABELS);
export const formatComplaintReviewer = (value: string) => readable(value, REVIEWER_LABELS);

/** Kelas warna lencana sesuai tingkat keparahan; teks tetap menyebut tingkatnya, bukan hanya warna. */
export function complaintSeverityClass(value: string): string {
  if (value === "CRITICAL" || value === "HIGH") return "clara-chip text-[var(--color-danger)]";
  if (value === "MEDIUM") return "clara-chip text-[var(--color-warning)]";
  return "clara-chip clara-chip-neutral";
}

export function canChangeComplaint(role: string | undefined, severity: string): boolean {
  if (!role || role === "sales") return false;
  if (severity === "HIGH" || severity === "CRITICAL") {
    return role === "head" || role === "superadmin";
  }
  return role === "manager" || role === "head" || role === "superadmin";
}
