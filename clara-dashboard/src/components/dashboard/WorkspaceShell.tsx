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
  faCloudArrowUp,
  faComments,
  faGaugeHigh,
  faRightFromBracket,
  faTriangleExclamation,
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
import {
  canAccessQueueAndActionCenter,
  isAdminLike,
  isManagerLike,
  isOwnerLike,
} from "@/lib/roles";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResponse,
} from "@/types/dashboard";

const SITE_TITLE = "SGB Sales Command Center";
const SITE_SUBTITLE = "SCC Workspace";

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

function buildNavGroups(currentUser?: CurrentUser | null): NavGroup[] {
  const workspaceItems: NavItem[] = [
    {
      href: "/workspace",
      label: "Beranda",
      icon: faGaugeHigh,
      description: "Pusat ringkasan tim",
    },
    {
      href: "/crm",
      label: "Lead Management",
      icon: faBriefcase,
      description: "Status, owner, dan timeline lead",
    },
    {
      href: "/notifications",
      label: "Alert Center",
      icon: faTriangleExclamation,
      description: "Alert operasional yang perlu ditindak",
    },
  ];

  if (currentUser && canAccessQueueAndActionCenter(currentUser.role)) {
    workspaceItems.splice(
      1,
      0,
      {
        href: "/sales",
        label: "Queue",
        icon: faComments,
        description: "Kerja percakapan customer",
      },
      {
        href: "/follow-up",
        label: "Action Center",
        icon: faCalendarCheck,
        description: "Prioritas follow-up harian",
      },
    );
  }

  const insightItems: NavItem[] = [];
  const adminItems: NavItem[] = [];

  if (
    currentUser &&
    !isManagerLike(currentUser.role) &&
    !isAdminLike(currentUser.role)
  ) {
    workspaceItems.push({
      href: "/upload",
      label: "Lead Capture",
      icon: faCloudArrowUp,
      description: "Masukkan chat atau lead baru",
    });
  }

  if (currentUser && isAdminLike(currentUser.role)) {
    workspaceItems.push({
      href: "/channels",
      label: "Channels",
      icon: faBars,
      description: "Lihat sumber channel dan ingestion",
    });
  }

  if (currentUser && isManagerLike(currentUser.role)) {
    workspaceItems.push({
      href: "/approvals",
      label: "Chat Review Center",
      icon: faWandSparkles,
      description: "Triase chat, draft, dan escalation",
    });
    insightItems.push({
      href: "/manager-insights",
      label: "Manager Insights",
      icon: faChartLine,
      description: "Discipline, coaching, dan alert tim",
    });
  }

  if (currentUser && isAdminLike(currentUser.role)) {
    insightItems.push(
      {
        href: "/knowledge",
        label: "Knowledge Base",
        icon: faBookOpen,
        description: "Landasan jawaban resmi",
      },
      {
        href: "/kpi",
        label: "Ops Dashboard",
        icon: faChartColumn,
        description: "Performa tim dan organisasi",
      },
    );

    adminItems.push({
      href: "/admin/access",
      label: "Access Control",
      icon: faUsersGear,
      description: "Kelola role dan boundary akses",
    });
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
  if (href === "/workspace") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getWorkspaceTitle(currentUser?: CurrentUser | null) {
  if (!currentUser) {
    return "SCC Workspace";
  }

  return currentUser.name;
}

function getGlobalAlertNotifications(
  notifications: OpsNotificationItem[],
): OpsNotificationItem[] {
  const activeItems = notifications.filter((item) => item.status === "active");
  const prioritizedItems = activeItems.sort((left, right) => {
    const leftIsDealSync = left.source_type === "deal_metrics_sync" ? 1 : 0;
    const rightIsDealSync = right.source_type === "deal_metrics_sync" ? 1 : 0;
    if (leftIsDealSync !== rightIsDealSync) {
      return rightIsDealSync - leftIsDealSync;
    }

    const leftIsHigh = left.severity === "high" ? 1 : 0;
    const rightIsHigh = right.severity === "high" ? 1 : 0;
    if (leftIsHigh !== rightIsHigh) {
      return rightIsHigh - leftIsHigh;
    }

    return right.updated_at.localeCompare(left.updated_at);
  });

  return prioritizedItems.filter(
    (item) =>
      item.source_type === "deal_metrics_sync" ||
      (item.severity === "high" && Boolean(item.target_href)),
  );
}

export function WorkspaceShell({ currentUser, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const dashboardUser = useDashboardUser();
  const resolvedCurrentUser = currentUser ?? dashboardUser?.currentUser ?? null;
  const navGroups = buildNavGroups(resolvedCurrentUser);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [globalNotifications, setGlobalNotifications] = useState<
    OpsNotificationItem[]
  >([]);

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

  useEffect(() => {
    if (!resolvedCurrentUser) {
      setGlobalNotifications([]);
      return;
    }

    let isCancelled = false;

    async function loadGlobalNotifications() {
      try {
        const response = await apiFetch<OpsNotificationResponse>(
          "/dashboard/notifications",
        );
        if (isCancelled) {
          return;
        }
        setGlobalNotifications(
          getGlobalAlertNotifications(response.items).slice(0, 2),
        );
      } catch {
        if (!isCancelled) {
          setGlobalNotifications([]);
        }
      }
    }

    void loadGlobalNotifications();

    return () => {
      isCancelled = true;
    };
  }, [resolvedCurrentUser, pathname]);

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
          className={`fixed inset-0 z-40 bg-black/66 backdrop-blur-[2px] transition-opacity duration-300 xl:hidden ${
            mobileNavOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />

        <aside
          id="clara-mobile-sidebar"
          className={`fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[86vw] flex-col overflow-hidden border-r border-[#f0cb73]/14 bg-[linear-gradient(180deg,#15100a_0%,#0f0b07_48%,#090705_100%)] text-white shadow-[0_24px_48px_rgba(0,0,0,0.4)] transition-transform duration-300 xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-auto xl:max-w-none xl:translate-x-0 xl:shadow-none ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,_rgba(240,203,115,0.22),_transparent_70%)] opacity-90" />
          <div className="absolute inset-y-0 right-0 hidden w-px bg-[#f0cb73]/10 xl:block" />

          <div className="relative shrink-0 border-b border-[#f0cb73]/12 px-5 py-5">
            <div className="mb-4 flex items-center justify-between xl:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#f0cb73]">
                Navigation
              </p>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f0cb73]/14 bg-[#f0cb73]/8 text-[#f7e7b7]"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Tutup menu"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[28px] border border-[#f0cb73]/12 bg-[#f0cb73]/7 p-4 shadow-[0_18px_34px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f7dfa2_0%,#bf8f31_100%)] text-[#140f08] shadow-[0_12px_22px_rgba(0,0,0,0.22)]">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-5 text-white">
                    {SITE_TITLE}
                  </p>
                  <p className="truncate text-sm text-slate-300">
                    {SITE_SUBTITLE}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="clara-scrollbar relative min-h-0 flex-1 space-y-8 overflow-y-auto px-4 py-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f0cb73]">
                  {group.title === "Insights" ? "Oversight" : group.title}
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
                            ? "border border-[#f7dfa2]/20 bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_14px_28px_rgba(0,0,0,0.22)]"
                            : "border border-white/0 text-slate-200 hover:border-[#f0cb73]/12 hover:bg-[#f0cb73]/8 hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                            active
                              ? "bg-[#140f08] text-[#f7dfa2]"
                              : "border border-[#f0cb73]/12 bg-[#f0cb73]/7 text-slate-200 group-hover:bg-[#f0cb73]/10"
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
                              active ? "text-[#352614]" : "text-slate-400"
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

          <div className="relative mt-auto border-t border-[#f0cb73]/12 px-4 py-4">
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

        <section className="min-w-0 px-5 pb-5 pt-28 sm:px-7 sm:pb-7 sm:pt-32 xl:px-7 xl:pb-7 xl:pt-32">
          <div className="fixed inset-x-0 top-0 z-30 px-4 pt-3 sm:px-6 sm:pt-4 xl:left-[292px] xl:right-0 xl:px-7">
            <div className="clara-surface flex items-center justify-between rounded-[26px] border border-[#f0cb73]/14 bg-[linear-gradient(135deg,rgba(27,20,14,0.94)_0%,rgba(18,13,10,0.96)_100%)] px-4 py-3 shadow-[0_18px_38px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:px-5 sm:py-3.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
                  SCC Workspace
                </p>
                <p className="truncate text-sm font-semibold text-[#fff0c9]">
                  {resolvedCurrentUser?.name ??
                    getWorkspaceTitle(resolvedCurrentUser)}
                </p>
              </div>

              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_12px_24px_rgba(0,0,0,0.22)] xl:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Buka menu"
                aria-expanded={mobileNavOpen}
                aria-controls="clara-mobile-sidebar"
              >
                <FontAwesomeIcon icon={faBars} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {globalNotifications.length > 0 ? (
              <div className="space-y-3">
                {globalNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-[24px] border border-[#f0cb73]/24 bg-[linear-gradient(135deg,rgba(71,50,17,0.94)_0%,rgba(36,26,12,0.96)_100%)] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#f0cb73] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#140f08]">
                            Perlu tindakan
                          </span>
                          <span className="rounded-full bg-[#f0cb73]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f3d694]">
                            {notification.source_type.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold text-[#fff0c9]">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#d6bb82]">
                          {notification.body}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        {notification.target_href ? (
                          <Link
                            href={notification.target_href}
                            className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] px-4 py-2.5 text-sm font-semibold text-[#140f08] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:brightness-105"
                          >
                            Buka data yang belum sinkron
                          </Link>
                        ) : null}
                        <Link
                          href="/dashboard/notifications"
                          className="inline-flex items-center rounded-full border border-[#f0cb73]/24 bg-[#f0cb73]/10 px-4 py-2.5 text-sm font-semibold text-[#f3d694] hover:bg-[#f0cb73]/14"
                        >
                          Buka notification center
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div>{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
