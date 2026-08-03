# Clara Five-Prompt Publication Runbook

## Create and review a Mini candidate

1. Sign in as superadmin and open AI Persona Clara.
2. Select Mini and click **Import current effective**.
3. Review Guardrail first, then Instruction, Conversation Flow, Personality,
   and Auto Adapt.
4. Save edited text as a new section draft. The UI selects that immutable
   version into the candidate; it does not publish it.
5. Confirm every section source, version, character count, timestamp, and hash.

## Validate, preview, and publish

1. Click **Validate bundle** and resolve every blocker.
2. Review every warning. Product/policy warnings require business or compliance
   confirmation; deterministic lint is not a semantic guarantee.
3. Review section diff and click **Preview exact bundle**.
4. In publication confirmation, verify all five versions, changed sections,
   warnings, current hash, and candidate hash.
5. Publish once. A stale current hash requires reload and revalidation.
6. Verify the effective endpoint and a new suggestion's safe bundle provenance.

## Rollback and emergency recovery

1. Select an archived complete bundle.
2. Review its recorded warnings and provenance.
3. Choose **Rollback whole bundle**; never roll back one active section.
4. Verify a new bundle version is published and the former current bundle is
   archived.

If runtime reports `INVALID_PUBLISHED_BUNDLE_FAIL_CLOSED`, stop publication,
preserve logs/hashes, and restore a verified historical complete bundle through
the rollback workflow. Do not edit database statuses manually.

Keep `CLARA_PERSONA_AUTHORITY_MODE=LEGACY` until a later controlled rollout.
Do not activate `HYBRID`, `PERSONA`, policy enforcement, product registry,
process FSM, routed service handling, or governed extension delivery as part of
this runbook.
## Stage 8 pre-publication evidence

After validation and preview, create and complete a Golden V2 run for the exact candidate. Confirm automated PASS, all PERSONA human reviews, dual critical-case reviews, reconciliations, `CERTIFIED` status, and bundle hash match. The backend rejects publication without this evidence even if the UI is bypassed. Certification is not production activation; publication remains a separate confirmed action. If any section changes, create a new run.
