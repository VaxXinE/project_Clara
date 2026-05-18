import re
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo


JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


@dataclass(frozen=True)
class ParsedTelegramMessage:
    sender_name: str
    sender_type: str
    message_text: str
    message_timestamp: datetime


class TelegramParseError(ValueError):
    pass


BRACKET_MESSAGE_PATTERN = re.compile(
    r"""
    ^\[
    (?P<date>\d{1,2}\.\d{1,2}\.\d{4})
    \s+
    (?P<time>\d{1,2}:\d{2}(?::\d{2})?)
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

PLAIN_MESSAGE_PATTERN = re.compile(
    r"""
    ^
    (?P<date>\d{1,2}\.\d{1,2}\.\d{4})
    \s+
    (?P<time>\d{1,2}:\d{2}(?::\d{2})?)
    \s+-\s+
    (?P<sender>[^:]+)
    :
    \s*
    (?P<message>.*)
    $
    """,
    re.VERBOSE,
)

MESSAGE_PATTERNS = (BRACKET_MESSAGE_PATTERN, PLAIN_MESSAGE_PATTERN)

EXPLICIT_SALES_KEYWORDS = ("sales", "admin", "cs", "clara")
EXPLICIT_CUSTOMER_KEYWORDS = ("cust", "customer", "client", "prospect", "lead")


def parse_telegram_datetime(date_text: str, time_text: str) -> datetime:
    raw_value = f"{date_text} {time_text.strip()}"
    formats = [
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(raw_value, fmt)
            return parsed.replace(tzinfo=JAKARTA_TZ)
        except ValueError:
            continue

    raise TelegramParseError(f"Unsupported Telegram datetime format: {raw_value}")


def detect_sender_type_hint(sender_name: str) -> str | None:
    normalized = sender_name.lower()
    if any(keyword in normalized for keyword in EXPLICIT_SALES_KEYWORDS):
        return "sales"
    if any(keyword in normalized for keyword in EXPLICIT_CUSTOMER_KEYWORDS):
        return "customer"
    return None


def detect_sender_type(sender_name: str) -> str:
    return detect_sender_type_hint(sender_name) or "customer"


def parse_message_line(line: str) -> ParsedTelegramMessage | None:
    for pattern in MESSAGE_PATTERNS:
        match = pattern.match(line)
        if match is None:
            continue

        return ParsedTelegramMessage(
            sender_name=match.group("sender").strip(),
            sender_type=detect_sender_type(match.group("sender").strip()),
            message_text=match.group("message").strip(),
            message_timestamp=parse_telegram_datetime(
                match.group("date"),
                match.group("time"),
            ),
        )

    return None


def infer_sender_types(
    messages: list[ParsedTelegramMessage],
) -> list[ParsedTelegramMessage]:
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
        inferred_types[next(iter(unknown_senders))] = "customer"

    if explicit_customers and not explicit_sales and len(unknown_senders) == 1:
        inferred_types[next(iter(unknown_senders))] = "sales"

    # Heuristic for simple 2-party pasted chats:
    # if no explicit sender role is present and only two participants exist,
    # assume the first sender is the customer and the other participant is sales.
    if not explicit_sales and not explicit_customers and len(sender_names) == 2:
        first_sender = messages[0].sender_name
        other_sender = next(
            sender_name for sender_name in sender_names if sender_name != first_sender
        )
        inferred_types[first_sender] = "customer"
        inferred_types[other_sender] = "sales"

    normalized_messages: list[ParsedTelegramMessage] = []
    for message in messages:
        sender_type = explicit_types[message.sender_name] or inferred_types.get(
            message.sender_name,
            message.sender_type,
        )
        normalized_messages.append(
            ParsedTelegramMessage(
                sender_name=message.sender_name,
                sender_type=sender_type,
                message_text=message.message_text,
                message_timestamp=message.message_timestamp,
            )
        )

    return normalized_messages


def parse_telegram_txt(raw_text: str) -> list[ParsedTelegramMessage]:
    messages: list[ParsedTelegramMessage] = []
    current_message: ParsedTelegramMessage | None = None

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        parsed_message = parse_message_line(line)
        if parsed_message is not None:
            current_message = parsed_message
            messages.append(current_message)
            continue

        if current_message is not None:
            updated = ParsedTelegramMessage(
                sender_name=current_message.sender_name,
                sender_type=current_message.sender_type,
                message_text=f"{current_message.message_text}\n{line}",
                message_timestamp=current_message.message_timestamp,
            )
            messages[-1] = updated
            current_message = updated

    if not messages:
        raise TelegramParseError("No valid Telegram messages found in uploaded file.")

    return infer_sender_types(messages)
