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

const STORAGE_VERSION = 2;
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
];

function buildStorageKey(userId: string) {
  return `clara.sales-onboarding.v${STORAGE_VERSION}.${userId}`;
}

export function resetSalesOnboardingState(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  window.localStorage.removeItem(buildStorageKey(userId));
}

function readState(userId: string): TourState {
  if (typeof window === "undefined") {
    return {
      completed: false,
      dismissed: false,
      routeIndex: 0,
      stepIndex: 0,
    };
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
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

function writeState(userId: string, state: TourState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(state));
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

  const isSalesUser = currentUser?.role === "sales";
  const userId = currentUser?.id ?? "";
  const routeIndexFromPath = TOUR_ROUTES.findIndex((route) => route.path === pathname);

  useEffect(() => {
    if (!isSalesUser || !userId) {
      setTourState(null);
      return;
    }

    setTourState(readState(userId));
  }, [isSalesUser, userId]);

  useEffect(() => {
    if (!tourState || !userId) {
      return;
    }

    writeState(userId, tourState);
  }, [tourState, userId]);

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

    return TOUR_ROUTES[tourState.routeIndex] ?? null;
  }, [routeIndexFromPath, tourState]);

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

  if (!isSalesUser || !tourState || !activeRoute || !activeStep) {
    return null;
  }

  const routeLabel = `${tourState.routeIndex + 1}/${TOUR_ROUTES.length}`;
  const stepLabel = `${tourState.stepIndex + 1}/${activeRoute.steps.length}`;
  const isLastStepOnRoute =
    tourState.stepIndex >= activeRoute.steps.length - 1;
  const isLastRoute = tourState.routeIndex >= TOUR_ROUTES.length - 1;
  const activeRouteIndex = tourState.routeIndex;
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
      const nextRoute = TOUR_ROUTES[activeRouteIndex + 1];
      updateTourState((current) => ({
        ...current,
        routeIndex: current.routeIndex + 1,
        stepIndex: 0,
      }));
      router.push(nextRoute.path);
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
              Onboarding Sales
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
                : "Lanjut halaman"
              : "Lanjut"}
          </button>
        </div>
      </div>
    </>
  );
}
