import re
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import StrEnum
from hashlib import sha256
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.clara_runtime_contract import PROCESS_STATE_METADATA, ProcessState
from app.models.customer_process_state import CustomerProcessState
from app.models.customer_process_state_event import CustomerProcessStateEvent
from app.models.customer_profile import CustomerProfile
from app.models.user import User


CLARA_PROCESS_STATE_CONTRACT_VERSION = "1.0"
process_state_logger = logging.getLogger("clara.process_state")


class ProcessStateMode(StrEnum):
    LEGACY = "LEGACY"
    SHADOW = "SHADOW"
    FSM = "FSM"


class TransitionDecision(StrEnum):
    OBSERVED = "OBSERVED"
    APPLIED = "APPLIED"
    SAME_STATE_CONFIRMED = "SAME_STATE_CONFIRMED"
    REJECTED_REGRESSION = "REJECTED_REGRESSION"
    REJECTED_LOW_CONFIDENCE = "REJECTED_LOW_CONFIDENCE"
    REJECTED_INSUFFICIENT_EVIDENCE = "REJECTED_INSUFFICIENT_EVIDENCE"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"
    MANUAL_CORRECTION = "MANUAL_CORRECTION"
    MERGE_RECONCILIATION_REQUIRED = "MERGE_RECONCILIATION_REQUIRED"
    MERGE_RECONCILED = "MERGE_RECONCILED"


class TransitionType(StrEnum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL_FORWARD = "MANUAL_FORWARD"
    MANUAL_CORRECTION = "MANUAL_CORRECTION"
    SYSTEM_CONFIRMED = "SYSTEM_CONFIRMED"
    IMPORT_RECONCILIATION = "IMPORT_RECONCILIATION"
    CUSTOMER_MERGE_RECONCILIATION = "CUSTOMER_MERGE_RECONCILIATION"


class TrustLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    AUTHORITATIVE = "AUTHORITATIVE"


PROCESS_STATE_ORDER = (
    ProcessState.UNKNOWN,
    ProcessState.NEW_INQUIRY,
    ProcessState.EXPLORATION,
    ProcessState.READY_TO_PROCEED,
    ProcessState.DATA_SUBMITTED,
    ProcessState.VERIFICATION_IN_PROGRESS,
    ProcessState.VERIFIED,
    ProcessState.ONBOARDING_OR_ACTIVATION,
    ProcessState.ACCOUNT_ACTIVE,
    ProcessState.FUNDED,
    ProcessState.ACTIVE_SUPPORT,
)
PROCESS_STATE_RANK = {
    state: PROCESS_STATE_METADATA[state][0] or 0 for state in PROCESS_STATE_ORDER
}
TRUST_RANK = {
    TrustLevel.LOW: 10,
    TrustLevel.MEDIUM: 20,
    TrustLevel.HIGH: 30,
    TrustLevel.AUTHORITATIVE: 40,
}
SENSITIVE_STATES = frozenset(
    {
        ProcessState.VERIFIED,
        ProcessState.ACCOUNT_ACTIVE,
        ProcessState.FUNDED,
        ProcessState.ACTIVE_SUPPORT,
    }
)
SENSITIVE_EVIDENCE = {
    ProcessState.VERIFIED: frozenset(
        {"VERIFICATION_COMPLETED_CONFIRMED", "SYSTEM_STATUS_CONFIRMATION"}
    ),
    ProcessState.ACCOUNT_ACTIVE: frozenset(
        {"ACCOUNT_ACTIVATION_CONFIRMED", "SYSTEM_STATUS_CONFIRMATION"}
    ),
    ProcessState.FUNDED: frozenset({"FUNDING_CONFIRMED", "SYSTEM_STATUS_CONFIRMATION"}),
    ProcessState.ACTIVE_SUPPORT: frozenset(
        {"SUPPORT_CONTEXT_CONFIRMED", "SYSTEM_STATUS_CONFIRMATION"}
    ),
}

QUESTION_PATTERN = re.compile(r"\?|\b(apakah|apa sudah|udah belum|sudah belum)\b", re.I)
HYPOTHETICAL_PATTERN = re.compile(r"\b(nanti|kalau|jika|seandainya|akan|rencana)\b", re.I)
NEGATION_PATTERN = re.compile(r"\b(belum|tidak|nggak|gak|bukan|jangan)\b", re.I)
STATE_PATTERNS = (
    (
        ProcessState.ACTIVE_SUPPORT,
        re.compile(r"\b(dukungan aktif|support aktif|bantuan setelah akun aktif)\b", re.I),
        "SUPPORT_CONTEXT_CONFIRMED",
    ),
    (
        ProcessState.FUNDED,
        re.compile(r"\b(dana|deposit)\b.{0,24}\b(sudah masuk|berhasil masuk|terkonfirmasi)\b", re.I),
        "FUNDING_CONFIRMED",
    ),
    (
        ProcessState.ACCOUNT_ACTIVE,
        re.compile(r"\bakun\b.{0,20}\b(sudah aktif|berhasil diaktifkan|telah aktif)\b", re.I),
        "ACCOUNT_ACTIVATION_CONFIRMED",
    ),
    (
        ProcessState.ONBOARDING_OR_ACTIVATION,
        re.compile(r"\b(onboarding|aktivasi)\b.{0,20}\b(dimulai|diproses|berjalan)\b", re.I),
        "SYSTEM_STATUS_CONFIRMATION",
    ),
    (
        ProcessState.VERIFIED,
        re.compile(r"\b(sudah|telah|berhasil)\b.{0,20}\b(verified|terverifikasi|diverifikasi)\b", re.I),
        "VERIFICATION_COMPLETED_CONFIRMED",
    ),
    (
        ProcessState.VERIFICATION_IN_PROGRESS,
        re.compile(r"\b(verifikasi)\b.{0,20}\b(dimulai|diproses|berjalan)\b", re.I),
        "VERIFICATION_STARTED_CONFIRMED",
    ),
    (
        ProcessState.DATA_SUBMITTED,
        re.compile(r"\b(data|dokumen)\b.{0,24}\b(sudah dikirim|telah dikirim|sudah saya kirim|diterima)\b", re.I),
        "DATA_SUBMISSION_CONFIRMED",
    ),
    (
        ProcessState.READY_TO_PROCEED,
        re.compile(r"\b(saya siap|siap lanjut|mau lanjut|boleh lanjut)\b", re.I),
        "EXPLICIT_CUSTOMER_STATEMENT",
    ),
)


@dataclass(frozen=True)
class ProcessStateObservation:
    proposed_state: ProcessState
    confidence_score: float
    source_type: str
    source_trust_level: TrustLevel
    evidence_codes: tuple[str, ...]
    source_reference_type: str | None
    source_reference_id: UUID | None
    safe_reason_codes: tuple[str, ...]


@dataclass(frozen=True)
class ProcessStateTransitionDecision:
    previous_state: ProcessState
    proposed_state: ProcessState
    applied_state: ProcessState
    decision: TransitionDecision
    mode: ProcessStateMode
    evidence_codes: tuple[str, ...]
    reason_codes: tuple[str, ...]
    state_version: int
    decision_hash: str

    def debug_metadata(self) -> dict:
        return {
            **asdict(self),
            "previous_state": self.previous_state.value,
            "proposed_state": self.proposed_state.value,
            "applied_state": self.applied_state.value,
            "decision": self.decision.value,
            "mode": self.mode.value,
            "process_state_contract_version": CLARA_PROCESS_STATE_CONTRACT_VERSION,
            "regression_blocked": self.decision == TransitionDecision.REJECTED_REGRESSION,
        }


def normalize_process_state_mode(value: str | None) -> ProcessStateMode:
    try:
        return ProcessStateMode((value or "").strip().upper())
    except ValueError:
        return ProcessStateMode.LEGACY


def parse_process_state(value: str) -> ProcessState:
    try:
        return ProcessState(value.strip().upper())
    except ValueError as exc:
        raise ValueError("Process state tidak valid.") from exc


def state_rank(state: ProcessState | str) -> int:
    canonical = state if isinstance(state, ProcessState) else parse_process_state(state)
    return PROCESS_STATE_RANK[canonical]


def derive_process_state_observation(
    *,
    message_text: str,
    sender_type: str,
    source_reference_type: str | None = None,
    source_reference_id: UUID | None = None,
    extraction_confidence: float | None = None,
    pipeline_stage: str | None = None,
) -> ProcessStateObservation:
    normalized_sender = sender_type.strip().lower()
    source_type = "CUSTOMER_MESSAGE" if normalized_sender == "customer" else "AGENT_MESSAGE"
    trust = TrustLevel.MEDIUM if normalized_sender == "customer" else TrustLevel.HIGH
    base_evidence = [
        "EXPLICIT_CUSTOMER_STATEMENT"
        if normalized_sender == "customer"
        else "AUTHORIZED_AGENT_CONFIRMATION"
    ]

    blocked_reason = None
    if QUESTION_PATTERN.search(message_text):
        blocked_reason = "QUESTION_FORM"
    elif HYPOTHETICAL_PATTERN.search(message_text):
        blocked_reason = "HYPOTHETICAL_OR_FUTURE"
    elif NEGATION_PATTERN.search(message_text):
        blocked_reason = "NEGATED_OR_UNCERTAIN"

    if blocked_reason is None:
        for proposed_state, pattern, evidence_code in STATE_PATTERNS:
            if pattern.search(message_text):
                confidence = 0.84 if trust == TrustLevel.MEDIUM else 0.94
                if extraction_confidence is not None:
                    confidence = min(confidence, max(0.0, min(extraction_confidence, 1.0)))
                return ProcessStateObservation(
                    proposed_state=proposed_state,
                    confidence_score=confidence,
                    source_type=source_type,
                    source_trust_level=trust,
                    evidence_codes=tuple([*base_evidence, evidence_code]),
                    source_reference_type=source_reference_type,
                    source_reference_id=source_reference_id,
                    safe_reason_codes=("EXPLICIT_CONFIRMATION",),
                )

    reason_codes = [blocked_reason or "NO_EXPLICIT_PROCESS_STATE_EVIDENCE"]
    evidence_codes = ["AI_INFERENCE_ONLY"]
    if pipeline_stage:
        evidence_codes.append("PIPELINE_STAGE_HINT")
        reason_codes.append("LEGACY_PIPELINE_STAGE_CONTEXT_ONLY")
    return ProcessStateObservation(
        proposed_state=ProcessState.UNKNOWN,
        confidence_score=0.0,
        source_type=source_type,
        source_trust_level=TrustLevel.LOW,
        evidence_codes=tuple(evidence_codes),
        source_reference_type=source_reference_type,
        source_reference_id=source_reference_id,
        safe_reason_codes=tuple(reason_codes),
    )


def decide_process_state_transition(
    *,
    current_state: ProcessState,
    current_confidence: float,
    current_trust_level: TrustLevel,
    current_version: int,
    manual_lock: bool,
    observation: ProcessStateObservation,
    mode: ProcessStateMode,
) -> ProcessStateTransitionDecision:
    decision = TransitionDecision.OBSERVED
    applied = current_state
    reasons = list(observation.safe_reason_codes)

    if mode == ProcessStateMode.FSM:
        current_rank = state_rank(current_state)
        proposed_rank = state_rank(observation.proposed_state)
        trust_rank = TRUST_RANK[observation.source_trust_level]
        current_trust_rank = TRUST_RANK[current_trust_level]
        evidence = set(observation.evidence_codes)

        if manual_lock:
            decision = TransitionDecision.REQUIRES_REVIEW
            reasons.append("MANUAL_LOCK_ACTIVE")
        elif observation.proposed_state == ProcessState.UNKNOWN:
            decision = TransitionDecision.REJECTED_INSUFFICIENT_EVIDENCE
        elif proposed_rank < current_rank:
            decision = TransitionDecision.REJECTED_REGRESSION
            reasons.append("AUTOMATIC_REGRESSION_FORBIDDEN")
        elif trust_rank < current_trust_rank and observation.confidence_score < current_confidence:
            decision = TransitionDecision.REJECTED_LOW_CONFIDENCE
            reasons.append("LOWER_TRUST_THAN_CURRENT_STATE")
        elif observation.proposed_state in SENSITIVE_STATES and (
            trust_rank < TRUST_RANK[TrustLevel.HIGH]
            or not (evidence & SENSITIVE_EVIDENCE[observation.proposed_state])
            or "AI_INFERENCE_ONLY" in evidence
            or "PIPELINE_STAGE_HINT" in evidence
        ):
            decision = TransitionDecision.REJECTED_INSUFFICIENT_EVIDENCE
            reasons.append("SENSITIVE_STATE_REQUIRES_TRUSTED_CONFIRMATION")
        elif proposed_rank == current_rank:
            if observation.confidence_score >= 0.65:
                decision = TransitionDecision.SAME_STATE_CONFIRMED
            else:
                decision = TransitionDecision.REJECTED_LOW_CONFIDENCE
        else:
            step_count = (proposed_rank - current_rank) // 10
            enough_for_one_step = step_count == 1 and observation.confidence_score >= 0.75
            enough_for_skip = (
                step_count > 1
                and observation.confidence_score >= 0.9
                and trust_rank >= TRUST_RANK[TrustLevel.HIGH]
            )
            if enough_for_one_step or enough_for_skip:
                decision = TransitionDecision.APPLIED
                applied = observation.proposed_state
            else:
                decision = TransitionDecision.REJECTED_LOW_CONFIDENCE
                reasons.append("FORWARD_SKIP_REQUIRES_STRONG_TRUSTED_EVIDENCE")

    next_version = (
        current_version + 1
        if decision in {TransitionDecision.APPLIED, TransitionDecision.SAME_STATE_CONFIRMED}
        else current_version
    )
    decision_input = "|".join(
        (
            current_state.value,
            observation.proposed_state.value,
            applied.value,
            decision.value,
            mode.value,
            str(current_version),
            *sorted(observation.evidence_codes),
            *sorted(set(reasons)),
        )
    )
    return ProcessStateTransitionDecision(
        previous_state=current_state,
        proposed_state=observation.proposed_state,
        applied_state=applied,
        decision=decision,
        mode=mode,
        evidence_codes=observation.evidence_codes,
        reason_codes=tuple(dict.fromkeys(reasons)),
        state_version=next_version,
        decision_hash=sha256(decision_input.encode()).hexdigest(),
    )


def get_or_create_process_state(
    db: Session, profile: CustomerProfile
) -> CustomerProcessState:
    state = db.scalar(
        select(CustomerProcessState).where(
            CustomerProcessState.customer_profile_id == profile.id
        )
    )
    if state is not None:
        return state
    state = CustomerProcessState(
        organization_id=profile.organization_id,
        customer_profile_id=profile.id,
    )
    db.add(state)
    db.flush()
    return state


def record_process_state_observation(
    db: Session,
    *,
    profile: CustomerProfile,
    observation: ProcessStateObservation,
    mode: ProcessStateMode,
    actor_user_id: UUID | None = None,
    correlation_id: str | None = None,
) -> ProcessStateTransitionDecision:
    if profile.merged_into_profile_id is not None:
        raise ValueError("Profil yang sudah digabung tidak dapat menerima state baru.")
    state = get_or_create_process_state(db, profile)
    decision = decide_process_state_transition(
        current_state=ProcessState(state.current_state),
        current_confidence=state.confidence_score,
        current_trust_level=TrustLevel(state.source_trust_level),
        current_version=state.version,
        manual_lock=state.manual_lock,
        observation=observation,
        mode=mode,
    )
    now = datetime.now(timezone.utc)
    if decision.decision in {
        TransitionDecision.APPLIED,
        TransitionDecision.SAME_STATE_CONFIRMED,
    }:
        values = {
            "current_state": decision.applied_state.value,
            "state_rank": state_rank(decision.applied_state),
            "confidence_score": observation.confidence_score,
            "source_type": observation.source_type,
            "source_reference_type": observation.source_reference_type,
            "source_reference_id": observation.source_reference_id,
            "source_trust_level": observation.source_trust_level.value,
            "version": decision.state_version,
            "last_confirmed_at": now,
            "updated_at": now,
        }
        if decision.decision == TransitionDecision.APPLIED:
            values["last_transition_at"] = now
        result = db.execute(
            update(CustomerProcessState)
            .where(
                CustomerProcessState.id == state.id,
                CustomerProcessState.version == state.version,
            )
            .values(**values)
        )
        if result.rowcount != 1:
            raise ValueError("State berubah bersamaan; muat ulang lalu coba lagi.")
        for key, value in values.items():
            setattr(state, key, value)

    db.add(
        CustomerProcessStateEvent(
            process_state_id=state.id,
            customer_profile_id=profile.id,
            organization_id=profile.organization_id,
            previous_state=decision.previous_state.value,
            proposed_state=decision.proposed_state.value,
            applied_state=decision.applied_state.value,
            decision=decision.decision.value,
            transition_type=TransitionType.AUTOMATIC.value,
            source_type=observation.source_type,
            source_reference_type=observation.source_reference_type,
            source_reference_id=observation.source_reference_id,
            evidence_codes=list(observation.evidence_codes),
            confidence_score=observation.confidence_score,
            source_trust_level=observation.source_trust_level.value,
            actor_user_id=actor_user_id,
            reason_codes=list(decision.reason_codes),
            correlation_id=correlation_id,
        )
    )
    db.flush()
    process_state_logger.info(
        "process_state_observation_decided",
        extra={
            **decision.debug_metadata(),
            "source_type": observation.source_type,
            "source_trust_level": observation.source_trust_level.value,
            "evidence_codes": list(observation.evidence_codes),
            "manual_correction_used": False,
            "merge_reconciliation_required": False,
        },
    )
    return decision


def apply_manual_process_state_transition(
    db: Session,
    *,
    profile: CustomerProfile,
    proposed_state: ProcessState,
    expected_version: int,
    reason_code: str,
    actor: User,
) -> ProcessStateTransitionDecision:
    reason = reason_code.strip()
    if not reason:
        raise ValueError("Reason code wajib diisi.")
    state = get_or_create_process_state(db, profile)
    resolving_merge = has_unresolved_merge_reconciliation(db, profile.id)
    if resolving_merge and not reason.startswith("MERGE_"):
        raise ValueError("Rekonsiliasi merge memerlukan reason code berawalan MERGE_.")
    if state.version != expected_version:
        raise ValueError("Versi state sudah berubah; muat ulang data terbaru.")
    previous = ProcessState(state.current_state)
    previous_rank = state_rank(previous)
    proposed_rank = state_rank(proposed_state)
    is_regression = proposed_rank < previous_rank
    if actor.role == "sales" and (is_regression or proposed_rank > state_rank(ProcessState.DATA_SUBMITTED)):
        raise PermissionError("Sales hanya dapat memajukan state sampai DATA_SUBMITTED.")
    if actor.role not in {"sales", "manager", "head", "superadmin"}:
        raise PermissionError("Role tidak diizinkan mengubah process state.")
    if actor.organization_id is None or profile.organization_id != actor.organization_id:
        raise PermissionError(
            "Perubahan lintas organization memerlukan aksi administratif terscope."
        )
    if is_regression and actor.role not in {"manager", "head", "superadmin"}:
        raise PermissionError("Koreksi mundur memerlukan manager atau role lebih tinggi.")

    now = datetime.now(timezone.utc)
    next_version = state.version + 1
    result = db.execute(
        update(CustomerProcessState)
        .where(
            CustomerProcessState.id == state.id,
            CustomerProcessState.version == expected_version,
        )
        .values(
            current_state=proposed_state.value,
            state_rank=proposed_rank,
            confidence_score=1.0,
            source_type="MANUAL",
            source_reference_type="user",
            source_reference_id=actor.id,
            source_trust_level=TrustLevel.AUTHORITATIVE.value,
            version=next_version,
            manual_lock=is_regression,
            last_confirmed_at=now,
            last_transition_at=now,
            updated_at=now,
        )
    )
    if result.rowcount != 1:
        raise ValueError("State berubah bersamaan; muat ulang lalu coba lagi.")
    transition_type = (
        TransitionType.MANUAL_CORRECTION if is_regression else TransitionType.MANUAL_FORWARD
    )
    decision_value = (
        TransitionDecision.MANUAL_CORRECTION if is_regression else TransitionDecision.APPLIED
    )
    decision_input = f"{previous.value}|{proposed_state.value}|{decision_value.value}|{next_version}|{reason}"
    decision = ProcessStateTransitionDecision(
        previous_state=previous,
        proposed_state=proposed_state,
        applied_state=proposed_state,
        decision=decision_value,
        mode=ProcessStateMode.FSM,
        evidence_codes=("MANUAL_OVERRIDE",),
        reason_codes=(reason,),
        state_version=next_version,
        decision_hash=sha256(decision_input.encode()).hexdigest(),
    )
    db.add(
        CustomerProcessStateEvent(
            process_state_id=state.id,
            customer_profile_id=profile.id,
            organization_id=profile.organization_id,
            previous_state=previous.value,
            proposed_state=proposed_state.value,
            applied_state=proposed_state.value,
            decision=decision_value.value,
            transition_type=transition_type.value,
            source_type="MANUAL",
            source_reference_type="user",
            source_reference_id=actor.id,
            evidence_codes=["MANUAL_OVERRIDE"],
            confidence_score=1.0,
            source_trust_level=TrustLevel.AUTHORITATIVE.value,
            actor_user_id=actor.id,
            reason_codes=[reason],
        )
    )
    if resolving_merge:
        db.add(
            CustomerProcessStateEvent(
                process_state_id=state.id,
                customer_profile_id=profile.id,
                organization_id=profile.organization_id,
                previous_state=proposed_state.value,
                proposed_state=proposed_state.value,
                applied_state=proposed_state.value,
                decision=TransitionDecision.MERGE_RECONCILED.value,
                transition_type=TransitionType.CUSTOMER_MERGE_RECONCILIATION.value,
                source_type="MANUAL",
                source_reference_type="user",
                source_reference_id=actor.id,
                evidence_codes=["MANUAL_OVERRIDE", "CUSTOMER_PROFILE_MERGE"],
                confidence_score=1.0,
                source_trust_level=TrustLevel.AUTHORITATIVE.value,
                actor_user_id=actor.id,
                reason_codes=[reason],
            )
        )
    db.flush()
    db.expire(state)
    process_state_logger.info(
        "process_state_manual_transition_applied",
        extra={
            **decision.debug_metadata(),
            "source_type": "MANUAL",
            "source_trust_level": TrustLevel.AUTHORITATIVE.value,
            "manual_correction_used": is_regression,
            "merge_reconciliation_required": False,
        },
    )
    return decision


def get_process_state_history(
    db: Session, customer_profile_id: UUID
) -> list[CustomerProcessStateEvent]:
    return list(
        db.scalars(
            select(CustomerProcessStateEvent)
            .where(CustomerProcessStateEvent.customer_profile_id == customer_profile_id)
            .order_by(CustomerProcessStateEvent.created_at.desc())
        ).all()
    )


def has_unresolved_merge_reconciliation(
    db: Session, customer_profile_id: UUID
) -> bool:
    latest = db.scalar(
        select(CustomerProcessStateEvent.decision)
        .where(
            CustomerProcessStateEvent.customer_profile_id == customer_profile_id,
            CustomerProcessStateEvent.decision.in_(
                (
                    TransitionDecision.MERGE_RECONCILIATION_REQUIRED.value,
                    TransitionDecision.MERGE_RECONCILED.value,
                )
            ),
        )
        .order_by(CustomerProcessStateEvent.created_at.desc(), CustomerProcessStateEvent.id.desc())
        .limit(1)
    )
    return latest == TransitionDecision.MERGE_RECONCILIATION_REQUIRED.value


def reconcile_customer_process_states(
    db: Session,
    *,
    source_profile: CustomerProfile,
    target_profile: CustomerProfile,
    actor_user_id: UUID,
) -> TransitionDecision | None:
    source = get_or_create_process_state(db, source_profile)
    target = get_or_create_process_state(db, target_profile)
    source.manual_lock = True
    source_state = ProcessState(source.current_state)
    target_state = ProcessState(target.current_state)
    if source_state == ProcessState.UNKNOWN and target_state == ProcessState.UNKNOWN:
        return None

    source_trust = TRUST_RANK[TrustLevel(source.source_trust_level)]
    target_trust = TRUST_RANK[TrustLevel(target.source_trust_level)]
    conflict = (
        source_state != target_state
        and source_trust >= TRUST_RANK[TrustLevel.HIGH]
        and target_trust >= TRUST_RANK[TrustLevel.HIGH]
    )
    decision = (
        TransitionDecision.MERGE_RECONCILIATION_REQUIRED
        if conflict
        else TransitionDecision.MERGE_RECONCILED
    )
    applied = target_state
    if not conflict and source_state != ProcessState.UNKNOWN and source_trust > target_trust:
        applied = source_state
        target.current_state = source.current_state
        target.state_rank = source.state_rank
        target.confidence_score = source.confidence_score
        target.source_type = "CUSTOMER_PROFILE_MERGE"
        target.source_reference_type = "customer_profile"
        target.source_reference_id = source_profile.id
        target.source_trust_level = source.source_trust_level
        target.version += 1
        target.last_confirmed_at = source.last_confirmed_at
        target.last_transition_at = datetime.now(timezone.utc)

    db.add_all([source, target])
    db.add(
        CustomerProcessStateEvent(
            process_state_id=target.id,
            customer_profile_id=target_profile.id,
            organization_id=target_profile.organization_id,
            previous_state=target_state.value,
            proposed_state=source_state.value,
            applied_state=applied.value,
            decision=decision.value,
            transition_type=TransitionType.CUSTOMER_MERGE_RECONCILIATION.value,
            source_type="CUSTOMER_PROFILE_MERGE",
            source_reference_type="customer_profile",
            source_reference_id=source_profile.id,
            evidence_codes=["CUSTOMER_PROFILE_MERGE"],
            confidence_score=max(source.confidence_score, target.confidence_score),
            source_trust_level=(
                TrustLevel.HIGH.value if conflict else target.source_trust_level
            ),
            actor_user_id=actor_user_id,
            reason_codes=[
                "HIGH_TRUST_STATE_CONFLICT" if conflict else "CLEARER_TRUSTED_STATE_SELECTED"
            ],
        )
    )
    db.flush()
    process_state_logger.info(
        "process_state_merge_reconciled",
        extra={
            "process_state_mode": ProcessStateMode.FSM.value,
            "current_process_state": target_state.value,
            "proposed_process_state": source_state.value,
            "transition_decision": decision.value,
            "process_state_version": target.version,
            "source_type": "CUSTOMER_PROFILE_MERGE",
            "source_trust_level": target.source_trust_level,
            "evidence_codes": ["CUSTOMER_PROFILE_MERGE"],
            "regression_blocked": False,
            "manual_correction_used": False,
            "merge_reconciliation_required": conflict,
        },
    )
    return decision
