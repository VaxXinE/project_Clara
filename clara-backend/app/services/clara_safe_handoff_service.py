from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256


CLARA_SAFE_HANDOFF_TEMPLATE_VERSION = "1.0"


class SafeHandoffCategory(StrEnum):
    PERSONAL_COMPLAINT = "PERSONAL_COMPLAINT"
    FINANCIAL_LOSS_CLAIM = "FINANCIAL_LOSS_CLAIM"
    REFUND_OR_COMPENSATION = "REFUND_OR_COMPENSATION"
    LEGAL_OR_REGULATOR_THREAT = "LEGAL_OR_REGULATOR_THREAT"
    FRAUD_ALLEGATION = "FRAUD_ALLEGATION"
    HUMAN_REQUEST = "HUMAN_REQUEST"
    HIGH_EMOTION = "HIGH_EMOTION"


@dataclass(frozen=True)
class SafeHandoffResult:
    content: str
    category: SafeHandoffCategory
    content_hash: str
    template_version: str = CLARA_SAFE_HANDOFF_TEMPLATE_VERSION

    def debug_metadata(self) -> dict:
        return {
            "category": self.category.value,
            "content_hash": self.content_hash,
            "template_version": self.template_version,
        }


_TEMPLATES = {
    SafeHandoffCategory.PERSONAL_COMPLAINT: (
        "Terima kasih sudah menyampaikan kendalanya. Saya akan meneruskan "
        "hal ini ke tim yang tepat untuk ditinjau. Mohon siapkan ringkasan "
        "waktu kejadian dan kanal yang digunakan, tanpa mengirim password, "
        "OTP, atau data akses akun."
    ),
    SafeHandoffCategory.FINANCIAL_LOSS_CLAIM: (
        "Saya memahami hal ini perlu ditangani dengan hati-hati. Informasinya "
        "akan diteruskan ke tim yang berwenang untuk ditinjau. Mohon siapkan "
        "kronologi singkat dan waktu kejadian, tanpa mengirim password, OTP, "
        "atau data akses akun."
    ),
    SafeHandoffCategory.REFUND_OR_COMPENSATION: (
        "Terima kasih sudah menjelaskan permintaannya. Saya tidak dapat "
        "menjanjikan hasil refund atau kompensasi, tetapi kasus ini akan "
        "diteruskan ke tim yang berwenang untuk ditinjau. Mohon jangan "
        "mengirim password, OTP, atau data akses akun."
    ),
    SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT: (
        "Saya memahami persoalan ini perlu ditangani secara resmi. Pesan ini "
        "akan diteruskan ke tim yang berwenang untuk ditinjau. Mohon siapkan "
        "kronologi singkat tanpa mengirim password, OTP, atau data akses akun."
    ),
    SafeHandoffCategory.FRAUD_ALLEGATION: (
        "Terima kasih sudah melaporkan hal ini. Informasinya akan diteruskan "
        "ke tim yang berwenang untuk ditinjau. Mohon simpan bukti yang relevan "
        "dan jangan mengirim password, OTP, atau data akses akun melalui chat."
    ),
    SafeHandoffCategory.HUMAN_REQUEST: (
        "Baik, permintaan untuk ditangani oleh petugas akan saya teruskan ke "
        "tim yang tepat. Mohon tunggu tindak lanjut di percakapan ini dan "
        "jangan mengirim password, OTP, atau data akses akun melalui chat."
    ),
    SafeHandoffCategory.HIGH_EMOTION: (
        "Saya memahami situasi ini membuat tidak nyaman. Pesan ini akan "
        "diteruskan ke tim yang tepat untuk ditinjau dengan hati-hati. Mohon "
        "jangan mengirim password, OTP, atau data akses akun melalui chat."
    ),
}


def build_safe_handoff(category: SafeHandoffCategory) -> SafeHandoffResult:
    content = _TEMPLATES[category]
    return SafeHandoffResult(
        content=content,
        category=category,
        content_hash=sha256(content.encode("utf-8")).hexdigest(),
    )
