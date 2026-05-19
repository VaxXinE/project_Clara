"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowTrendUp,
  faBars,
  faBookOpen,
  faBriefcase,
  faBuildingShield,
  faCalendarCheck,
  faChartColumn,
  faChartLine,
  faChevronLeft,
  faCloudArrowUp,
  faComments,
  faGaugeHigh,
  faRightFromBracket,
  faUsersGear,
  faWandSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";
import { apiFetch } from "@/lib/api";
import { formatStatusLabel } from "@/lib/format";
import type { CurrentUser } from "@/types/dashboard";

type WorkspaceShellProps = {
  currentUser?: CurrentUser | null;
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconDefinition;
  description: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

function getRolePrinciples(role?: string) {
  if (role === "owner") {
    return {
      title: "Mode Owner",
      items: [
        "Mulai dari KPI, alert, dan notification untuk membaca kesehatan bisnis lebih dulu.",
        "Turun ke marketing, pipeline, atau identity hanya saat ada sinyal yang perlu intervensi.",
        "Gunakan halaman operasional untuk verifikasi, bukan sebagai titik pantau utama harian.",
      ],
    };
  }

  if (role === "admin") {
    return {
      title: "Mode Admin",
      items: [
        "Mulai dari notification, approvals, dan KPI agar bottleneck tim cepat terlihat.",
        "Pastikan workflow sales dan lead pipeline tetap rapi sebelum masuk ke area insight.",
        "Users dan Admin Ops dipakai saat ada masalah akses atau kontrol organisasi.",
      ],
    };
  }

  return {
    title: "Mode Marketing",
    items: [
      "Mulai dari import chat atau Chat Masuk, lalu bergerak ke lead dan follow-up.",
      "Gunakan AI analysis dan draft sebagai alat bantu, bukan pengganti pengecekan konteks chat.",
      "Naikkan ke approvals, notifications, atau CRM saat conversation sudah butuh tindakan lanjutan.",
    ],
  };
}

function buildNavGroups(currentUser?: CurrentUser | null): NavGroup[] {
  const workspaceItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Beranda",
      icon: faGaugeHigh,
      description: "Pusat ringkasan tim",
    },
    {
      href: "/dashboard/sales",
      label: "Inbox",
      icon: faComments,
      description: "Percakapan pelanggan",
    },
    {
      href: "/dashboard/upload",
      label: "Upload",
      icon: faCloudArrowUp,
      description: "Masukkan chat baru",
    },
    {
      href: "/dashboard/crm",
      label: "CRM",
      icon: faBriefcase,
      description: "Monitor pipeline lead",
    },
    {
      href: "/dashboard/follow-up",
      label: "Follow Up",
      icon: faCalendarCheck,
      description: "Tugas prioritas harian",
    },
    {
      href: "/dashboard/approvals",
      label: "Approval",
      icon: faWandSparkles,
      description: "Review draft Clara",
    },
  ];

  const insightItems: NavItem[] = [];
  const adminItems: NavItem[] = [];

  if (currentUser?.role === "owner") {
    insightItems.push({
      href: "/dashboard/knowledge",
      label: "Knowledge",
      icon: faBookOpen,
      description: "Fakta dan policy resmi",
    });
  }

  if (currentUser && ["owner", "admin"].includes(currentUser.role)) {
    insightItems.push(
      {
        href: "/dashboard/marketing",
        label: "Insights",
        icon: faChartLine,
        description: "Sinyal pasar dan tren",
      },
      {
        href: "/dashboard/kpi",
        label: "KPI Center",
        icon: faChartColumn,
        description: "Performa tim dan org",
      },
    );

    adminItems.push(
      {
        href: "/dashboard/admin/ops",
        label: "Admin Ops",
        icon: faBuildingShield,
        description: "Kontrol operasional",
      },
      {
        href: "/dashboard/admin/access",
        label: "User Access",
        icon: faUsersGear,
        description: "Kelola struktur akses",
      },
    );
  }

  const groups: NavGroup[] = [{ title: "Workspace", items: workspaceItems }];

  if (insightItems.length > 0) {
    groups.push({ title: "Insights", items: insightItems });
  }

  if (adminItems.length > 0) {
    groups.push({ title: "Administration", items: adminItems });
  }

  return groups;
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getWorkspaceTitle(currentUser?: CurrentUser | null) {
  if (!currentUser) {
    return "Clara Workspace";
  }

  return currentUser.name;
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function WorkspaceShell({
  currentUser,
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const dashboardUser = useDashboardUser();
  const resolvedCurrentUser = currentUser ?? dashboardUser?.currentUser ?? null;
  const navGroups = buildNavGroups(resolvedCurrentUser);
  const rolePrinciples = getRolePrinciples(resolvedCurrentUser?.role);
  const todayLabel = getTodayLabel();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    dashboardUser?.syncCurrentUser(currentUser);
  }, [currentUser, dashboardUser]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.removeProperty("overflow");

      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [mobileNavOpen]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout API failure and still force redirect to login.
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <main className="min-h-screen bg-transparent text-slate-900">
      <div className="relative min-h-screen xl:grid xl:grid-cols-[292px_minmax(0,1fr)] xl:items-start">
        <div
          className={`fixed inset-0 z-40 bg-slate-950/44 backdrop-blur-[2px] transition-opacity duration-300 xl:hidden ${
            mobileNavOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />

        <aside
          id="clara-mobile-sidebar"
          className={`fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[86vw] flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#0f162c_0%,#15203b_48%,#10172d_100%)] text-white shadow-[0_24px_48px_rgba(15,23,42,0.34)] transition-transform duration-300 xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-auto xl:max-w-none xl:translate-x-0 xl:shadow-none ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,_rgba(212,176,123,0.34),_transparent_70%)] opacity-90" />
          <div className="absolute inset-y-0 right-0 hidden w-px bg-white/8 xl:block" />

          <div className="relative shrink-0 border-b border-white/10 px-5 py-5">
            <div className="mb-4 flex items-center justify-between xl:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d4b07b]">
                Navigation
              </p>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-slate-100"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Tutup menu"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-[0_18px_34px_rgba(3,7,18,0.22)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f8ead2_0%,#d4b07b_100%)] text-[#10172d] shadow-[0_12px_22px_rgba(0,0,0,0.18)]">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {getWorkspaceTitle(resolvedCurrentUser)}
                  </p>
                  <p className="truncate text-sm text-slate-300">
                    {resolvedCurrentUser?.organization_name ?? "Clara Workspace"}
                  </p>
                </div>
              </div>

              {resolvedCurrentUser ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                  <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1">
                    {formatStatusLabel(resolvedCurrentUser.role)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1">
                    Internal workspace
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="clara-scrollbar relative min-h-0 flex-1 space-y-8 overflow-y-auto px-4 py-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d4b07b]">
                  {group.title}
                </p>
                <nav className="mt-3 space-y-2.5">
                  {group.items.map((item) => {
                    const active = isNavItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={`group flex items-center gap-3 rounded-[22px] px-3 py-3 transition ${
                          active
                            ? "bg-[linear-gradient(135deg,#fff7ea_0%,#ecd4af_100%)] text-[#10172d] shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                            : "border border-white/0 text-slate-200 hover:border-white/8 hover:bg-white/6 hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                            active
                              ? "bg-[#10172d] text-[#f4e7d3]"
                              : "border border-white/10 bg-white/6 text-slate-200 group-hover:bg-white/10"
                          }`}
                        >
                          <FontAwesomeIcon
                            icon={item.icon}
                            className="h-4 w-4"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {item.label}
                          </span>
                          <span
                            className={`mt-0.5 block truncate text-xs ${
                              active ? "text-slate-600" : "text-slate-400"
                            }`}
                          >
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="relative mt-auto border-t border-white/10 px-4 py-4">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-[22px] border border-red-500/10 bg-red-500/6 px-3 py-3 text-left text-red-100 hover:border-red-500/16 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/10 bg-red-500/8 text-red-100">
                <FontAwesomeIcon
                  icon={faRightFromBracket}
                  className="h-4 w-4"
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {isLoggingOut ? "Keluar..." : "Logout"}
                </span>
              </span>
            </button>
          </div>
        </aside>

        <section className="min-w-0 px-5 pb-5 pt-24 sm:px-7 sm:pb-7 sm:pt-28 xl:py-7">
          <div className="fixed inset-x-0 top-1 z-30 px-5 pt-3 sm:px-7 sm:pt-4 xl:hidden">
            <div className="clara-surface flex items-center justify-between rounded-[24px] border px-4 py-3 shadow-xl backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e6b3f]">
                  Clara Workspace
                </p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {getWorkspaceTitle(resolvedCurrentUser)}
                </p>
              </div>

              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#10172d] text-white shadow-[0_12px_24px_rgba(16,23,45,0.22)]"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Buka menu"
                aria-expanded={mobileNavOpen}
                aria-controls="clara-mobile-sidebar"
              >
                <FontAwesomeIcon icon={faBars} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.035),rgba(255,255,255,0.85)_45%,rgba(184,138,90,0.08))] p-5 sm:grid-cols-[1.2fr_0.8fr] sm:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                {eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                {description}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {rolePrinciples.title}
                </p>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {todayLabel}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {rolePrinciples.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
