from app.services.clara_service_routing_service import (
    CLARA_SERVICE_ROUTING_CONTRACT_VERSION,
    ServiceRoute,
    ServiceRoutingMode,
    SupportLevel,
    SupportTopic,
    normalize_service_routing_mode,
    route_service_message,
)


def test_service_routing_mode_is_fail_safe() -> None:
    assert normalize_service_routing_mode(None) == ServiceRoutingMode.LEGACY
    assert normalize_service_routing_mode("invalid") == ServiceRoutingMode.LEGACY
    assert normalize_service_routing_mode(" routed ") == ServiceRoutingMode.ROUTED


def test_contextual_complaints_are_routed_without_keyword_only_false_positive() -> None:
    complaint = route_service_message(
        "Dana saya hilang dan saya minta petugas menangani."
    )
    generic = route_service_message("Apa kebijakan refund dan apakah perusahaan legal?")
    assert complaint.route == ServiceRoute.COMPLAINT
    assert complaint.support_level == SupportLevel.HUMAN_REQUIRED
    assert complaint.complaint_category is not None
    assert generic.route == ServiceRoute.COMPLIANCE_GENERAL
    assert generic.complaint_category is None


def test_cs_and_status_requests_are_separated() -> None:
    login = route_service_message("Saya tidak bisa login.")
    status = route_service_message("Akun saya verified belum? Tolong cek.")
    assert (login.route, login.support_topic) == (
        ServiceRoute.CS_GENERAL,
        SupportTopic.LOGIN_GENERAL,
    )
    assert (status.support_level, status.support_topic) == (
        SupportLevel.HUMAN_REQUIRED,
        SupportTopic.STATUS_REQUEST,
    )


def test_human_request_upgrades_cs_problem_to_complaint() -> None:
    result = route_service_message(
        "Saya tidak bisa login, hubungkan ke petugas manusia."
    )
    assert result.route == ServiceRoute.COMPLAINT
    assert result.complaint_category is not None


def test_routing_metadata_is_safe_and_deterministic() -> None:
    first = route_service_message("Saya tidak bisa login.")
    second = route_service_message("Saya tidak bisa login.")
    assert first.contract_version == CLARA_SERVICE_ROUTING_CONTRACT_VERSION
    assert first.decision_hash == second.decision_hash
    metadata = first.debug_metadata()
    assert "Saya" not in str(metadata)
    assert "message" not in metadata
