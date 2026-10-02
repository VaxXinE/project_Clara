/**
 * Satu kamus nama untuk seluruh dashboard. Sidebar, judul halaman, tombol, dan panduan
 * harus memakai nama yang sama untuk halaman yang sama, supaya user baru tidak mengira
 * "Chat Masuk", "Queue", dan "Inbox" adalah tiga tempat berbeda.
 */

export const SITE_NAME = "Clara";

export const NAV_GROUP_NAMES = {
  daily: "Kerja Harian",
  analysis: "Analisis",
  monitoring: "Pemantauan",
  admin: "Administrasi",
  team: "Pantau Tim",
  knowledge: "Pengetahuan & Pasar",
  settings: "Pengaturan Sistem",
  account: "Akun",
  guide: "Panduan",
} as const;

export const PAGE_NAMES = {
  home: "Beranda",
  inbox: "Chat Masuk",
  leads: "Lead",
  leadsTeam: "Lead Tim",
  followUp: "Tindak Lanjut",
  intake: "Input Chat",
  customers: "Customer",
  reviewSales: "Review Sales",
  teamDirection: "Arahan Tim",
  teamMonitor: "Monitor Tim",
  alerts: "Alert",
  alertsTeam: "Alert Tim",
  opsDashboard: "Dashboard Operasional",
  knowledge: "Knowledge Base",
  marketing: "Insight Pasar",
  channels: "Channel",
  users: "Pengguna & Akses",
  audit: "Audit & Status Sistem",
  persona: "Persona AI",
  productFacts: "Fakta Produk",
  supportKnowledge: "Knowledge Support",
  complaints: "Komplain",
  profile: "Profil",
  guide: "Panduan Alur Kerja",
} as const;

/** Nama sumber notifikasi dari backend yang ditampilkan ke user. */
const NOTIFICATION_SOURCE_NAMES: Record<string, string> = {
  deal_metrics_sync: "Data deal belum sinkron",
  approval_queue: "Chat perlu keputusan",
  operational_alert: "Alert operasional",
  extension_build_update: "Update extension",
  follow_up_overdue: "Tindak lanjut terlambat",
  kpi_alert: "Alert KPI",
};

export function formatNotificationSource(sourceType: string): string {
  const known = NOTIFICATION_SOURCE_NAMES[sourceType];
  if (known) {
    return known;
  }

  const readable = sourceType.replaceAll("_", " ").trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Notifikasi";
}
