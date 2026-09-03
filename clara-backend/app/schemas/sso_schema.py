from pydantic import BaseModel, ConfigDict


class SSOTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    scope: str
    id_token: str


class SSOIntrospectionResponse(BaseModel):
    active: bool
    sub: str | None = None
    client_id: str | None = None
    scope: str | None = None
    exp: int | None = None
    iat: int | None = None
    name: str | None = None
    email: str | None = None
    role: str | None = None
    organizationId: str | None = None
    teamId: str | None = None
    isActive: bool | None = None


class SSOUserInfoResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sub: str
    name: str
    email: str
    role: str
    organizationId: str
    teamId: str | None
    isActive: bool


class OIDCDiscoveryResponse(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    introspection_endpoint: str
    response_types_supported: list[str]
    grant_types_supported: list[str]
    subject_types_supported: list[str]
    id_token_signing_alg_values_supported: list[str]
    token_endpoint_auth_methods_supported: list[str]
    scopes_supported: list[str]
    code_challenge_methods_supported: list[str]
    claims_supported: list[str]
