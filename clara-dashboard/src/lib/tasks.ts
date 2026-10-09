/**
 * Katalog "Saya mau ..." untuk pencarian menu. Tiap tujuan ditulis dengan kata yang dipakai user,
 * bukan nama fitur. Hanya tujuan yang halamannya ada di menu role tersebut yang ditampilkan.
 */

export type TaskEntry = {
  goal: string;
  href: string;
  /** Kata lain yang dipakai orang untuk hal yang sama, dipisah spasi. */
  keywords: string;
  /** Kosong berarti berlaku untuk semua role yang punya halamannya. */
  roles?: string[];
};

export const TASKS: TaskEntry[] = [
  {
    goal: "Balas chat customer yang baru masuk",
    href: "/sales",
    keywords: "balas jawab reply inbox antrean chat masuk customer whatsapp",
    roles: ["sales", "superadmin"],
  },
  {
    goal: "Masukkan chat dari WhatsApp ke Clara",
    href: "/upload",
    keywords: "input upload impor import tempel paste file txt telegram chat baru tambah",
  },
  {
    goal: "Lihat siapa yang harus di-follow-up hari ini",
    href: "/follow-up",
    keywords: "tindak lanjut follow up jadwal pengingat reminder terlambat overdue hubungi",
  },
  {
    goal: "Cari prospect atau customer, dan ubah tahapnya",
    href: "/crm",
    keywords: "lead prospect customer pelanggan profil kontak nomor pipeline tahap stage crm cari status deal",
    roles: ["sales", "superadmin"],
  },
  {
    goal: "Lihat progres lead seluruh tim",
    href: "/crm",
    keywords: "lead tim progres prospect pipeline crm pantau",
    roles: ["manager", "head"],
  },
  {
    goal: "Cari data customer",
    href: "/customers",
    keywords: "customer pelanggan nasabah profil riwayat kontak nomor",
  },
  {
    goal: "Catat atau tinjau keluhan customer",
    href: "/complaints",
    keywords: "komplain keluhan complaint masalah penarikan dana laporan",
  },
  {
    goal: "Tinjau jawaban yang disusun Sales",
    href: "/approvals",
    keywords: "review setujui approve tolak draft jawaban koreksi periksa coaching",
    roles: ["manager", "superadmin"],
  },
  {
    goal: "Beri arahan tindak lanjut ke tim",
    href: "/approvals",
    keywords: "arahan keputusan review eskalasi approve tim",
    roles: ["head"],
  },
  {
    goal: "Pantau kinerja dan hambatan tim",
    href: "/manager-insights",
    keywords: "monitor pantau performa tim kinerja hambatan sales risiko insight laporan",
  },
  {
    goal: "Lihat alert yang perlu perhatian",
    href: "/notifications",
    keywords: "alert notifikasi peringatan sinyal perhatian terlambat",
  },
  {
    goal: "Ubah jawaban resmi yang dipakai Clara",
    href: "/knowledge",
    keywords: "knowledge pengetahuan jawaban resmi faq produk fakta isi materi",
  },
  {
    goal: "Lihat keberatan customer yang paling sering muncul",
    href: "/marketing",
    keywords: "insight pasar keberatan objection tren topik marketing pemasaran",
  },
  {
    goal: "Lihat kinerja operasional",
    href: "/kpi",
    keywords: "kpi dashboard operasional kinerja angka target statistik",
  },
  {
    goal: "Cek sumber chat (WhatsApp, Instagram, TikTok)",
    href: "/channels",
    keywords: "channel sumber whatsapp instagram tiktok extension koneksi",
  },
  {
    goal: "Tambah, nonaktifkan, atau reset password pengguna",
    href: "/admin/access",
    keywords: "user pengguna akun akses role organisasi tim unit password reset tambah hapus nonaktif",
  },
  {
    goal: "Cek log audit dan status sistem",
    href: "/admin/ops",
    keywords: "audit log jejak status sistem ops",
  },
  {
    goal: "Unggah versi baru ekstensi Chrome",
    href: "/admin/extension",
    keywords: "ekstensi extension chrome unggah upload versi build zip unduh pasang update",
  },
  {
    goal: "Atur gaya dan aturan jawaban Clara",
    href: "/admin/ai-config",
    keywords: "persona ai gaya aturan prompt bahasa nada jawaban publish",
  },
  {
    goal: "Kembali ke ringkasan hari ini",
    href: "/workspace",
    keywords: "beranda home ringkasan dashboard awal utama",
  },
  {
    goal: "Ganti password atau ubah profil",
    href: "/profile",
    keywords: "profil akun password sandi ganti nama email keamanan",
  },
  {
    goal: "Pelajari alur kerja Clara langkah demi langkah",
    href: "/start",
    keywords: "panduan bantuan tutorial cara pakai mulai alur kerja onboarding",
  },
];

/** Halaman yang selalu bisa dibuka lewat menu akun, walau tidak ada di sidebar. */
export const ALWAYS_AVAILABLE_HREFS = ["/profile", "/start"];

export function tasksForUser(role: string | undefined, availableHrefs: ReadonlySet<string>): TaskEntry[] {
  return TASKS.filter(
    (task) =>
      (availableHrefs.has(task.href) || ALWAYS_AVAILABLE_HREFS.includes(task.href)) &&
      (!task.roles || (role !== undefined && task.roles.includes(role))),
  );
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Semua kata yang diketik harus ada di tujuan, nama halaman, atau kata kuncinya. */
export function matchTasks<T extends { goal: string; keywords: string; pageLabel: string }>(
  tasks: T[],
  query: string,
): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return tasks;
  }

  return tasks.filter((task) => {
    const haystack = normalize(`${task.goal} ${task.pageLabel} ${task.keywords}`);
    return words.every((word) => haystack.includes(word));
  });
}
