# Clara Golden V2 Evaluation Runbook

## Fixture and candidate workflow

1. Validate an unpublished Mini candidate in the Superadmin Mini Bundle Workspace.
2. Create a `GOVERNED_OFFLINE_SIMULATION` evaluation run. Confirm bundle and section hashes.
3. Run `uv run python scripts/evaluate_clara_golden_v2.py` from the repository root for the offline 30-case × 3-mode fixture. It performs no external call. JSON, Markdown, and the synthetic human-review pack are written under `tmp/golden-v2/`.
4. External outputs are never requested by default. Only use the explicit controlled option described by `--help`, with synthetic inputs and a reviewed provider adapter; never supply credentials in arguments or artifacts.
5. Inspect safe case reason codes, route/policy/state/handoff matches, hard-fail IDs, and report hashes. Do not treat deterministic PASS as semantic proof.

## Human review and certification

Review every PERSONA output on the ten 1–5 dimensions. Complaint and adversarial cases need two different reviewers. A difference greater than one needs a third, non-conflicting reviewer to reconcile. A human hard fail rejects regardless of average; critical-category compliance safety must be 5.

Certify only after automated PASS and complete review. Reject unsafe evidence. Certification does not activate production. A newer unfinished run supersedes older unfinished evidence; a section, bundle, dataset, evaluator, or contract hash change requires new evidence. Historical rollback may reuse an exact, still-supported certification only.

## Safe report handling

Download only the safe JSON report or locally generated synthetic review pack. Keep artifacts out of git. They contain hashes, synthetic fixture text, reason codes, and scores—not production conversations, system prompts, secrets, or chain of thought. Delete restricted local artifacts after the release decision according to the team's retention policy.
