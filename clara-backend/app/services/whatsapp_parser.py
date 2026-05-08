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


DATE_FIRST_MESSAGE_PATTERN = re.compile(
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

# Supports:
# [9:35 AM, 8/5/2026] Name: Message
# [09:35:10 PM, 8/5/26] Name: Message
TIME_FIRST_MESSAGE_PATTERN = re.compile(
    r"""
    ^\[
    (?P<time>\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm))
    ,\s+
    (?P<date>\d{1,2}/\d{1,2}/\d{2,4})
    \]
    \s+
    (?P<sender>[^:]+)
    :
    \s*
    (?P<message>.*)
    $
    """,
    re.VERBOSE,
)

MESSAGE_PATTERNS = (
    DATE_FIRST_MESSAGE_PATTERN,
    TIME_FIRST_MESSAGE_PATTERN,
)

EXPLICIT_SALES_KEYWORDS = ("sales", "admin", "cs", "clara")
EXPLICIT_CUSTOMER_KEYWORDS = ("cust", "customer", "client", "prospect", "lead")


def parse_whatsapp_datetime(date_text: str, time_text: str) -> datetime:
    normalized_time = time_text.replace(".", ":")
    normalized_time = re.sub(r"\s+", " ", normalized_time.strip()).upper()

    formats = [
        "%d/%m/%y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%y %I:%M %p",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%y %I:%M:%S %p",
        "%m/%d/%Y %I:%M:%S %p",
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
    inferred_type = detect_sender_type_hint(sender_name)
    return inferred_type or "customer"


def detect_sender_type_hint(sender_name: str) -> str | None:
    normalized = sender_name.lower()

    if any(keyword in normalized for keyword in EXPLICIT_SALES_KEYWORDS):
        return "sales"

    if any(keyword in normalized for keyword in EXPLICIT_CUSTOMER_KEYWORDS):
        return "customer"

    return None


def parse_message_line(line: str) -> ParsedMessage | None:
    for pattern in MESSAGE_PATTERNS:
        match = pattern.match(line)

        if match is None:
            continue

        timestamp = parse_whatsapp_datetime(
            match.group("date"),
            match.group("time"),
        )

        sender_name = match.group("sender").strip()
        message_text = match.group("message").strip()

        return ParsedMessage(
            sender_name=sender_name,
            sender_type=detect_sender_type(sender_name),
            message_text=message_text,
            message_timestamp=timestamp,
        )

    return None


def infer_sender_types(messages: list[ParsedMessage]) -> list[ParsedMessage]:
    sender_names = {message.sender_name for message in messages}
    explicit_types = {
        sender_name: detect_sender_type_hint(sender_name)
        for sender_name in sender_names
    }

    explicit_sales = {
        sender_name
        for sender_name, sender_type in explicit_types.items()
        if sender_type == "sales"
    }
    explicit_customers = {
        sender_name
        for sender_name, sender_type in explicit_types.items()
        if sender_type == "customer"
    }
    unknown_senders = sender_names - explicit_sales - explicit_customers

    inferred_types: dict[str, str] = {}

    if explicit_sales and not explicit_customers and len(unknown_senders) == 1:
        unknown_sender = next(iter(unknown_senders))
        inferred_types[unknown_sender] = "customer"

    if explicit_customers and not explicit_sales and len(unknown_senders) == 1:
        unknown_sender = next(iter(unknown_senders))
        inferred_types[unknown_sender] = "sales"

    normalized_messages: list[ParsedMessage] = []

    for message in messages:
        sender_type = explicit_types[message.sender_name] or inferred_types.get(
            message.sender_name,
            message.sender_type,
        )
        normalized_messages.append(
            ParsedMessage(
                sender_name=message.sender_name,
                sender_type=sender_type,
                message_text=message.message_text,
                message_timestamp=message.message_timestamp,
            )
        )

    return normalized_messages


def parse_whatsapp_txt(raw_text: str) -> list[ParsedMessage]:
    messages: list[ParsedMessage] = []
    current_message: ParsedMessage | None = None

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        parsed_message = parse_message_line(line)

        if parsed_message is not None:
            current_message = parsed_message
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

    return infer_sender_types(messages)
