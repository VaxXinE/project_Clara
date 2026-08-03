from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ClaraEvaluationRun(Base):
    __tablename__ = "clara_evaluation_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','RUNNING','AUTOMATED_PASS','AUTOMATED_FAIL','HUMAN_REVIEW_PENDING','CERTIFIED','REJECTED','SUPERSEDED','ERROR')",
            name="ck_clara_evaluation_runs_status",
        ),
        Index("ix_clara_evaluation_runs_bundle_status", "persona_bundle_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    persona_bundle_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_persona_bundles.id", ondelete="RESTRICT"), index=True
    )
    persona_bundle_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    bundle_section_metadata: Mapped[dict] = mapped_column(JSON, nullable=False)
    variant: Mapped[str] = mapped_column(String(20), nullable=False, default="mini")
    dataset_version: Mapped[str] = mapped_column(String(20), nullable=False)
    dataset_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    evaluator_version: Mapped[str] = mapped_column(String(20), nullable=False)
    configuration_profile: Mapped[str] = mapped_column(String(50), nullable=False)
    configuration_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    configuration_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    automated_verdict: Mapped[str | None] = mapped_column(String(30))
    critical_failure_count: Mapped[int] = mapped_column(Integer, default=0)
    review_required_count: Mapped[int] = mapped_column(Integer, default=0)
    passed_case_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_case_count: Mapped[int] = mapped_column(Integer, default=0)
    human_review_status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
    )
    certification_status: Mapped[str] = mapped_column(
        String(30), default="UNCERTIFIED", nullable=False
    )
    report_hash: Mapped[str | None] = mapped_column(String(64))
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    completed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    case_results = relationship(
        "ClaraEvaluationCaseResult", back_populates="run", cascade="all, delete-orphan"
    )
    human_reviews = relationship(
        "ClaraEvaluationHumanReview", back_populates="run", cascade="all, delete-orphan"
    )


class ClaraEvaluationCaseResult(Base):
    __tablename__ = "clara_evaluation_case_results"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_run_id", "case_id", "authority_mode", name="uq_clara_eval_case_mode"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    evaluation_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("clara_evaluation_runs.id", ondelete="CASCADE"), index=True
    )
    case_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    authority_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    output_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    automated_verdict: Mapped[str] = mapped_column(String(30), nullable=False)
    structural_match: Mapped[bool] = mapped_column(Boolean, nullable=False)
    findings: Mapped[dict] = mapped_column(JSON, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    run = relationship("ClaraEvaluationRun", back_populates="case_results")


class ClaraEvaluationHumanReview(Base):
    __tablename__ = "clara_evaluation_human_reviews"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_run_id", "case_id", "reviewer_user_id", name="uq_clara_eval_human_reviewer"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    evaluation_run_id: Mapped[UUID] = mapped_column(
        ForeignKey("clara_evaluation_runs.id", ondelete="CASCADE"), index=True
    )
    case_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    reviewer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    scores: Mapped[dict] = mapped_column(JSON, nullable=False)
    average_score: Mapped[str] = mapped_column(String(10), nullable=False)
    hard_fail: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reason_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    safe_note: Mapped[str | None] = mapped_column(Text)
    reconciliation_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="NOT_REQUIRED"
    )
    reconciled_scores: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    run = relationship("ClaraEvaluationRun", back_populates="human_reviews")
