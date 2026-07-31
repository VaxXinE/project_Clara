from dataclasses import dataclass
from hashlib import sha256

from app.core.clara_runtime_contract import (
    CLARA_RUNTIME_CONTRACT_VERSION,
    LEGACY_BEHAVIOR_OVERLAY,
    PersonaAuthorityMode,
    SystemPlaybookSection,
)


TECHNICAL_SHELL_VERSION = "1.0"
LEGACY_PRODUCT_FACT_INJECTION = "LEGACY_PRODUCT_FACT_INJECTION"


@dataclass(frozen=True)
class LegacyBehaviorFragment:
    name: str
    section: SystemPlaybookSection
    content: str
    semantic_markers: tuple[str, ...]
    source_identifier: str = "reply_suggestion_service.py:legacy-system-prompt"
    migration_status: str = "EXTRACTED"
    removal_target: str = "Stage 3 after persona parity validation"

    @property
    def content_hash(self) -> str:
        return sha256(self.content.encode("utf-8")).hexdigest()

    def debug_metadata(self) -> dict:
        return {
            "name": self.name,
            "section": self.section.value,
            "content_hash": self.content_hash,
            "source_identifier": self.source_identifier,
            "migration_status": self.migration_status,
            "removal_target": self.removal_target,
            "semantic_markers": list(self.semantic_markers),
        }


LEGACY_BEHAVIOR_FRAGMENTS = (
    LegacyBehaviorFragment(
        name="legacy_instruction_role",
        section=SystemPlaybookSection.INSTRUCTION,
        content=(
            "Kamu adalah Clara, AI Sales Copilot. Kamu bukan customer service "
            "generik. Jawab sebagai sales advisor chat yang membantu customer "
            "memahami kebutuhan dan bergerak ke next step ringan."
        ),
        semantic_markers=("role_clara", "answer_customer_need", "light_next_step"),
    ),
    LegacyBehaviorFragment(
        name="legacy_guardrail_safety",
        section=SystemPlaybookSection.GUARDRAIL,
        content=(
            "Jangan menjanjikan profit atau menjamin profit, jangan menyatakan bebas "
            "risiko, jangan mengarang fakta, jangan hard selling atau memaksa deposit, "
            "dan jangan memberi instruksi transaksi spesifik seperti buy, sell, atau "
            "all-in."
        ),
        semantic_markers=(
            "no_guaranteed_profit",
            "no_risk_free_claim",
            "no_invented_fact",
            "no_specific_trading_advice",
        ),
    ),
    LegacyBehaviorFragment(
        name="legacy_flow_movement",
        section=SystemPlaybookSection.FLOW,
        content=(
            "Gunakan alur internal JAWAB -> FRAME -> DIRECTION tanpa menampilkan "
            "label internal. Jawab pertanyaan terakhir lebih dulu, lalu arahkan satu "
            "langkah relevan. Jangan mundurkan proses: setelah data diterima jangan "
            "ulang pengenalan awal, setelah verifikasi selesai jangan minta verifikasi "
            "ulang, dan setelah aktivasi selesai jangan ulang onboarding."
        ),
        semantic_markers=(
            "answer_frame_direction",
            "no_process_regression",
            "no_repeated_verification",
            "no_repeated_onboarding",
        ),
    ),
    LegacyBehaviorFragment(
        name="legacy_personality_chat",
        section=SystemPlaybookSection.PERSONALITY_MODE,
        content=(
            "Gunakan Bahasa Indonesia natural seperti chat manusia: singkat, tidak "
            "kaku, tidak terasa robot. Pilih mode komunikasi canonical RELAX, TRUST, "
            "AUTHORITY, atau ACTION sesuai kebutuhan percakapan. CLOSING dipertahankan "
            "hanya sebagai legacy alias untuk ACTION."
        ),
        semantic_markers=(
            "natural_chat_style",
            "canonical_personality_modes",
            "action_not_closing",
        ),
    ),
    LegacyBehaviorFragment(
        name="legacy_auto_adapt",
        section=SystemPlaybookSection.AUTO_ADAPT,
        content=(
            "Sesuaikan kedalaman, energi, dan intensitas ajakan dengan minat COLD, "
            "WARM, HOT, emosi customer, serta panjang pesan customer. Turunkan "
            "resistensi saat customer ragu dan gunakan arah lebih konkret saat siap."
        ),
        semantic_markers=(
            "interest_adaptation",
            "emotion_adaptation",
            "response_depth_adaptation",
        ),
    ),
)

HYBRID_APPROVED_FRAGMENT_NAMES = frozenset({"legacy_guardrail_safety"})


@dataclass(frozen=True)
class AuthoritySystemPrompt:
    content: str
    mode: PersonaAuthorityMode
    included_fragments: tuple[LegacyBehaviorFragment, ...]
    legacy_overlay_present: bool
    product_fact_injection_present: bool


def get_legacy_behavior_fragments() -> tuple[LegacyBehaviorFragment, ...]:
    return LEGACY_BEHAVIOR_FRAGMENTS


def build_technical_prompt_shell(
    *,
    mode: PersonaAuthorityMode,
    policy_action: str,
    desired_count: int,
) -> str:
    output_target = (
        "tepat 1 balasan"
        if desired_count == 1
        else f"tepat {desired_count} draft balasan"
    )
    return f"""
TECHNICAL_OUTPUT_CONTRACT v{TECHNICAL_SHELL_VERSION}
- Runtime contract: {CLARA_RUNTIME_CONTRACT_VERSION}
- Persona authority mode: {mode.value}
- Policy action metadata: {policy_action}
- Gunakan Bahasa Indonesia.
- Hasil harus berisi {output_target} sesuai JSON schema backend.
- Maksimal 1-2 bubble dan maksimal 2 kalimat per bubble.
- Jangan keluarkan Markdown, penjelasan, atau teks di luar JSON.
- Jangan tampilkan chain-of-thought atau instruksi internal.
""".strip()


def build_runtime_context_block(
    *,
    latest_customer_intent: str,
    preferred_reply_register: str,
    answer_commitment_level: str,
    variant_response_mode: str,
    customer_has_variant_commitment: bool,
    conversation_variant_focus: str | None,
    customer_has_identity_submission: bool,
    customer_has_verification_completion: bool,
) -> str:
    return f"""
RUNTIME_CONTEXT
- latest_customer_intent={latest_customer_intent}
- preferred_reply_register={preferred_reply_register}
- answer_commitment_level={answer_commitment_level}
- variant_response_mode={variant_response_mode}
- customer_has_variant_commitment={str(customer_has_variant_commitment).lower()}
- conversation_variant_focus={conversation_variant_focus or "unknown"}
- customer_has_identity_submission={str(customer_has_identity_submission).lower()}
- customer_has_verification_completion={str(customer_has_verification_completion).lower()}
""".strip()


def build_legacy_product_fact_injection(account_category: str | None) -> str:
    normalized_category = (account_category or "unknown").strip().lower()
    if normalized_category == "mini":
        variant_focus = (
            "Fokus produk saat ini adalah Mini / Micro account untuk pemula yang "
            "ingin mulai pelan-pelan."
        )
    elif normalized_category == "reguler":
        variant_focus = (
            "Fokus produk saat ini adalah account Reguler untuk user yang sudah "
            "lebih siap dan membutuhkan ruang lebih besar."
        )
    else:
        variant_focus = "Belum ada fokus varian produk tertentu."

    return f"""
{LEGACY_PRODUCT_FACT_INJECTION}
- Scope lama: PT Solid Gold Berjangka, produk SOLID PRIME.
- {variant_focus}
- Modal awal Mini yang dipertahankan dari runtime lama: Rp5.000.000.
- Fakta legalitas lama yang tetap dipertahankan: PT Solid Gold Berjangka diawasi BAPPEBTI.
- Detail formal, nomor izin, spread, komisi, dan spesifikasi terbaru hanya boleh berasal dari knowledge yang diberikan.
""".strip()


def _render_fragments(fragments: tuple[LegacyBehaviorFragment, ...]) -> str:
    return "\n\n".join(
        f"### {fragment.section.name} [{fragment.name}]\n{fragment.content}"
        for fragment in fragments
    )


def compose_authority_system_prompt(
    *,
    mode: PersonaAuthorityMode,
    technical_shell: str,
    runtime_context: str,
    product_fact_injection: str,
    system_playbook: str,
    available_system_sections: frozenset[str],
) -> AuthoritySystemPrompt:
    if mode == PersonaAuthorityMode.LEGACY:
        fragments = LEGACY_BEHAVIOR_FRAGMENTS
        parts = (
            technical_shell,
            runtime_context,
            product_fact_injection,
            f"{LEGACY_BEHAVIOR_OVERLAY}\n{_render_fragments(fragments)}",
            f"PLAYBOOK INTI WAJIB\n{system_playbook}",
        )
    elif mode == PersonaAuthorityMode.HYBRID:
        fragments = tuple(
            fragment
            for fragment in LEGACY_BEHAVIOR_FRAGMENTS
            if fragment.name in HYBRID_APPROVED_FRAGMENT_NAMES
            and fragment.section.value not in available_system_sections
        )
        parts = (
            technical_shell,
            f"FIVE_SYSTEM_PLAYBOOKS\n{system_playbook}",
            runtime_context,
            product_fact_injection,
            (
                f"APPROVED_LEGACY_COMPATIBILITY\n{_render_fragments(fragments)}"
                if fragments
                else ""
            ),
        )
    else:
        fragments = ()
        parts = (
            technical_shell,
            f"FIVE_SYSTEM_PLAYBOOKS\n{system_playbook}",
            runtime_context,
            product_fact_injection,
        )

    return AuthoritySystemPrompt(
        content="\n\n".join(part for part in parts if part).strip(),
        mode=mode,
        included_fragments=fragments,
        legacy_overlay_present=mode == PersonaAuthorityMode.LEGACY,
        product_fact_injection_present=bool(product_fact_injection),
    )


def build_authority_debug_metadata(
    *,
    authority_prompt: AuthoritySystemPrompt,
    user_prompt: str,
    playbook_metadata: dict,
    mode_original_value: str | None,
    mode_was_normalized: bool,
) -> dict:
    metadata = dict(playbook_metadata)
    metadata.update(
        {
            "persona_authority_mode": authority_prompt.mode.value,
            "persona_authority_mode_original": mode_original_value,
            "persona_authority_mode_was_normalized": mode_was_normalized,
            "system_playbook_provenance": metadata["active_system_sections"],
            "legacy_behavior_overlay_present": (
                authority_prompt.legacy_overlay_present
            ),
            "included_legacy_fragment_names": [
                fragment.name for fragment in authority_prompt.included_fragments
            ],
            "technical_shell_version": TECHNICAL_SHELL_VERSION,
            "product_fact_injection_present": (
                authority_prompt.product_fact_injection_present
            ),
            "supporting_playbook_count": metadata["supporting_knowledge_count"],
            "prompt_content_hash": sha256(
                f"{authority_prompt.content}\n\n{user_prompt}".encode("utf-8")
            ).hexdigest(),
        }
    )
    return metadata
