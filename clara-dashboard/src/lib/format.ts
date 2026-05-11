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