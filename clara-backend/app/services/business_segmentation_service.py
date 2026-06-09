VALID_ACCOUNT_CATEGORIES = {"mini", "reguler", "unknown"}


def normalize_account_category(account_category: str | None) -> str:
    if account_category is None:
        return "unknown"

    normalized = account_category.strip().lower().replace(" ", "_")
    if normalized in {"", "all"}:
        return "unknown"
    if normalized not in VALID_ACCOUNT_CATEGORIES:
        return "unknown"
    return normalized


def matches_account_category(
    account_category: str | None,
    requested_category: str | None,
) -> bool:
    normalized_requested = normalize_account_category(requested_category)
    if normalized_requested == "unknown" and requested_category in {None, "", "all"}:
        return True

    return normalize_account_category(account_category) == normalized_requested
