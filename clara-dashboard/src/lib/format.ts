import { getRoleDisplayLabel, normalizeWorkspaceRole } from "@/lib/roles";

export function formatDateTime(value: string | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatStatusLabel(value: string): string {
  const normalizedRole = normalizeWorkspaceRole(value);

  if (
    normalizedRole === "sales" ||
    normalizedRole === "manager" ||
    normalizedRole === "head" ||
    normalizedRole === "superadmin"
  ) {
    return getRoleDisplayLabel(value);
  }

  return value.replaceAll("_", " ");
}

export function getPasswordStrength(password: string): {
  label: string;
  badgeClassName: string;
  checks: Array<{ label: string; passed: boolean }>;
} {
  const checks = [
    { label: "minimal 8 karakter", passed: password.length >= 8 },
    { label: "huruf kecil", passed: /[a-z]/.test(password) },
    { label: "huruf besar", passed: /[A-Z]/.test(password) },
    { label: "angka", passed: /\d/.test(password) },
    { label: "simbol", passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((check) => check.passed).length;

  if (score >= 5) {
    return {
      label: "strong",
      badgeClassName: "bg-green-100 text-green-700",
      checks,
    };
  }

  if (score >= 3) {
    return {
      label: "medium",
      badgeClassName: "bg-amber-100 text-amber-700",
      checks,
    };
  }

  return {
    label: "weak",
    badgeClassName: "bg-red-100 text-red-700",
    checks,
  };
}

export function getLeadBadgeClass(leadTemperature?: string): string {
  switch (leadTemperature) {
    case "hot":
      return "bg-red-100 text-red-700";
    case "warm":
      return "bg-yellow-100 text-yellow-800";
    case "cold":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-orange-100 text-orange-700";
  }
}

export function getRiskBadgeClass(riskLevel?: string): string {
  switch (riskLevel) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-orange-100 text-orange-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-orange-100 text-orange-700";
  }
}

export function formatChannelLabel(channel?: string | null): string {
  switch ((channel ?? "").trim().toLowerCase()) {
    case "whatsapp":
      return "WhatsApp";
    case "instagram":
      return "Instagram DM";
    case "tiktok":
      return "TikTok DM";
    case "telegram":
      return "Telegram";
    case "email":
      return "Email";
    case "import":
      return "Import";
    case "unknown":
      return "Unknown";
    default:
      return channel?.trim() || "Unknown";
  }
}

export function isExperimentalChannel(channel?: string | null): boolean {
  const normalized = (channel ?? "").trim().toLowerCase();
  return normalized === "instagram" || normalized === "tiktok";
}

export function getChannelBadgeClass(channel?: string | null): string {
  switch ((channel ?? "").trim().toLowerCase()) {
    case "whatsapp":
      return "border-green-500/20 bg-green-500/10 text-green-700";
    case "instagram":
      return "border-pink-500/20 bg-pink-500/10 text-pink-700";
    case "tiktok":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-700";
    case "telegram":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700";
    case "email":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

export function inferProviderFromSource(source?: string | null): string {
  const normalized = (source ?? "").trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("_extension")) {
    return "extension";
  }

  if (
    normalized.includes("_webhook") ||
    normalized.includes("official_api") ||
    normalized.includes("meta")
  ) {
    return "official_api";
  }

  if (
    normalized.includes("_txt") ||
    normalized.includes("manual") ||
    normalized.includes("import")
  ) {
    return "manual";
  }

  return "unknown";
}

export function formatProviderLabel(provider?: string | null): string {
  switch ((provider ?? "").trim().toLowerCase()) {
    case "extension":
      return "Extension Reader";
    case "official_api":
      return "Official API";
    case "manual":
      return "Manual";
    default:
      return "Unknown Source";
  }
}

export function getProviderBadgeClass(provider?: string | null): string {
  switch ((provider ?? "").trim().toLowerCase()) {
    case "extension":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700";
    case "official_api":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700";
    case "manual":
      return "border-slate-400/20 bg-slate-200/70 text-slate-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}
