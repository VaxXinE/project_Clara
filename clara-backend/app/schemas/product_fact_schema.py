from datetime import datetime
import json
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProductFactAccountCategory = Literal["mini", "regular", "global"]
ProductFactValueType = Literal["text", "integer", "decimal", "boolean", "date", "json"]
ProductFactLifecycleStatus = Literal[
    "DRAFT", "APPROVED", "ACTIVE", "EXPIRED", "REVOKED"
]
ProductFactFreshnessClass = Literal[
    "HIGH_VOLATILITY", "MEDIUM_VOLATILITY", "LOW_VOLATILITY"
]


class ProductFactDraftCreateRequest(BaseModel):
    fact_key: str = Field(min_length=1, max_length=120)
    account_category: ProductFactAccountCategory = "global"
    product_code: str | None = Field(default=None, min_length=1, max_length=100)
    value_type: ProductFactValueType
    value: Any
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    last_verified_at: datetime | None = None
    source_type: str = Field(min_length=1, max_length=50)
    source_reference: str = Field(min_length=1, max_length=500)
    source_hash: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    freshness_class: ProductFactFreshnessClass
    sensitivity_class: str = Field(default="CUSTOMER_SAFE", min_length=1, max_length=30)
    organization_id: UUID | None = None

    @model_validator(mode="after")
    def validate_period(self):
        if (
            self.effective_from
            and self.effective_until
            and self.effective_until <= self.effective_from
        ):
            raise ValueError("effective_until must be after effective_from")
        valid_value = {
            "text": isinstance(self.value, str),
            "integer": isinstance(self.value, int) and not isinstance(self.value, bool),
            "decimal": isinstance(self.value, (int, float))
            and not isinstance(self.value, bool),
            "boolean": isinstance(self.value, bool),
            "date": isinstance(self.value, str),
            "json": isinstance(self.value, (dict, list)),
        }[self.value_type]
        if not valid_value:
            raise ValueError(f"value does not match value_type={self.value_type}")
        if len(json.dumps(self.value, ensure_ascii=False, default=str)) > 50_000:
            raise ValueError("value exceeds 50000 characters")
        return self


class ProductFactResponse(BaseModel):
    id: UUID
    organization_id: UUID | None
    fact_key: str
    account_category: ProductFactAccountCategory
    product_code: str | None
    value_type: ProductFactValueType
    value: Any
    unit: str | None
    lifecycle_status: ProductFactLifecycleStatus
    effective_from: datetime | None
    effective_until: datetime | None
    last_verified_at: datetime | None
    verified_by_user_id: UUID | None
    source_type: str
    source_reference: str
    source_hash: str | None
    freshness_class: ProductFactFreshnessClass
    freshness_status: str
    sensitivity_class: str
    revision: int
    supersedes_fact_id: UUID | None
    created_by_user_id: UUID | None
    resolution_status: str | None = None
    warnings: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductFactShadowMismatchResponse(BaseModel):
    created_at: datetime
    mismatch_keys: list[str]
    missing_keys: list[str]
    stale_keys: list[str]
    conflicting_keys: list[str]
