# Clara Stage 8 Change Audit

Audit range: `a52c3a1..d633c2b`. Stage 8 commit: `d633c2b`. Stage 8.1 branch: `fix/clara-stage-8-governance-hardening`.

Method: all 89 paths were inspected by name/status, whitespace diff, and Python AST equivalence. An AST-identical Python file is classified formatter-only. Those 68 files are restored to their exact Stage 7 content in Stage 8.1. No unrelated semantic change or unresolved file remains.

## REQUIRED_STAGE_8_CHANGE (19)

- `clara-backend/alembic/versions/d8e9f0a1b2c3_add_service_routing_support_and_complaints.py`
- `clara-backend/app/api/routes_service_routing.py`
- `clara-backend/app/core/config.py`
- `clara-backend/app/models/complaint_case.py`
- `clara-backend/app/models/support_knowledge_article.py`
- `clara-backend/app/schemas/service_routing_schema.py`
- `clara-backend/app/services/clara_complaint_service.py`
- `clara-backend/app/services/clara_service_routing_service.py`
- `clara-backend/app/services/clara_support_knowledge_service.py`
- `clara-backend/app/services/reply_suggestion_service.py`
- `clara-backend/tests/test_clara_service_routing.py`
- `clara-dashboard/src/app/dashboard/(insights)/support-knowledge/page.tsx`
- `clara-dashboard/src/app/dashboard/(workspace)/complaints/page.tsx`
- `clara-dashboard/src/app/dashboard/(workspace)/complaints/[caseId]/page.tsx`
- `docs/architecture/CLARA_POLICY_ENFORCEMENT_CONTRACT.md`
- `docs/architecture/CLARA_PROCESS_STATE_FSM_CONTRACT.md`
- `docs/architecture/CLARA_PRODUCT_FACT_REGISTRY_CONTRACT.md`
- `docs/architecture/CLARA_RUNTIME_AUTHORITY_MAP.md`
- `docs/architecture/CLARA_RUNTIME_CONTRACT_V1.md`

Stage 8.1 additionally adds the incident-identity migration, four missing contracts/runbook, this audit, test fixture table registration, and `.gitignore` exceptions required to version the previously ignored documents.

## REQUIRED_IMPORT_OR_RELATION_CHANGE (2)

- `clara-backend/app/main.py` — registers the Stage 8 router.
- `clara-backend/app/models/__init__.py` — imports new ORM models for metadata registration.

## FORMATTER_ONLY (68)

- `clara-backend/app/api/routes_ai.py`
- `clara-backend/app/api/routes_auth.py`
- `clara-backend/app/api/routes_conversations.py`
- `clara-backend/app/api/routes_customers.py`
- `clara-backend/app/api/routes_dashboard.py`
- `clara-backend/app/api/routes_leads.py`
- `clara-backend/app/api/routes_product_knowledge.py`
- `clara-backend/app/api/routes_reply.py`
- `clara-backend/app/api/routes_sales_structure.py`
- `clara-backend/app/api/routes_sent_messages.py`
- `clara-backend/app/api/routes_live_chat_webhooks.py`
- `clara-backend/app/api/routes_upload.py`
- `clara-backend/app/api/routes_webhooks.py`
- `clara-backend/app/core/logging.py`
- `clara-backend/app/db/session.py`
- `clara-backend/app/middleware/request_logging.py`
- `clara-backend/app/middleware/security_headers.py`
- `clara-backend/app/models/ai_extraction.py`
- `clara-backend/app/models/approval_log.py`
- `clara-backend/app/models/conversation.py`
- `clara-backend/app/models/customer_process_state.py`
- `clara-backend/app/models/customer_process_state_event.py`
- `clara-backend/app/models/customer_profile.py`
- `clara-backend/app/models/knowledge_update_proposal.py`
- `clara-backend/app/models/lead_deal.py`
- `clara-backend/app/models/marketing_execution_item.py`
- `clara-backend/app/models/message.py`
- `clara-backend/app/models/ops_notification.py`
- `clara-backend/app/models/organization.py`
- `clara-backend/app/models/performance_action.py`
- `clara-backend/app/models/product_knowledge.py`
- `clara-backend/app/models/reply_suggestion.py`
- `clara-backend/app/models/sales_performance_snapshot.py`
- `clara-backend/app/models/sent_message.py`
- `clara-backend/app/models/team_performance_snapshot.py`
- `clara-backend/app/models/user.py`
- `clara-backend/app/schemas/integration_schema.py`
- `clara-backend/app/schemas/sent_message_schema.py`
- `clara-backend/app/services/ai_extraction_service.py`
- `clara-backend/app/services/ai_persona_config_service.py`
- `clara-backend/app/services/auth_service.py`
- `clara-backend/app/services/chat_review_service.py`
- `clara-backend/app/services/clara_persona_parity_service.py`
- `clara-backend/app/services/clara_playbook_service.py`
- `clara-backend/app/services/clara_policy_enforcement_service.py`
- `clara-backend/app/services/clara_process_state_service.py`
- `clara-backend/app/services/clara_reply_retry_service.py`
- `clara-backend/app/services/clara_reply_validation_service.py`
- `clara-backend/app/services/clara_semantic_quality_service.py`
- `clara-backend/app/services/conversation_lifecycle_service.py`
- `clara-backend/app/services/customer_profile_service.py`
- `clara-backend/app/services/dashboard_service.py`
- `clara-backend/app/services/extension_ingest_service.py`
- `clara-backend/app/services/knowledge_update_queue_service.py`
- `clara-backend/app/services/lead_activity_service.py`
- `clara-backend/app/services/lead_discipline_service.py`
- `clara-backend/app/services/lead_service.py`
- `clara-backend/app/services/lead_task_service.py`
- `clara-backend/app/services/marketing_snapshot_service.py`
- `clara-backend/app/services/official_source_service.py`
- `clara-backend/app/services/organization_service.py`
- `clara-backend/app/services/performance_action_service.py`
- `clara-backend/app/services/policy_engine.py`
- `clara-backend/app/services/product_knowledge_service.py`
- `clara-backend/app/services/sales_structure_service.py`
- `clara-backend/app/services/sgcc_integration_service.py`
- `clara-backend/app/services/live_chat_ingest_service.py`
- `clara-backend/app/services/whatsapp_webhook_service.py`

## UNRELATED_SEMANTIC_CHANGE

None.

## UNRESOLVED

None.

## Boundary decision

The restoration deliberately returns live-chat owner resolution, WhatsApp ingestion, SGCC integration, dashboards, hierarchy, authentication, product facts, process-state logic, policy engine, approval, and send services to byte-equivalent Stage 7 behavior. Only the centralized reply orchestration hook remains because it is required for opt-in Stage 8 routing. Production default remains `LEGACY`.
