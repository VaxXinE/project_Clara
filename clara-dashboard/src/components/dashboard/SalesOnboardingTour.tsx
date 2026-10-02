"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";

type TourStep = {
  id: string;
  title: string;
  description: string;
};

type TourRoute = {
  path: string;
  title: string;
  steps: TourStep[];
};

type TourState = {
  completed: boolean;
  dismissed: boolean;
  routeIndex: number;
  stepIndex: number;
};

type TourRole = "sales" | "manager" | "head";

const STORAGE_VERSION = 4;
const VIEWPORT_GAP = 16;
const POPUP_WIDTH = 320;

const TOUR_ROUTES: TourRoute[] = [
  {
    path: "/workspace",
    title: "Beranda Sales",
    steps: [
      {
        id: "sales-shell-sidebar",
        title: "Mulai dari Chat Masuk",
        description:
          "Gunakan Chat Masuk untuk membuka antrean dan memilih customer yang paling perlu respons.",
      },
      {
        id: "sales-home-next-action",
        title: "Mulai dari sini",
        description:
          "Ini chat yang paling perlu kamu kerjakan sekarang. Klik Buka dan balas, tidak perlu memilih sendiri.",
      },
      {
        id: "sales-home-counts",
        title: "Ringkasan pekerjaan",
        description:
          "Tiga angka ini bisa diklik. Pilih salah satu untuk langsung ke daftar chat atau tindak lanjut.",
      },
    ],
  },
  {
    path: "/sales",
    title: "Chat Masuk",
    steps: [
      {
        id: "sales-inbox-filters",
        title: "Temukan chat",
        description:
          "Cari nama customer, pilih kelompok chat (misalnya Siap dibalas), atau saring berdasarkan channel.",
      },
      {
        id: "sales-inbox-queue",
        title: "Baca status dan alasan",
        description:
          "Chat dikelompokkan menurut langkah yang perlu kamu ambil: baca dengan Clara, buat draft, balas, atau tunggu customer.",
      },
      {
        id: "sales-inbox-upcoming-actions",
        title: "Lakukan aksi berikutnya",
        description:
          "Tombol di kanan tiap chat selalu langkah berikutnya: Baca dengan Clara, Buat draft jawaban, atau Buka dan balas.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Lead",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead",
        description:
          "Kalimat ini merangkum berapa lead yang perlu tindakan dan berapa yang terlambat.",
      },
      {
        id: "sales-crm-filters",
        title: "Cari dan saring lead",
        description:
          "Cari nama customer, ubah urutan, atau pilih kelompok seperti Terlambat atau Customer panas.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead",
        description:
          "Tiap lead punya langkah berikutnya yang jelas. Klik Buka lead untuk detail atau Buka chat untuk menghubungi customer.",
      },
    ],
  },
  {
    path: "/customers",
    title: "Customer",
    steps: [
      {
        id: "sales-customers-filters",
        title: "Cari dan saring customer",
        description:
          "Cari nama, telepon, email, atau penanggung jawab. Pilih status Aktif kalau hanya ingin customer yang masih berjalan.",
      },
      {
        id: "sales-customers-list",
        title: "Daftar customer aktif",
        description:
          "Tiap customer punya ringkasan singkat: jumlah lead aktif, percakapan, dan kapan terakhir dihubungi. Klik Buka profil untuk detailnya.",
      },
    ],
  },
  {
    path: "/follow-up",
    title: "Tindak Lanjut",
    steps: [
      {
        id: "sales-followup-focus",
        title: "Fokus tindak lanjut",
        description:
          "Kalimat ini merangkum beban tindak lanjut hari ini, jadi kamu tahu harus mulai dari mana.",
      },
      {
        id: "sales-followup-filters",
        title: "Filter pekerjaan follow-up",
        description:
          "Cari nama customer atau pilih kelompok (misalnya Hari ini) supaya daftarnya tidak terlalu panjang.",
      },
      {
        id: "sales-followup-list",
        title: "Daftar kerja yang harus dibereskan",
        description:
          "Kerjakan dari atas ke bawah. Klik Buka chat untuk menghubungi, lalu buka Catat hasilnya untuk menandai selesai.",
      },
      {
        id: "sales-followup-upcoming",
        title: "Follow-up berikutnya",
        description:
          "Bagian ini berisi tindak lanjut yang belum perlu dikerjakan sekarang, supaya tidak tercampur dengan yang mendesak.",
      },
    ],
  },
  {
    path: "/upload",
    title: "Input Chat",
    steps: [
      {
        id: "sales-upload-form",
        title: "Form input chat",
        description:
          "Isi nama customer, pilih file atau tempel teks chat, lalu klik Proses chat. Percakapannya langsung terbuka.",
      },
      {
        id: "sales-upload-example",
        title: "Contoh format chat",
        description:
          "Kalau ragu bentuk chat yang bisa dibaca Clara, buka bagian ini untuk melihat contohnya.",
      },
    ],
  },
  {
    path: "/customers/[customerId]",
    title: "Detail Customer",
    steps: [
      {
        id: "sales-customer-detail-focus",
        title: "Fokus customer ini",
        description:
          "Bagian atas ini merangkum customer yang sedang dibuka: seberapa aktif lead-nya, channel utamanya, dan kenapa customer ini layak dicek sekarang.",
      },
      {
        id: "sales-customer-detail-summary",
        title: "Ringkasan customer",
        description:
          "Panel ini membantu kamu baca customer sebagai satu entitas, meskipun dia muncul di beberapa lead atau channel.",
      },
      {
        id: "sales-customer-detail-panels",
        title: "Pilihan panel kerja",
        description:
          "Tombol ini dipakai untuk ganti fokus antara ringkasan customer, lead terkait, dan merge candidate tanpa pindah halaman.",
      },
      {
        id: "sales-customer-detail-profile",
        title: "Data customer inti",
        description:
          "Di sini kamu cek identitas customer, status, channel, dan data yang perlu dirapikan sebelum turun ke lead terkait.",
      },
    ],
  },
  {
    path: "/sales/conversations/[conversationId]",
    title: "Detail Percakapan",
    steps: [
      {
        id: "sales-conversation-timeline",
        title: "Timeline percakapan",
        description:
          "Mulai dari sini untuk baca chat terbaru lebih dulu. Fokus utamanya pahami konteks customer sebelum menjalankan AI atau memilih balasan.",
      },
      {
        id: "sales-conversation-workspace",
        title: "Area kerja sales",
        description:
          "Panel kanan ini adalah workspace utama saat mengerjakan satu conversation: pindah antara AI dan riwayat kirim tanpa kehilangan konteks chat.",
      },
      {
        id: "sales-conversation-ai-summary",
        title: "Ringkasan hasil baca Clara",
        description:
          "Bagian ini merangkum pembacaan AI terhadap chat: stage, sentimen, objection, dan next best action.",
      },
      {
        id: "sales-conversation-reply-actions",
        title: "Aksi jawaban",
        description:
          "Di sini kamu lanjut generate, review, lalu pilih jawaban terbaik. Tujuannya bukan langsung kirim, tapi memastikan balasan yang dipakai benar konteksnya.",
      },
    ],
  },
  {
    path: "/crm/[leadId]",
    title: "Detail Lead",
    steps: [
      {
        id: "sales-lead-detail-focus",
        title: "Fokus kerja lead ini",
        description:
          "Bagian atas ini memberi tahu tekanan utama lead saat ini: follow-up berikutnya, task terbuka, dan arah kerja yang paling dekat ke aksi.",
      },
      {
        id: "sales-lead-detail-snapshot",
        title: "Snapshot lead",
        description:
          "Kartu ini dipakai untuk baca kondisi inti lead secara cepat: kategori akun, kontak terakhir, owner, status deal, dan jumlah percakapan.",
      },
      {
        id: "sales-lead-detail-context",
        title: "Update konteks lead",
        description:
          "Form ini dipakai untuk merapikan stage, suhu lead, ringkasan, catatan internal, dan jadwal follow-up dari satu tempat.",
      },
      {
        id: "sales-lead-detail-discipline",
        title: "Catatan follow-up harian",
        description:
          "Bagian ini menyimpan jejak follow-up yang benar-benar terjadi supaya lead tidak cuma punya status, tapi juga ritme kerja yang kebaca jelas.",
      },
      {
        id: "sales-lead-detail-timeline",
        title: "Riwayat perubahan lead",
        description:
          "Timeline ini adalah audit trail cepat untuk melihat perubahan stage, follow-up, task, dan aktivitas penting lain di lead ini.",
      },
    ],
  },
  {
    path: "/profile",
    title: "Profile",
    steps: [
      {
        id: "profile-extension-download",
        title: "Download Clara Extension",
        description:
          "Ambil extension Clara dari kartu ini. Semua role memakai file extension yang sama, jadi cukup download dari sini lalu pasang ke browser kerja kamu.",
      },
    ],
  },
];

const MANAGER_TOUR_ROUTES: TourRoute[] = [
  {
    path: "/workspace",
    title: "Beranda Manager",
    steps: [
      {
        id: "manager-shell-sidebar",
        title: "Menu kerja manager",
        description:
          "Sidebar ini adalah jalur kerja manager. Fokus utamanya pindah cepat antara Beranda, Lead Tim, Review Sales, dan Monitor Tim.",
      },
      {
        id: "manager-home-next-action",
        title: "Mulai dari sini",
        description:
          "Kartu ini menunjuk hal yang paling perlu kamu kerjakan lebih dulu. Klik tombolnya untuk langsung ke sana.",
      },
      {
        id: "manager-home-metrics",
        title: "Ringkasan angka",
        description:
          "Empat angka ini bisa diklik. Pilih salah satu untuk langsung ke halaman yang membahasnya.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Lead Tim",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead",
        description:
          "Kalimat ini merangkum berapa lead yang perlu tindakan dan berapa yang terlambat.",
      },
      {
        id: "sales-crm-filters",
        title: "Cari dan saring lead",
        description:
          "Cari nama customer, ubah urutan, atau pilih kelompok seperti Terlambat atau Customer panas.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead",
        description:
          "Tiap lead punya langkah berikutnya yang jelas. Klik Buka lead untuk detail atau Buka chat untuk menghubungi customer.",
      },
    ],
  },
  {
    path: "/approvals",
    title: "Review Sales",
    steps: [
      {
        id: "manager-approvals-summary",
        title: "Ringkasan",
        description:
          "Kalimat ini menyebut kasus mana yang paling perlu keputusan lebih dulu. Daftar di bawahnya sudah diurutkan dari yang paling mendesak.",
      },
      {
        id: "manager-approvals-metrics",
        title: "Kelompok kasus",
        description:
          "Pilih satu kelompok untuk mempersempit daftar, misalnya Perlu keputusan manusia. Daftar langsung berubah.",
      },
      {
        id: "manager-approvals-filters",
        title: "Saring lebih lanjut",
        description:
          "Buka bagian ini untuk menyaring berdasarkan tingkat risiko, lama menunggu, atau channel.",
      },
      {
        id: "manager-approvals-queue",
        title: "Daftar kasus",
        description:
          "Tiap kasus menjelaskan apa yang perlu kamu lakukan. Klik Buka chat untuk melihat chat lengkap dan memutuskan.",
      },
    ],
  },
  {
    path: "/manager-insights",
    title: "Monitor Tim",
    steps: [
      {
        id: "manager-insights-hero",
        title: "Ringkasan tim",
        description:
          "Kalimat di atas merangkum berapa hal yang perlu perhatianmu, ditambah beberapa angka utama: follow-up terlambat dan ketepatan follow-up.",
      },
      {
        id: "manager-insights-steps",
        title: "Perlu perhatian",
        description:
          "Peringatan dari tim dan kasus pembinaan ada di sini. Tiap item menjelaskan apa yang perlu kamu lakukan dan punya tombol untuk membukanya.",
      },
      {
        id: "manager-insights-sales-performance",
        title: "Anggota tim",
        description:
          "Lihat kondisi tiap Sales. Klik Lihat detail untuk melihat lead dan chat yang bermasalah, atau Beri tugas untuk membuat tugas pembinaan.",
      },
      {
        id: "manager-insights-objections",
        title: "Keraguan customer",
        description:
          "Hal yang paling sering membuat customer ragu. Kalau sama terus, beri arahan umum ke seluruh tim.",
      },
    ],
  },
  {
    path: "/crm/[leadId]",
    title: "Detail Lead",
    steps: [
      {
        id: "sales-lead-detail-focus",
        title: "Fokus lead untuk manager",
        description:
          "Bagian atas ini memberi pembacaan cepat tekanan utama lead sebelum manager turun ke form atau timeline detail.",
      },
      {
        id: "sales-lead-detail-snapshot",
        title: "Snapshot lead tim",
        description:
          "Kartu ini membantu manager mengecek kondisi inti lead: owner, kontak terakhir, follow-up, deal status, dan jumlah percakapan.",
      },
      {
        id: "sales-lead-detail-context",
        title: "Kontrol konteks lead",
        description:
          "Form ini adalah tempat manager memvalidasi stage, suhu lead, summary, owner, dan jadwal follow-up.",
      },
      {
        id: "sales-lead-detail-discipline",
        title: "Jejak follow-up sales",
        description:
          "Bagian ini membantu manager melihat apakah follow-up benar-benar berjalan atau hanya terlihat rapi di status.",
      },
      {
        id: "sales-lead-detail-timeline",
        title: "Audit trail lead",
        description:
          "Timeline ini dipakai manager untuk melihat perubahan penting di lead tanpa harus menebak histori kerjanya.",
      },
    ],
  },
  {
    path: "/sales/conversations/[conversationId]",
    title: "Detail Percakapan",
    steps: [
      {
        id: "sales-conversation-timeline",
        title: "Timeline conversation",
        description:
          "Manager tetap mulai dari chat terbaru supaya keputusan review tidak lepas dari konteks customer yang sebenarnya.",
      },
      {
        id: "sales-conversation-workspace",
        title: "Workspace review manager",
        description:
          "Panel kanan ini adalah area kerja manager untuk berpindah antara AI, coaching, knowledge, dan sent logs.",
      },
      {
        id: "sales-conversation-ai-summary",
        title: "Ringkasan AI conversation",
        description:
          "Bagian ini merangkum hasil baca Clara yang paling relevan untuk manager saat menilai kualitas arah balasan.",
      },
      {
        id: "sales-conversation-reply-actions",
        title: "Aksi jawaban dan review",
        description:
          "Di sinilah manager melihat draft, approval, dan langkah tindak lanjut sebelum memutuskan arahan ke sales.",
      },
    ],
  },
  {
    path: "/customers/[customerId]",
    title: "Detail Customer",
    steps: [
      {
        id: "sales-customer-detail-focus",
        title: "Fokus customer untuk manager",
        description:
          "Bagian atas ini membantu manager tahu customer mana yang perlu dicek dan kenapa customer ini penting buat tim sekarang.",
      },
      {
        id: "sales-customer-detail-summary",
        title: "Ringkasan customer lintas lead",
        description:
          "Panel ini menunjukkan customer sebagai satu entitas lintas lead dan channel, bukan sekadar satu conversation.",
      },
      {
        id: "sales-customer-detail-panels",
        title: "Pilihan panel customer",
        description:
          "Tombol ini membantu manager berpindah fokus antara ringkasan, lead terkait, dan merge candidate.",
      },
      {
        id: "sales-customer-detail-profile",
        title: "Data customer inti",
        description:
          "Di sini manager memvalidasi identitas customer dan memastikan data yang dipakai tim tidak pecah atau salah baca.",
      },
    ],
  },
  {
    path: "/profile",
    title: "Profile",
    steps: [
      {
        id: "profile-extension-download",
        title: "Download Clara Extension",
        description:
          "Kalau perlu pasang ulang atau bantu tim instal extension, ambil file extension global dari kartu ini. Manager memakai package yang sama dengan role lain.",
      },
    ],
  },
];

const HEAD_TOUR_ROUTES: TourRoute[] = [
  {
    path: "/workspace",
    title: "Beranda Head",
    steps: [
      {
        id: "head-shell-sidebar",
        title: "Menu kerja head",
        description:
          "Sidebar ini adalah jalur kerja head untuk berpindah antara Beranda, Alert Tim, Monitor Tim, Arahan Tim, dan Lead Tim.",
      },
      {
        id: "head-home-next-action",
        title: "Mulai dari sini",
        description:
          "Kartu ini menunjuk hal yang paling perlu keputusanmu. Klik tombolnya untuk langsung ke sana.",
      },
      {
        id: "head-home-metrics",
        title: "Ringkasan angka",
        description:
          "Empat angka ini bisa diklik. Pilih salah satu untuk langsung ke halaman yang membahasnya.",
      },
    ],
  },
  {
    path: "/notifications",
    title: "Alert Tim",
    steps: [
      {
        id: "head-alerts-summary",
        title: "Ringkasan alert tim",
        description:
          "Bagian atas ini membantu head memahami tingkat urgensi alert lintas tim dan area mana yang perlu dibaca dulu.",
      },
      {
        id: "head-alerts-metrics",
        title: "Kartu tekanan alert",
        description:
          "Kartu angka ini dipakai untuk membaca jumlah alert aktif, acknowledged, resolved, dan escalation dengan cepat.",
      },
      {
        id: "head-alerts-filters",
        title: "Filter alert tim",
        description:
          "Filter ini membantu head memotong daftar alert berdasarkan status dan severity agar fokusnya tetap tajam.",
      },
      {
        id: "head-alerts-list",
        title: "Daftar alert per owner",
        description:
          "Di sini alert dikelompokkan supaya head bisa langsung melihat owner atau area tim mana yang paling banyak butuh perhatian.",
      },
    ],
  },
  {
    path: "/manager-insights",
    title: "Monitor Tim",
    steps: [
      {
        id: "manager-insights-hero",
        title: "Ringkasan semua tim",
        description:
          "Kalimat di atas merangkum berapa hal yang perlu keputusanmu, ditambah angka utama lintas tim.",
      },
      {
        id: "manager-insights-steps",
        title: "Perlu perhatian",
        description:
          "Peringatan dari tim dan kasus yang butuh arahan Head. Tiap item menjelaskan apa yang perlu kamu lakukan.",
      },
      {
        id: "manager-insights-sales-performance",
        title: "Anggota tim",
        description:
          "Lihat kondisi tiap Sales dari semua tim, buka detailnya, atau beri tugas pembinaan.",
      },
      {
        id: "manager-insights-objections",
        title: "Keraguan customer",
        description:
          "Pola keraguan yang berulang bisa dijadikan arahan umum untuk seluruh tim.",
      },
    ],
  },
  {
    path: "/approvals",
    title: "Arahan Tim",
    steps: [
      {
        id: "manager-approvals-summary",
        title: "Ringkasan",
        description:
          "Kalimat ini menyebut kasus mana yang paling perlu keputusan lebih dulu. Daftar di bawahnya sudah diurutkan dari yang paling mendesak.",
      },
      {
        id: "manager-approvals-metrics",
        title: "Kelompok kasus",
        description:
          "Pilih satu kelompok untuk mempersempit daftar, misalnya Perlu keputusan manusia. Daftar langsung berubah.",
      },
      {
        id: "manager-approvals-filters",
        title: "Saring lebih lanjut",
        description:
          "Buka bagian ini untuk menyaring berdasarkan tingkat risiko, lama menunggu, atau channel.",
      },
      {
        id: "manager-approvals-queue",
        title: "Daftar kasus",
        description:
          "Tiap kasus menjelaskan apa yang perlu kamu lakukan. Klik Buka chat untuk melihat chat lengkap dan memutuskan.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Lead Tim",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead",
        description:
          "Kalimat ini merangkum berapa lead yang perlu tindakan dan berapa yang terlambat.",
      },
      {
        id: "sales-crm-filters",
        title: "Cari dan saring lead",
        description:
          "Cari nama customer, ubah urutan, atau pilih kelompok seperti Terlambat atau Customer panas.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead",
        description:
          "Tiap lead punya langkah berikutnya yang jelas. Klik Buka lead untuk detail atau Buka chat untuk menghubungi customer.",
      },
    ],
  },
  {
    path: "/crm/[leadId]",
    title: "Detail Lead",
    steps: [
      {
        id: "sales-lead-detail-focus",
        title: "Fokus lead untuk head",
        description:
          "Bagian atas ini membantu head melihat tekanan utama lead sebelum memberikan arahan atau intervensi.",
      },
      {
        id: "sales-lead-detail-snapshot",
        title: "Snapshot lead lintas keputusan",
        description:
          "Kartu ini dipakai untuk membaca kondisi inti lead secara cepat: owner, follow-up, status deal, dan jumlah percakapan.",
      },
      {
        id: "sales-lead-detail-context",
        title: "Validasi konteks lead",
        description:
          "Form ini adalah tempat head memvalidasi stage, owner, suhu lead, dan konteks yang memengaruhi keputusan.",
      },
      {
        id: "sales-lead-detail-discipline",
        title: "Jejak eksekusi tim",
        description:
          "Bagian ini membantu head melihat apakah follow-up tim benar-benar jalan atau hanya tampak rapi di status.",
      },
      {
        id: "sales-lead-detail-timeline",
        title: "Audit trail lead",
        description:
          "Timeline ini dipakai head untuk membaca histori perubahan lead sebelum memutuskan eskalasi atau arahan tambahan.",
      },
    ],
  },
  {
    path: "/sales/conversations/[conversationId]",
    title: "Detail Percakapan",
    steps: [
      {
        id: "sales-conversation-timeline",
        title: "Timeline percakapan untuk head",
        description:
          "Head tetap mulai dari konteks chat terbaru supaya keputusan yang diambil tidak lepas dari situasi customer sebenarnya.",
      },
      {
        id: "sales-conversation-workspace",
        title: "Workspace arahan",
        description:
          "Panel kanan ini adalah area kerja head untuk melihat AI, coaching, knowledge, dan sent logs tanpa kehilangan konteks utama.",
      },
      {
        id: "sales-conversation-ai-summary",
        title: "Ringkasan AI percakapan",
        description:
          "Bagian ini merangkum hasil baca Clara yang paling relevan untuk keputusan atau validasi arah balasan.",
      },
      {
        id: "sales-conversation-reply-actions",
        title: "Aksi keputusan percakapan",
        description:
          "Di sinilah head melihat draft, approval, dan jalur tindak lanjut sebelum memberi arahan ke manager atau sales.",
      },
    ],
  },
  {
    path: "/profile",
    title: "Profile",
    steps: [
      {
        id: "profile-extension-download",
        title: "Download Clara Extension",
        description:
          "Halaman profile sekarang juga jadi titik distribusi extension. Head bisa arahkan user untuk ambil file extension global langsung dari kartu ini.",
      },
    ],
  },
];

function isDynamicRoutePath(path: string) {
  return path.includes("[");
}

function matchesRoutePath(routePath: string, pathname: string) {
  if (routePath === pathname) {
    return true;
  }

  if (!isDynamicRoutePath(routePath)) {
    return false;
  }

  const routePattern = routePath.replace(/\[[^\]]+\]/g, "[^/]+");
  return new RegExp(`^${routePattern}$`).test(pathname);
}

function getTourRoutes(role: TourRole) {
  if (role === "manager") {
    return MANAGER_TOUR_ROUTES;
  }
  if (role === "head") {
    return HEAD_TOUR_ROUTES;
  }
  return TOUR_ROUTES;
}

function buildStorageKey(userId: string, role: TourRole) {
  return `clara.${role}-onboarding.v${STORAGE_VERSION}.${userId}`;
}

export function resetDashboardOnboardingState(userId: string, role: TourRole) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  window.localStorage.removeItem(buildStorageKey(userId, role));
}

export function resetSalesOnboardingState(userId: string) {
  resetDashboardOnboardingState(userId, "sales");
}

function readState(userId: string, role: TourRole): TourState {
  if (typeof window === "undefined") {
    return {
      completed: false,
      dismissed: false,
      routeIndex: 0,
      stepIndex: 0,
    };
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId, role));
    if (!raw) {
      return {
        completed: false,
        dismissed: false,
        routeIndex: 0,
        stepIndex: 0,
      };
    }

    const parsed = JSON.parse(raw) as Partial<TourState>;
    const routes = getTourRoutes(role);
    const routeIndex = clamp(
      typeof parsed.routeIndex === "number" ? parsed.routeIndex : 0,
      0,
      routes.length - 1,
    );
    return {
      completed: parsed.completed === true,
      dismissed: parsed.dismissed === true,
      routeIndex,
      stepIndex: clamp(
        typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
        0,
        routes[routeIndex].steps.length - 1,
      ),
    };
  } catch {
    return {
      completed: false,
      dismissed: false,
      routeIndex: 0,
      stepIndex: 0,
    };
  }
}

function writeState(userId: string, role: TourRole, state: TourState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    buildStorageKey(userId, role),
    JSON.stringify(state),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SalesOnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const dashboardUser = useDashboardUser();
  const currentUser = dashboardUser?.currentUser ?? null;
  const [tourState, setTourState] = useState<TourState | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popupHeight, setPopupHeight] = useState(260);

  const currentTourRole: TourRole | null =
    currentUser?.role === "sales"
      ? "sales"
      : currentUser?.role === "manager"
        ? "manager"
        : currentUser?.role === "head"
          ? "head"
        : null;
  const userId = currentUser?.id ?? "";
  const activeTourRoutes = useMemo(
    () => (currentTourRole ? getTourRoutes(currentTourRole) : []),
    [currentTourRole],
  );
  const routeIndexFromPath = activeTourRoutes.findIndex((route) =>
    matchesRoutePath(route.path, pathname),
  );

  useEffect(() => {
    if (!currentTourRole || !userId) {
      setTourState(null);
      return;
    }

    setTourState(readState(userId, currentTourRole));
  }, [currentTourRole, userId]);

  useEffect(() => {
    if (!tourState || !userId || !currentTourRole) {
      return;
    }

    writeState(userId, currentTourRole, tourState);
  }, [currentTourRole, tourState, userId]);

  useEffect(() => {
    if (!tourState || routeIndexFromPath < 0 || tourState.completed || tourState.dismissed) {
      return;
    }

    if (routeIndexFromPath < tourState.routeIndex) {
      return;
    }

    if (routeIndexFromPath !== tourState.routeIndex) {
      setTourState((current) =>
        current
          ? {
              ...current,
              routeIndex: routeIndexFromPath,
              stepIndex: 0,
            }
          : current,
      );
    }
  }, [routeIndexFromPath, tourState]);

  const activeRoute = useMemo(() => {
    if (!tourState || routeIndexFromPath < 0) {
      return null;
    }

    if (tourState.completed || tourState.dismissed) {
      return null;
    }

    if (routeIndexFromPath !== tourState.routeIndex) {
      return null;
    }

    return activeTourRoutes[tourState.routeIndex] ?? null;
  }, [activeTourRoutes, routeIndexFromPath, tourState]);

  const activeStep = useMemo(() => {
    if (!activeRoute || !tourState) {
      return null;
    }

    return activeRoute.steps[tourState.stepIndex] ?? null;
  }, [activeRoute, tourState]);
  const isTourVisible = Boolean(activeStep);

  useEffect(() => {
    if (!isTourVisible) {
      return;
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrameId = window.requestAnimationFrame(() => {
      popupRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setTourState((current) =>
        current
          ? {
              ...current,
              completed: true,
              dismissed: true,
            }
          : current,
      );
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [isTourVisible]);

  useEffect(() => {
    if (!activeStep) {
      setTargetRect(null);
      return;
    }

    let animationFrameId = 0;

    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-onboarding-id="${activeStep.id}"]`,
      );

      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      const isOutOfView =
        rect.top < VIEWPORT_GAP ||
        rect.bottom > window.innerHeight - VIEWPORT_GAP;

      if (isOutOfView) {
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateTarget);
    };

    scheduleUpdate();

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [activeStep]);

  useEffect(() => {
    if (!activeStep) {
      return;
    }

    const popup = popupRef.current;

    if (!popup) {
      return;
    }

    const nextHeight = popup.getBoundingClientRect().height;

    if (nextHeight > 0 && Math.abs(nextHeight - popupHeight) > 1) {
      setPopupHeight(nextHeight);
    }
  }, [
    activeStep,
    popupHeight,
    targetRect,
    tourState?.routeIndex,
    tourState?.stepIndex,
  ]);

  if (!currentTourRole || !tourState || !activeRoute || !activeStep) {
    return null;
  }

  const routeLabel = `${tourState.routeIndex + 1} dari ${activeTourRoutes.length}`;
  const stepLabel = `${tourState.stepIndex + 1} dari ${activeRoute.steps.length}`;
  const isLastStepOnRoute =
    tourState.stepIndex >= activeRoute.steps.length - 1;
  const isLastRoute = tourState.routeIndex >= activeTourRoutes.length - 1;
  const activeRouteIndex = tourState.routeIndex;
  const nextRoute = isLastRoute
    ? null
    : activeTourRoutes[activeRouteIndex + 1] ?? null;
  const nextRouteRequiresManualOpen = nextRoute
    ? isDynamicRoutePath(nextRoute.path)
    : false;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportWidth =
    typeof window === "undefined" ? 1280 : window.innerWidth;

  const preferredBottomTop = targetRect ? targetRect.bottom + 12 : VIEWPORT_GAP;
  const preferredTopTop = targetRect
    ? targetRect.top - popupHeight - 12
    : VIEWPORT_GAP;
  const popupTop = targetRect
    ? preferredBottomTop + popupHeight <= viewportHeight - VIEWPORT_GAP
      ? preferredBottomTop
      : preferredTopTop >= VIEWPORT_GAP
        ? preferredTopTop
        : clamp(
            preferredBottomTop,
            VIEWPORT_GAP,
            viewportHeight - popupHeight - VIEWPORT_GAP,
          )
    : Math.max(VIEWPORT_GAP, viewportHeight / 2 - popupHeight / 2);
  const popupLeft = targetRect
    ? clamp(
        Math.min(targetRect.left, targetRect.right - POPUP_WIDTH),
        VIEWPORT_GAP,
        viewportWidth - POPUP_WIDTH - VIEWPORT_GAP,
      )
    : Math.max(VIEWPORT_GAP, viewportWidth / 2 - POPUP_WIDTH / 2);
  const highlightLeft = targetRect
    ? Math.max(VIEWPORT_GAP / 2, targetRect.left - 8)
    : 0;
  const highlightTop = targetRect
    ? Math.max(VIEWPORT_GAP / 2, targetRect.top - 8)
    : 0;
  const highlightWidth = targetRect ? Math.max(80, targetRect.width + 16) : 0;
  const highlightHeight = targetRect ? Math.max(56, targetRect.height + 16) : 0;
  const highlightRight = highlightLeft + highlightWidth;
  const highlightBottom = highlightTop + highlightHeight;

  function updateTourState(updater: (current: TourState) => TourState) {
    setTourState((current) => (current ? updater(current) : current));
  }

  function handleSkip() {
    updateTourState((current) => ({
      ...current,
      completed: true,
      dismissed: true,
    }));
  }

  function handleNext() {
    if (!isLastStepOnRoute) {
      updateTourState((current) => ({
        ...current,
        stepIndex: current.stepIndex + 1,
      }));
      return;
    }

    if (!isLastRoute) {
      updateTourState((current) => ({
        ...current,
        routeIndex: current.routeIndex + 1,
        stepIndex: 0,
      }));
      if (nextRoute && !isDynamicRoutePath(nextRoute.path)) {
        router.push(nextRoute.path);
      }
      return;
    }

    updateTourState((current) => ({
      ...current,
      completed: true,
    }));
  }

  return (
    <>
      {targetRect ? (
        <>
          <div
            className="pointer-events-none fixed inset-x-0 top-0 z-[70] bg-[rgba(0,0,0,0.34)] backdrop-blur-[3px]"
            style={{ height: highlightTop }}
          />
          <div
            className="pointer-events-none fixed bottom-0 left-0 z-[70] bg-[rgba(0,0,0,0.34)] backdrop-blur-[3px]"
            style={{
              top: highlightTop,
              width: highlightLeft,
              height: highlightHeight,
            }}
          />
          <div
            className="pointer-events-none fixed bottom-0 right-0 z-[70] bg-[rgba(0,0,0,0.34)] backdrop-blur-[3px]"
            style={{
              top: highlightTop,
              left: highlightRight,
            }}
          />
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] bg-[rgba(0,0,0,0.34)] backdrop-blur-[3px]"
            style={{ top: highlightBottom }}
          />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-[rgba(0,0,0,0.34)] backdrop-blur-[3px]" />
      )}

      {targetRect ? (
        <div
          className="pointer-events-none fixed z-[71] rounded-2xl border-[3px] border-[#f6d98c] bg-transparent shadow-[0_0_0_2px_rgba(255,243,207,0.42),0_0_28px_rgba(240,203,115,0.38),0_0_0_9999px_rgba(0,0,0,0.14)] transition-all motion-reduce:transition-none"
          style={{
            left: highlightLeft,
            top: highlightTop,
            width: highlightWidth,
            height: highlightHeight,
          }}
        />
      ) : null}

      <div
        aria-labelledby="sales-onboarding-title"
        className="fixed z-[72] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#f6d98c]/40 bg-[linear-gradient(180deg,rgba(43,31,19,0.99)_0%,rgba(20,14,10,0.99)_100%)] p-5 text-[#fff4d6] shadow-[0_28px_64px_rgba(0,0,0,0.58),0_0_0_1px_rgba(246,217,140,0.18)]"
        ref={popupRef}
        role="dialog"
        style={{
          left: popupLeft,
          top: popupTop,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#f6d98c]">
              {currentTourRole === "manager"
                ? "Onboarding Manager"
                : currentTourRole === "head"
                  ? "Onboarding Head"
                  : "Onboarding Sales"}
            </p>
            <h2
              id="sales-onboarding-title"
              className="mt-2 text-xl font-bold leading-7 text-[#fff6de]"
            >
              {activeStep.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="clara-button clara-button-ghost"
          >
            Lewati
          </button>
        </div>

        <p className="mt-3 text-[15px] leading-7 text-[#f1ddb0]">
          {activeStep.description}
        </p>

        <div className="mt-4 rounded-2xl border border-[#f6d98c]/16 bg-[rgba(246,217,140,0.12)] px-3 py-2 text-xs font-medium text-[#f4e0b5]">
          {activeRoute.title}: langkah {stepLabel} (halaman {routeLabel})
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-[#d8bc84]">
            {isLastStepOnRoute
              ? isLastRoute
                ? "Ini langkah terakhir onboarding."
                : nextRouteRequiresManualOpen
                  ? "Setelah ini buka halaman detail berikutnya untuk lanjut onboarding."
                  : "Setelah ini Clara akan pindah ke halaman berikutnya."
              : "Klik Lanjut untuk melihat bagian berikutnya di halaman ini."}
          </p>

          <button
            type="button"
            onClick={handleNext}
            className="clara-button clara-button-primary"
          >
            {isLastStepOnRoute
              ? isLastRoute
                ? "Selesai"
                : nextRouteRequiresManualOpen
                  ? "Lanjut nanti"
                  : "Lanjut halaman"
              : "Lanjut"}
          </button>
        </div>
      </div>
    </>
  );
}
