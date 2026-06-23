from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OFFICIAL_SOLID_URL = "https://sg-berjangka.com/"
OFFICIAL_BAPPEBTI_URL = "https://bappebti.go.id/pialang_berjangka/detail/049"


@dataclass(frozen=True)
class OfficialKnowledgeEntry:
    title: str
    category: str
    content: str
    source_type: str


def _compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _strip_html(html: str) -> str:
    without_scripts = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1>",
        " ",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    without_tags = re.sub(r"<[^>]+>", " ", without_scripts)
    return _compact_whitespace(unescape(without_tags))


@lru_cache(maxsize=8)
def fetch_official_source_text(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; ClaraBot/1.0; +https://sg-berjangka.com/)"
            )
        },
    )
    try:
        with urlopen(request, timeout=3) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            raw = response.read().decode(charset, errors="ignore")
    except (HTTPError, URLError, TimeoutError, ValueError):
        return ""

    return _strip_html(raw)


def _build_solid_product_entry() -> OfficialKnowledgeEntry:
    fetched_text = fetch_official_source_text(OFFICIAL_SOLID_URL)
    if fetched_text:
        content = (
            f"Sumber resmi produk dan prosedur Solid: {OFFICIAL_SOLID_URL}. "
            "Website resmi menampilkan menu produk seperti Multilateral (JFX), "
            "Bilateral (SPA), Live Quote, Karakteristik Produk, Ilustrasi "
            "Transaksi, Petunjuk Transaksi, Prosedur Penarikan, dan Prosedur "
            "Registrasi Online. "
            "Gunakan situs ini sebagai acuan untuk detail produk, karakteristik, "
            "dan prosedur operasional; jangan mengarang spread atau spesifikasi "
            "teknis jika belum terbaca jelas dari sumber resmi."
        )
    else:
        content = (
            f"Sumber resmi produk dan prosedur Solid: {OFFICIAL_SOLID_URL}. "
            "Gunakan website ini sebagai acuan utama untuk produk, "
            "karakteristik produk, live quote, Bilateral (SPA), Multilateral "
            "(JFX), registrasi online, dan prosedur penarikan. "
            "Jangan mengarang angka spread, komisi, atau spesifikasi teknis "
            "kalau belum ada di sumber resmi."
        )

    return OfficialKnowledgeEntry(
        title="Sumber resmi produk dan prosedur SOLID",
        category="official_product_source",
        content=content,
        source_type="official_source_sg",
    )


def _build_solid_company_entry() -> OfficialKnowledgeEntry:
    fetched_text = fetch_official_source_text(OFFICIAL_SOLID_URL)
    profile_sentence = (
        'Berdiri sejak tahun 2002, PT Solid Gold Berjangka ("SGB") merupakan '
        "perusahaan pialang berjangka terdaftar dan diawasi oleh Badan "
        "Pengawas Perdagangan Berjangka Komoditi (BAPPEBTI)."
    )
    if fetched_text and "PT Solid Gold Berjangka" in fetched_text:
        profile_sentence = (
            "PT Solid Gold Berjangka berdiri sejak 2002 dan pada website "
            "resminya disebut sebagai perusahaan pialang berjangka terdaftar "
            "dan diawasi BAPPEBTI, serta anggota Bursa Berjangka Jakarta (BBJ) "
            "dan Kliring Berjangka Indonesia (KBI)."
        )

    return OfficialKnowledgeEntry(
        title="Profil resmi PT Solid Gold Berjangka",
        category="official_company_profile",
        content=(
            f"{profile_sentence} Acuan website resmi perusahaan: "
            f"{OFFICIAL_SOLID_URL}."
        ),
        source_type="official_source_sg",
    )


def _build_solid_security_entry() -> OfficialKnowledgeEntry:
    return OfficialKnowledgeEntry(
        title="Catatan resmi keamanan proses dana SOLID",
        category="official_safety_notice",
        content=(
            f"Website resmi {OFFICIAL_SOLID_URL} mengingatkan agar proses "
            "transfer dana untuk transaksi dilakukan hanya ke rekening "
            "Segregated Account atas nama PT Solid Gold Berjangka, bukan ke "
            "rekening pribadi. Gunakan poin ini saat customer bertanya aman, "
            "takut ditipu, atau keamanan prosedur dana."
        ),
        source_type="official_source_sg",
    )


def _build_bappebti_entry() -> OfficialKnowledgeEntry:
    fetched_text = fetch_official_source_text(OFFICIAL_BAPPEBTI_URL)
    if fetched_text and "Solid Gold Berjangka" in fetched_text:
        content = (
            f"Legalitas resmi PT Solid Gold Berjangka harus mengacu ke halaman "
            f"BAPPEBTI ini: {OFFICIAL_BAPPEBTI_URL}. Gunakan halaman ini sebagai "
            "source of truth untuk status pialang berjangka, legalitas, izin, "
            "dan referensi regulasi."
        )
    else:
        content = (
            f"Legalitas resmi PT Solid Gold Berjangka mengacu ke halaman "
            f"BAPPEBTI berikut: {OFFICIAL_BAPPEBTI_URL}. Jika customer meminta "
            "bukti legalitas, status izin, atau referensi regulasi, arahkan "
            "ke halaman ini sebagai acuan utama."
        )

    return OfficialKnowledgeEntry(
        title="Legalitas resmi BAPPEBTI PT Solid Gold Berjangka",
        category="official_legality_source",
        content=content,
        source_type="official_source_bappebti",
    )


def get_official_source_entries() -> list[OfficialKnowledgeEntry]:
    return [
        _build_bappebti_entry(),
        _build_solid_product_entry(),
        _build_solid_company_entry(),
        _build_solid_security_entry(),
    ]
