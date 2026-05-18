from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.telegram_parser import parse_telegram_txt


def test_parse_telegram_txt_supports_bracket_format() -> None:
    raw_text = """
    [18.05.2026 09:12] Customer Leoni: Halo kak, ini legal?
    [18.05.2026 09:13] Sales Aria: Legal kak, nanti saya kirim dokumen resminya.
    """.strip()

    messages = parse_telegram_txt(raw_text)

    assert len(messages) == 2
    assert messages[0].sender_name == "Customer Leoni"
    assert messages[0].sender_type == "customer"
    assert messages[1].sender_name == "Sales Aria"
    assert messages[1].sender_type == "sales"


def test_parse_telegram_txt_supports_plain_dash_format_and_multiline() -> None:
    raw_text = """
    18.05.2026 09:12 - Customer Leoni: Halo kak
    saya masih ragu.
    18.05.2026 09:13 - Sales Aria: Siap kak, saya bantu jelaskan.
    """.strip()

    messages = parse_telegram_txt(raw_text)

    assert len(messages) == 2
    assert messages[0].message_text == "Halo kak\nsaya masih ragu."
    assert messages[1].sender_type == "sales"


def test_parse_telegram_txt_infers_customer_and_sales_for_two_plain_names() -> None:
    raw_text = """
    [18.05.2026 09:12] Nia: Halo kak, saya tertarik.
    [18.05.2026 09:13] Aria: Siap kak, saya bantu jelaskan.
    [18.05.2026 09:14] Nia: Oke kak, saya mau tahu dulu alurnya.
    """.strip()

    messages = parse_telegram_txt(raw_text)

    assert messages[0].sender_name == "Nia"
    assert messages[0].sender_type == "customer"
    assert messages[1].sender_name == "Aria"
    assert messages[1].sender_type == "sales"
    assert messages[2].sender_name == "Nia"
    assert messages[2].sender_type == "customer"
