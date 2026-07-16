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
        title: "Menu kerja utama",
        description:
          "Sidebar ini adalah jalur kerja sales. Kamu akan paling sering pindah antara Beranda, Chat Masuk, Leads, Tindak Lanjut, dan Input Chat.",
      },
      {
        id: "sales-home-summary",
        title: "Ringkasan kerja hari ini",
        description:
          "Ini adalah ringkasan paling atas untuk membaca kondisi kerja hari ini. Biasanya cukup lihat bagian ini dulu sebelum memutuskan mau mulai dari chat, follow-up, atau lead.",
      },
      {
        id: "sales-home-metrics",
        title: "Angka tekanan kerja",
        description:
          "Kartu angka ini dipakai untuk membaca tekanan harian secara cepat. Tujuannya bukan analisis detail, tapi supaya kamu langsung tahu apakah kerja hari ini berat di chat, follow-up, atau risiko.",
      },
      {
        id: "sales-home-next-action",
        title: "Kerja berikutnya",
        description:
          "Panel ini menunjukkan pekerjaan yang paling layak dibuka berikutnya. Kalau kamu bingung harus mulai dari mana, ikuti blok ini dulu karena isinya memang diprioritaskan untuk sales.",
      },
      {
        id: "sales-home-latest-conversation",
        title: "Percakapan terbaru",
        description:
          "Bagian ini merangkum conversation terakhir yang masih relevan. Gunanya untuk cepat balik ke chat aktif tanpa harus buka inbox dan cari manual lagi.",
      },
      {
        id: "sales-home-quick-nav",
        title: "Navigasi cepat",
        description:
          "Tombol-tombol ini adalah shortcut ke area kerja utama sales. Pakai ini kalau kamu sudah tahu mau kerja di mana dan tidak perlu lewat sidebar dulu.",
      },
      {
        id: "sales-home-focus",
        title: "Fokus kerja Sales hari ini",
        description:
          "Blok ini menjelaskan prioritas praktis untuk hari ini: apakah harus mulai dari chat masuk, tindak lanjut, atau cukup rapikan lead yang masih aktif.",
      },
      {
        id: "sales-home-health",
        title: "Kondisi kerja",
        description:
          "Bagian ini adalah health check cepat untuk kualitas ritme kerja kamu: seberapa banyak chat sudah dibaca AI, berapa yang berisiko, dan seberapa besar coverage AI saat ini.",
      },
    ],
  },
  {
    path: "/sales",
    title: "Chat Masuk",
    steps: [
      {
        id: "sales-shell-actions",
        title: "Aksi cepat halaman ini",
        description:
          "Tombol di kanan atas dipakai untuk lompat cepat ke halaman yang paling sering dipakai bersama inbox ini.",
      },
      {
        id: "sales-inbox-hero",
        title: "Ringkasan inbox",
        description:
          "Bagian atas ini menjelaskan kondisi antrean chat secara singkat. Dari sini sales bisa langsung tahu apakah harus fokus ke chat berisiko, chat belum dianalisis, atau cukup lanjut ke percakapan siap balas.",
      },
      {
        id: "sales-inbox-metrics",
        title: "Kartu metrik inbox",
        description:
          "Tiga kartu ini adalah pembacaan cepat kondisi inbox: berapa yang masih perlu analisis, berapa yang berisiko tinggi, dan berapa yang sudah menunggu customer.",
      },
      {
        id: "sales-inbox-filters",
        title: "Filter antrean chat",
        description:
          "Gunakan filter ini untuk menyempitkan chat berdasarkan status, channel, dan prioritas kerja supaya fokusmu tidak pecah.",
      },
      {
        id: "sales-inbox-queue",
        title: "Antrean chat aktif",
        description:
          "Di sini Clara mengelompokkan chat berdasarkan apa yang perlu kamu lakukan: analisis, draft, balas, atau cukup tunggu customer.",
      },
      {
        id: "sales-inbox-upcoming-actions",
        title: "Aksi di setiap conversation",
        description:
          "Setiap kartu conversation memberi jalan kerja yang berbeda: analisis AI, buat draft, atau langsung buka percakapan. Fokusnya pilih aksi paling kecil yang membuat chat itu maju.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Leads",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead",
        description:
          "Bagian atas halaman lead membantu kamu tahu mana lead yang paling dekat ke aksi berikutnya atau mulai overdue.",
      },
      {
        id: "sales-crm-metrics",
        title: "Angka tekanan lead",
        description:
          "Kartu angka ini dipakai untuk membaca tekanan kerja di CRM dengan cepat: mana yang perlu tindakan, mana yang overdue, mana yang hot, dan mana yang belum sinkron.",
      },
      {
        id: "sales-crm-filters",
        title: "Filter dan pencarian lead",
        description:
          "Pakai filter ini untuk cari lead yang benar-benar perlu disentuh, misalnya yang overdue, hot, atau perlu sync.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead kerja",
        description:
          "Daftar ini adalah tempat memilih lead yang mau kamu baca lebih dulu sebelum turun ke preview atau detail penuh.",
      },
      {
        id: "sales-crm-preview",
        title: "Preview lead terpilih",
        description:
          "Panel kanan ini dipakai untuk cek konteks cepat lead yang sedang dipilih: owner, stage, kesehatan sync, dan langkah berikutnya sebelum kamu masuk ke detail lead atau conversation.",
      },
    ],
  },
  {
    path: "/customers",
    title: "Daftar Customer",
    steps: [
      {
        id: "sales-customers-hero",
        title: "Fokus customer sekarang",
        description:
          "Bagian atas ini membantu kamu lihat customer mana yang paling layak dibuka dulu beserta ringkasan tekanan kerjanya.",
      },
      {
        id: "sales-customers-filters",
        title: "Cari dan saring customer",
        description:
          "Gunakan pencarian dan filter status untuk cepat menemukan customer yang mau dicek tanpa scroll daftar panjang secara manual.",
      },
      {
        id: "sales-customers-list",
        title: "Daftar customer aktif",
        description:
          "Di sini kamu bisa baca ringkasan tiap customer, lihat hot lead atau lead aktifnya, lalu lanjut ke profil customer yang paling relevan.",
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
          "Kartu ini memberi tahu beban kerja follow-up hari ini, jadi kamu bisa mulai dari item yang paling telat atau paling siap dikirim.",
      },
      {
        id: "sales-followup-metrics",
        title: "Kartu angka follow-up",
        description:
          "Kartu angka di kanan dipakai untuk melihat tekanan kerja follow-up: yang telat berat, harus hari ini, siap dikirim, dan yang sudah selesai.",
      },
      {
        id: "sales-followup-filters",
        title: "Filter pekerjaan follow-up",
        description:
          "Gunakan pencarian dan prioritas untuk menyaring worklist supaya kamu tidak tenggelam di semua task sekaligus.",
      },
      {
        id: "sales-followup-list",
        title: "Daftar kerja yang harus dibereskan",
        description:
          "Bagian ini adalah eksekusi hariannya. Kerjakan item satu per satu, lalu tandai selesai atau sembunyikan kalau sudah aman.",
      },
      {
        id: "sales-followup-upcoming",
        title: "Follow-up berikutnya",
        description:
          "Bagian bawah ini berisi item yang belum perlu dikerjakan sekarang. Gunanya untuk melihat beban kerja berikutnya tanpa mencampur dengan prioritas hari ini.",
      },
    ],
  },
  {
    path: "/upload",
    title: "Input Chat",
    steps: [
      {
        id: "sales-upload-steps",
        title: "Alur input tercepat",
        description:
          "Kotak ini menjelaskan urutan paling singkat untuk memasukkan chat baru ke Clara tanpa banyak langkah tambahan.",
      },
      {
        id: "sales-upload-safety",
        title: "Aturan aman sebelum upload",
        description:
          "Blok ini menjelaskan hal-hal penting supaya Clara membaca chat dengan benar, terutama nama customer, channel, dan format file yang dipakai.",
      },
      {
        id: "sales-upload-form",
        title: "Form input chat",
        description:
          "Isi seperlunya saja: channel, nama customer, lalu file atau isi chat. Setelah diproses, Clara akan langsung bikin atau lanjutkan conversation.",
      },
      {
        id: "sales-upload-example",
        title: "Contoh format chat",
        description:
          "Kalau ragu format mana yang paling aman, lihat contoh ini dulu supaya parser Clara tidak salah membaca isi percakapan.",
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
        id: "manager-home-summary",
        title: "Ringkasan bottleneck hari ini",
        description:
          "Bagian atas ini dipakai untuk tahu tekanan utama tim hari ini sebelum Anda turun ke case atau lead tertentu.",
      },
      {
        id: "manager-home-next-action",
        title: "Aksi manager berikutnya",
        description:
          "Panel ini menunjukkan pekerjaan paling bernilai untuk dibuka lebih dulu, jadi Anda tidak perlu membaca semua data tim sekaligus.",
      },
      {
        id: "manager-home-health",
        title: "Kondisi tim singkat",
        description:
          "Blok ini merangkum kesehatan ritme tim: kepatuhan follow-up, lead yang mulai macet, dan jumlah catatan yang belum rapi.",
      },
      {
        id: "manager-home-quick-nav",
        title: "Navigasi cepat manager",
        description:
          "Shortcut ini dipakai untuk lompat ke area kerja paling sering setelah membaca beranda.",
      },
      {
        id: "manager-home-priority",
        title: "Urutan kerja manager",
        description:
          "Bagian ini menjelaskan urutan kerja yang paling aman: review sales dulu, cek monitor tim, lalu turun ke lead spesifik kalau perlu.",
      },
      {
        id: "manager-home-metrics",
        title: "Angka penting manager",
        description:
          "Kartu angka ini dipakai untuk pembacaan cepat kondisi tim tanpa perlu buka laporan monitor penuh.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Lead Tim",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead tim",
        description:
          "Bagian atas ini membantu manager tahu lead tim mana yang paling dekat ke risiko, overdue, atau butuh arahan cepat.",
      },
      {
        id: "sales-crm-metrics",
        title: "Angka tekanan lead tim",
        description:
          "Kartu ini memberi pembacaan cepat kondisi lead tim: perlu tindakan, overdue, hot, dan sinkronisasi yang tertinggal.",
      },
      {
        id: "sales-crm-filters",
        title: "Filter lead tim",
        description:
          "Gunakan filter ini untuk menyaring lead yang benar-benar layak dibaca manager lebih dulu.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead prioritas",
        description:
          "Bagian kiri ini adalah daftar lead yang perlu dipilih dulu sebelum manager turun ke preview atau detail penuh.",
      },
      {
        id: "sales-crm-preview",
        title: "Preview keputusan cepat",
        description:
          "Panel kanan membantu manager cek owner, stage, sync health, dan next action tanpa harus selalu masuk ke detail lead.",
      },
    ],
  },
  {
    path: "/approvals",
    title: "Review Sales",
    steps: [
      {
        id: "manager-approvals-summary",
        title: "Ringkasan review sales",
        description:
          "Bagian atas ini dipakai untuk membaca antrean review hari ini dan menentukan kasus mana yang perlu keputusan lebih dulu.",
      },
      {
        id: "manager-approvals-metrics",
        title: "Kartu tekanan review",
        description:
          "Angka ini menunjukkan beban keputusan, persiapan, eskalasi, dan item stale yang perlu dijaga manager.",
      },
      {
        id: "manager-approvals-filters",
        title: "Filter antrean review",
        description:
          "Filter ini membantu manager memotong antrean berdasarkan bucket, risk, age, dan channel agar fokusnya tidak melebar.",
      },
      {
        id: "manager-approvals-guide",
        title: "Urutan kerja review",
        description:
          "Bagian ini memberi panduan ringkas cara membaca antrean review dengan urutan yang aman dan cepat.",
      },
      {
        id: "manager-approvals-queue",
        title: "Daftar case review",
        description:
          "Di sinilah manager membaca case satu per satu, melihat konteks singkat, lalu memutuskan jalur berikutnya.",
      },
    ],
  },
  {
    path: "/manager-insights",
    title: "Monitor Tim",
    steps: [
      {
        id: "manager-insights-hero",
        title: "Ringkasan monitor tim",
        description:
          "Bagian atas ini menjelaskan area tim yang mulai melambat dan apa yang paling layak dipantau manager sekarang.",
      },
      {
        id: "manager-insights-steps",
        title: "Urutan baca monitor",
        description:
          "Panduan ini membantu manager membaca halaman monitor dengan urutan yang benar: tim bermasalah dulu, lalu case coaching, lalu pola hambatan.",
      },
      {
        id: "manager-insights-metrics",
        title: "Angka utama monitor",
        description:
          "Kartu angka ini dipakai untuk membaca urgensi tim tanpa perlu membuka semua panel detail.",
      },
      {
        id: "manager-insights-alerts",
        title: "Alert tim yang perlu dicek",
        description:
          "Bagian ini berisi area risiko yang paling menonjol, supaya manager bisa mulai dari tim yang paling butuh dorongan.",
      },
      {
        id: "manager-insights-cases",
        title: "Case review prioritas",
        description:
          "Panel ini mengelompokkan case coaching yang paling cepat memberi dampak kalau manager ambil keputusan sekarang.",
      },
      {
        id: "manager-insights-teams",
        title: "Ringkasan kondisi tiap tim",
        description:
          "Di sini manager bisa membandingkan kondisi tim secara cepat, lalu membuka anggota tim saat butuh konteks lebih dalam.",
      },
      {
        id: "manager-insights-objections",
        title: "Pola hambatan tim",
        description:
          "Bagian ini membantu manager melihat objection yang berulang, supaya arahan tim bisa lebih sistematis dan tidak hanya case-by-case.",
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
        title: "Aksi head berikutnya",
        description:
          "Panel utama ini menunjukkan area lintas tim yang paling layak dibaca dulu sebelum head turun ke detail yang lebih spesifik.",
      },
      {
        id: "head-home-health",
        title: "Ringkasan lintas tim",
        description:
          "Bagian ini dipakai untuk melihat kesehatan follow-up lintas tim secara cepat tanpa membuka halaman monitor penuh.",
      },
      {
        id: "head-home-quick-nav",
        title: "Navigasi cepat head",
        description:
          "Shortcut ini membantu head langsung masuk ke area kerja strategis yang paling sering dipakai.",
      },
      {
        id: "head-home-priority",
        title: "Cara baca beranda head",
        description:
          "Blok ini menjelaskan urutan kerja yang aman untuk head: alert besar dulu, pola monitor tim, lalu turunkan arahan.",
      },
      {
        id: "head-home-metrics",
        title: "Angka penting head",
        description:
          "Kartu angka ini dipakai untuk membaca tekanan lintas tim dengan cepat tanpa tenggelam di semua detail.",
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
    title: "Head Insight",
    steps: [
      {
        id: "manager-insights-hero",
        title: "Ringkasan head insight",
        description:
          "Bagian atas ini membantu head membaca area risiko tim dan memutuskan intervensi lintas tim yang paling penting.",
      },
      {
        id: "manager-insights-steps",
        title: "Urutan baca head insight",
        description:
          "Blok ini menjelaskan cara membaca insight untuk head: area risiko, case keputusan, lalu pola hambatan tim.",
      },
      {
        id: "manager-insights-metrics",
        title: "Angka utama head insight",
        description:
          "Kartu angka ini memberi pembacaan cepat kondisi lintas tim tanpa perlu membuka semua panel detail.",
      },
      {
        id: "manager-insights-alerts",
        title: "Area risiko tim",
        description:
          "Panel ini berisi boundary alert atau area tim yang cukup besar untuk masuk radar keputusan head.",
      },
      {
        id: "manager-insights-cases",
        title: "Case yang butuh keputusan head",
        description:
          "Di sinilah head melihat case coaching yang memang butuh arahan atau validasi level lebih tinggi.",
      },
      {
        id: "manager-insights-teams",
        title: "Tim yang perlu dipantau",
        description:
          "Bagian ini membantu head membandingkan kondisi tiap tim tanpa harus membaca semua lead satu per satu.",
      },
      {
        id: "manager-insights-objections",
        title: "Pola hambatan lintas tim",
        description:
          "Panel ini membantu head melihat objection berulang yang layak dijadikan arahan umum untuk banyak tim sekaligus.",
      },
    ],
  },
  {
    path: "/approvals",
    title: "Arahan Tim",
    steps: [
      {
        id: "manager-approvals-summary",
        title: "Ringkasan arahan tim",
        description:
          "Bagian atas ini dipakai head untuk melihat antrean keputusan yang benar-benar perlu intervensi level lebih tinggi.",
      },
      {
        id: "manager-approvals-metrics",
        title: "Kartu tekanan arahan",
        description:
          "Angka ini memberi pembacaan cepat jumlah item yang perlu diputuskan, disiapkan, atau sudah naik eskalasi.",
      },
      {
        id: "manager-approvals-filters",
        title: "Filter arahan tim",
        description:
          "Gunakan filter ini untuk menyaring kasus berdasarkan bucket, risk, age, dan channel supaya keputusan head tetap fokus.",
      },
      {
        id: "manager-approvals-guide",
        title: "Urutan kerja arahan",
        description:
          "Bagian ini merangkum urutan kerja yang paling aman saat membaca antrean arahan tim.",
      },
      {
        id: "manager-approvals-queue",
        title: "Daftar kasus arahan",
        description:
          "Di sinilah head membaca case, melihat konteks singkat, lalu memutuskan jalur keputusan berikutnya.",
      },
    ],
  },
  {
    path: "/crm",
    title: "Lead Tim",
    steps: [
      {
        id: "sales-crm-hero",
        title: "Ringkasan lead lintas tim",
        description:
          "Bagian atas ini membantu head melihat lead tim mana yang paling dekat ke risiko atau butuh keputusan lintas tim.",
      },
      {
        id: "sales-crm-metrics",
        title: "Angka tekanan lead lintas tim",
        description:
          "Kartu angka ini memberi pembacaan cepat kondisi lead lintas tim: overdue, hot, dan sinkronisasi yang tertinggal.",
      },
      {
        id: "sales-crm-filters",
        title: "Filter lead lintas tim",
        description:
          "Filter ini dipakai head untuk menyaring lead yang memang layak dibaca sebelum turun ke detail.",
      },
      {
        id: "sales-crm-list",
        title: "Daftar lead tim",
        description:
          "Panel kiri ini adalah daftar lead prioritas yang perlu dipilih dulu sebelum membaca preview atau detail penuh.",
      },
      {
        id: "sales-crm-preview",
        title: "Preview keputusan head",
        description:
          "Panel kanan membantu head membaca owner, stage, sync health, dan next action tanpa harus selalu turun ke detail lead.",
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
    return {
      completed: parsed.completed === true,
      dismissed: parsed.dismissed === true,
      routeIndex:
        typeof parsed.routeIndex === "number" && parsed.routeIndex >= 0
          ? parsed.routeIndex
          : 0,
      stepIndex:
        typeof parsed.stepIndex === "number" && parsed.stepIndex >= 0
          ? parsed.stepIndex
          : 0,
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
          behavior: "smooth",
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

  const routeLabel = `${tourState.routeIndex + 1}/${activeTourRoutes.length}`;
  const stepLabel = `${tourState.stepIndex + 1}/${activeRoute.steps.length}`;
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
          className="pointer-events-none fixed z-[71] rounded-[24px] border-[3px] border-[#f6d98c] bg-transparent shadow-[0_0_0_2px_rgba(255,243,207,0.42),0_0_28px_rgba(240,203,115,0.38),0_0_0_9999px_rgba(0,0,0,0.14)] transition-all"
          style={{
            left: highlightLeft,
            top: highlightTop,
            width: highlightWidth,
            height: highlightHeight,
          }}
        />
      ) : null}

      <div
        className="fixed z-[72] w-[340px] max-w-[calc(100vw-2rem)] rounded-[24px] border border-[#f6d98c]/40 bg-[linear-gradient(180deg,rgba(43,31,19,0.99)_0%,rgba(20,14,10,0.99)_100%)] p-5 text-[#fff4d6] shadow-[0_28px_64px_rgba(0,0,0,0.58),0_0_0_1px_rgba(246,217,140,0.18)]"
        ref={popupRef}
        style={{
          left: popupLeft,
          top: popupTop,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#f6d98c]">
              {currentTourRole === "manager"
                ? "Onboarding Manager"
                : currentTourRole === "head"
                  ? "Onboarding Head"
                  : "Onboarding Sales"}
            </p>
            <h2 className="mt-2 text-xl font-bold leading-7 text-[#fff6de]">
              {activeStep.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-full border border-[#f6d98c]/28 bg-[rgba(246,217,140,0.08)] px-3 py-1.5 text-xs font-semibold text-[#f6d98c] hover:bg-[rgba(246,217,140,0.14)]"
          >
            Lewati
          </button>
        </div>

        <p className="mt-3 text-[15px] leading-7 text-[#f1ddb0]">
          {activeStep.description}
        </p>

        <div className="mt-4 rounded-2xl border border-[#f6d98c]/16 bg-[rgba(246,217,140,0.12)] px-3 py-2 text-xs font-medium text-[#f4e0b5]">
          Halaman {routeLabel}: {activeRoute.title} • Komponen {stepLabel}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-[#d8bc84]">
            {isLastStepOnRoute
              ? isLastRoute
                ? "Ini langkah terakhir onboarding."
                : nextRouteRequiresManualOpen
                  ? "Setelah ini buka halaman detail berikutnya untuk lanjut onboarding."
                  : "Setelah ini Clara akan pindah ke halaman berikutnya."
              : "Lanjutkan untuk melihat komponen berikutnya di halaman ini."}
          </p>

          <button
            type="button"
            onClick={handleNext}
            className="rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:brightness-105"
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
