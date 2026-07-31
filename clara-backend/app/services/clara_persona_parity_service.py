import json
from hashlib import sha256
from pathlib import Path

from app.core.clara_runtime_contract import (
    PersonaAuthorityMode,
    PromptSectionSource,
    SystemPlaybookSection,
)
from app.services.clara_legacy_behavior_service import (
    LEGACY_PRODUCT_FACT_INJECTION,
    build_authority_debug_metadata,
    build_legacy_product_fact_injection,
    build_runtime_context_block,
    build_technical_prompt_shell,
    compose_authority_system_prompt,
)
from app.services.clara_playbook_service import compose_clara_playbooks
from app.services.clara_reply_retry_service import compose_retry_prompt


SHADOW_REPORT_VERSION = "1.0"
SHADOW_VALIDATOR_IDS = (
    "missing_latest_intent",
    "unsupported_fixed_sensitive_number",
    "post_signup_regression",
)
REQUIRED_SYSTEM_SECTIONS = frozenset(section.value for section in SystemPlaybookSection)


def load_golden_cases(path: Path) -> list[dict]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or len(cases) != 20:
        raise ValueError("Shadow evaluator requires exactly 20 golden cases.")
    return cases


def build_shadow_report(
    golden_path: Path,
    *,
    include_safe_excerpts: bool = False,
) -> dict:
    records = []
    for case in load_golden_cases(golden_path):
        playbooks = compose_clara_playbooks(
            None,
            case.get("account_category"),
            latest_customer_intent=case.get("expected_intent"),
            desired_count=1,
            latency_profile="standard",
        )
        available_sections = frozenset(
            section.section_key
            for section in playbooks.system_sections
            if section.provenance.effective_source != PromptSectionSource.MISSING
        )
        missing_sections = sorted(REQUIRED_SYSTEM_SECTIONS - available_sections)
        product_facts = build_legacy_product_fact_injection(
            case.get("account_category")
        )
        user_prompt = (
            "RUNTIME_CASE\n"
            f"case_id={case['id']}\n"
            f"latest_customer_intent={case.get('expected_intent', 'unknown')}\n"
            "SUPPORTING_KNOWLEDGE_AND_RESPONSE_EXAMPLES\n"
            f"{playbooks.supporting_playbook}\n"
            "ACTIVE_CUSTOMER_MESSAGE\n"
            f"{case.get('customer_message', '')}"
        )

        for mode in PersonaAuthorityMode:
            authority = compose_authority_system_prompt(
                mode=mode,
                technical_shell=build_technical_prompt_shell(
                    mode=mode,
                    policy_action="shadow_only",
                    desired_count=1,
                ),
                runtime_context=build_runtime_context_block(
                    latest_customer_intent=case.get("expected_intent", "unknown"),
                    preferred_reply_register="natural",
                    answer_commitment_level="direct_answer_first",
                    variant_response_mode=case.get("account_category", "unknown"),
                    customer_has_variant_commitment=False,
                    conversation_variant_focus=None,
                    customer_has_identity_submission=False,
                    customer_has_verification_completion=False,
                ),
                product_fact_injection=product_facts,
                system_playbook=playbooks.system_playbook,
                available_system_sections=available_sections,
            )
            debug = build_authority_debug_metadata(
                authority_prompt=authority,
                user_prompt=user_prompt,
                playbook_metadata=playbooks.debug_metadata(mode),
                mode_original_value=mode.value,
                mode_was_normalized=False,
            )
            retry = compose_retry_prompt(
                authority_mode=mode,
                validator_ids=SHADOW_VALIDATOR_IDS,
                desired_count=1,
                available_system_sections=available_sections,
            )
            forbidden_leaks = _find_forbidden_leaks(mode, authority, retry)
            record = {
                "case_id": case["id"],
                "mode": mode.value,
                "required_sections_present": not missing_sections,
                "missing_sections": missing_sections,
                "legacy_fragments_present": [
                    fragment.name for fragment in authority.included_fragments
                ],
                "legacy_retry_fragments_present": list(retry.behavioral_fragment_names),
                "product_fact_injection_present": (
                    LEGACY_PRODUCT_FACT_INJECTION in authority.content
                ),
                "product_fact_hash": sha256(product_facts.encode("utf-8")).hexdigest(),
                "technical_shell_present": (
                    "TECHNICAL_OUTPUT_CONTRACT" in authority.content
                ),
                "runtime_context_present": "RUNTIME_CONTEXT" in authority.content,
                "supporting_knowledge_lower_authority": (
                    "SUPPORTING_KNOWLEDGE_AND_RESPONSE_EXAMPLES" in user_prompt
                    and "SUPPORTING_KNOWLEDGE_AND_RESPONSE_EXAMPLES"
                    not in authority.content
                ),
                "retry_contract_present": ("RETRY_TECHNICAL_CONTRACT" in retry.content),
                "forbidden_authority_leakage": forbidden_leaks,
                "prompt_hash": debug["prompt_content_hash"],
                "retry_prompt_hash": retry.content_hash,
                "debug_metadata_exposes_content": _metadata_exposes_content(
                    debug, authority.content, case.get("customer_message", "")
                ),
            }
            if include_safe_excerpts:
                record["safe_excerpt"] = (
                    f"{mode.value}: sections={','.join(sorted(available_sections))}; "
                    f"retry={','.join(retry.validator_ids)}"
                )[:240]
            records.append(record)

    return {
        "report_version": SHADOW_REPORT_VERSION,
        "golden_case_count": len({record["case_id"] for record in records}),
        "mode_count": len(PersonaAuthorityMode),
        "composition_count": len(records),
        "external_api_called": False,
        "database_write_performed": False,
        "records": records,
    }


def _find_forbidden_leaks(mode, authority, retry) -> list[str]:
    if mode != PersonaAuthorityMode.PERSONA:
        return []

    leaks = []
    if authority.included_fragments or authority.legacy_overlay_present:
        leaks.append("primary_legacy_fragment")
    if retry.behavioral_fragment_names or retry.legacy_behavior_present:
        leaks.append("retry_legacy_fragment")
    for marker in (
        "LEGACY_BEHAVIOR_OVERLAY",
        "APPROVED_LEGACY_COMPATIBILITY",
        "LEGACY_RETRY_COMPATIBILITY",
    ):
        if marker in authority.content or marker in retry.content:
            leaks.append(marker)
    return leaks


def _metadata_exposes_content(
    metadata: dict,
    authority_content: str,
    customer_message: str,
) -> bool:
    serialized = json.dumps(metadata, ensure_ascii=False)
    return authority_content in serialized or (
        bool(customer_message) and customer_message in serialized
    )


def render_shadow_markdown(report: dict) -> str:
    failures = sum(
        bool(record["missing_sections"])
        or bool(record["forbidden_authority_leakage"])
        or record["debug_metadata_exposes_content"]
        or not record["technical_shell_present"]
        or not record["runtime_context_present"]
        or not record["product_fact_injection_present"]
        or not record["retry_contract_present"]
        or not record["supporting_knowledge_lower_authority"]
        for record in report["records"]
    )
    lines = [
        "# Clara Persona Parity Shadow Report",
        "",
        f"- Report version: {report['report_version']}",
        f"- Golden cases: {report['golden_case_count']}",
        f"- Modes: {report['mode_count']}",
        f"- Compositions: {report['composition_count']}",
        f"- Failed structural inspections: {failures}",
        "- External API called: false",
        "- Database write performed: false",
        "",
        "| Case | Mode | Sections | Legacy | Retry legacy | Leaks |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for record in report["records"]:
        lines.append(
            f"| {record['case_id']} | {record['mode']} | "
            f"{'ok' if record['required_sections_present'] else 'missing'} | "
            f"{len(record['legacy_fragments_present'])} | "
            f"{len(record['legacy_retry_fragments_present'])} | "
            f"{len(record['forbidden_authority_leakage'])} |"
        )
    return "\n".join(lines) + "\n"
