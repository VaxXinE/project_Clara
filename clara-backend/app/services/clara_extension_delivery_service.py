from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from hashlib import sha256
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.approval_log import ApprovalLog
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.extension_delivery import (
    ExtensionDeliveryAuthorization,
    ExtensionDeliveryEvent,
)
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.schemas.sent_message_schema import MarkReplySentRequest
from app.services.clara_policy_enforcement_service import (
    ClaraEnforcementError,
    ReviewerRequirement,
    assert_no_critical_safety_violation,
    assert_user_can_review_requirement,
    reviewer_requirement_for_suggestion,
)
from app.services.clara_rollout_service import (
    ClaraRolloutError,
    assert_rollout_suggestion_sendable,
    hard_stop_candidate_suggestion,
)
from app.services.sent_message_service import (
    SentMessageError,
    mark_reply_suggestion_as_sent,
)


CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION = "1.0"


class ExtensionDeliveryMode(StrEnum):
    LEGACY = "LEGACY"
    OBSERVE = "OBSERVE"
    GOVERNED = "GOVERNED"


class DeliveryPermission(StrEnum):
    ALLOW_MANUAL_SEND = "ALLOW_MANUAL_SEND"
    REQUIRE_REFRESH = "REQUIRE_REFRESH"
    REQUIRE_REVIEW = "REQUIRE_REVIEW"
    BLOCK = "BLOCK"
    ALREADY_SENT = "ALREADY_SENT"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"


class DeliveryStatus(StrEnum):
    OBSERVED = "OBSERVED"
    AUTHORIZED = "AUTHORIZED"
    CLAIMED = "CLAIMED"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"


@dataclass(frozen=True)
class DeliveryModeResolution:
    mode: ExtensionDeliveryMode
    original_value: str | None
    was_normalized: bool

    def debug_metadata(self) -> dict:
        return {
            "extension_delivery_mode": self.mode.value,
            "extension_delivery_mode_original": self.original_value,
            "extension_delivery_mode_was_normalized": self.was_normalized,
        }


@dataclass(frozen=True)
class ExtensionDeliveryDecision:
    mode: ExtensionDeliveryMode
    delivery_permission: DeliveryPermission
    reason_codes: tuple[str, ...]
    organization_id: UUID
    conversation_id: UUID
    suggestion_id: UUID
    suggestion_version: int
    approval_status: str
    policy_action: str
    reviewer_requirement: ReviewerRequirement
    snapshot_fingerprint: str
    latest_message_fingerprint: str
    active_chat_fingerprint: str
    final_text_hash: str
    previous_delivery_status: str | None
    authorization_required: bool
    authorization_id: UUID | None
    authorization_token: str | None
    authorization_expires_at: datetime | None
    decision_hash: str
    delivery_contract_version: str = CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION

    def response_data(self) -> dict:
        return {
            "mode": self.mode.value,
            "delivery_permission": self.delivery_permission.value,
            "reason_codes": list(self.reason_codes),
            "organization_id": self.organization_id,
            "conversation_id": self.conversation_id,
            "suggestion_id": self.suggestion_id,
            "suggestion_version": self.suggestion_version,
            "approval_status": self.approval_status,
            "policy_action": self.policy_action,
            "reviewer_requirement": self.reviewer_requirement.value,
            "snapshot_fingerprint": self.snapshot_fingerprint,
            "latest_message_fingerprint": self.latest_message_fingerprint,
            "active_chat_fingerprint": self.active_chat_fingerprint,
            "final_text_hash": self.final_text_hash,
            "previous_delivery_status": self.previous_delivery_status,
            "authorization_required": self.authorization_required,
            "authorization_id": self.authorization_id,
            "authorization_token": self.authorization_token,
            "authorization_expires_at": (
                self.authorization_expires_at.isoformat()
                if self.authorization_expires_at
                else None
            ),
            "decision_hash": self.decision_hash,
            "delivery_contract_version": self.delivery_contract_version,
        }

    def debug_metadata(self) -> dict:
        return {
            "extension_delivery_mode": self.mode.value,
            "delivery_permission": self.delivery_permission.value,
            "reason_codes": list(self.reason_codes),
            "suggestion_id": str(self.suggestion_id),
            "suggestion_version": self.suggestion_version,
            "conversation_id": str(self.conversation_id),
            "snapshot_match": "snapshot_mismatch" not in self.reason_codes,
            "latest_message_match": "latest_message_mismatch" not in self.reason_codes,
            "active_chat_match": "active_chat_mismatch" not in self.reason_codes,
            "final_text_hash_match": "final_text_mismatch" not in self.reason_codes,
            "authorization_status": self.previous_delivery_status,
            "decision_hash": self.decision_hash,
            "delivery_contract_version": self.delivery_contract_version,
        }


class ExtensionDeliveryError(RuntimeError):
    pass


def normalize_extension_delivery_mode(value: str | None) -> DeliveryModeResolution:
    original = value
    normalized = (value or "").strip().upper()
    if normalized in {item.value for item in ExtensionDeliveryMode}:
        return DeliveryModeResolution(
            ExtensionDeliveryMode(normalized), original, normalized != (value or "")
        )
    return DeliveryModeResolution(ExtensionDeliveryMode.LEGACY, original, True)


def hash_text(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _decision_hash(payload: dict) -> str:
    return hash_text(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def _ensure_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _event(
    authorization: ExtensionDeliveryAuthorization,
    *,
    actor_user_id: UUID,
    event_type: str,
    previous_status: str | None,
    new_status: str,
    reason_codes: tuple[str, ...] = (),
    safe_metadata: dict | None = None,
) -> ExtensionDeliveryEvent:
    fingerprint = _decision_hash(
        {
            "authorization_id": str(authorization.id),
            "event_type": event_type,
            "new_status": new_status,
            "version": authorization.version,
        }
    )
    return ExtensionDeliveryEvent(
        authorization_id=authorization.id,
        organization_id=authorization.organization_id,
        conversation_id=authorization.conversation_id,
        reply_suggestion_id=authorization.reply_suggestion_id,
        event_type=event_type,
        previous_status=previous_status,
        new_status=new_status,
        actor_user_id=actor_user_id,
        reason_codes=list(reason_codes),
        event_fingerprint=fingerprint,
        safe_metadata=safe_metadata or {},
    )


def _latest_delivery(
    db: Session, suggestion_id: UUID
) -> ExtensionDeliveryAuthorization | None:
    return db.scalars(
        select(ExtensionDeliveryAuthorization)
        .where(ExtensionDeliveryAuthorization.reply_suggestion_id == suggestion_id)
        .order_by(ExtensionDeliveryAuthorization.created_at.desc())
    ).first()


def _approved_by_authorized_reviewer(
    db: Session,
    suggestion: ReplySuggestion,
    requirement: ReviewerRequirement,
) -> bool:
    audit = db.scalars(
        select(AuditLog)
        .where(AuditLog.action == "reply_suggestion.approve")
        .where(AuditLog.resource_id == str(suggestion.id))
        .order_by(AuditLog.created_at.desc())
    ).first()
    if audit is None:
        return False
    try:
        assert_user_can_review_requirement(audit.actor_role, requirement)
    except ClaraEnforcementError:
        return False
    return True


def _build_decision(
    *,
    mode: ExtensionDeliveryMode,
    permission: DeliveryPermission,
    reasons: tuple[str, ...],
    user: User,
    suggestion: ReplySuggestion,
    requirement: ReviewerRequirement,
    snapshot_fingerprint: str,
    latest_message_fingerprint: str,
    active_chat_fingerprint: str,
    final_text_hash: str,
    previous_status: str | None = None,
    authorization: ExtensionDeliveryAuthorization | None = None,
    raw_token: str | None = None,
) -> ExtensionDeliveryDecision:
    if user.organization_id is None:
        raise ExtensionDeliveryError("User has no organization assigned.")
    payload = {
        "mode": mode.value,
        "permission": permission.value,
        "reasons": reasons,
        "organization_id": str(user.organization_id),
        "conversation_id": str(suggestion.conversation_id),
        "suggestion_id": str(suggestion.id),
        "suggestion_version": suggestion.version,
        "approval_status": suggestion.approval_status,
        "policy_action": suggestion.action_mode,
        "reviewer_requirement": requirement.value,
        "snapshot_fingerprint": snapshot_fingerprint,
        "latest_message_fingerprint": latest_message_fingerprint,
        "active_chat_fingerprint": active_chat_fingerprint,
        "final_text_hash": final_text_hash,
        "previous_delivery_status": previous_status,
        "contract_version": CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
    }
    return ExtensionDeliveryDecision(
        mode=mode,
        delivery_permission=permission,
        reason_codes=reasons,
        organization_id=user.organization_id,
        conversation_id=suggestion.conversation_id,
        suggestion_id=suggestion.id,
        suggestion_version=suggestion.version,
        approval_status=suggestion.approval_status,
        policy_action=suggestion.action_mode,
        reviewer_requirement=requirement,
        snapshot_fingerprint=snapshot_fingerprint,
        latest_message_fingerprint=latest_message_fingerprint,
        active_chat_fingerprint=active_chat_fingerprint,
        final_text_hash=final_text_hash,
        previous_delivery_status=previous_status,
        authorization_required=mode == ExtensionDeliveryMode.GOVERNED,
        authorization_id=authorization.id if authorization else None,
        authorization_token=raw_token,
        authorization_expires_at=authorization.expires_at if authorization else None,
        decision_hash=_decision_hash(payload),
    )


def authorize_extension_delivery(
    db: Session,
    *,
    channel: str,
    current_user: User,
    suggestion: ReplySuggestion,
    final_reply_text: str,
    snapshot_fingerprint: str,
    latest_message_fingerprint: str,
    active_chat_fingerprint: str,
    suggestion_version: int,
    idempotency_key: str,
    explicit_human_action: bool,
) -> ExtensionDeliveryDecision:
    rollout_metadata = suggestion.persona_bundle_metadata or {}
    mode = normalize_extension_delivery_mode(
        rollout_metadata.get("rollout_extension_delivery_mode")
        or settings.clara_extension_delivery_mode
    ).mode
    normalized_text = final_reply_text.strip()
    final_hash = hash_text(normalized_text)
    idempotency_hash = hash_text(idempotency_key)
    requirement = reviewer_requirement_for_suggestion(
        action_mode=suggestion.action_mode,
        risk_level=suggestion.risk_level,
        policy_reasons=tuple(suggestion.policy_reasons),
    )
    if current_user.organization_id is None:
        raise ExtensionDeliveryError("User has no organization assigned.")
    conversation = db.get(Conversation, suggestion.conversation_id)
    if conversation is None or conversation.organization_id != current_user.organization_id:
        raise ExtensionDeliveryError("Conversation is not available.")
    if not explicit_human_action:
        candidate_stopped = hard_stop_candidate_suggestion(
            db,
            suggestion=suggestion,
            category="AUTOMATIC_CUSTOMER_SEND",
            reason_codes=("MISSING_EXPLICIT_HUMAN_ACTION",),
            actor=current_user,
        )
        if candidate_stopped:
            raise ExtensionDeliveryError("Explicit human action is required for candidate delivery.")
    try:
        assert_rollout_suggestion_sendable(db, suggestion)
    except ClaraRolloutError as exc:
        raise ExtensionDeliveryError(str(exc)) from exc

    existing_sent = db.scalars(
        select(SentMessage).where(SentMessage.reply_suggestion_id == suggestion.id)
    ).first()
    latest_delivery = _latest_delivery(db, suggestion.id)
    previous_status = latest_delivery.status if latest_delivery else None
    if (
        latest_delivery
        and latest_delivery.status == DeliveryStatus.AUTHORIZED.value
        and latest_delivery.expires_at
        and _ensure_utc(latest_delivery.expires_at) <= datetime.now(timezone.utc)
    ):
        latest_delivery.status = DeliveryStatus.EXPIRED.value
        latest_delivery.version += 1
        db.add(
            _event(
                latest_delivery,
                actor_user_id=current_user.id,
                event_type=DeliveryStatus.EXPIRED.value,
                previous_status=DeliveryStatus.AUTHORIZED.value,
                new_status=DeliveryStatus.EXPIRED.value,
                reason_codes=("authorization_expired",),
            )
        )
        db.commit()
        previous_status = DeliveryStatus.EXPIRED.value

    if existing_sent or previous_status == DeliveryStatus.SENT.value:
        return _build_decision(
            mode=mode,
            permission=DeliveryPermission.ALREADY_SENT,
            reasons=("already_sent",),
            user=current_user,
            suggestion=suggestion,
            requirement=requirement,
            snapshot_fingerprint=snapshot_fingerprint,
            latest_message_fingerprint=latest_message_fingerprint,
            active_chat_fingerprint=active_chat_fingerprint,
            final_text_hash=final_hash,
            previous_status=previous_status,
        )

    if mode == ExtensionDeliveryMode.LEGACY:
        return _build_decision(
            mode=mode,
            permission=DeliveryPermission.ALLOW_MANUAL_SEND,
            reasons=("legacy_compatibility",),
            user=current_user,
            suggestion=suggestion,
            requirement=requirement,
            snapshot_fingerprint=snapshot_fingerprint,
            latest_message_fingerprint=latest_message_fingerprint,
            active_chat_fingerprint=active_chat_fingerprint,
            final_text_hash=final_hash,
            previous_status=previous_status,
        )

    prior_idempotent = db.scalars(
        select(ExtensionDeliveryAuthorization).where(
            ExtensionDeliveryAuthorization.organization_id == current_user.organization_id,
            ExtensionDeliveryAuthorization.user_id == current_user.id,
            ExtensionDeliveryAuthorization.idempotency_key == idempotency_hash,
        )
    ).first()
    if prior_idempotent:
        if prior_idempotent.reply_suggestion_id != suggestion.id:
            raise ExtensionDeliveryError("Idempotency key belongs to another delivery.")
        replay_permission = (
            DeliveryPermission.ALLOW_MANUAL_SEND
            if prior_idempotent.status
            in {DeliveryStatus.OBSERVED.value, DeliveryStatus.AUTHORIZED.value}
            else DeliveryPermission.RECONCILIATION_REQUIRED
        )
        return _build_decision(
            mode=mode,
            permission=replay_permission,
            reasons=("authorization_request_replayed",),
            user=current_user,
            suggestion=suggestion,
            requirement=requirement,
            snapshot_fingerprint=snapshot_fingerprint,
            latest_message_fingerprint=latest_message_fingerprint,
            active_chat_fingerprint=active_chat_fingerprint,
            final_text_hash=final_hash,
            previous_status=prior_idempotent.status,
            authorization=prior_idempotent,
            raw_token=None,
        )

    governed_permission = DeliveryPermission.ALLOW_MANUAL_SEND
    reasons: tuple[str, ...] = ("governed_checks_passed",)
    generation_identity = (
        suggestion.extension_snapshot_fingerprint,
        suggestion.extension_latest_message_fingerprint,
        suggestion.extension_active_chat_fingerprint,
    )
    request_identity = (
        snapshot_fingerprint,
        latest_message_fingerprint,
        active_chat_fingerprint,
    )
    mismatch_reasons = tuple(
        reason
        for expected, actual, reason in zip(
            generation_identity,
            request_identity,
            ("snapshot_mismatch", "latest_message_mismatch", "active_chat_mismatch"),
            strict=True,
        )
        if not expected or expected != actual
    )
    if "active_chat_mismatch" in mismatch_reasons:
        hard_stop_candidate_suggestion(
            db,
            suggestion=suggestion,
            category="WRONG_ACTIVE_CHAT_DELIVERY",
            reason_codes=("ACTIVE_CHAT_FINGERPRINT_MISMATCH",),
            actor=current_user,
        )
    if mismatch_reasons or suggestion.version != suggestion_version:
        governed_permission = DeliveryPermission.REQUIRE_REFRESH
        reasons = mismatch_reasons + (
            (() if suggestion.version == suggestion_version else ("suggestion_version_outdated",))
        )
    elif previous_status in {
        DeliveryStatus.AUTHORIZED.value,
        DeliveryStatus.CLAIMED.value,
        DeliveryStatus.SENDING.value,
        DeliveryStatus.UNKNOWN.value,
        DeliveryStatus.RECONCILIATION_REQUIRED.value,
    }:
        governed_permission = (
            DeliveryPermission.REQUIRE_REFRESH
            if previous_status == DeliveryStatus.AUTHORIZED.value
            else DeliveryPermission.RECONCILIATION_REQUIRED
        )
        reasons = (
            ("active_authorization_exists",)
            if previous_status == DeliveryStatus.AUTHORIZED.value
            else ("previous_delivery_unresolved",)
        )
    elif suggestion.approval_status in {"blocked", "rejected"} or suggestion.action_mode.upper() == "BLOCK":
        hard_stop_candidate_suggestion(
            db,
            suggestion=suggestion,
            category="BLOCKED_POLICY_SENDABLE",
            reason_codes=("BLOCKED_SUGGESTION_DELIVERY_ATTEMPT",),
            actor=current_user,
        )
        governed_permission = DeliveryPermission.BLOCK
        reasons = ("suggestion_blocked",)
    else:
        try:
            assert_no_critical_safety_violation(normalized_text)
        except ClaraEnforcementError:
            governed_permission = DeliveryPermission.BLOCK
            reasons = ("critical_validation_failed",)

    if governed_permission == DeliveryPermission.ALLOW_MANUAL_SEND:
        if suggestion.approval_status == "pending":
            if requirement != ReviewerRequirement.SALES_REVIEW or not explicit_human_action:
                governed_permission = DeliveryPermission.REQUIRE_REVIEW
                reasons = ("review_required",)
            elif mode == ExtensionDeliveryMode.OBSERVE:
                reasons = ("would_explicitly_approve",)
            else:
                try:
                    assert_user_can_review_requirement(current_user.role, requirement)
                except ClaraEnforcementError:
                    governed_permission = DeliveryPermission.REQUIRE_REVIEW
                    reasons = ("reviewer_role_not_authorized",)
                else:
                    suggestion.selected_reply_text = normalized_text
                    suggestion.final_reply_text = normalized_text
                    suggestion.approval_status = "approved"
                    suggestion.version += 1
                    db.add(
                        ApprovalLog(
                            reply_suggestion_id=suggestion.id,
                            reviewer_name=current_user.name,
                            action="approved_explicit_extension",
                            before_text=None,
                            after_text=normalized_text,
                            reason="explicit_approve_and_send",
                        )
                    )
                    db.flush()
        elif suggestion.approval_status != "approved":
            governed_permission = DeliveryPermission.BLOCK
            reasons = ("invalid_approval_status",)
        elif hash_text((suggestion.final_reply_text or "").strip()) != final_hash:
            governed_permission = DeliveryPermission.REQUIRE_REVIEW
            reasons = ("final_text_mismatch",)
        elif requirement != ReviewerRequirement.SALES_REVIEW and not _approved_by_authorized_reviewer(
            db, suggestion, requirement
        ):
            governed_permission = DeliveryPermission.REQUIRE_REVIEW
            reasons = ("authorized_reviewer_evidence_missing",)

    if mode == ExtensionDeliveryMode.OBSERVE or governed_permission != DeliveryPermission.ALLOW_MANUAL_SEND:
        observed = ExtensionDeliveryAuthorization(
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            conversation_id=suggestion.conversation_id,
            reply_suggestion_id=suggestion.id,
            channel=channel,
            status=DeliveryStatus.OBSERVED.value,
            snapshot_fingerprint=snapshot_fingerprint,
            latest_message_fingerprint=latest_message_fingerprint,
            active_chat_fingerprint=active_chat_fingerprint,
            final_text_hash=final_hash,
            decision_hash="pending",
            token_hash=None,
            idempotency_key=idempotency_hash,
            suggestion_version=suggestion.version,
            expires_at=None,
        )
        db.add(observed)
        db.flush()
        decision = _build_decision(
            mode=mode,
            permission=(
                DeliveryPermission.ALLOW_MANUAL_SEND
                if mode == ExtensionDeliveryMode.OBSERVE
                else governed_permission
            ),
            reasons=(("observe_only",) + reasons if mode == ExtensionDeliveryMode.OBSERVE else reasons),
            user=current_user,
            suggestion=suggestion,
            requirement=requirement,
            snapshot_fingerprint=snapshot_fingerprint,
            latest_message_fingerprint=latest_message_fingerprint,
            active_chat_fingerprint=active_chat_fingerprint,
            final_text_hash=final_hash,
            previous_status=previous_status,
            authorization=observed,
        )
        observed.decision_hash = decision.decision_hash
        db.add(
            _event(
                observed,
                actor_user_id=current_user.id,
                event_type=DeliveryStatus.OBSERVED.value,
                previous_status=previous_status,
                new_status=DeliveryStatus.OBSERVED.value,
                reason_codes=decision.reason_codes,
            )
        )
        db.commit()
        return decision

    raw_token = secrets.token_urlsafe(32)
    ttl = max(15, min(300, settings.clara_extension_delivery_authorization_ttl_seconds))
    authorization = ExtensionDeliveryAuthorization(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        conversation_id=suggestion.conversation_id,
        reply_suggestion_id=suggestion.id,
        channel=channel,
        status=DeliveryStatus.AUTHORIZED.value,
        snapshot_fingerprint=snapshot_fingerprint,
        latest_message_fingerprint=latest_message_fingerprint,
        active_chat_fingerprint=active_chat_fingerprint,
        final_text_hash=final_hash,
        decision_hash="pending",
        token_hash=hash_text(raw_token),
        idempotency_key=idempotency_hash,
        suggestion_version=suggestion.version,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl),
    )
    db.add(authorization)
    db.flush()
    decision = _build_decision(
        mode=mode,
        permission=DeliveryPermission.ALLOW_MANUAL_SEND,
        reasons=reasons,
        user=current_user,
        suggestion=suggestion,
        requirement=requirement,
        snapshot_fingerprint=snapshot_fingerprint,
        latest_message_fingerprint=latest_message_fingerprint,
        active_chat_fingerprint=active_chat_fingerprint,
        final_text_hash=final_hash,
        previous_status=previous_status,
        authorization=authorization,
        raw_token=raw_token,
    )
    authorization.decision_hash = decision.decision_hash
    db.add(
        _event(
            authorization,
            actor_user_id=current_user.id,
            event_type=DeliveryStatus.AUTHORIZED.value,
            previous_status=previous_status,
            new_status=DeliveryStatus.AUTHORIZED.value,
            reason_codes=reasons,
        )
    )
    db.commit()
    return decision


def claim_extension_delivery(
    db: Session,
    *,
    authorization_id: UUID,
    current_user: User,
    authorization_token: str,
    conversation_id: UUID,
    suggestion_id: UUID,
    snapshot_fingerprint: str,
    latest_message_fingerprint: str,
    active_chat_fingerprint: str,
    final_text_hash: str,
) -> ExtensionDeliveryAuthorization:
    if current_user.organization_id is None:
        raise ExtensionDeliveryError("User has no organization assigned.")
    authorization = db.get(ExtensionDeliveryAuthorization, authorization_id)
    if authorization is None or authorization.organization_id != current_user.organization_id:
        raise ExtensionDeliveryError("Delivery authorization not found.")
    if authorization.user_id != current_user.id:
        raise ExtensionDeliveryError("Delivery authorization belongs to another user.")
    if authorization.status in {DeliveryStatus.SENT.value, DeliveryStatus.CLAIMED.value, DeliveryStatus.SENDING.value}:
        raise ExtensionDeliveryError("ALREADY_CLAIMED")
    if authorization.status != DeliveryStatus.AUTHORIZED.value:
        raise ExtensionDeliveryError("Delivery authorization is not claimable.")
    if authorization.expires_at is None or _ensure_utc(authorization.expires_at) <= datetime.now(timezone.utc):
        authorization.status = DeliveryStatus.EXPIRED.value
        authorization.version += 1
        db.add(
            _event(
                authorization,
                actor_user_id=current_user.id,
                event_type=DeliveryStatus.EXPIRED.value,
                previous_status=DeliveryStatus.AUTHORIZED.value,
                new_status=DeliveryStatus.EXPIRED.value,
                reason_codes=("authorization_expired",),
            )
        )
        db.commit()
        raise ExtensionDeliveryError("Delivery authorization expired.")
    bindings_match = (
        authorization.token_hash == hash_text(authorization_token)
        and authorization.conversation_id == conversation_id
        and authorization.reply_suggestion_id == suggestion_id
        and authorization.snapshot_fingerprint == snapshot_fingerprint
        and authorization.latest_message_fingerprint == latest_message_fingerprint
        and authorization.active_chat_fingerprint == active_chat_fingerprint
        and authorization.final_text_hash == final_text_hash
    )
    if not bindings_match:
        raise ExtensionDeliveryError("Delivery authorization binding mismatch.")

    previous_version = authorization.version
    claimed_at = datetime.now(timezone.utc)
    result = db.execute(
        update(ExtensionDeliveryAuthorization)
        .where(
            ExtensionDeliveryAuthorization.id == authorization.id,
            ExtensionDeliveryAuthorization.status == DeliveryStatus.AUTHORIZED.value,
            ExtensionDeliveryAuthorization.version == previous_version,
        )
        .values(
            status=DeliveryStatus.SENDING.value,
            claimed_at=claimed_at,
            updated_at=claimed_at,
            version=previous_version + 1,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        raise ExtensionDeliveryError("ALREADY_CLAIMED")
    db.expire(authorization)
    db.refresh(authorization)
    db.add(
        _event(
            authorization,
            actor_user_id=current_user.id,
            event_type=DeliveryStatus.CLAIMED.value,
            previous_status=DeliveryStatus.AUTHORIZED.value,
            new_status=DeliveryStatus.CLAIMED.value,
            reason_codes=("authorization_claimed",),
        )
    )
    db.add(
        _event(
            authorization,
            actor_user_id=current_user.id,
            event_type=DeliveryStatus.SENDING.value,
            previous_status=DeliveryStatus.CLAIMED.value,
            new_status=DeliveryStatus.SENDING.value,
            reason_codes=("browser_send_started",),
        )
    )
    db.commit()
    db.refresh(authorization)
    return authorization


def reconcile_extension_delivery(
    db: Session,
    *,
    authorization_id: UUID,
    current_user: User,
    authorization_token: str,
    result_status: str,
    browser_event_id: str,
    adapter_result_code: str,
    active_chat_fingerprint: str,
    latest_message_fingerprint: str,
    final_text_hash: str,
) -> tuple[ExtensionDeliveryAuthorization, SentMessage | None, bool]:
    if current_user.organization_id is None:
        raise ExtensionDeliveryError("User has no organization assigned.")
    authorization = db.get(ExtensionDeliveryAuthorization, authorization_id)
    if (
        authorization is None
        or authorization.organization_id != current_user.organization_id
        or authorization.user_id != current_user.id
    ):
        raise ExtensionDeliveryError("Delivery authorization not found.")
    if authorization.token_hash != hash_text(authorization_token):
        raise ExtensionDeliveryError("Delivery authorization token is invalid.")
    if (
        authorization.active_chat_fingerprint != active_chat_fingerprint
        or authorization.latest_message_fingerprint != latest_message_fingerprint
        or authorization.final_text_hash != final_text_hash
    ):
        suggestion = db.get(ReplySuggestion, authorization.reply_suggestion_id)
        if suggestion is not None:
            hard_stop_candidate_suggestion(
                db,
                suggestion=suggestion,
                category="WRONG_ACTIVE_CHAT_DELIVERY",
                reason_codes=("DELIVERY_RESULT_BINDING_MISMATCH",),
                actor=current_user,
            )
        raise ExtensionDeliveryError("Delivery result binding mismatch.")

    browser_event_hash = hash_text(browser_event_id)
    if authorization.browser_event_hash is not None:
        if authorization.browser_event_hash != browser_event_hash:
            suggestion = db.get(ReplySuggestion, authorization.reply_suggestion_id)
            if suggestion is not None:
                hard_stop_candidate_suggestion(
                    db,
                    suggestion=suggestion,
                    category="DUPLICATE_CONFIRMED_SEND",
                    reason_codes=("CONFLICTING_BROWSER_DELIVERY_EVENT",),
                    actor=current_user,
                )
            raise ExtensionDeliveryError("Delivery result already recorded by another browser event.")
        sent = db.scalars(
            select(SentMessage).where(
                SentMessage.reply_suggestion_id == authorization.reply_suggestion_id
            )
        ).first()
        return authorization, sent, True
    if authorization.status not in {DeliveryStatus.CLAIMED.value, DeliveryStatus.SENDING.value}:
        raise ExtensionDeliveryError("Delivery authorization is not awaiting a result.")

    authorization.browser_event_hash = browser_event_hash
    previous_status = authorization.status
    sent_message: SentMessage | None = None
    if result_status == DeliveryStatus.SENT.value:
        sent_message = db.scalars(
            select(SentMessage).where(
                SentMessage.reply_suggestion_id == authorization.reply_suggestion_id
            )
        ).first()
        if sent_message is None:
            try:
                sent_message = mark_reply_suggestion_as_sent(
                    db,
                    authorization.reply_suggestion_id,
                    MarkReplySentRequest(sent_by_name=current_user.name),
                    sender_role=current_user.role,
                    send_mode="extension_governed",
                )
            except SentMessageError as exc:
                raise ExtensionDeliveryError(str(exc)) from exc
        authorization.status = DeliveryStatus.SENT.value
        reason_codes = ("browser_delivery_confirmed",)
    elif result_status == DeliveryStatus.FAILED.value:
        authorization.status = DeliveryStatus.FAILED.value
        reason_codes = ("browser_delivery_failed",)
    elif result_status == DeliveryStatus.UNKNOWN.value:
        authorization.status = DeliveryStatus.RECONCILIATION_REQUIRED.value
        reason_codes = ("browser_delivery_unknown", "manual_reconciliation_required")
    else:
        raise ExtensionDeliveryError("Unsupported delivery result.")

    authorization.completed_at = datetime.now(timezone.utc)
    authorization.version += 1
    db.add(authorization)
    db.add(
        _event(
            authorization,
            actor_user_id=current_user.id,
            event_type=result_status,
            previous_status=previous_status,
            new_status=authorization.status,
            reason_codes=reason_codes,
            safe_metadata={"adapter_result_code": adapter_result_code[:80]},
        )
    )
    db.commit()
    db.refresh(authorization)
    return authorization, sent_message, False
