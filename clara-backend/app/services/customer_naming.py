"""Penamaan customer. Nomor WhatsApp yang belum disimpan datang sebagai judul chat berupa nomor telepon,
jadi nomor dikenali sebagai "belum ada nama" dan disimpan sebagai telepon, bukan sebagai nama."""

from __future__ import annotations

import re
from typing import Any

PHONE_TEXT_PATTERN = re.compile(r"^\+?[\d\s().\-]{7,24}$")
PHONE_CANONICAL_PREFIX = "phone:"
MIN_PHONE_DIGITS = 8
MAX_PHONE_DIGITS = 15


def normalize_phone_number(value: str | None) -> str | None:
    """Nomor dalam format baku +<kode negara><nomor>. Awalan 0 dianggap nomor Indonesia (+62)."""
    text = (value or "").strip()
    if not text:
        return None

    digits = re.sub(r"\D", "", text)
    if not MIN_PHONE_DIGITS <= len(digits) <= MAX_PHONE_DIGITS:
        return None

    if text.startswith("+"):
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+62{digits[1:]}"
    return f"+{digits}"


def looks_like_phone_number(value: str | None) -> bool:
    """Teks yang hanya berisi nomor telepon, mis. "+62 821-1095-7104" atau "0821 1095 7104"."""
    text = (value or "").strip()
    if not text or not PHONE_TEXT_PATTERN.match(text):
        return False
    return normalize_phone_number(text) is not None


def phone_canonical_key(phone: str) -> str:
    return f"{PHONE_CANONICAL_PREFIX}{phone}"


def conversation_display_title(conversation: Any) -> str:
    """Judul percakapan yang ditampilkan di dashboard. Memakai nama customer kalau sudah ada,
    dan nomor aslinya kalau belum. Judul asli di database tidak diubah karena dipakai
    untuk mengenali chat yang sama saat sinkronisasi."""
    lead = getattr(conversation, "lead", None)
    lead_name = (getattr(lead, "display_name", None) or "").strip()

    if lead_name and not looks_like_phone_number(lead_name):
        return lead_name

    return conversation.title
