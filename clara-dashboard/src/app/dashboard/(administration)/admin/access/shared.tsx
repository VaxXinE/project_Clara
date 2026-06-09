"use client";

"use client";

import Link from "next/link";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";

import { getPasswordStrength } from "@/lib/format";
import type {
  CreateOrganizationRequest,
  CreateSalesTeamRequest,
  CreateSalesUnitRequest,
  CurrentUser,
  OrganizationItem,
  ResetUserPasswordRequest,
  SalesTeamItem,
  UpdateUserRequest,
  CreateUserRequest,
} from "@/types/dashboard";

export const EMPTY_ORGANIZATION_FORM: CreateOrganizationRequest = {
  name: "",
  slug: "",
};

export const EMPTY_USER_FORM: CreateUserRequest = {
  name: "",
  email: "",
  password: "",
  role: "sales",
  organization_id: null,
  team_id: null,
};

export const EMPTY_EDIT_FORM: UpdateUserRequest = {
  name: "",
  email: "",
  role: "sales",
  organization_id: null,
  team_id: null,
};

export const EMPTY_UNIT_FORM: CreateSalesUnitRequest = {
  organization_id: null,
  name: "",
  code: "",
};

export const EMPTY_TEAM_FORM: CreateSalesTeamRequest = {
  organization_id: null,
  unit_id: null,
  manager_user_id: null,
  name: "",
  code: "",
};

export const EMPTY_PASSWORD_FORM: ResetUserPasswordRequest = {
  password: "",
};

export function getOrganizationLabel(
  organizationId: string | null,
  organizations: OrganizationItem[],
): string {
  if (!organizationId) {
    return "-";
  }

  return (
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? organizationId
  );
}

export function getTeamOptions(
  organizationId: string | null,
  teams: SalesTeamItem[],
): SalesTeamItem[] {
  if (!organizationId) {
    return [];
  }

  return teams.filter((team) => team.organization_id === organizationId);
}

export function getManagedTeamsForUser(
  userId: string,
  teams: SalesTeamItem[],
): SalesTeamItem[] {
  return teams.filter((team) => team.manager_user_id === userId);
}

export function getUserTeamDisplay(
  user: CurrentUser,
  teams: SalesTeamItem[],
): { teamName: string; unitName: string; managedTeamLabel: string | null } {
  if (user.team_name || user.unit_name) {
    return {
      teamName: user.team_name ?? "-",
      unitName: user.unit_name ?? "-",
      managedTeamLabel: null,
    };
  }

  const managedTeams = getManagedTeamsForUser(user.id, teams);
  if (managedTeams.length === 0) {
    return {
      teamName: "-",
      unitName: "-",
      managedTeamLabel: null,
    };
  }

  const primaryManagedTeam = managedTeams[0];
  const managedTeamLabel =
    managedTeams.length === 1
      ? primaryManagedTeam.name
      : `${primaryManagedTeam.name} +${managedTeams.length - 1} team lain`;

  return {
    teamName: primaryManagedTeam.name,
    unitName: primaryManagedTeam.unit_name ?? "-",
    managedTeamLabel,
  };
}

export function InfoCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-[24px] border border-[#f7dfa2]/18 bg-[linear-gradient(135deg,#f7dfa2_0%,#d1a44b_52%,#a06d20_100%)] p-5 text-[#140f08] shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <p className="clara-kicker text-xs text-[#5c3a12]">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#140f08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#3a2811]">{description}</p>
    </article>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
  className,
  contentClassName,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={`clara-card rounded-[28px] p-5 ${className ?? ""}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#fff0c9]">{title}</h2>
          <p className="mt-1 text-sm text-[#d6bb84]">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`mt-5 ${contentClassName ?? ""}`.trim()}>{children}</div>
    </section>
  );
}

export function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-[#b89a62]">{text}</p>;
}

export function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#fff0c9]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="clara-input mt-2"
        placeholder={placeholder}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#fff0c9]">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="clara-select mt-2"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PasswordStrengthHint({
  password,
  strength,
}: {
  password: string;
  strength: ReturnType<typeof getPasswordStrength>;
}) {
  if (!password) {
    return (
      <p className="clara-card-soft rounded-xl border border-[#f0cb73]/14 p-3 text-xs text-[#d6bb84]">
        Hint: gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.
      </p>
    );
  }

  const strengthBadgeClassName =
    strength.label === "strong"
      ? "border border-[#f0cb73]/18 bg-[#f0cb73]/12 text-[#f7dfa2]"
      : strength.label === "medium"
        ? "border border-[#d3a74b]/18 bg-[#5c4015] text-[#f0cb73]"
        : "border border-[#7a5520]/18 bg-[#38250f] text-[#d6bb84]";

  return (
    <div className="clara-card-soft rounded-xl border border-[#f0cb73]/14 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b89a62]">
          Password Strength
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${strengthBadgeClassName}`}
        >
          {strength.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {strength.checks.map((check) => (
          <span
            key={check.label}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              check.passed
                ? "border border-[#f0cb73]/18 bg-[#f0cb73]/10 text-[#f0cb73]"
                : "border border-[#3c2c16] bg-[#22190f] text-[#c8ad75]"
            }`}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MetricIcon({
  icon,
  label,
  value,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
}) {
  return (
    <div className="clara-card-soft rounded-[22px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="clara-kicker text-xs">{label}</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] text-[#140f08] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
          <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function RouteCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="clara-card flex h-full flex-col justify-between rounded-[28px] p-5">
      <div>
        <p className="clara-kicker text-xs text-[#f0cb73]">Access flow</p>
        <h3 className="mt-3 text-xl font-semibold text-[#fff0c9]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#d6bb84]">{description}</p>
      </div>
      <div className="mt-5">
        <Link href={href} className="clara-button clara-button-primary">
          {cta}
        </Link>
      </div>
    </article>
  );
}
