"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
};

function buildNavItems(currentUser?: CurrentUser | null): NavItem[] {
  if (!currentUser) {
    return [];
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/sales", label: "Inbox" },
    { href: "/dashboard/upload", label: "Upload" },
  ];

  if (["owner", "admin"].includes(currentUser.role)) {
    items.push({ href: "/dashboard/marketing", label: "Insights" });
    items.push({ href: "/dashboard/admin/ops", label: "Admin Ops" });
    items.push({ href: "/dashboard/admin/access", label: "Users" });
  }

  if (currentUser.role === "owner") {
    items.splice(3, 0, { href: "/dashboard/knowledge", label: "Knowledge" });
  }

  return items;
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
  const navItems = buildNavItems(currentUser);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(194,230,255,0.65),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(245,225,210,0.55),_transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f5f7fb_38%,#eef3f8_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/88 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-slate-200/80 px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_48%,#b88a5a_100%)] text-sm font-bold tracking-[0.24em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]">
                  CL
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Clara Workspace
                  </p>
                  <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    {title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              </div>

              {currentUser && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {currentUser.name}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>{formatStatusLabel(currentUser.role)}</span>
                  <span className="text-slate-300">•</span>
                  <span>{currentUser.organization_name ?? "global"}</span>
                </div>
              )}
            </div>

            {(navItems.length > 0 || backHref || actions) && (
              <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3">
                  {backHref && backLabel && (
                    <Link
                      href={backHref}
                      className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
                    >
                      <span aria-hidden="true">←</span>
                      {backLabel}
                    </Link>
                  )}

                  {navItems.length > 0 && (
                    <nav className="flex flex-wrap gap-2">
                      {navItems.map((item) => {
                        const active = isNavItemActive(pathname, item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                              active
                                ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </nav>
                  )}
                </div>

                {actions ? (
                  <div className="flex flex-wrap items-center gap-2">{actions}</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="px-5 py-5 sm:px-7 sm:py-7">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Prinsip Tampilan
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Prioritas informasi paling penting muncul lebih dulu.</li>
                  <li>Aksi utama selalu terlihat tanpa harus mencari menu.</li>
                  <li>Status dan konteks dibaca cepat, bukan ditebak dari UUID.</li>
                </ul>
              </div>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
