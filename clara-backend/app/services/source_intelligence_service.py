from __future__ import annotations


def normalize_source_key(source: str | None) -> str:
    if source is None:
        return "unknown"
    normalized = source.strip().lower().replace(" ", "_")
    return normalized or "unknown"


def normalize_source_channel(source: str | None) -> str:
    source_key = normalize_source_key(source)

    if source_key.startswith("whatsapp") or source_key.startswith("wa_"):
        return "whatsapp"
    if source_key.startswith("telegram") or source_key.startswith("tg_"):
        return "telegram"
    if source_key.startswith("instagram") or source_key.startswith("ig_"):
        return "instagram"
    if source_key.startswith("email"):
        return "email"
    if "import" in source_key or source_key.startswith("csv"):
        return "import"
    return "unknown"


def normalize_requested_source_channel(source_channel: str | None) -> str | None:
    if source_channel is None:
        return None

    normalized = source_channel.strip().lower().replace(" ", "_")
    if normalized in {"", "all"}:
        return None
    return normalized


def matches_source_channel(source: str | None, source_channel: str | None) -> bool:
    normalized_channel = normalize_requested_source_channel(source_channel)
    if normalized_channel is None:
        return True

    return normalize_source_channel(source) == normalized_channel


def build_source_label(source: str | None) -> str:
    source_key = normalize_source_key(source)
    explicit_labels = {
        "whatsapp_extension": "WhatsApp Extension",
        "whatsapp_txt": "WhatsApp TXT Import",
        "telegram_txt": "Telegram TXT Import",
        "telegram_extension": "Telegram Extension",
        "telegram_manual": "Telegram Manual",
        "instagram_dm": "Instagram DM",
        "instagram_comment": "Instagram Comment",
        "email_inbox": "Email Inbox",
        "csv_import": "CSV Import",
        "unknown": "Unknown Source",
    }
    if source_key in explicit_labels:
        return explicit_labels[source_key]

    return " ".join(part.capitalize() for part in source_key.split("_"))
