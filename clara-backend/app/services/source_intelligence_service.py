from __future__ import annotations


CHANNEL_REGISTRY: dict[str, dict[str, object]] = {
    "whatsapp": {
        "key": "whatsapp",
        "label": "WhatsApp",
        "description": "Channel utama untuk operasional sales, baik dari extension maupun import chat.",
        "supports_file_upload": True,
        "supports_text_paste": True,
        "supports_live_sync": True,
        "file_endpoint": "/upload/whatsapp-txt",
        "text_endpoint": "/upload/whatsapp-text",
        "supported_sources": ["whatsapp_extension", "whatsapp_txt"],
        "sample_hint": "12/04/26, 09.12 - Customer: Halo kak",
    },
    "telegram": {
        "key": "telegram",
        "label": "Telegram",
        "description": "Channel kedua untuk import chat dan eksperimen multi-channel non-WhatsApp.",
        "supports_file_upload": True,
        "supports_text_paste": True,
        "supports_live_sync": False,
        "file_endpoint": "/upload/telegram-txt",
        "text_endpoint": "/upload/telegram-text",
        "supported_sources": ["telegram_txt", "telegram_extension", "telegram_manual"],
        "sample_hint": "[18.05.2026 09:12] Customer: Halo kak",
    },
}


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


def list_channel_definitions() -> list[dict[str, object]]:
    return [CHANNEL_REGISTRY[key].copy() for key in CHANNEL_REGISTRY]


def get_channel_definition(channel: str | None) -> dict[str, object] | None:
    if channel is None:
        return None
    normalized = normalize_requested_source_channel(channel)
    if normalized is None:
        return None
    definition = CHANNEL_REGISTRY.get(normalized)
    return definition.copy() if definition else None
