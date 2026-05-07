import re
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo


JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


@dataclass(frozen=True)
class ParsedMessage:
    sender_name: str
    sender_type: str
    message_text: str
    message_timestamp: datetime


class WhatsAppParseError(ValueError):
    pass


# Supports:
# 12/04/26, 09.12 - Name: Message
# 12/04/2026, 09:12 - Name: Message
# [12/04/26, 09.12.10] Name: Message
MESSAGE_PATTERN = re.compile(
    r"""
    ^\[?
    (?P<date>\d{1,2}/\d{1,2}/\d{2,4})
    ,\s+
    (?P<time>\d{1,2}[.:]\d{2}(?:[.:]\d{2})?)
    \]?
    \s+-?\s*
    (?P<sender>[^:]+)
    :
    \s*
    (?P<message>.*)
    $
    """,
    re.VERBOSE,
)


def parse_whatsapp_datetime(date_text: str, time_text: str) -> datetime:
    normalized_time = time_text.replace(".", ":")

    formats = [
        "%d/%m/%y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]

    raw_value = f"{date_text} {normalized_time}"

    for fmt in formats:
        try:
            parsed = datetime.strptime(raw_value, fmt)
            return parsed.replace(tzinfo=JAKARTA_TZ)
        except ValueError:
            continue

    raise WhatsAppParseError(f"Unsupported datetime format: {raw_value}")


def detect_sender_type(sender_name: str) -> str:
    normalized = sender_name.lower()

    sales_keywords = ["sales", "admin", "cs", "clara"]

    if any(keyword in normalized for keyword in sales_keywords):
        return "sales"

    return "customer"


def parse_whatsapp_txt(raw_text: str) -> list[ParsedMessage]:
    messages: list[ParsedMessage] = []
    current_message: ParsedMessage | None = None

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        match = MESSAGE_PATTERN.match(line)

        if match:
            timestamp = parse_whatsapp_datetime(
                match.group("date"),
                match.group("time"),
            )

            sender_name = match.group("sender").strip()
            message_text = match.group("message").strip()

            current_message = ParsedMessage(
                sender_name=sender_name,
                sender_type=detect_sender_type(sender_name),
                message_text=message_text,
                message_timestamp=timestamp,
            )
            messages.append(current_message)
            continue

        # Handle multiline WhatsApp messages.
        # Example:
        # 12/04/26, 09.12 - Customer: Halo kak
        # ini masih satu pesan yang sama
        if current_message is not None:
            updated_message = ParsedMessage(
                sender_name=current_message.sender_name,
                sender_type=current_message.sender_type,
                message_text=f"{current_message.message_text}\n{line}",
                message_timestamp=current_message.message_timestamp,
            )
            messages[-1] = updated_message
            current_message = updated_message

    if not messages:
        raise WhatsAppParseError("No valid WhatsApp messages found in uploaded file.")

    return messages