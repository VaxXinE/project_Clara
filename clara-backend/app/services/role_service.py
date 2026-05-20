LEGACY_ROLE_MARKETING = "marketing"
LEGACY_ROLE_ADMIN = "admin"
LEGACY_ROLE_OWNER = "owner"
PLATFORM_ROLE_SUPER_ADMIN = "super_admin"

ROLE_ALIASES = {
    "sales": LEGACY_ROLE_MARKETING,
    "marketing": LEGACY_ROLE_MARKETING,
    "head": LEGACY_ROLE_ADMIN,
    "admin": LEGACY_ROLE_ADMIN,
    "superadmin": LEGACY_ROLE_OWNER,
    "owner": LEGACY_ROLE_OWNER,
    PLATFORM_ROLE_SUPER_ADMIN: PLATFORM_ROLE_SUPER_ADMIN,
}


def normalize_role(role: str | None) -> str:
    normalized = (role or "").strip().lower().replace("-", "_")
    return ROLE_ALIASES.get(normalized, normalized)


def is_platform_super_admin(role: str | None) -> bool:
    return normalize_role(role) == PLATFORM_ROLE_SUPER_ADMIN


def is_owner_like(role: str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in {LEGACY_ROLE_OWNER, PLATFORM_ROLE_SUPER_ADMIN}


def is_admin_like(role: str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in {
        LEGACY_ROLE_ADMIN,
        LEGACY_ROLE_OWNER,
        PLATFORM_ROLE_SUPER_ADMIN,
    }


def is_marketing_like(role: str | None) -> bool:
    return normalize_role(role) == LEGACY_ROLE_MARKETING
