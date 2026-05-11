from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.whatsapp_parser import parse_whatsapp_txt


def test_parse_whatsapp_txt_supports_bracket_time_first_format() -> None:
    raw_text = """[9:35 AM, 8/5/2026] Leoni Cust: halo kak
[9:36 AM, 8/5/2026] Arya Pramuditha: Halo kak, perkenalkan saya Arya Pramuditha, saya adalah bagian sales dari SG. Salam kenal kak.
Ada yang bisa saya bantu?
[9:37 AM, 8/5/2026] Leoni Cust: halo kak, saya Leoni, saya tertarik untuk mencoba SG dengan dana tertentu, itu bagaimana caranya untuk bergabung yaa kak?
"""

    messages = parse_whatsapp_txt(raw_text)

    assert len(messages) == 3
    assert messages[0].sender_name == "Leoni Cust"
    assert messages[0].sender_type == "customer"
    assert messages[0].message_timestamp.isoformat() == "2026-08-05T09:35:00+07:00"
    assert messages[1].sender_name == "Arya Pramuditha"
    assert messages[1].sender_type == "sales"
    assert messages[1].message_text.endswith("Ada yang bisa saya bantu?")
    assert messages[2].message_timestamp.isoformat() == "2026-08-05T09:37:00+07:00"


def test_parse_whatsapp_txt_supports_existing_date_first_format() -> None:
    raw_text = """12/04/26, 09.12 - Customer: Kak, ini programnya legal nggak?
12/04/26, 09.13 - Sales Ani: Legal kak, nanti saya kirim dokumen resminya.
"""

    messages = parse_whatsapp_txt(raw_text)

    assert len(messages) == 2
    assert messages[0].sender_type == "customer"
    assert messages[1].sender_type == "sales"
    assert messages[1].message_timestamp.isoformat() == "2026-04-12T09:13:00+07:00"
