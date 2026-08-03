from dataclasses import dataclass

from app.models.ai_extraction import AIExtraction


@dataclass(frozen=True)
class PolicyDecision:
    action_mode: str
    reasons: list[str]


def decide_reply_action(extraction: AIExtraction) -> PolicyDecision:
    reasons: list[str] = []

    if extraction.risk_level == "high":
        reasons.append("Risk level high: wajib eskalasi ke sales/supervisor.")
        return PolicyDecision(
            action_mode="escalate_to_human",
            reasons=reasons,
        )

    if extraction.risk_level == "medium":
        reasons.append("Risk level medium: balasan butuh approval sales.")
        return PolicyDecision(
            action_mode="human_approval_required",
            reasons=reasons,
        )

    if extraction.confidence_score < 0.85:
        reasons.append("Confidence score di bawah 0.85: butuh approval sales.")
        return PolicyDecision(
            action_mode="human_approval_required",
            reasons=reasons,
        )

    if extraction.pipeline_stage in {"closing", "negotiation", "won"}:
        reasons.append("Stage sensitif terkait closing/negosiasi: butuh approval sales.")
        return PolicyDecision(
            action_mode="human_approval_required",
            reasons=reasons,
        )

    reasons.append("Low risk dan confidence tinggi: aman untuk auto draft.")
    return PolicyDecision(
        action_mode="auto_draft_only",
        reasons=reasons,
    )