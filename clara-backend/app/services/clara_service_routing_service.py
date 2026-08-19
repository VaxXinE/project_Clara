import json
import re
from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256

from app.core.clara_runtime_contract import ConversationIntent, TopLevelRouteIntent
from app.services.clara_policy_enforcement_service import (
    GOVERNANCE_BYPASS_PATTERN,
    ReviewerRequirement,
    classify_safe_handoff_category,
)
from app.services.clara_safe_handoff_service import SafeHandoffCategory


CLARA_SERVICE_ROUTING_CONTRACT_VERSION = "1.1"
ServiceRoute = TopLevelRouteIntent


class ServiceRoutingMode(StrEnum):
    LEGACY = "LEGACY"
    SHADOW = "SHADOW"
    ROUTED = "ROUTED"


class ServiceGenerationStrategy(StrEnum):
    EXISTING_SALES_GENERATION = "EXISTING_SALES_GENERATION"
    COMPLIANCE_EDUCATION = "COMPLIANCE_EDUCATION"
    SUPPORT_KNOWLEDGE_DRAFT = "SUPPORT_KNOWLEDGE_DRAFT"
    SUPPORT_SAFE_HANDOFF = "SUPPORT_SAFE_HANDOFF"
    COMPLAINT_SAFE_HANDOFF = "COMPLAINT_SAFE_HANDOFF"
    OFF_TOPIC_BOUNDARY = "OFF_TOPIC_BOUNDARY"
    NO_CUSTOMER_DRAFT = "NO_CUSTOMER_DRAFT"


class ComplaintSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


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
    top_level_route: TopLevelRouteIntent
    conversation_intent: ConversationIntent
    support_level: SupportLevel
    support_topic: SupportTopic
    complaint_category: SafeHandoffCategory | None
    complaint_severity: ComplaintSeverity | None
    route_reason_codes: tuple[str, ...]
    confidence_score: float
    requires_human: bool
    create_case: bool
    generation_strategy: ServiceGenerationStrategy
    reviewer_requirement: ReviewerRequirement
    source_type: str
    decision_hash: str
    routing_contract_version: str = CLARA_SERVICE_ROUTING_CONTRACT_VERSION

    @property
    def route(self) -> TopLevelRouteIntent:
        return self.top_level_route

    @property
    def reason_codes(self) -> tuple[str, ...]:
        return self.route_reason_codes

    @property
    def contract_version(self) -> str:
        return self.routing_contract_version

    def debug_metadata(self) -> dict:
        return {
            "service_routing_contract_version": self.routing_contract_version,
            "top_level_route": self.top_level_route.value,
            "conversation_intent": self.conversation_intent.value,
            "support_level": self.support_level.value,
            "support_topic": self.support_topic.value,
            "complaint_category": self.complaint_category.value
            if self.complaint_category
            else None,
            "complaint_severity": self.complaint_severity.value
            if self.complaint_severity
            else None,
            "route_reason_codes": list(self.route_reason_codes),
            "confidence_score": self.confidence_score,
            "requires_human": self.requires_human,
            "create_case": self.create_case,
            "generation_strategy": self.generation_strategy.value,
            "reviewer_requirement": self.reviewer_requirement.value,
            "source_type": self.source_type,
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
    r"\b(?:cek|periksa|lihat|bagaimana|gimana|status(?:nya)?|apakah)\b"
    r".{0,40}\b(?:verifikasi|verified|aktivasi|withdraw|penarikan|deposit)\b|"
    r"\b(?:verifikasi|verified|aktivasi|withdraw|penarikan|deposit)\b"
    r".{0,40}\b(?:status(?:nya)?|sudah\s+belum|belum\s*\?|tolong\s+cek)\b",
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
    r"\b(legal|legalitas|izin|bappebti|regulator|risiko|resiko|risk|aman|rugi|loss|bahaya|aturan|refund policy|kebijakan refund)\b",
    re.I,
)
_RISK_EDUCATION = re.compile(
    r"\b(risiko|resiko|risk|aman|rugi|loss|bahaya)\b",
    re.I,
)
_SALES = re.compile(
    r"\b(harga|produk|mini|regular|reguler|trading|modal|spread|komisi|margin|instrumen)\b",
    re.I,
)
_OFF_TOPIC = re.compile(r"\b(cuaca|resep|sepak\s*bola|film|musik)\b", re.I)
_HIGH_COMPLAINT = re.compile(
    r"\b(?:dana|uang|saldo)\s+(?:saya\s+)?(?:hilang|berkurang)|"
    r"\b(?:refund|kompensasi|ganti\s+rugi|ditipu|fraud|somasi|gugat)\b",
    re.I,
)
_TRADING_READY = re.compile(
    r"\b(?:sudah|telah)\b.{0,25}\b(?:deposit|pendanaan|dana\s+sudah\s+masuk)\b"
    r".{0,60}\b(?:mau|siap)\b.{0,15}\b(?:mulai\s+)?transaksi\b",
    re.I,
)
_VERIFICATION_METHOD_FACT = re.compile(
    r"\b(?:verifikasi|tahap|proses)\b.{0,60}"
    r"\b(?:video\s*call|wpb|wakil\s+pialang(?:\s+berjangka)?)\b|"
    r"\b(?:video\s*call|wpb|wakil\s+pialang(?:\s+berjangka)?)\b.{0,60}"
    r"\b(?:verifikasi|tahap|proses)\b",
    re.I,
)
_REGISTRATION_PRODUCT_FACT = re.compile(
    r"\b(?:website|aplikasi)\b.{0,50}\b(?:daftar|registrasi|pendaftaran)\b|"
    r"\b(?:daftar|registrasi|pendaftaran)\b.{0,50}\b(?:website|aplikasi)\b",
    re.I,
)
_SALES_PRESSURE_OBJECTION = re.compile(
    r"\b(?:ujung(?:[-\s]?ujungnya)?|intinya|akhirnya|endingnya)\b.{0,40}"
    r"\b(?:cuma|hanya)?\s*(?:disuruh|diminta|diarahkan|suruh)\b.{0,20}"
    r"\b(?:deposit|top\s*up|transfer|setor(?:\s+dana)?)\b|"
    r"\b(?:cuma|hanya)\b.{0,20}\b(?:disuruh|diminta|diarahkan|suruh)\b.{0,20}"
    r"\b(?:deposit|top\s*up|transfer|setor(?:\s+dana)?)\b",
    re.I,
)
CLARA_IDENTITY_OR_APP_COMPARISON_PATTERN = re.compile(
    r"\b(?:kamu|anda|clara)\s+(?:ini\s+)?siapa\b|"
    r"\b(?:sama|beda|berbeda)(?:\s+\w+){0,4}\s+"
    r"(?:aplikasi\s+)?solid(?:\s+prime)?\b|"
    r"\b(?:aplikasi\s+)?solid(?:\s+prime)?(?:\s+\w+){0,4}\s+"
    r"(?:sama|beda|berbeda)\b",
    re.I,
)


def route_service_message(message: str) -> ServiceRoutingDecision:
    text = " ".join((message or "").split())[:4000]
    if GOVERNANCE_BYPASS_PATTERN.search(text):
        return _decision(
            TopLevelRouteIntent.UNKNOWN,
            ConversationIntent.UNKNOWN,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.SECURITY_CONCERN,
            ("security_boundary",),
            1.0,
            True,
            False,
            ServiceGenerationStrategy.NO_CUSTOMER_DRAFT,
            ReviewerRequirement.NO_REVIEW_ALLOWED,
        )

    if CLARA_IDENTITY_OR_APP_COMPARISON_PATTERN.search(text):
        return _decision(
            TopLevelRouteIntent.SALES,
            ConversationIntent.INFO_SEEKING,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("clara_identity_or_solid_app_comparison",),
            0.98,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )

    complaint = classify_safe_handoff_category(text)
    if _SECURITY.search(text):
        return _decision(
            TopLevelRouteIntent.CS_GENERAL,
            ConversationIntent.COMPLAINT_OR_PROBLEM,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.SECURITY_CONCERN,
            ("security_support",),
            0.98,
            True,
            False,
            ServiceGenerationStrategy.SUPPORT_SAFE_HANDOFF,
            ReviewerRequirement.SUPERVISOR_OR_COMPLIANCE_REVIEW,
            complaint,
        )
    if (
        _CS_PATTERNS[0][1].search(text)
        and complaint != SafeHandoffCategory.HUMAN_REQUEST
    ):
        return _decision(
            TopLevelRouteIntent.CS_GENERAL,
            ConversationIntent.POST_ACTIVATION_SUPPORT,
            SupportLevel.LEVEL_1,
            SupportTopic.LOGIN_GENERAL,
            ("routine_account_access",),
            0.95,
            False,
            False,
            ServiceGenerationStrategy.SUPPORT_KNOWLEDGE_DRAFT,
            ReviewerRequirement.SALES_REVIEW,
        )
    if complaint:
        severity = (
            ComplaintSeverity.HIGH
            if _HIGH_COMPLAINT.search(text)
            else _complaint_severity(complaint)
        )
        return _decision(
            TopLevelRouteIntent.COMPLAINT,
            ConversationIntent.COMPLAINT_OR_PROBLEM,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.UNKNOWN,
            ("contextual_complaint",),
            0.98,
            True,
            True,
            ServiceGenerationStrategy.COMPLAINT_SAFE_HANDOFF,
            ReviewerRequirement.COMPLIANCE_REVIEW
            if severity in {ComplaintSeverity.HIGH, ComplaintSeverity.CRITICAL}
            else ReviewerRequirement.MANAGER_REVIEW,
            complaint,
            severity,
        )
    if _COMPLIANCE.search(text):
        intent = (
            ConversationIntent.RISK_CHECK
            if _RISK_EDUCATION.search(text)
            else ConversationIntent.LEGALITY_CHECK
        )
        return _decision(
            TopLevelRouteIntent.COMPLIANCE_GENERAL,
            intent,
            SupportLevel.LEVEL_0,
            SupportTopic.UNKNOWN,
            ("general_compliance_education",),
            0.9,
            False,
            False,
            ServiceGenerationStrategy.COMPLIANCE_EDUCATION,
            ReviewerRequirement.COMPLIANCE_REVIEW,
        )
    if _STATUS.search(text):
        return _decision(
            TopLevelRouteIntent.CS_GENERAL,
            ConversationIntent.PROCESS_CHECK,
            SupportLevel.HUMAN_REQUIRED,
            SupportTopic.STATUS_REQUEST,
            ("status_requires_authorized_access",),
            0.98,
            True,
            False,
            ServiceGenerationStrategy.SUPPORT_SAFE_HANDOFF,
            ReviewerRequirement.MANAGER_REVIEW,
        )
    if _TRADING_READY.search(text):
        return _decision(
            TopLevelRouteIntent.SALES,
            ConversationIntent.READINESS_VALIDATION,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("customer_reports_trading_ready",),
            0.95,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )
    if _VERIFICATION_METHOD_FACT.search(text):
        return _decision(
            TopLevelRouteIntent.SALES,
            ConversationIntent.PROCESS_CHECK,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.VERIFICATION_GENERAL,
            ("verification_method_product_fact",),
            0.98,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )
    if _REGISTRATION_PRODUCT_FACT.search(text):
        return _decision(
            TopLevelRouteIntent.SALES,
            ConversationIntent.PROCESS_CHECK,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.REGISTRATION_GENERAL,
            ("registration_channel_product_fact",),
            0.98,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )
    if _SALES_PRESSURE_OBJECTION.search(text):
        return _decision(
            TopLevelRouteIntent.SALES,
            ConversationIntent.OBJECTION,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("sales_pressure_objection",),
            0.95,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )
    for topic, pattern in _CS_PATTERNS:
        if pattern.search(text):
            return _decision(
                TopLevelRouteIntent.CS_GENERAL,
                ConversationIntent.POST_ACTIVATION_SUPPORT,
                SupportLevel.LEVEL_1,
                topic,
                ("support_topic_match",),
                0.9,
                False,
                False,
                ServiceGenerationStrategy.SUPPORT_KNOWLEDGE_DRAFT,
                ReviewerRequirement.SALES_REVIEW,
            )
    if _SALES.search(text):
        intent = (
            ConversationIntent.COST_CHECK
            if re.search(r"\b(harga|modal|spread|komisi|margin)\b", text, re.I)
            else ConversationIntent.INFO_SEEKING
        )
        return _decision(
            TopLevelRouteIntent.SALES,
            intent,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("sales_topic_match",),
            0.85,
            False,
            False,
            ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
            ReviewerRequirement.SALES_REVIEW,
        )
    if _OFF_TOPIC.search(text):
        return _decision(
            TopLevelRouteIntent.OFF_TOPIC,
            ConversationIntent.UNKNOWN,
            SupportLevel.NOT_APPLICABLE,
            SupportTopic.UNKNOWN,
            ("off_topic_match",),
            0.9,
            False,
            False,
            ServiceGenerationStrategy.OFF_TOPIC_BOUNDARY,
            ReviewerRequirement.SALES_REVIEW,
        )
    return _decision(
        TopLevelRouteIntent.UNKNOWN,
        ConversationIntent.UNKNOWN,
        SupportLevel.NOT_APPLICABLE,
        SupportTopic.UNKNOWN,
        ("no_deterministic_match",),
        0.0,
        False,
        False,
        ServiceGenerationStrategy.EXISTING_SALES_GENERATION,
        ReviewerRequirement.SALES_REVIEW,
    )


def _complaint_severity(category: SafeHandoffCategory) -> ComplaintSeverity:
    if category in {
        SafeHandoffCategory.FRAUD_ALLEGATION,
        SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT,
        SafeHandoffCategory.FINANCIAL_LOSS_CLAIM,
        SafeHandoffCategory.REFUND_OR_COMPENSATION,
    }:
        return ComplaintSeverity.HIGH
    return ComplaintSeverity.MEDIUM


def _decision(
    route: TopLevelRouteIntent,
    intent: ConversationIntent,
    level: SupportLevel,
    topic: SupportTopic,
    reasons: tuple[str, ...],
    confidence: float,
    human: bool,
    create_case: bool,
    strategy: ServiceGenerationStrategy,
    reviewer: ReviewerRequirement,
    complaint: SafeHandoffCategory | None = None,
    severity: ComplaintSeverity | None = None,
) -> ServiceRoutingDecision:
    payload = {
        "top_level_route": route.value,
        "conversation_intent": intent.value,
        "support_level": level.value,
        "support_topic": topic.value,
        "complaint_category": complaint.value if complaint else None,
        "complaint_severity": severity.value if severity else None,
        "route_reason_codes": reasons,
        "confidence_score": confidence,
        "requires_human": human,
        "create_case": create_case,
        "generation_strategy": strategy.value,
        "reviewer_requirement": reviewer.value,
        "source_type": "DETERMINISTIC_RULES",
        "routing_contract_version": CLARA_SERVICE_ROUTING_CONTRACT_VERSION,
    }
    decision_hash = sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return ServiceRoutingDecision(
        route,
        intent,
        level,
        topic,
        complaint,
        severity,
        reasons,
        confidence,
        human,
        create_case,
        strategy,
        reviewer,
        "DETERMINISTIC_RULES",
        decision_hash,
    )
