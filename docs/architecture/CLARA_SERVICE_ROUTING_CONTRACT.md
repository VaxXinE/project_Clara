# Clara Service Routing Contract

Status: Stage 8.1 stabilization. Contract version `1.1`.

## Modes and safe default

`CLARA_SERVICE_ROUTING_MODE` accepts `LEGACY`, `SHADOW`, and `ROUTED`; missing or invalid values normalize to `LEGACY`.

- `LEGACY`: computes no customer-facing change and creates no case.
- `SHADOW`: calculates the complete typed decision and logs safe IDs/hash only; it creates no case and changes no reply or status.
- `ROUTED`: sales and general compliance retain their existing path; CS uses eligible support knowledge or deterministic handoff; complaints skip sales generation, create/update a governed case, and use deterministic handoff. Every reply suggestion remains pending review.

## Typed decision

`ServiceRoutingDecision` contains `top_level_route`, `conversation_intent`, `support_level`, `support_topic`, `complaint_category`, `complaint_severity`, `route_reason_codes`, `confidence_score`, `requires_human`, `create_case`, `generation_strategy`, `reviewer_requirement`, `source_type`, `decision_hash`, and `routing_contract_version`.

Strategies are `EXISTING_SALES_GENERATION`, `COMPLIANCE_EDUCATION`, `SUPPORT_KNOWLEDGE_DRAFT`, `SUPPORT_SAFE_HANDOFF`, `COMPLAINT_SAFE_HANDOFF`, `OFF_TOPIC_BOUNDARY`, and `NO_CUSTOMER_DRAFT`. Debug metadata never contains message text.

## Precedence

1. backend security/governance boundary;
2. policy enforcement and critical semantic result;
3. contextual personal complaint or explicit human request;
4. general compliance education;
5. CS L0/L1 or status handoff;
6. existing sales generation;
7. off-topic boundary;
8. unknown compatibility path.

Generic fraud, legal, regulator, risk, or refund-policy education is not a complaint without personal incident evidence. Routine login trouble is CS unless human handling is requested. A status question is `HUMAN_REQUIRED` and cannot confirm process/account state.

Routing consumes enforcement/reviewer decisions but cannot override backend `BLOCK`, product facts, canonical process state, approval/send gates, or live-chat owner resolution. Rollback is setting routing to `LEGACY` and restarting; audit history remains intact.

## Tahap 6 extension delivery boundary

Service routing selects generation/handoff behavior only. Extension delivery
may authorize a reviewed result but cannot change its route, convert sales to
handoff, create complaint ownership, or mutate process state. Complaint and CS
drafts retain their reviewer requirement before governed manual send.
