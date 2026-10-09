from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead
from app.models.message import Message
from app.services.customer_naming import (
    conversation_display_title,
    looks_like_phone_number,
    normalize_phone_number,
)
from app.services.customer_profile_service import is_placeholder_profile_name
from app.services.lead_service import sync_lead_from_conversation

PHONE_TITLE = "+62 821-1095-7104"


def login(client, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client) -> dict[str, str]:
    token = client.cookies.get(settings.csrf_cookie_name)
    assert token
    return {"X-CSRF-Token": token}


def upload_unsaved_number_chat(client) -> UUID:
    raw_text = (
        f"12/04/26, 09.12 - {PHONE_TITLE}: Kak, mau tanya biaya inap\n"
        "12/04/26, 09.13 - Sales Aria: Boleh kak, saya bantu jelaskan."
    )
    response = client.post(
        "/upload/whatsapp-text",
        json={"title": PHONE_TITLE, "raw_text": raw_text},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    return UUID(response.json()["conversation_id"])


def test_phone_number_helpers() -> None:
    assert normalize_phone_number("+62 821-1095-7104") == "+6282110957104"
    assert normalize_phone_number("0821 1095 7104") == "+6282110957104"
    assert normalize_phone_number("6282110957104") == "+6282110957104"
    assert normalize_phone_number("12345") is None
    assert normalize_phone_number("") is None

    assert looks_like_phone_number("+62 821-1095-7104")
    assert looks_like_phone_number("(0821) 1095 7104")
    assert not looks_like_phone_number("Budi Santoso")
    assert not looks_like_phone_number("Budi 0821 1095 7104")
    assert not looks_like_phone_number("2026")
    assert is_placeholder_profile_name("+62 821-1095-7104")
    assert not is_placeholder_profile_name("Budi")


def test_unsaved_number_keeps_number_as_title_and_stores_phone(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    conversation_id = upload_unsaved_number_chat(client)

    db = db_session_factory()
    conversation = db.get(Conversation, conversation_id)
    lead = db.get(Lead, conversation.lead_id)
    profile = db.get(CustomerProfile, lead.customer_profile_id)

    assert lead.display_name == PHONE_TITLE
    assert lead.name_source == "auto"
    assert conversation_display_title(conversation) == PHONE_TITLE
    assert profile.phone == "+6282110957104"
    assert profile.canonical_key == "phone:+6282110957104"


def test_rename_customer_shows_name_everywhere_and_survives_sync(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    conversation_id = upload_unsaved_number_chat(client)

    response = client.patch(
        f"/dashboard/sales/conversations/{conversation_id}/customer-name",
        json={"name": "  Budi   Santoso "},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    assert response.json()["customer_name"] == "Budi Santoso"
    assert response.json()["name_source"] == "manual"

    inbox = client.get("/dashboard/sales/inbox?archive_scope=all").json()
    assert [item["title"] for item in inbox if item["conversation_id"] == str(conversation_id)] == [
        "Budi Santoso"
    ]
    detail = client.get(f"/dashboard/sales/conversations/{conversation_id}").json()
    assert detail["title"] == "Budi Santoso"

    db = db_session_factory()
    conversation = db.get(Conversation, conversation_id)
    lead = db.get(Lead, conversation.lead_id)
    profile = db.get(CustomerProfile, lead.customer_profile_id)
    assert profile.display_name == "Budi Santoso"
    assert profile.phone == "+6282110957104"
    # Judul asli tidak berubah karena dipakai untuk mengenali chat yang sama saat sinkronisasi.
    assert conversation.title == PHONE_TITLE

    # Chat berikutnya membawa nama pengirim lain. Nama yang sudah diberi Sales tidak boleh tertimpa.
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Pak Hendra",
            sender_type="customer",
            message_text="Halo lagi kak",
            message_timestamp=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.refresh(conversation)

    sync_lead_from_conversation(db=db, conversation=conversation)
    db.commit()
    db.refresh(lead)
    assert lead.display_name == "Budi Santoso"
    assert lead.name_source == "manual"
    # Satu customer tetap satu profil, walau nama berubah dari nomor jadi nama.
    assert lead.customer_profile_id == profile.id
    assert db.query(CustomerProfile).filter(CustomerProfile.phone == "+6282110957104").count() == 1


def test_same_number_in_other_format_reuses_the_named_customer(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    first_id = upload_unsaved_number_chat(client)
    client.patch(
        f"/dashboard/sales/conversations/{first_id}/customer-name",
        json={"name": "Budi Santoso"},
        headers=csrf_headers(client),
    )

    raw_text = (
        "13/04/26, 10.00 - 0821 1095 7104: Halo lagi kak\n"
        "13/04/26, 10.01 - Sales Aria: Halo kak Budi."
    )
    second = client.post(
        "/upload/whatsapp-text",
        json={"title": "0821 1095 7104", "raw_text": raw_text},
        headers=csrf_headers(client),
    )
    assert second.status_code == 201, second.text

    db = db_session_factory()
    first_lead = db.get(Lead, db.get(Conversation, first_id).lead_id)
    second_lead = db.get(Lead, db.get(Conversation, UUID(second.json()["conversation_id"])).lead_id)

    assert second_lead.customer_profile_id == first_lead.customer_profile_id
    profile = db.get(CustomerProfile, first_lead.customer_profile_id)
    assert profile.display_name == "Budi Santoso"


def test_rename_rejects_phone_numbers_and_too_short_names(
    client,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    conversation_id = upload_unsaved_number_chat(client)

    for bad_name in ("0821 1095 7104", "+62 821-1095-7104", "A", "   "):
        response = client.patch(
            f"/dashboard/sales/conversations/{conversation_id}/customer-name",
            json={"name": bad_name},
            headers=csrf_headers(client),
        )
        assert response.status_code == 422, (bad_name, response.text)


def test_rename_is_limited_to_conversations_the_user_can_access(
    client,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    conversation_id = upload_unsaved_number_chat(client)
    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=seeded_data["marketing_other_org"].email, password="MarketingPass123!")
    response = client.patch(
        f"/dashboard/sales/conversations/{conversation_id}/customer-name",
        json={"name": "Orang Lain"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 404, response.text


def snapshot_payload(*, title: str, author: str, thread_id: str, extra_text: str | None = None) -> dict:
    messages = [
        {
            "id": "09.00-0",
            "author": author,
            "direction": "incoming",
            "text": "Halo kak, mau tanya biaya inap",
            "timestampLabel": "09.00",
        },
        {
            "id": "09.01-1",
            "author": "Arya",
            "direction": "outgoing",
            "text": "Boleh kak, saya bantu jelaskan.",
            "timestampLabel": "09.01",
        },
    ]
    if extra_text:
        messages.append(
            {
                "id": "09.05-2",
                "author": author,
                "direction": "incoming",
                "text": extra_text,
                "timestampLabel": "09.05",
            }
        )

    return {
        "chatData": {
            "capturedAt": "2026-05-12T09:10:00.000Z",
            "chatTitle": title,
            "chatSubtitle": "",
            "externalThreadId": thread_id,
            "messages": messages,
        }
    }


def test_contact_saved_later_keeps_one_conversation_one_profile_and_takes_the_contact_name(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    """Nomor awalnya belum disimpan. Setelah Sales menyimpannya di WhatsApp, judul chat berubah jadi nama kontak,
    tapi id percakapan WhatsApp (nomor) sama. Hasilnya harus tetap satu percakapan, satu lead, satu profil."""
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    thread_id = "whatsapp:6282110957104@c.us"

    first = client.post(
        "/extension/whatsapp/snapshots",
        json=snapshot_payload(title=PHONE_TITLE, author=PHONE_TITLE, thread_id=thread_id),
        headers=csrf_headers(client),
    )
    assert first.status_code in (200, 201), first.text
    conversation_id = UUID(first.json()["conversation_id"])

    second = client.post(
        "/extension/whatsapp/snapshots",
        json=snapshot_payload(
            title="Pak Budi SGB",
            author="Pak Budi SGB",
            thread_id=thread_id,
            extra_text="Berapa minimal depositnya?",
        ),
        headers=csrf_headers(client),
    )
    assert second.status_code in (200, 201), second.text
    assert UUID(second.json()["conversation_id"]) == conversation_id

    db = db_session_factory()
    conversation = db.get(Conversation, conversation_id)
    lead = db.get(Lead, conversation.lead_id)
    profile = db.get(CustomerProfile, lead.customer_profile_id)

    assert conversation.title == "Pak Budi SGB"
    assert lead.display_name == "Pak Budi SGB"
    assert lead.name_source == "auto"
    assert profile.display_name == "Pak Budi SGB"
    assert profile.phone == "+6282110957104"
    assert profile.canonical_key == "phone:+6282110957104"

    assert db.query(Conversation).filter(Conversation.sales_user_id == conversation.sales_user_id).count() == 1
    assert db.query(Lead).filter(Lead.assigned_user_id == conversation.sales_user_id).count() == 1
    assert db.query(CustomerProfile).filter(CustomerProfile.phone == "+6282110957104").count() == 1


def test_manual_name_wins_over_the_contact_name_saved_later(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    thread_id = "whatsapp:6282110957104@c.us"

    first = client.post(
        "/extension/whatsapp/snapshots",
        json=snapshot_payload(title=PHONE_TITLE, author=PHONE_TITLE, thread_id=thread_id),
        headers=csrf_headers(client),
    )
    conversation_id = UUID(first.json()["conversation_id"])
    rename = client.patch(
        f"/dashboard/sales/conversations/{conversation_id}/customer-name",
        json={"name": "Budi Santoso"},
        headers=csrf_headers(client),
    )
    assert rename.status_code == 200, rename.text

    client.post(
        "/extension/whatsapp/snapshots",
        json=snapshot_payload(
            title="Pak Budi SGB",
            author="Pak Budi SGB",
            thread_id=thread_id,
            extra_text="Berapa minimal depositnya?",
        ),
        headers=csrf_headers(client),
    )

    db = db_session_factory()
    conversation = db.get(Conversation, conversation_id)
    lead = db.get(Lead, conversation.lead_id)
    profile = db.get(CustomerProfile, lead.customer_profile_id)

    assert conversation.title == "Pak Budi SGB"
    assert lead.display_name == "Budi Santoso"
    assert lead.name_source == "manual"
    assert profile.display_name == "Budi Santoso"
    assert db.query(CustomerProfile).filter(CustomerProfile.phone == "+6282110957104").count() == 1
    inbox = client.get("/dashboard/sales/inbox?archive_scope=all").json()
    assert [item["title"] for item in inbox if item["conversation_id"] == str(conversation_id)] == [
        "Budi Santoso"
    ]


HISTORY = [
    ("incoming", "Halo kak, saya mau tanya tanya terkait solid mini"),
    ("outgoing", "Tentu kak, Mini Account cocok buat yang mau mulai lebih ringan dan belajar prosesnya bertahap."),
    ("incoming", "Kalau modal awalnya berapa ya kak, dan prosesnya gimana?"),
]


def history_payload(*, title: str, extra: list[tuple[str, str]] | None = None, history=HISTORY) -> dict:
    rows = [*history, *(extra or [])]
    return {
        "chatData": {
            "capturedAt": "2026-05-12T09:10:00.000Z",
            "chatTitle": title,
            "chatSubtitle": "",
            "messages": [
                {
                    "id": f"09.{index:02d}-{index}",
                    "author": title if direction == "incoming" else "Arya",
                    "direction": direction,
                    "text": text,
                    "timestampLabel": f"09.{index:02d}",
                }
                for index, (direction, text) in enumerate(rows)
            ],
        }
    }


def sync(client, payload: dict):
    response = client.post("/extension/whatsapp/snapshots", json=payload, headers=csrf_headers(client))
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_saved_contact_is_recognized_by_chat_content_when_whatsapp_gives_no_thread_id(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    first = sync(client, history_payload(title=PHONE_TITLE))
    second = sync(
        client,
        history_payload(title="Arya Prm", extra=[("incoming", "Oke kak, saya tunggu penjelasannya.")]),
    )

    assert second["conversation_id"] == first["conversation_id"]

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(first["conversation_id"]))
    lead = db.get(Lead, conversation.lead_id)
    assert conversation.title == "Arya Prm"
    assert lead.display_name == "Arya Prm"
    sales_id = conversation.sales_user_id
    assert db.query(Conversation).filter(Conversation.sales_user_id == sales_id).count() == 1
    assert db.query(Lead).filter(Lead.assigned_user_id == sales_id).count() == 1
    assert db.query(CustomerProfile).filter(CustomerProfile.phone == "+6282110957104").count() == 1
    assert len(conversation.messages) == 4

    # Sinkronisasi berikutnya dengan nama yang sama tetap di percakapan yang sama.
    third = sync(
        client,
        history_payload(title="Arya Prm", extra=[("incoming", "Oke kak, saya tunggu penjelasannya.")]),
    )
    assert third["conversation_id"] == first["conversation_id"]


def test_saved_contact_fallback_does_not_merge_when_evidence_is_weak_or_ambiguous(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    # Dua nomor belum disimpan dengan isi chat yang sama persis: tidak boleh ada yang dipilih.
    sync(client, history_payload(title="+62 821-1111-2222"))
    sync(client, history_payload(title="+62 821-3333-4444"))
    ambiguous = sync(client, history_payload(title="Pak Hendra"))

    # Isi chat terlalu singkat: bukan bukti yang cukup.
    short_history = [("incoming", "Halo"), ("outgoing", "Halo kak, ada yang bisa dibantu?")]
    sync(client, history_payload(title="+62 821-5555-6666", history=short_history))
    short = sync(client, history_payload(title="Bu Ratna", history=short_history))

    db = db_session_factory()
    sales_id = seeded_data["marketing_a"].id
    own = db.query(Conversation).filter(Conversation.sales_user_id == sales_id).all()
    by_title = {c.title: c for c in own}
    assert str(by_title["Pak Hendra"].id) == ambiguous["conversation_id"]
    assert by_title["Pak Hendra"].id not in {by_title["+62 821-1111-2222"].id, by_title["+62 821-3333-4444"].id}
    assert str(by_title["Bu Ratna"].id) == short["conversation_id"]
    assert by_title["Bu Ratna"].id != by_title["+62 821-5555-6666"].id
    assert len(own) == 5


def id_payload(*, title: str, rows: list[tuple[str, str, str]]) -> dict:
    """rows: (provider_message_id, direction, text). Isinya sengaja pendek supaya pengenalan lewat isi chat tidak ikut jalan."""
    return {
        "chatData": {
            "capturedAt": "2026-05-12T09:10:00.000Z",
            "chatTitle": title,
            "chatSubtitle": "",
            "messages": [
                {
                    "id": f"09.{index:02d}-{index}",
                    "providerMessageId": provider_id,
                    "author": title if direction == "incoming" else "Arya",
                    "direction": direction,
                    "text": text,
                    "timestampLabel": f"09.{index:02d}",
                }
                for index, (provider_id, direction, text) in enumerate(rows)
            ],
        }
    }


def test_provider_message_ids_keep_one_conversation_when_the_number_is_saved_as_contact(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    rows = [
        ("ACE3CBCEC272C6A64810BE9C0F85FC26", "incoming", "Haloo"),
        ("3EB039B88EDE9F39CC3D94", "outgoing", "Halo kak"),
    ]

    first = sync(client, id_payload(title=PHONE_TITLE, rows=rows))
    second = sync(
        client,
        id_payload(
            title="Arya Prm",
            rows=[*rows, ("AC896A69E349C14E4C73F8493C91AA31", "incoming", "Mau tanya solid mini")],
        ),
    )
    # Nama kontak diganti lagi: tetap percakapan yang sama.
    third = sync(
        client,
        id_payload(
            title="Arya Pramuditha",
            rows=[*rows, ("AC896A69E349C14E4C73F8493C91AA31", "incoming", "Mau tanya solid mini")],
        ),
    )

    assert second["conversation_id"] == first["conversation_id"] == third["conversation_id"]

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(first["conversation_id"]))
    sales_id = conversation.sales_user_id
    assert conversation.title == "Arya Pramuditha"
    assert len(conversation.messages) == 3
    assert db.query(Conversation).filter(Conversation.sales_user_id == sales_id).count() == 1
    assert db.query(Lead).filter(Lead.assigned_user_id == sales_id).count() == 1
    assert db.query(CustomerProfile).filter(CustomerProfile.phone == "+6282110957104").count() == 1


def test_provider_message_ids_are_not_used_when_they_point_to_two_conversations(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    first = sync(client, id_payload(title="+62 821-1111-2222", rows=[("A1", "incoming", "Halo"), ("A2", "outgoing", "Ya")]))
    second = sync(client, id_payload(title="+62 821-3333-4444", rows=[("B1", "incoming", "Hai"), ("B2", "outgoing", "Ya kak")]))
    mixed = sync(client, id_payload(title="Pak Hendra", rows=[("A1", "incoming", "Halo"), ("B1", "incoming", "Hai")]))

    assert mixed["conversation_id"] not in {first["conversation_id"], second["conversation_id"]}


def label_payload(*, captured_at: str, labels: list[str]) -> dict:
    return {
        "chatData": {
            "capturedAt": captured_at,
            "chatTitle": "Arya Prm",
            "chatSubtitle": "",
            "messages": [
                {
                    "id": f"{index}",
                    "author": "Arya Prm" if index % 2 == 0 else "Arya",
                    "direction": "incoming" if index % 2 == 0 else "outgoing",
                    "text": f"Pesan nomor {index}",
                    "timestampLabel": label,
                }
                for index, label in enumerate(labels)
            ],
        }
    }


def stored_dates(db_session_factory, conversation_id: str) -> list[str]:
    db = db_session_factory()
    messages = sorted(
        db.get(Conversation, UUID(conversation_id)).messages,
        key=lambda message: message.message_timestamp,
    )
    return [message.message_timestamp.strftime("%Y-%m-%d") for message in messages]


LABEL_SHAPES = ("{time}, {date}", "{date}, {time}")

# (label sebagai ditulis WhatsApp Web, hari/bulan atau bulan/hari). Keduanya terjadi di 9 Oktober 2026.
REAL_WORLD_LABELS = [
    ("3:30 pm, 9/10/2026", "dmy"),
    ("3:30 PM, 10/9/2026", "mdy"),
    ("15.30, 9/10/2026", "dmy"),
    ("9/10/2026, 15.30", "dmy"),
    ("10/9/2026, 15.30", "mdy"),
]


def labels_for(date: str, times: list[str], shape: str) -> list[str]:
    return [shape.format(date=date, time=time) for time in times]


def test_whatsapp_web_month_day_labels_are_not_read_as_day_month(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    """WhatsApp Web berbahasa Inggris menulis tanggal sebagai bulan/hari: "10/9/2026" artinya 9 Oktober. Kalau dibaca
    hari/bulan jadi 10 September, chat dianggap lama, diarsipkan otomatis, dan hilang dari Chat Masuk."""
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    for index, shape in enumerate(LABEL_SHAPES):
        payload = label_payload(
            captured_at="2026-10-09T09:10:00.000Z",
            labels=labels_for("10/9/2026", ["15.30", "15.31", "16.09"], shape),
        )
        payload["chatData"]["chatTitle"] = f"Arya Prm {index}"
        result = sync(client, payload)
        assert set(stored_dates(db_session_factory, result["conversation_id"])) == {"2026-10-09"}, shape

        inbox = client.get("/dashboard/sales/inbox").json()
        assert result["conversation_id"] in [item["conversation_id"] for item in inbox], shape


def test_day_month_labels_and_unambiguous_dates_keep_working(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    # Label hari/bulan yang sah: 10 September, dibaca pada 12 September.
    day_first = sync(
        client,
        label_payload(
            captured_at="2026-09-12T09:10:00.000Z",
            labels=labels_for("10/09/2026", ["15.30", "15.31", "15.40"], "{date}, {time}"),
        ),
    )
    assert set(stored_dates(db_session_factory, day_first["conversation_id"])) == {"2026-09-10"}

    # Ada tanggal yang tidak ambigu (13 di posisi hari), jadi "10/9" di snapshot yang sama dibaca hari/bulan juga.
    payload = label_payload(
        captured_at="2026-10-09T09:10:00.000Z",
        labels=["10/9/2026, 15.31", "13/9/2026, 15.30"],
    )
    payload["chatData"]["chatTitle"] = "Bu Ratna"
    sync_result = sync(client, payload)
    assert stored_dates(db_session_factory, sync_result["conversation_id"]) == ["2026-09-10", "2026-09-13"]


def test_twelve_hour_labels_follow_the_date_order_of_the_users_whatsapp(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    """Label asli dari WhatsApp Web berbahasa Inggris (Australia/India) adalah "3:30 pm, 9/10/2026": jam 12 dengan
    tanggal hari/bulan. Dulu setiap jam 12 dianggap format AS, jadi 9 Oktober terbaca 10 September."""
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")

    for index, (label, _order) in enumerate(REAL_WORLD_LABELS):
        payload = label_payload(captured_at="2026-10-09T09:10:00.000Z", labels=[label, label.replace("30", "31"), label.replace("30", "40")])
        payload["chatData"]["chatTitle"] = f"Pelanggan {index}"
        result = sync(client, payload)

        assert set(stored_dates(db_session_factory, result["conversation_id"])) == {"2026-10-09"}, label
        inbox = client.get("/dashboard/sales/inbox").json()
        assert result["conversation_id"] in [item["conversation_id"] for item in inbox], label


def test_a_conversation_with_wrongly_read_dates_is_corrected_on_the_next_sync(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, email=seeded_data["marketing_a"].email, password="MarketingPass123!")
    payload = label_payload(
        captured_at="2026-10-09T09:10:00.000Z",
        labels=["3:30 pm, 9/10/2026", "3:31 pm, 9/10/2026", "3:40 pm, 9/10/2026"],
    )
    first = sync(client, payload)

    # Meniru data lama yang terlanjur tersimpan dengan tanggal terbalik (10 September).
    db = db_session_factory()
    conversation = db.get(Conversation, UUID(first["conversation_id"]))
    wrong = datetime(2026, 9, 10, 8, 40)
    conversation.last_message_at = wrong
    for message in conversation.messages:
        message.message_timestamp = wrong
    db.commit()
    db.close()

    again = sync(client, payload)
    assert again["conversation_id"] == first["conversation_id"]
    assert set(stored_dates(db_session_factory, first["conversation_id"])) == {"2026-10-09"}
    inbox = client.get("/dashboard/sales/inbox").json()
    assert first["conversation_id"] in [item["conversation_id"] for item in inbox]
