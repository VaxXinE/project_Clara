from uuid import UUID

from pydantic import BaseModel, Field


class ExtensionChannelConfigItem(BaseModel):
    enabled: bool
    provider: str = "extension"


class ExtensionConfigResponse(BaseModel):
    channels: dict[str, ExtensionChannelConfigItem]
    delivery_mode: str = "LEGACY"


class WhatsAppExtensionMessage(BaseModel):
    id: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    direction: str = Field(pattern="^(incoming|outgoing)$")
    text: str = Field(min_length=1, max_length=5000)
    reply_context_text: str | None = Field(
        alias="replyContextText",
        default=None,
        max_length=5000,
    )
    reply_context_sender_name: str | None = Field(
        alias="replyContextSenderName",
        default=None,
        max_length=255,
    )
    reply_context_sender_type: str | None = Field(
        alias="replyContextSenderType",
        default=None,
        pattern="^(incoming|outgoing|unknown)$",
    )
    timestamp_label: str = Field(alias="timestampLabel", default="", max_length=255)


class WhatsAppExtensionChatSnapshot(BaseModel):
    captured_at: str = Field(alias="capturedAt", min_length=1, max_length=255)
    chat_title: str = Field(alias="chatTitle", min_length=1, max_length=255)
    chat_subtitle: str = Field(alias="chatSubtitle", default="", max_length=255)
    external_thread_id: str | None = Field(
        alias="externalThreadId",
        default=None,
        max_length=255,
    )
    messages: list[WhatsAppExtensionMessage] = Field(default_factory=list)


class WhatsAppExtensionSnapshotSyncRequest(BaseModel):
    chat_data: WhatsAppExtensionChatSnapshot | None = Field(
        alias="chatData",
        default=None,
    )


class WhatsAppExtensionSnapshotSyncResponse(BaseModel):
    ok: bool = True
    status: str
    duplicate: bool = False
    conversation_id: UUID | None = None
    message_count: int = 0
    source: str = "whatsapp_extension"
    snapshot_fingerprint: str | None = None
    latest_message_fingerprint: str | None = None
    active_chat_fingerprint: str | None = None


class WhatsAppExtensionReplySuggestionItem(BaseModel):
    tone: str
    text: str
    reasoning: str


class WhatsAppExtensionReplySuggestionsResponse(BaseModel):
    ok: bool = True
    status: str
    duplicate: bool = False
    cached: bool = False
    conversation_id: UUID
    reply_suggestion_id: UUID
    message_count: int = 0
    source: str = "whatsapp_extension"
    suggestions: list[str] = Field(default_factory=list)
    suggestion_details: list[WhatsAppExtensionReplySuggestionItem] = Field(
        default_factory=list
    )
    risk_level: str | None = None
    action_mode: str | None = None
    next_best_action: str | None = None
    customer_summary: str | None = None
    snapshot_fingerprint: str | None = None
    latest_message_fingerprint: str | None = None
    active_chat_fingerprint: str | None = None
    suggestion_version: int = 1


class WhatsAppExtensionSendReplyRequest(BaseModel):
    selected_reply_text: str = Field(
        alias="selectedReplyText",
        min_length=1,
        max_length=2000,
    )
    final_reply_text: str = Field(
        alias="finalReplyText",
        min_length=1,
        max_length=2000,
    )
    sent_by_name: str = Field(
        alias="sentByName",
        default="sales_user",
        max_length=255,
    )


class WhatsAppExtensionSendReplyResponse(BaseModel):
    ok: bool = True
    status: str
    conversation_id: UUID
    reply_suggestion_id: UUID
    sent_message_id: UUID
    approval_status: str = "approved"
    auto_approved: bool = False
    already_sent: bool = False


class ExtensionSnapshotSyncRequest(WhatsAppExtensionSnapshotSyncRequest):
    pass


class ExtensionSnapshotSyncResponse(WhatsAppExtensionSnapshotSyncResponse):
    pass


class ExtensionReplySuggestionsResponse(WhatsAppExtensionReplySuggestionsResponse):
    pass


class ExtensionSendReplyRequest(WhatsAppExtensionSendReplyRequest):
    pass


class ExtensionSendReplyResponse(WhatsAppExtensionSendReplyResponse):
    pass


class ExtensionDeliveryAuthorizationRequest(BaseModel):
    final_reply_text: str = Field(alias="finalReplyText", min_length=1, max_length=2000)
    snapshot_fingerprint: str = Field(alias="snapshotFingerprint", pattern=r"^[a-f0-9]{64}$")
    latest_message_fingerprint: str = Field(
        alias="latestMessageFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    active_chat_fingerprint: str = Field(
        alias="activeChatFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    suggestion_version: int = Field(alias="suggestionVersion", ge=1)
    idempotency_key: str = Field(
        alias="idempotencyKey",
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    explicit_human_action: bool = Field(alias="explicitHumanAction")


class ExtensionDeliveryDecisionResponse(BaseModel):
    mode: str
    delivery_permission: str
    reason_codes: list[str]
    organization_id: UUID
    conversation_id: UUID
    suggestion_id: UUID
    suggestion_version: int
    approval_status: str
    policy_action: str
    reviewer_requirement: str
    snapshot_fingerprint: str
    latest_message_fingerprint: str
    active_chat_fingerprint: str
    final_text_hash: str
    previous_delivery_status: str | None = None
    authorization_required: bool
    authorization_id: UUID | None = None
    authorization_token: str | None = None
    authorization_expires_at: str | None = None
    decision_hash: str
    delivery_contract_version: str


class ExtensionDeliveryClaimRequest(BaseModel):
    authorization_token: str = Field(alias="authorizationToken", min_length=32, max_length=255)
    conversation_id: UUID = Field(alias="conversationId")
    suggestion_id: UUID = Field(alias="suggestionId")
    snapshot_fingerprint: str = Field(alias="snapshotFingerprint", pattern=r"^[a-f0-9]{64}$")
    latest_message_fingerprint: str = Field(
        alias="latestMessageFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    active_chat_fingerprint: str = Field(
        alias="activeChatFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    final_text_hash: str = Field(alias="finalTextHash", pattern=r"^[a-f0-9]{64}$")


class ExtensionDeliveryClaimResponse(BaseModel):
    status: str
    reason_codes: list[str]
    authorization_id: UUID
    decision_hash: str
    delivery_contract_version: str


class ExtensionDeliveryResultRequest(BaseModel):
    authorization_token: str = Field(alias="authorizationToken", min_length=32, max_length=255)
    result: str = Field(pattern=r"^(SENT|FAILED|UNKNOWN)$")
    browser_event_id: str = Field(alias="browserEventId", min_length=8, max_length=128)
    adapter_result_code: str = Field(
        alias="adapterResultCode",
        default="UNSPECIFIED",
        max_length=80,
        pattern=r"^[A-Z0-9_]+$",
    )
    active_chat_fingerprint: str = Field(
        alias="activeChatFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    latest_message_fingerprint: str = Field(
        alias="latestMessageFingerprint", pattern=r"^[a-f0-9]{64}$"
    )
    final_text_hash: str = Field(alias="finalTextHash", pattern=r"^[a-f0-9]{64}$")


class ExtensionDeliveryResultResponse(BaseModel):
    status: str
    authorization_id: UUID
    sent_message_id: UUID | None = None
    reconciliation_required: bool = False
    duplicate_prevented: bool = False
    reason_codes: list[str]
    delivery_contract_version: str
