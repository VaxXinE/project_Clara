"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowTrendUp,
  faBars,
  faBookOpen,
  faBriefcase,
  faBuildingShield,
  faBullhorn,
  faCalendarCheck,
  faChartColumn,
  faChartLine,
  faCloudArrowUp,
  faComments,
  faGaugeHigh,
  faRobot,
  faTriangleExclamation,
  faUsersGear,
  faWandSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useDashboardUser } from "@/components/dashboard/DashboardUserProvider";
import { resetDashboardOnboardingState } from "@/components/dashboard/SalesOnboardingTour";
import { apiFetch } from "@/lib/api";
import {
  canAccessQueueAndActionCenter,
  getRoleDisplayLabel,
  normalizeWorkspaceRole,
} from "@/lib/roles";
import type {
  CurrentUser,
  OpsNotificationItem,
  OpsNotificationResponse,
} from "@/types/dashboard";

const SITE_TITLE = "SCC Workspace";

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
  const normalizedRole = normalizeWorkspaceRole(currentUser?.role);
  const isSalesRole = normalizedRole === "sales";
  const isManagerScopedRole = normalizedRole === "manager";
  const isHeadScopedRole = normalizedRole === "head";
  const isSuperadminScopedRole = normalizedRole === "superadmin";
  const isManagerMonitorRole =
    isManagerScopedRole && !canAccessQueueAndActionCenter(currentUser?.role);
  const isHeadMonitorRole =
    isHeadScopedRole && !canAccessQueueAndActionCenter(currentUser?.role);

  const workspaceItems: NavItem[] = [
    {
      href: "/workspace",
      label: "Beranda",
      icon: faGaugeHigh,
      description: isSalesRole ? "Prioritas kerja hari ini" : "Ringkasan kerja",
    },
    {
      href: "/crm",
      label: "Leads",
      icon: faBriefcase,
      description: isSalesRole
        ? "Progres prospect yang sedang ditangani"
        : isHeadMonitorRole
          ? "Status dan progres lead lintas tim"
        : isManagerMonitorRole
          ? "Status dan progres lead tim"
        : "Status dan progres lead",
    },
  ];

  if (isSalesRole || isSuperadminScopedRole) {
    workspaceItems.push({
      href: "/customers",
      label: "Customers",
      icon: faBuildingShield,
      description: isSalesRole ? "Ringkasan customer aktif" : "Data customer",
    });
  }

  if (currentUser && canAccessQueueAndActionCenter(currentUser.role)) {
    workspaceItems.splice(
      1,
      0,
      {
        href: "/sales",
        label: "Chat",
        icon: faComments,
        description: isSalesRole ? "Tempat mulai balas chat" : "Chat masuk Sales",
      },
      {
        href: "/follow-up",
        label: "Follow-up",
        icon: faCalendarCheck,
        description: isSalesRole
          ? "Pekerjaan follow-up yang belum selesai"
          : "Prioritas follow-up",
      },
    );
  }

  const insightItems: NavItem[] = [];
  const adminItems: NavItem[] = [];

  if (currentUser && (isHeadScopedRole || isSuperadminScopedRole)) {
    workspaceItems.push({
      href: "/notifications",
      label: "Alerts",
      icon: faTriangleExclamation,
      description: isHeadScopedRole
        ? "Sinyal follow-up tim yang perlu perhatian"
        : "Alert operasional",
    });
  }

  if (currentUser && isSuperadminScopedRole) {
    workspaceItems.push({
      href: "/channels",
      label: "Channels",
      icon: faBars,
      description: "Sumber channel",
    });
  }

  if (
    currentUser &&
    (isManagerScopedRole || isHeadScopedRole || isSuperadminScopedRole)
  ) {
    workspaceItems.push({
      href: "/approvals",
      label: isHeadScopedRole
        ? "Arahan Tim"
        : "Review",
      icon: faWandSparkles,
      description: isHeadScopedRole
        ? "Keputusan dan arahan tindak lanjut tim"
        : isManagerMonitorRole
          ? "Cek balasan dan arahkan Sales"
        : "Review jawaban Sales",
    });
    insightItems.push({
      href: "/manager-insights",
      label: "Team Monitor",
      icon: faChartLine,
      description: isHeadScopedRole
        ? "Pantau progres, risiko, dan hambatan tim"
        : isManagerMonitorRole
          ? "Pantau progres dan hambatan tim"
        : "Progres prospect Sales",
    });
  }

  if (currentUser && (isHeadScopedRole || isSuperadminScopedRole)) {
    insightItems.push(
      {
        href: "/knowledge",
        label: "Knowledge",
        icon: faBookOpen,
        description: "Jawaban resmi",
      },
      {
        href: "/marketing",
        label: isHeadMonitorRole ? "Insight Pasar" : "Marketing Insights",
        icon: faBullhorn,
        description: isHeadMonitorRole
          ? "Pola objection dan sinyal dari lapangan"
          : "Analisis sinyal marketing",
      },
      {
        href: "/kpi",
        label: "Ops Dashboard",
        icon: faChartColumn,
        description: "Kinerja operasional",
      },
    );

  }

  if (currentUser && isSuperadminScopedRole) {
    adminItems.push(
      {
        href: "/admin/access",
        label: "Users & Access",
        icon: faUsersGear,
        description: "Role dan akses",
      },
      {
        href: "/admin/ops",
        label: "Audit Logs",
        icon: faBuildingShield,
        description: "Jejak audit dan status sistem",
      },
      {
        href: "/admin/ai-config",
        label: "AI Persona",
        icon: faRobot,
        description: "Prompt dan perilaku Clara",
      },
    );
  }

  const groups: NavGroup[] = [{ title: "Workspace", items: workspaceItems }];

  if (currentUser && isSalesRole) {
    workspaceItems.push({
      href: "/upload",
      label: "Input Chat",
      icon: faCloudArrowUp,
      description: "Masukkan chat baru ke Clara",
    });
    return groups;
  }

  if (insightItems.length > 0) {
    groups.push({
      title: isManagerMonitorRole || isHeadMonitorRole ? "Monitoring" : "Insights",
      items: insightItems,
    });
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
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuContainerRef = useRef<HTMLDivElement>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null);
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
              <section key={group.title} aria-labelledby={`nav-${group.title}`}>
                <h2
                  id={`nav-${group.title}`}
                  className="clara-text-muted px-3 text-xs font-semibold uppercase tracking-[0.16em]"
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
                        <span className="min-w-0 truncate">{item.label}</span>
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
                <p className="clara-text-secondary truncate text-sm font-medium">
                  {eyebrow}
                </p>
              </div>

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

          <div className="space-y-4">
            <header className="clara-page-hero border-b border-[var(--color-border-default)] px-4 pb-5 pt-4 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  {backHref && backLabel ? (
                    <Link
                      href={backHref}
                      className="clara-text-secondary mb-3 inline-flex min-h-10 max-w-full items-center rounded-lg px-2 text-sm font-medium hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      <span aria-hidden="true" className="mr-2">
                        ←
                      </span>
                      <span className="truncate">{backLabel}</span>
                    </Link>
                  ) : null}
                  <p className="clara-kicker">{eyebrow}</p>
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
                            {notification.source_type.replaceAll("_", " ")}
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
                            {normalizedRole === "head"
                              ? "Buka follow-up tim"
                              : "Buka data yang belum sinkron"}
                          </Link>
                        ) : null}
                        <Link
                          href="/dashboard/notifications"
                          className="clara-button clara-button-secondary max-w-full px-3 py-2 text-sm"
                        >
                          Lihat semua notifikasi
                        </Link>
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
                            : "Tutup"}
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
