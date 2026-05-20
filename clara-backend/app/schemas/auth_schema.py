from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CurrentUserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    organization_id: UUID | None
    organization_name: str | None = None
    created_by_user_id: UUID | None
    created_by_user_name: str | None = None
    model_config = ConfigDict(from_attributes=True)


class SessionResponse(BaseModel):
    token_type: str = "bearer"
    user: CurrentUserResponse


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)
    role: str = Field(default="marketing", max_length=50)
    organization_id: UUID | None = None


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    role: str | None = Field(default=None, max_length=50)
    organization_id: UUID | None = None


class ResetUserPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=255)
    new_password: str = Field(min_length=8, max_length=255)
