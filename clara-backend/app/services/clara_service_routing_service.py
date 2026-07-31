import json
import re
from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256

from app.services.clara_policy_enforcement_service import (
    GOVERNANCE_BYPASS_PATTERN,
    classify_safe_handoff_category,
)
from app.services.clara_safe_handoff_service import SafeHandoffCategory


CLARA_SERVICE_ROUTING_CONTRACT_VERSION = "1.0"


class ServiceRoutingMode(StrEnum):
    LEGACY = "LEGACY"
    SHADOW = "SHADOW"
    ROUTED = "ROUTED"


class ServiceRoute(StrEnum):
    SALES = "SALES"
    COMPLIANCE_GENERAL = "COMPLIANCE_GENERAL"
    CS_GENERAL = "CS_GENERAL"
    COMPLAINT = "COMPLAINT"
    OFF_TOPIC = "OFF_TOPIC"
    UNKNOWN = "UNKNOWN"


class SupportLevel(StrEnum):
    LEVEL_0 = "LEVEL_0"
    LEVEL_1 = "LEVEL_1"
    HUMAN_REQUIRED = "HUMAN_REQUIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class SupportTopic(StrEnum):
    GENERAL_NAVIGATION = "GENERAL_NAVIGATION"
    OFFICIAL_CHANNEL = "OFFICIAL_CHANNEL"
    ACCOUNT_ACCESS_GENERAL = "ACCOUNT_ACCESS_GENERAL"
    LOGIN_GENERAL = "LOGIN_GENERAL"
    PASSWORD_SAFETY = "PASSWORD_SAFETY"
    REGISTRATION_GENERAL = "REGISTRATION_GENERAL"
    DOCUMENT_PREPARATION_GENERAL = "DOCUMENT_PREPARATION_GENERAL"
    VERIFICATION_GENERAL = "VERIFICATION_GENERAL"
    ACTIVATION_GENERAL = "ACTIVATION_GENERAL"
    FUNDING_GENERAL = "FUNDING_GENERAL"
    WITHDRAWAL_GENERAL = "WITHDRAWAL_GENERAL"
    PLATFORM_GENERAL = "PLATFORM_GENERAL"
    ERROR_MESSAGE_GENERAL = "ERROR_MESSAGE_GENERAL"
    POST_ACTIVATION_GENERAL = "POST_ACTIVATION_GENERAL"
    STATUS_REQUEST = "STATUS_REQUEST"
    SECURITY_CONCERN = "SECURITY_CONCERN"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class ServiceRoutingDecision:
    route: ServiceRoute
    support_level: SupportLevel
    support_topic: SupportTopic
    reason_codes: tuple[str, ...]
    complaint_category: SafeHandoffCategory | None
    decision_hash: str
    contract_version: str = CLARA_SERVICE_ROUTING_CONTRACT_VERSION

    def debug_metadata(self) -> dict:
        return {
            "service_routing_contract_version": self.contract_version,
            "service_route": self.route.value,
            "support_level": self.support_level.value,
            "support_topic": self.support_topic.value,
            "reason_codes": list(self.reason_codes),
            "complaint_category": self.complaint_category.value
            if self.complaint_category
            else None,
            "decision_hash": self.decision_hash,
        }


def normalize_service_routing_mode(value: str | None) -> ServiceRoutingMode:
    try:
        return ServiceRoutingMode((value or "").strip().upper())
    except ValueError:
        return ServiceRoutingMode.LEGACY


_SECURITY = re.compile(
    r"\b(password|kata\s+sandi|otp|pin|kode\s+verifikasi|akun\s+dibajak)\b", re.I
)
_STATUS = re.compile(
    r"\b(?:status|sudah|belum)\b.{0,30}\b(?:verifikasi|verified|aktivasi|withdraw|penarikan|deposit)\b|"
    r"\b(?:verifikasi|verified|aktivasi|withdraw|penarikan|deposit)\b.{0,30}\b(?:status|sudah|belum|cek)\b",
    re.I,
)
_CS_PATTERNS: tuple[tuple[SupportTopic, re.Pattern[str]], ...] = (
    (
        SupportTopic.LOGIN_GENERAL,
        re.compile(r"\b(login|masuk\s+akun|sign\s*in)\b", re.I),
    ),
    (
        SupportTopic.PASSWORD_SAFETY,
        re.compile(r"\b(password|kata\s+sandi|otp|pin)\b", re.I),
    ),
    (
        SupportTopic.VERIFICATION_GENERAL,
        re.compile(r"\b(verifikasi|verified|kyc)\b", re.I),
    ),
    (
        SupportTopic.REGISTRATION_GENERAL,
        re.compile(r"\b(daftar|registrasi|pendaftaran)\b", re.I),
    ),
    (
        SupportTopic.DOCUMENT_PREPARATION_GENERAL,
        re.compile(r"\b(dokumen|ktp|identitas)\b", re.I),
    ),
    (
        SupportTopic.ACTIVATION_GENERAL,
        re.compile(r"\b(aktivasi|aktifkan\s+akun)\b", re.I),
    ),
    (SupportTopic.WITHDRAWAL_GENERAL, re.compile(r"\b(withdraw|penarikan)\b", re.I)),
    (
        SupportTopic.FUNDING_GENERAL,
        re.compile(r"\b(deposit|pendanaan|top\s*up)\b", re.I),
    ),
    (
        SupportTopic.ERROR_MESSAGE_GENERAL,
        re.compile(r"\b(error|gagal|tidak\s+bisa)\b", re.I),
    ),
    (
        SupportTopic.PLATFORM_GENERAL,
        re.compile(r"\b(platform|aplikasi|menu|navigasi)\b", re.I),
    ),
)
_COMPLIANCE = re.compile(
    r"\b(legal|legalitas|izin|bappebti|regulator|risiko|risk|aturan)\b", re.I
)
_SALES = re.compile(
    r"\b(harga|produk|mini|regular|reguler|trading|modal|spread|komisi|margin|instrumen)\b",
    re.I,
)
_OFF_TOPIC = re.compile(r"\b(cuaca|resep|sepak\s*bola|film|musik)\b", re.I)


def route_service_message(message: str) -> ServiceRoutingDecision:
    text = " ".join((message or "").split())[:4000]
    if GOVERNANCE_BYPASS_PATTERN.search(text):
        return _decision(
            ServiceRoute.UNKNOWN,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.SECURITY_CONCERN,
            ("security_boundary",),
        )
    complaint = classify_safe_handoff_category(text)
    if _SECURITY.search(text):
        return _decision(
            ServiceRoute.CS_GENERAL,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.SECURITY_CONCERN,
            ("security_support",),
            complaint,
        )
    # Routine access trouble is CS unless the customer explicitly asks for a human.
    if (
        _CS_PATTERNS[0][1].search(text)
        and complaint != SafeHandoffCategory.HUMAN_REQUEST
    ):
        return _decision(
            ServiceRoute.CS_GENERAL,
            SupportLevel.LEVEL_1,
            SupportTopic.LOGIN_GENERAL,
            ("support_topic_match",),
        )
    if complaint:
        return _decision(
            ServiceRoute.COMPLAINT,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.UNKNOWN,
            ("contextual_complaint",),
            complaint,
        )
    if _COMPLIANCE.search(text):
        return _decision(
            ServiceRoute.COMPLIANCE_GENERAL,
            SupportLevel.LEVEL_0,
            SupportTopic.UNKNOWN,
            ("general_compliance_question",),
        )
    if _STATUS.search(text):
        return _decision(
            ServiceRoute.CS_GENERAL,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.STATUS_REQUEST,
            ("status_requires_authorized_access",),
        )
    for topic, pattern in _CS_PATTERNS:
        if pattern.search(text):
            return _decision(
                ServiceRoute.CS_GENERAL,
                SupportLevel.LEVEL_1,
                topic,
                ("support_topic_match",),
            )
    if _SALES.search(text):
        return _decision(
            ServiceRoute.SALES,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("sales_topic_match",),
        )
    if _OFF_TOPIC.search(text):
        return _decision(
            ServiceRoute.OFF_TOPIC,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("off_topic_match",),
        )
    return _decision(
        ServiceRoute.UNKNOWN,
        SupportLevel.NOT_APPLICABLE,
        SupportTopic.UNKNOWN,
        ("no_deterministic_match",),
    )


def _decision(
    route: ServiceRoute,
    level: SupportLevel,
    topic: SupportTopic,
    reasons: tuple[str, ...],
    complaint: SafeHandoffCategory | None = None,
) -> ServiceRoutingDecision:
    payload = {
        "route": route.value,
        "support_level": level.value,
        "support_topic": topic.value,
        "reason_codes": reasons,
        "complaint_category": complaint.value if complaint else None,
        "contract_version": CLARA_SERVICE_ROUTING_CONTRACT_VERSION,
    }
    return ServiceRoutingDecision(
        route,
        level,
        topic,
        reasons,
        complaint,
        sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
    )
