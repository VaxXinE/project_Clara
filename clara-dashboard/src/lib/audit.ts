import { describeAuditAction } from "@/lib/vocab";
import type { OpsDatabaseOverview } from "@/types/dashboard";

export type AuditLogItem = OpsDatabaseOverview["recent_audit_logs"][number];

/** Jenis aktivitas untuk filter: yang diubah admin, yang masuk akun, dan pemakaian sehari-hari. */
export type AuditKind = "changes" | "login" | "usage";
export type AuditFilter = "all" | AuditKind;

export const AUDIT_FILTER_LABEL: Record<AuditFilter, string> = {
  all: "Semua",
  changes: "Perubahan",
  login: "Login",
  usage: "Pemakaian",
};

export function auditKind(action: string | null | undefined): AuditKind {
  const key = (action ?? "").trim();

  if (key === "auth.login" || key === "auth.access_token.issue") {
    return "login";
  }
  if (
    key.startsWith("extension.") ||
    key === "extension_build.download" ||
    key.startsWith("reply_suggestion.") ||
    key.startsWith("conversation.upload")
  ) {
    return "usage";
  }
  return "changes";
}

export type AuditGroup = {
  key: string;
  label: string;
  kind: AuditKind;
  actorEmail: string | null;
  actorRole: string | null;
  organizationName: string | null;
  count: number;
  latestAt: string;
  earliestAt: string;
};

/**
 * Daftar log diurutkan dari yang terbaru. Aktivitas yang sama oleh orang yang sama dan berurutan
 * digabung jadi satu baris dengan jumlahnya, supaya satu orang yang memakai ekstensi puluhan kali
 * tidak menenggelamkan login atau perubahan penting.
 */
export function groupAuditLogs(logs: AuditLogItem[]): AuditGroup[] {
  const groups: AuditGroup[] = [];

  for (const log of logs) {
    const previous = groups[groups.length - 1];

    if (previous && previous.key === `${log.action}|${log.actor_email ?? ""}`) {
      previous.count += 1;
      previous.earliestAt = log.created_at;
      continue;
    }

    groups.push({
      key: `${log.action}|${log.actor_email ?? ""}`,
      label: describeAuditAction(log.action),
      kind: auditKind(log.action),
      actorEmail: log.actor_email,
      actorRole: log.actor_role,
      organizationName: log.organization_name,
      count: 1,
      latestAt: log.created_at,
      earliestAt: log.created_at,
    });
  }

  return groups;
}
