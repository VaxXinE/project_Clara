export function formatDateTime(value: string | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatStatusLabel(value: string): string {
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
      return "bg-gray-100 text-gray-700";
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
      return "bg-gray-100 text-gray-700";
  }
}
