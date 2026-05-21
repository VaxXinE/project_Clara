ROLE_SALES = "sales"
ROLE_MANAGER = "manager"
ROLE_HEAD = "head"
ROLE_SUPERADMIN = "superadmin"

ROLE_ALIASES = {
    "marketing": ROLE_SALES,
    ROLE_SALES: ROLE_SALES,
    "admin": ROLE_HEAD,
    ROLE_HEAD: ROLE_HEAD,
    ROLE_MANAGER: ROLE_MANAGER,
    "owner": ROLE_SUPERADMIN,
    "super_admin": ROLE_SUPERADMIN,
    ROLE_SUPERADMIN: ROLE_SUPERADMIN,
}


def normalize_role(role: str | None) -> str:
    normalized = (role or "").strip().lower().replace("-", "_")
    return ROLE_ALIASES.get(normalized, normalized)


def is_platform_super_admin(role: str | None) -> bool:
    return normalize_role(role) == ROLE_SUPERADMIN


def is_superadmin_like(role: str | None) -> bool:
    return normalize_role(role) == ROLE_SUPERADMIN


def is_head_like(role: str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in {ROLE_HEAD, ROLE_SUPERADMIN}


def is_manager_like(role: str | None) -> bool:
    normalized = normalize_role(role)
    return normalized in {ROLE_MANAGER, ROLE_HEAD, ROLE_SUPERADMIN}


def is_sales_like(role: str | None) -> bool:
    return normalize_role(role) == ROLE_SALES


# Compatibility helpers for older call sites while the codebase is migrated.
def is_owner_like(role: str | None) -> bool:
    return is_superadmin_like(role)


def is_admin_like(role: str | None) -> bool:
    return is_manager_like(role)


def is_marketing_like(role: str | None) -> bool:
    return is_sales_like(role)
