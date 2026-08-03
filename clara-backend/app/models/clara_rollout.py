from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ClaraRolloutPlan(Base):
    __tablename__ = "clara_rollout_plans"
    __table_args__ = (
        CheckConstraint("variant = 'mini'", name="ck_clara_rollout_plan_variant"),
        CheckConstraint("status IN ('DRAFT','READY','ACTIVE','PAUSED','STOPPED','ROLLED_BACK','COMPLETED','REJECTED')", name="ck_clara_rollout_plan_status"),
        CheckConstraint("current_stage IS NULL OR current_stage IN ('INTERNAL_SIMULATION','SHADOW','REVIEWER_CANARY_10','REVIEWER_CANARY_30','SEMI_AUTOMATIC_100')", name="ck_clara_rollout_plan_stage"),
        CheckConstraint("cohort_percentage BETWEEN 0 AND 100", name="ck_clara_rollout_plan_cohort"),
        CheckConstraint("shadow_sample_percentage BETWEEN 0 AND 100", name="ck_clara_rollout_plan_shadow_sample"),
        CheckConstraint("daily_shadow_limit >= 0 AND required_sample_size >= 0", name="ck_clara_rollout_plan_sample_limits"),
        Index("ix_clara_rollout_plan_org_status", "organization_id", "variant", "status"),
        Index(
            "uq_clara_rollout_active_org_variant",
            "organization_id",
            "variant",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
            sqlite_where=text("status = 'ACTIVE'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    variant: Mapped[str] = mapped_column(String(20), nullable=False, default="mini")
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    current_stage: Mapped[str | None] = mapped_column(String(40))
    candidate_bundle_id: Mapped[UUID] = mapped_column(ForeignKey("ai_persona_bundles.id", ondelete="RESTRICT"), index=True)
    candidate_bundle_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    certification_run_id: Mapped[UUID] = mapped_column(ForeignKey("clara_evaluation_runs.id", ondelete="RESTRICT"), index=True)
    certification_report_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    baseline_profile: Mapped[dict] = mapped_column(JSON, nullable=False)
    candidate_profile: Mapped[dict] = mapped_column(JSON, nullable=False)
    cohort_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cohort_seed: Mapped[str] = mapped_column(String(128), nullable=False)
    shadow_sample_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_shadow_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    promotion_thresholds: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    required_sample_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    paused_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    events = relationship("ClaraRolloutEvent", back_populates="plan")
    observations = relationship("ClaraRolloutObservation", back_populates="plan", cascade="all, delete-orphan")
    incidents = relationship("ClaraRolloutIncident", back_populates="plan", cascade="all, delete-orphan")


class ClaraRolloutEvent(Base):
    __tablename__ = "clara_rollout_events"
    __table_args__ = (
        CheckConstraint("event_type IN ('CREATED','READINESS_VALIDATED','ACTIVATED','STAGE_PROMOTED','PAUSED','RESUMED','STOP_CONDITION_TRIGGERED','ROLLBACK_STARTED','ROLLED_BACK','COMPLETED','REJECTED')", name="ck_clara_rollout_event_type"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("clara_rollout_plans.id", ondelete="RESTRICT"), index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reason_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    safe_metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    plan = relationship("ClaraRolloutPlan", back_populates="events")


class ClaraRolloutObservation(Base):
    __tablename__ = "clara_rollout_observations"
    __table_args__ = (
        CheckConstraint("rollout_stage IN ('INTERNAL_SIMULATION','SHADOW','REVIEWER_CANARY_10','REVIEWER_CANARY_30','SEMI_AUTOMATIC_100')", name="ck_clara_rollout_observation_stage"),
        CheckConstraint("generation_lane IN ('BASELINE','SHADOW_CANDIDATE','CANARY_CANDIDATE')", name="ck_clara_rollout_observation_lane"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("clara_rollout_plans.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    suggestion_id: Mapped[UUID | None] = mapped_column(ForeignKey("reply_suggestions.id", ondelete="SET NULL"), index=True)
    conversation_id: Mapped[UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"), index=True)
    reviewer_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    rollout_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    generation_lane: Mapped[str] = mapped_column(String(30), nullable=False)
    profile_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    bundle_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    cohort_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shadow_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    send_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    route: Mapped[str | None] = mapped_column(String(40))
    policy_action: Mapped[str | None] = mapped_column(String(40))
    process_state: Mapped[str | None] = mapped_column(String(50))
    validator_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    reason_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    input_length: Mapped[int | None] = mapped_column(Integer)
    output_length: Mapped[int | None] = mapped_column(Integer)
    normalized_edit_distance: Mapped[float | None] = mapped_column(Float)
    review_outcome: Mapped[str | None] = mapped_column(String(30))
    generation_latency_ms: Mapped[int | None] = mapped_column(Integer)
    reviewer_turnaround_ms: Mapped[int | None] = mapped_column(Integer)
    escalation_expected: Mapped[bool | None] = mapped_column(Boolean)
    escalation_selected: Mapped[bool | None] = mapped_column(Boolean)
    delivery_authorization_failed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    customer_movement: Mapped[str | None] = mapped_column(String(40))
    is_production_sample: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    output_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    plan = relationship("ClaraRolloutPlan", back_populates="observations")


class ClaraRolloutIncident(Base):
    __tablename__ = "clara_rollout_incidents"
    __table_args__ = (
        CheckConstraint("status IN ('OPEN','ACKNOWLEDGED','RESOLVED')", name="ck_clara_rollout_incident_status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("clara_rollout_plans.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    stop_condition_category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source_suggestion_id: Mapped[UUID | None] = mapped_column(ForeignKey("reply_suggestions.id", ondelete="SET NULL"))
    source_conversation_id: Mapped[UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"))
    safe_reason_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    acknowledged_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolution_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    plan = relationship("ClaraRolloutPlan", back_populates="incidents")
