"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowTrendUp,
  faBars,
  faAddressBook,
  faBookOpen,
  faBriefcase,
  faBullhorn,
  faCalendarCheck,
  faChartColumn,
  faChartLine,
  faClipboardCheck,
  faClipboardList,
  faCloudArrowUp,
  faFlag,
  faComments,
  faGaugeHigh,
  faMagnifyingGlass,
  faShareNodes,
  faSliders,
  faTriangleExclamation,
  faUsersGear,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";
import { resetDashboardOnboardingState } from "@/components/dashboard/SalesOnboardingTour";
import { TaskFinder } from "@/components/dashboard/TaskFinder";
import { apiFetch } from "@/lib/api";
import {
  NAV_GROUP_NAMES,
  PAGE_NAMES,
  SITE_NAME,
  formatNotificationSource,
} from "@/lib/labels";
import { getRoleDisplayLabel, normalizeWorkspaceRole } from "@/lib/roles";
import { tasksForUser } from "@/lib/tasks";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResponse,
} from "@/types/dashboard";

const SITE_TITLE = SITE_NAME;

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
  const role = normalizeWorkspaceRole(currentUser?.role);

  if (!currentUser) {
    return [];
  }

  const home = (description: string): NavItem => ({
    href: "/workspace",
    label: PAGE_NAMES.home,
    icon: faGaugeHigh,
    description,
  });
  const complaints: NavItem = {
    href: "/complaints",
    label: PAGE_NAMES.complaints,
    icon: faFlag,
    description: "Keluhan customer yang perlu ditinjau",
  };
  const inbox = (description: string): NavItem => ({
    href: "/sales",
    label: PAGE_NAMES.inbox,
    icon: faComments,
    description,
  });
  const followUp = (description: string): NavItem => ({
    href: "/follow-up",
    label: PAGE_NAMES.followUp,
    icon: faCalendarCheck,
    description,
  });
  const leads = (label: string, description: string): NavItem => ({
    href: "/crm",
    label,
    icon: faBriefcase,
    description,
  });
  const teamMonitor = (description: string): NavItem => ({
    href: "/manager-insights",
    label: PAGE_NAMES.teamMonitor,
    icon: faChartLine,
    description,
  });
  const knowledge: NavItem = {
    href: "/knowledge",
    label: PAGE_NAMES.knowledge,
    icon: faBookOpen,
    description: "Jawaban resmi yang dipakai Clara",
  };
  const marketing: NavItem = {
    href: "/marketing",
    label: PAGE_NAMES.marketing,
    icon: faBullhorn,
    description: "Keberatan customer dan sinyal pasar",
  };
  const opsDashboard: NavItem = {
    href: "/kpi",
    label: PAGE_NAMES.opsDashboard,
    icon: faChartColumn,
    description: "Kinerja operasional",
  };

  if (role === "sales") {
    return [
      {
        title: NAV_GROUP_NAMES.daily,
        items: [
          home("Prioritas kerja hari ini"),
          inbox("Tempat mulai balas chat"),
          {
            href: "/upload",
            label: PAGE_NAMES.intake,
            icon: faCloudArrowUp,
            description: "Tambah chat baru ke Clara",
          },
          followUp("Pekerjaan follow-up yang belum selesai"),
          leads(PAGE_NAMES.leads, "Prospect yang sedang kamu tangani"),
          {
            href: "/customers",
            label: PAGE_NAMES.customers,
            icon: faAddressBook,
            description: "Ringkasan customer aktif",
          },
          complaints,
        ],
      },
    ];
  }

  if (role === "manager") {
    return [
      {
        title: NAV_GROUP_NAMES.daily,
        items: [
          home("Ringkasan kerja hari ini"),
          {
            href: "/approvals",
            label: PAGE_NAMES.reviewSales,
            icon: faClipboardCheck,
            description: "Cek balasan dan arahkan Sales",
          },
          leads(PAGE_NAMES.leadsTeam, "Progres lead timmu"),
          complaints,
        ],
      },
      {
        title: NAV_GROUP_NAMES.team,
        items: [teamMonitor("Pantau progres dan hambatan tim")],
      },
    ];
  }

  if (role === "head") {
    return [
      {
        title: NAV_GROUP_NAMES.daily,
        items: [
          home("Ringkasan kerja hari ini"),
          {
            href: "/notifications",
            label: PAGE_NAMES.alertsTeam,
            icon: faTriangleExclamation,
            description: "Sinyal follow-up tim yang perlu perhatian",
          },
          {
            href: "/approvals",
            label: PAGE_NAMES.teamDirection,
            icon: faClipboardCheck,
            description: "Keputusan dan arahan tindak lanjut tim",
          },
          leads(PAGE_NAMES.leadsTeam, "Progres lead semua tim"),
          complaints,
        ],
      },
      {
        title: NAV_GROUP_NAMES.team,
        items: [teamMonitor("Pantau progres, risiko, dan hambatan tim"), opsDashboard],
      },
      { title: NAV_GROUP_NAMES.knowledge, items: [knowledge, marketing] },
    ];
  }

  if (role === "superadmin") {
    return [
      {
        title: NAV_GROUP_NAMES.daily,
        items: [
          home("Ringkasan kerja hari ini"),
          inbox("Chat masuk Sales"),
          followUp("Prioritas tindak lanjut"),
          leads(PAGE_NAMES.leads, "Progres lead"),
          {
            href: "/customers",
            label: PAGE_NAMES.customers,
            icon: faAddressBook,
            description: "Data customer",
          },
          complaints,
        ],
      },
      {
        title: NAV_GROUP_NAMES.team,
        items: [
          {
            href: "/notifications",
            label: PAGE_NAMES.alerts,
            icon: faTriangleExclamation,
            description: "Alert operasional",
          },
          {
            href: "/approvals",
            label: PAGE_NAMES.reviewSales,
            icon: faClipboardCheck,
            description: "Review jawaban Sales",
          },
          teamMonitor("Progres prospect Sales"),
          opsDashboard,
        ],
      },
      { title: NAV_GROUP_NAMES.knowledge, items: [knowledge, marketing] },
      {
        title: NAV_GROUP_NAMES.settings,
        items: [
          {
            href: "/admin/access",
            label: PAGE_NAMES.users,
            icon: faUsersGear,
            description: "Akun, role, dan tim",
          },
          {
            href: "/channels",
            label: PAGE_NAMES.channels,
            icon: faShareNodes,
            description: "Sumber chat: WhatsApp, Instagram, TikTok",
          },
          {
            href: "/admin/ai-config",
            label: PAGE_NAMES.persona,
            icon: faSliders,
            description: "Gaya dan aturan jawaban Clara",
          },
          {
            href: "/admin/ops",
            label: PAGE_NAMES.audit,
            icon: faClipboardList,
            description: "Jejak audit dan status sistem",
          },
        ],
      },
    ];
  }

  return [{ title: NAV_GROUP_NAMES.daily, items: [home("Ringkasan kerja hari ini")] }];
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getAccountProfileHref() {
  return "/profile";
}

function getGlobalAlertNotifications(
  notifications: OpsNotificationItem[],
  currentUser?: CurrentUser | null,
): OpsNotificationItem[] {
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const activeItems = notifications.filter(
    (item) =>
      item.status === "active" &&
      (!normalizedRole ||
        item.target_role === normalizedRole ||
        item.target_role === "all"),
  );
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

export function WorkspaceShell({
  currentUser,
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
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuContainerRef = useRef<HTMLDivElement>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const finderTriggerRef = useRef<HTMLButtonElement>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuPathname, setAccountMenuPathname] = useState(pathname);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [resolvingNotificationId, setResolvingNotificationId] = useState<
    string | null
  >(null);
  const [globalNotifications, setGlobalNotifications] = useState<
    OpsNotificationItem[]
  >([]);
  const normalizedRole = normalizeWorkspaceRole(resolvedCurrentUser?.role);
  const isAccountMenuVisible =
    accountMenuOpen && accountMenuPathname === pathname;

  const allNavItems = navGroups.flatMap((group) => group.items);
  const activeNavItem = allNavItems
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
  const finderItems = useMemo(() => {
    const pageLabels = new Map(allNavItems.map((item) => [item.href, item.label]));
    pageLabels.set("/profile", "Profil");
    pageLabels.set("/start", PAGE_NAMES.guide);

    return tasksForUser(
      normalizedRole,
      new Set(allNavItems.map((item) => item.href)),
    ).map((task) => ({
      goal: task.goal,
      href: task.href,
      keywords: task.keywords,
      pageLabel: pageLabels.get(task.href) ?? task.href,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRole, navGroups.length, resolvedCurrentUser?.id]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileNavOpen(false);
        setAccountMenuOpen(false);
        setFinderOpen((current) => !current);
      }
    }

    document.addEventListener("keydown", handleShortcut);

    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    dashboardUser?.syncCurrentUser(currentUser);
  }, [currentUser, dashboardUser]);

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;

    if (!mobileNavOpen) {
      document.body.style.removeProperty("overflow");
      if (isDesktop) {
        mobileSidebarRef.current?.removeAttribute("inert");
        mobileSidebarRef.current?.removeAttribute("aria-hidden");
      } else {
        mobileSidebarRef.current?.setAttribute("inert", "");
        mobileSidebarRef.current?.setAttribute("aria-hidden", "true");
      }

      return;
    }

    mobileSidebarRef.current?.removeAttribute("inert");
    mobileSidebarRef.current?.removeAttribute("aria-hidden");
    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();

    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1280px)");

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) {
        mobileSidebarRef.current?.removeAttribute("inert");
        mobileSidebarRef.current?.removeAttribute("aria-hidden");
        setMobileNavOpen(false);
      } else if (!mobileNavOpen) {
        mobileSidebarRef.current?.setAttribute("inert", "");
        mobileSidebarRef.current?.setAttribute("aria-hidden", "true");
      }
    }

    desktopMedia.addEventListener("change", handleDesktopChange);

    return () => desktopMedia.removeEventListener("change", handleDesktopChange);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!isAccountMenuVisible) {
      return;
    }

    function handleOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !accountMenuContainerRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);

    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [isAccountMenuVisible]);

  useEffect(() => {
    if (!mobileNavOpen && !isAccountMenuVisible) {
      return;
    }

    function handleShellKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isAccountMenuVisible) {
          setAccountMenuOpen(false);
          accountMenuTriggerRef.current?.focus();
          return;
        }

        setMobileNavOpen(false);
        mobileMenuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !mobileNavOpen) {
        return;
      }

      const focusableElements = mobileSidebarRef.current?.querySelectorAll<
        HTMLElement
      >(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleShellKeyDown);

    return () => document.removeEventListener("keydown", handleShellKeyDown);
  }, [isAccountMenuVisible, mobileNavOpen]);

  useEffect(() => {
    if (!resolvedCurrentUser) {
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
          getGlobalAlertNotifications(response.items, resolvedCurrentUser).slice(
            0,
            2,
          ),
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

  function handleRestartOnboarding() {
    if (!resolvedCurrentUser?.id) {
      return;
    }

    if (
      normalizedRole === "sales" ||
      normalizedRole === "manager" ||
      normalizedRole === "head"
    ) {
      resetDashboardOnboardingState(resolvedCurrentUser.id, normalizedRole);
    }
    setAccountMenuOpen(false);
    window.location.href = "/workspace";
  }

  async function handleResolveGlobalNotification(notificationId: string) {
    setResolvingNotificationId(notificationId);

    try {
      await apiFetch(`/dashboard/notifications/${notificationId}/resolve`, {
        method: "PATCH",
        body: { resolution_note: "Ditutup dari ringkasan global." },
      });
      setGlobalNotifications((current) =>
        current.filter((item) => item.id !== notificationId),
      );
    } catch {
      // Keep the card visible if resolve fails.
    } finally {
      setResolvingNotificationId(null);
    }
  }

  return (
    <main className="clara-text-primary min-h-screen bg-transparent">
      <div className="relative min-h-screen xl:grid xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
        <div
          className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 xl:hidden ${
            mobileNavOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden="true"
          onClick={() => {
            setMobileNavOpen(false);
            mobileMenuTriggerRef.current?.focus();
          }}
        />

        <aside
          ref={mobileSidebarRef}
          id="clara-mobile-sidebar"
          aria-label="Navigasi utama"
          data-onboarding-id={
            normalizedRole === "sales"
              ? "sales-shell-sidebar"
              : normalizedRole === "manager"
                ? "manager-shell-sidebar"
                : normalizedRole === "head"
                  ? "head-shell-sidebar"
                : undefined
          }
          className={`fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[86vw] flex-col overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] shadow-[var(--shadow-floating)] transition-transform duration-200 xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-auto xl:max-w-none xl:translate-x-0 xl:shadow-none ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="shrink-0 border-b border-[var(--color-border-subtle)] p-4">
            <div className="mb-3 flex items-center justify-between xl:hidden">
              <p className="clara-text-secondary text-sm font-semibold">
                Navigasi
              </p>
              <button
                ref={mobileCloseButtonRef}
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
                onClick={() => {
                  setMobileNavOpen(false);
                  mobileMenuTriggerRef.current?.focus();
                }}
                aria-label="Tutup menu"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-10 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                <FontAwesomeIcon icon={faArrowTrendUp} className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {SITE_TITLE}
                </p>
                <p className="clara-text-muted truncate text-xs capitalize">
                  {resolvedCurrentUser
                    ? getRoleDisplayLabel(resolvedCurrentUser.role)
                    : "Workspace"}
                </p>
              </div>
            </div>
          </div>

          <nav
            className="clara-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5"
            aria-label="Menu workspace"
          >
            {navGroups.map((group) => (
              <section
                key={group.title}
                aria-labelledby={`nav-${group.title.replaceAll(" ", "-")}`}
              >
                <h2
                  id={`nav-${group.title.replaceAll(" ", "-")}`}
                  className="clara-text-muted px-3 text-xs font-semibold"
                >
                  {group.title}
                </h2>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const active = isNavItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                          active
                            ? "border-[var(--color-border-default)] bg-[var(--color-surface-muted)] text-[var(--color-accent)]"
                            : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <FontAwesomeIcon
                            icon={item.icon}
                            className="h-4 w-4"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{item.label}</span>
                          <span
                            className={`block text-xs font-normal leading-4 ${
                              active
                                ? "text-[var(--color-text-secondary)]"
                                : "text-[var(--color-text-muted)]"
                            }`}
                          >
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-4 pb-5 pt-20 sm:px-6 sm:pb-6 xl:px-8 xl:pb-8">
          <div className="fixed inset-x-0 top-0 z-30 h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] xl:left-[260px]">
            <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  ref={mobileMenuTriggerRef}
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] xl:hidden"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setMobileNavOpen(true);
                  }}
                  aria-label="Buka menu"
                  aria-expanded={mobileNavOpen}
                  aria-controls="clara-mobile-sidebar"
                >
                  <FontAwesomeIcon icon={faBars} className="h-4 w-4" />
                </button>
                <nav aria-label="Posisi halaman" className="min-w-0">
                  <ol className="flex min-w-0 items-center gap-2 text-sm">
                    {activeNavItem && pathname !== activeNavItem.href ? (
                      <>
                        <li className="shrink-0">
                          <Link
                            href={activeNavItem.href}
                            className="clara-text-secondary rounded px-1 font-medium hover:text-[var(--color-text-primary)]"
                          >
                            {activeNavItem.label}
                          </Link>
                        </li>
                        <li aria-hidden="true" className="clara-text-muted shrink-0">
                          /
                        </li>
                        <li aria-current="page" className="min-w-0 truncate font-semibold">
                          {title}
                        </li>
                      </>
                    ) : (
                      <li aria-current="page" className="min-w-0 truncate font-semibold">
                        {activeNavItem?.label ?? title}
                      </li>
                    )}
                  </ol>
                </nav>
              </div>

              <div className="flex shrink-0 items-center gap-2">
              <button
                ref={finderTriggerRef}
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setAccountMenuOpen(false);
                  setFinderOpen(true);
                }}
                aria-label="Saya mau... (cari menu)"
                className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4" />
                <span className="hidden md:inline">Saya mau...</span>
                <kbd className="hidden rounded border border-[var(--color-border-subtle)] px-1.5 text-xs text-[var(--color-text-muted)] lg:inline">
                  Ctrl K
                </kbd>
              </button>

              <div ref={accountMenuContainerRef} className="relative shrink-0">
                  <button
                    ref={accountMenuTriggerRef}
                    type="button"
                    onClick={() => {
                      setAccountMenuPathname(pathname);
                      setAccountMenuOpen((current) =>
                        accountMenuPathname === pathname ? !current : true,
                      );
                    }}
                    className="flex h-11 max-w-[min(15rem,48vw)] items-center gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-muted)] px-2.5 text-left hover:border-[var(--color-border-strong)]"
                    aria-label={
                      isAccountMenuVisible ? "Tutup menu akun" : "Buka menu akun"
                    }
                    aria-expanded={isAccountMenuVisible}
                    aria-controls="account-menu"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-bold uppercase text-[var(--color-accent-foreground)]">
                      {resolvedCurrentUser?.name
                        ? resolvedCurrentUser.name
                            .split(" ")
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "A"}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block truncate text-sm font-semibold">
                        {resolvedCurrentUser?.name ?? "Akun Clara"}
                      </span>
                      <span className="clara-text-muted block truncate text-xs capitalize">
                        {resolvedCurrentUser
                          ? getRoleDisplayLabel(resolvedCurrentUser.role)
                          : "Pengguna"}
                      </span>
                    </span>
                  </button>

                  {isAccountMenuVisible ? (
                    <div
                      id="account-menu"
                      aria-label="Menu akun"
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] shadow-[var(--shadow-floating)]"
                    >
                      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
                        <p className="truncate text-sm font-semibold">
                          {resolvedCurrentUser?.name ?? "Akun Clara"}
                        </p>
                        {resolvedCurrentUser?.email ? (
                          <p className="clara-text-secondary mt-1 truncate text-xs">
                            {resolvedCurrentUser.email}
                          </p>
                        ) : null}
                        <p className="clara-text-muted mt-1 truncate text-xs capitalize">
                          {resolvedCurrentUser
                            ? getRoleDisplayLabel(resolvedCurrentUser.role)
                            : "Pengguna"}
                        </p>
                      </div>

                      <div className="p-2">
                        <Link
                          href={getAccountProfileHref()}
                          className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium hover:bg-[var(--color-surface-muted)]"
                        >
                          Profil
                        </Link>
                        <Link
                          href="/start"
                          className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium hover:bg-[var(--color-surface-muted)]"
                        >
                          {PAGE_NAMES.guide}
                        </Link>
                        {normalizedRole === "sales" ||
                        normalizedRole === "manager" ||
                        normalizedRole === "head" ? (
                          <button
                            type="button"
                            onClick={handleRestartOnboarding}
                            className="block min-h-11 w-full rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-[var(--color-surface-muted)]"
                          >
                            Ulangi onboarding
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          disabled={isLoggingOut}
                          className="block min-h-11 w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoggingOut ? "Sedang keluar..." : "Keluar"}
                        </button>
                      </div>
                    </div>
                  ) : null}
              </div>
              </div>
            </div>
          </div>

          <TaskFinder
            open={finderOpen}
            items={finderItems}
            onClose={() => {
              setFinderOpen(false);
              finderTriggerRef.current?.focus();
            }}
          />

          <div className="space-y-4">
            <header className="clara-page-hero border-b border-[var(--color-border-default)] px-4 pb-5 pt-4 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  {backHref && backLabel ? (
                    <Link
                      href={backHref}
                      className="clara-text-secondary mb-3 inline-flex min-h-11 max-w-full items-center rounded-lg px-2 text-sm font-medium hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <span aria-hidden="true" className="mr-2">
                        ←
                      </span>
                      <span className="truncate">{backLabel}</span>
                    </Link>
                  ) : null}
                  <h1 className="clara-page-title mt-2 break-words">
                    {title}
                  </h1>
                  <p className="clara-text-secondary mt-2 max-w-3xl text-sm leading-6 sm:text-[15px]">
                    {description}
                  </p>
                </div>

                {actions ? (
                  <div
                    data-onboarding-id={
                      normalizedRole === "sales"
                        ? "sales-shell-actions"
                        : undefined
                    }
                    className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto lg:max-w-[520px] lg:flex-none lg:justify-end [&_.clara-button]:max-w-full [&_.clara-button]:px-3 [&_.clara-button]:py-2 [&_.clara-button]:text-sm"
                  >
                    {actions}
                  </div>
                ) : null}
              </div>
            </header>

            {globalNotifications.length > 0 ? (
              <div className="space-y-2" aria-label="Notifikasi penting">
                {globalNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    role={notification.severity === "high" ? "alert" : "status"}
                    className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-warning-surface)] p-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--color-warning)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-inverse)]">
                            {notification.severity === "high"
                              ? "Prioritas tinggi"
                              : "Perlu tindakan"}
                          </span>
                          <span className="text-xs font-medium text-[var(--color-warning)]">
                            {formatNotificationSource(notification.source_type)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold">
                          {notification.title}
                        </p>
                        <p className="clara-text-secondary mt-1 text-sm leading-5">
                          {notification.body}
                        </p>
                      </div>

                      <div className="flex min-w-0 shrink-0 flex-wrap gap-2">
                        {notification.target_href ? (
                          <Link
                            href={notification.target_href}
                            className="clara-button clara-button-primary max-w-full px-3 py-2 text-sm"
                          >
                            Lihat sekarang
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            void handleResolveGlobalNotification(notification.id)
                          }
                          disabled={resolvingNotificationId === notification.id}
                          className="clara-button clara-button-ghost px-3 py-2 text-sm"
                        >
                          {resolvingNotificationId === notification.id
                            ? "Menutup..."
                            : "Sudah ditangani"}
                        </button>
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
