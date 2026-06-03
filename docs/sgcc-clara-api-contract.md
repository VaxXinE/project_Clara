# Kontrak API Integrasi SGCC <-> Clara

Dokumen ini mendefinisikan kontrak integrasi antara:

- **SGCC** sebagai client / consumer
- **Clara** sebagai AI intelligence provider

Untuk panduan implementasi yang lebih praktis untuk developer SGCC, lihat juga:

- [sgcc-clara-api-developer-guide.md](/Users/newsmaker23/Projects/clara/docs/sgcc-clara-api-developer-guide.md)
- [sgcc-clara-api-alignment-with-scc-spec.md](/Users/newsmaker23/Projects/clara/docs/sgcc-clara-api-alignment-with-scc-spec.md)

Scope dokumen ini saat ini mencakup **Fase 1, Fase 1.5, Fase 2, dan Fase 3**:

1. `conversation-analysis`
2. `reply-suggestions`
3. `objection-insights`
4. `follow-up-recommendation`
5. `customer-identity-match`
6. `kpi-enrichment`

Tujuan integrasi:

- SGCC tetap menjadi sistem operasional utama sales
- Clara menyediakan kemampuan AI yang belum ada di SGCC
- integrasi dilakukan secara **stateless** dan **service-to-service**

---

## Prinsip Integrasi

## Peran masing-masing sistem

### SGCC

SGCC bertanggung jawab atas:

- autentikasi user SGCC
- struktur organisasi sales
- data prospect/prospect log
- workflow manager/head/sales
- penyimpanan data operasional utama

### Clara

Clara bertanggung jawab atas:

- analisis percakapan berbasis AI
- klasifikasi lead temperature/risk/objection/stage
- pembuatan draft balasan
- policy decision untuk approval/action mode

---

## Karakter API

- protocol: `HTTP/JSON`
- auth: `X-Clara-Integration-Key`
- style: `request -> response`
- mode: **stateless**
- persistence Clara: **tidak wajib menyimpan data SGCC** sebagai source of truth
- observability: Clara mencatat **audit log integrasi**
- abuse protection: Clara menerapkan **rate limit khusus integrasi**

Artinya:

- SGCC mengirim transcript + context
- Clara memproses
- Clara mengembalikan hasil
- SGCC bebas menyimpan hasil itu di database-nya sendiri

---

## Base URL

Contoh base URL lokal:

```text
http://127.0.0.1:8000
```

Semua endpoint fase 1 berada di bawah prefix:

```text
/integrations/sgcc
```

Endpoint fase 2 tetap memakai prefix yang sama.

---

## Authentication

Setiap request dari SGCC ke Clara **wajib** mengirim header:

```http
X-Clara-Integration-Key: <integration-key>
```

### Environment variable Clara

Di backend Clara:

```env
SGCC_INTEGRATION_API_KEY=replace_with_a_long_random_integration_key
```

### Aturan auth

- kalau header tidak ada -> `401 Unauthorized`
- kalau key salah -> `401 Unauthorized`
- kalau Clara belum dikonfigurasi -> `503 Service Unavailable`

---

## Rate Limit dan Audit Log

### Rate limit

Semua endpoint SGCC saat ini dilindungi rate limit per:

- `path endpoint`
- `IP caller`
- `window 60 detik`

Environment Clara:

```env
SGCC_INTEGRATION_RATE_LIMIT_PER_MINUTE=30
```

Default saat ini:

- `30 request / menit / endpoint / IP`

Jika limit terlampaui, Clara akan mengembalikan:

```http
429 Too Many Requests
```

Contoh body:

```json
{
  "detail": "Too many SGCC integration requests. Please try again later."
}
```

### Audit log

Untuk request sukses, Clara mencatat audit log integrasi minimal:

- `integration_client`
- `endpoint action`
- `resource_id` bila tersedia
- metadata operasional penting

Contoh metadata yang bisa tercatat:

- `source_channel`
- `message_count`
- `account_category`
- `risk_level`
- `pipeline_stage`
- `action_mode`
- `priority_score`
- `urgency_level`
- `used_supplied_analysis`

### Rekomendasi security

- pakai key yang panjang dan random
- bedakan key per environment:
  - local
  - staging
  - production
- jangan hard-code key di frontend/browser
- simpan key hanya di backend SGCC / secret manager / env server

---

## Common Headers

Header minimum:

```http
Content-Type: application/json
Accept: application/json
X-Clara-Integration-Key: <integration-key>
```

Contoh:

```http
POST /integrations/sgcc/conversation-analysis HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json
Accept: application/json
X-Clara-Integration-Key: super-secret-integration-key
```

---

## Endpoint 1: Conversation Analysis

Endpoint ini dipakai SGCC untuk meminta Clara membaca transcript percakapan dan mengembalikan analisis AI.

### Request

```http
POST /integrations/sgcc/conversation-analysis
```

### Request body schema

```json
{
  "external_conversation_id": "string|null",
  "source_channel": "whatsapp|telegram|other",
  "customer_name": "string|null",
  "sales_name": "string|null",
  "account_category": "string|null",
  "extra_context": "string|null",
  "messages": [
    {
      "sender_type": "customer|sales|system",
      "sender_name": "string",
      "message_text": "string",
      "message_timestamp": "ISO8601 datetime|null"
    }
  ]
}
```

### Field detail

#### `external_conversation_id`

- type: `string | null`
- optional
- ID conversation dari SGCC
- dipakai untuk trace/debug, bukan primary key Clara

#### `source_channel`

- type: enum
- allowed:
  - `whatsapp`
  - `telegram`
  - `other`

#### `customer_name`

- type: `string | null`
- optional

#### `sales_name`

- type: `string | null`
- optional

#### `account_category`

- type: `string | null`
- optional
- contoh di SGCC:
  - `mini`
  - `reguler`

#### `extra_context`

- type: `string | null`
- optional
- bisa dipakai SGCC untuk menambahkan konteks seperti:
  - status prospect saat ini
  - catatan manager
  - origin source

#### `messages`

- type: `array`
- minimal: `1`
- maksimal saat ini: `120`

Setiap item:

- `sender_type`: `customer | sales | system`
- `sender_name`: wajib
- `message_text`: wajib
- `message_timestamp`: optional, format ISO8601

---

## Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "model_name": "gpt-4.1-mini",
  "schema_version": "v1",
  "analysis": {
    "lead_temperature": "cold|warm|hot",
    "pipeline_stage": "new_lead|qualification|education|objection|negotiation|closing|won|lost|unknown",
    "buying_intent": "low|medium|high",
    "sentiment": "positive|neutral|cautious|negative|angry",
    "risk_level": "low|medium|high",
    "main_objections": ["string"],
    "budget_signal": {
      "detected": true,
      "amount_text": "string|null",
      "notes": "string"
    },
    "recommended_reply_strategy": {
      "tone": "friendly|professional|empathetic|urgent",
      "key_points": ["string"],
      "avoid_topics": ["string"]
    },
    "customer_summary": "string",
    "next_best_action": "string",
    "content_insight": "string",
    "internal_notes": "string",
    "confidence_score": 0.91
  }
}
```

---

## Contoh request

```json
{
  "external_conversation_id": "sgcc-chat-001",
  "source_channel": "whatsapp",
  "customer_name": "Nia",
  "sales_name": "Aria",
  "account_category": "reguler",
  "extra_context": "Lead dari iklan, manager ingin fokus pada legalitas dan trust.",
  "messages": [
    {
      "sender_type": "customer",
      "sender_name": "Nia",
      "message_text": "Halo kak, saya masih ragu soal legalitasnya.",
      "message_timestamp": "2026-05-19T09:00:00Z"
    },
    {
      "sender_type": "sales",
      "sender_name": "Aria",
      "message_text": "Siap kak, saya bantu jelaskan satu per satu ya.",
      "message_timestamp": "2026-05-19T09:01:00Z"
    }
  ]
}
```

## Contoh response

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "model_name": "gpt-4.1-mini",
  "schema_version": "v1",
  "analysis": {
    "lead_temperature": "warm",
    "pipeline_stage": "objection",
    "buying_intent": "medium",
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": false,
      "amount_text": null,
      "notes": "Belum ada sinyal budget eksplisit."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["jelaskan legalitas", "beri bukti resmi"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "Lead tertarik tetapi masih perlu penguatan trust.",
    "next_best_action": "Kirim penjelasan legalitas dan bukti resmi.",
    "content_insight": "Legalitas adalah isu utama untuk segmen ini.",
    "internal_notes": "Perlu materi trust yang ringkas.",
    "confidence_score": 0.91
  }
}
```

---

## Endpoint 2: Reply Suggestions

Endpoint ini dipakai SGCC untuk meminta Clara membuat draft balasan.

Endpoint ini bisa dipakai dalam dua mode:

1. **Dengan analysis dikirim dari SGCC**
   - paling efisien
   - tidak perlu Clara analisis ulang

2. **Tanpa analysis**
   - Clara akan menganalisis transcript dulu
   - lalu membuat draft balasan

### Request

```http
POST /integrations/sgcc/reply-suggestions
```

### Request body schema

```json
{
  "external_conversation_id": "string|null",
  "source_channel": "whatsapp|telegram|other",
  "customer_name": "string|null",
  "sales_name": "string|null",
  "account_category": "string|null",
  "extra_context": "string|null",
  "knowledge_snippets": ["string"],
  "analysis": {
    "lead_temperature": "cold|warm|hot",
    "pipeline_stage": "new_lead|qualification|education|objection|negotiation|closing|won|lost|unknown",
    "buying_intent": "low|medium|high",
    "sentiment": "positive|neutral|cautious|negative|angry",
    "risk_level": "low|medium|high",
    "main_objections": ["string"],
    "budget_signal": {
      "detected": true,
      "amount_text": "string|null",
      "notes": "string"
    },
    "recommended_reply_strategy": {
      "tone": "friendly|professional|empathetic|urgent",
      "key_points": ["string"],
      "avoid_topics": ["string"]
    },
    "customer_summary": "string",
    "next_best_action": "string",
    "content_insight": "string",
    "internal_notes": "string",
    "confidence_score": 0.91
  },
  "messages": [
    {
      "sender_type": "customer|sales|system",
      "sender_name": "string",
      "message_text": "string",
      "message_timestamp": "ISO8601 datetime|null"
    }
  ]
}
```

### Field tambahan

#### `knowledge_snippets`

- type: `array<string>`
- optional
- maksimal saat ini: `20`
- digunakan SGCC untuk mengirim knowledge tambahan, misalnya:
  - aturan legalitas
  - kebijakan internal
  - FAQ produk
  - batasan klaim

#### `analysis`

- type: object
- optional
- kalau diisi, Clara akan langsung pakai hasil analysis itu
- kalau tidak diisi, Clara akan memanggil analysis internal dulu

---

## Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "model_name": "gpt-4.1-mini",
  "schema_version": "v1",
  "analysis": {
    "lead_temperature": "warm",
    "pipeline_stage": "objection",
    "buying_intent": "medium",
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": false,
      "amount_text": null,
      "notes": "Belum ada budget eksplisit."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["jelaskan legalitas"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "string",
    "next_best_action": "string",
    "content_insight": "string",
    "internal_notes": "string",
    "confidence_score": 0.9
  },
  "action_mode": "auto_draft_only|human_approval_required|escalate_to_human",
  "policy_reasons": ["string"],
  "suggested_replies": [
    {
      "tone": "friendly|professional|empathetic|urgent",
      "text": "string",
      "reasoning": "string"
    }
  ]
}
```

### Aturan `suggested_replies`

- selalu berisi tepat `3` draft
- tiap draft punya:
  - `tone`
  - `text`
  - `reasoning`

### Aturan `action_mode`

Nilai saat ini:

- `auto_draft_only`
- `human_approval_required`
- `escalate_to_human`

Interpretasi:

- `auto_draft_only`
  - SGCC boleh menampilkan draft sebagai saran aman
- `human_approval_required`
  - draft tetap boleh ditampilkan, tapi sebaiknya perlu validasi sales/manager
- `escalate_to_human`
  - kasus high risk, draft tidak boleh dianggap safe untuk auto action

---

## Contoh request

```json
{
  "external_conversation_id": "sgcc-chat-002",
  "source_channel": "whatsapp",
  "customer_name": "Nia",
  "sales_name": "Aria",
  "knowledge_snippets": [
    "Legalitas produk hanya boleh dijelaskan berdasarkan dokumen resmi.",
    "Jangan membuat janji hasil atau nominal profit."
  ],
  "analysis": {
    "lead_temperature": "warm",
    "pipeline_stage": "objection",
    "buying_intent": "medium",
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": false,
      "amount_text": null,
      "notes": "Belum ada budget eksplisit."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["jelaskan legalitas", "beri referensi resmi"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "Lead masih butuh penguatan trust.",
    "next_best_action": "Jelaskan legalitas dan tawarkan follow-up dokumen resmi.",
    "content_insight": "Legalitas menjadi sumber resistensi utama.",
    "internal_notes": "Jangan overclaim.",
    "confidence_score": 0.9
  },
  "messages": [
    {
      "sender_type": "customer",
      "sender_name": "Nia",
      "message_text": "Saya masih ragu soal legalitasnya.",
      "message_timestamp": "2026-05-19T09:00:00Z"
    },
    {
      "sender_type": "sales",
      "sender_name": "Aria",
      "message_text": "Baik kak, saya bantu jelaskan ya.",
      "message_timestamp": "2026-05-19T09:01:00Z"
    }
  ]
}
```

## Contoh response

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "model_name": "gpt-4.1-mini",
  "schema_version": "v1",
  "analysis": {
    "lead_temperature": "warm",
    "pipeline_stage": "objection",
    "buying_intent": "medium",
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": false,
      "amount_text": null,
      "notes": "Belum ada budget eksplisit."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["jelaskan legalitas", "beri referensi resmi"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "Lead masih butuh penguatan trust.",
    "next_best_action": "Jelaskan legalitas dan tawarkan follow-up dokumen resmi.",
    "content_insight": "Legalitas menjadi sumber resistensi utama.",
    "internal_notes": "Jangan overclaim.",
    "confidence_score": 0.9
  },
  "action_mode": "human_approval_required",
  "policy_reasons": [
    "Risk level medium: balasan butuh approval sales."
  ],
  "suggested_replies": [
    {
      "tone": "friendly",
      "text": "Siap kak, saya bantu jelaskan legalitasnya dengan ringkas ya.",
      "reasoning": "Versi ringan untuk membuka follow-up tanpa terasa menekan."
    },
    {
      "tone": "professional",
      "text": "Baik kak, saya kirim penjelasan legalitas beserta referensi resmi yang relevan.",
      "reasoning": "Versi profesional untuk memperkuat kredibilitas."
    },
    {
      "tone": "empathetic",
      "text": "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya supaya lebih tenang.",
      "reasoning": "Versi empatik untuk menjawab kekhawatiran trust."
    }
  ]
}
```

---

## Endpoint 3: Objection Insights

Endpoint ini dipakai SGCC untuk meminta Clara membuat ringkasan agregat dari sekumpulan conversation analysis yang sudah ada.

Tujuan utamanya:

- membaca pola objection dominan
- melihat breakdown risk/sentiment/stage
- mendapatkan rekomendasi angle konten/edukasi

### Request

```http
POST /integrations/sgcc/objection-insights
```

### Request body schema

```json
{
  "period_label": "Weekly review 2026-05-19",
  "conversations": [
    {
      "external_conversation_id": "sgcc-chat-101",
      "source_channel": "whatsapp",
      "customer_name": "Nia",
      "sales_name": "Aria",
      "account_category": "reguler",
      "analysis": {
        "lead_temperature": "warm",
        "pipeline_stage": "objection",
        "buying_intent": "medium",
        "sentiment": "cautious",
        "risk_level": "medium",
        "main_objections": ["legalitas", "trust"],
        "budget_signal": {
          "detected": false,
          "amount_text": null,
          "notes": "Belum ada budget eksplisit."
        },
        "recommended_reply_strategy": {
          "tone": "professional",
          "key_points": ["jelaskan legalitas"],
          "avoid_topics": ["janji hasil"]
        },
        "customer_summary": "Lead masih butuh trust.",
        "next_best_action": "Kirim bukti resmi.",
        "content_insight": "Legalitas dan trust dominan.",
        "internal_notes": "Perlu angle edukasi.",
        "confidence_score": 0.88
      }
    }
  ]
}
```

### Catatan penting

- endpoint ini **tidak** menganalisis transcript mentah
- SGCC harus mengirim `analysis` yang sudah valid untuk tiap conversation
- cocok dipakai untuk review harian/mingguan manager

### Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "schema_version": "v1",
  "period_label": "Weekly review 2026-05-19",
  "total_conversations": 12,
  "top_objections": [
    { "topic": "legalitas", "count": 6 },
    { "topic": "trust", "count": 4 }
  ],
  "risk_level_breakdown": {
    "low": 4,
    "medium": 6,
    "high": 2
  },
  "sentiment_breakdown": {
    "positive": 1,
    "neutral": 3,
    "cautious": 7,
    "negative": 1
  },
  "lead_temperature_breakdown": {
    "cold": 2,
    "warm": 7,
    "hot": 3
  },
  "pipeline_stage_breakdown": {
    "qualification": 2,
    "education": 3,
    "objection": 5,
    "closing": 2
  },
  "content_recommendations": [
    {
      "title": "Konten edukasi: legalitas",
      "rationale": "Objection ini paling sering muncul di percakapan SGCC.",
      "suggested_format": "carousel_instagram",
      "priority": "high"
    }
  ]
}
```

---

## Endpoint 4: Follow-up Recommendation

Endpoint ini dipakai SGCC untuk meminta Clara mengubah transcript + konteks follow-up menjadi rekomendasi kerja operasional.

Tujuan utamanya:

- menentukan prioritas follow-up
- memberi `task_type`
- memberi `urgency_level`
- memberi saran waktu follow-up berikutnya

### Request

```http
POST /integrations/sgcc/follow-up-recommendation
```

### Request body schema

```json
{
  "external_conversation_id": "sgcc-chat-202",
  "source_channel": "whatsapp",
  "customer_name": "Leoni",
  "sales_name": "Aria",
  "account_category": "reguler",
  "extra_context": "Lead sudah beberapa kali follow-up.",
  "current_stage": "closing",
  "next_follow_up_at": "2026-05-19T08:00:00Z",
  "last_contact_at": "2026-05-19T07:40:00Z",
  "analysis": {
    "lead_temperature": "hot",
    "pipeline_stage": "closing",
    "buying_intent": "high",
    "sentiment": "positive",
    "risk_level": "low",
    "main_objections": [],
    "budget_signal": {
      "detected": true,
      "amount_text": "10 juta",
      "notes": "Budget terlihat siap."
    },
    "recommended_reply_strategy": {
      "tone": "urgent",
      "key_points": ["pandu langkah closing"],
      "avoid_topics": ["overclaim"]
    },
    "customer_summary": "Lead siap lanjut hari ini.",
    "next_best_action": "Segera pandu tahap closing.",
    "content_insight": "Closing intent tinggi.",
    "internal_notes": "Jangan lambat balas.",
    "confidence_score": 0.95
  },
  "messages": [
    {
      "sender_type": "customer",
      "sender_name": "Leoni",
      "message_text": "Kalau saya kirim data sekarang bisa langsung diproses?",
      "message_timestamp": "2026-05-19T09:00:00Z"
    }
  ]
}
```

### Catatan penting

- `analysis` boleh dikirim agar SGCC tidak memicu analisis ulang
- kalau `analysis` tidak dikirim, Clara akan menganalisis transcript dulu
- field `current_stage`, `next_follow_up_at`, dan `last_contact_at` dipakai untuk scoring operasional

### Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "model_name": "gpt-4.1-mini",
  "schema_version": "v1",
  "analysis": {
    "lead_temperature": "hot",
    "pipeline_stage": "closing",
    "buying_intent": "high",
    "sentiment": "positive",
    "risk_level": "low",
    "main_objections": [],
    "budget_signal": {
      "detected": true,
      "amount_text": "10 juta",
      "notes": "Budget terlihat siap."
    },
    "recommended_reply_strategy": {
      "tone": "urgent",
      "key_points": ["pandu langkah closing"],
      "avoid_topics": ["overclaim"]
    },
    "customer_summary": "Lead siap lanjut hari ini.",
    "next_best_action": "Segera pandu tahap closing.",
    "content_insight": "Closing intent tinggi.",
    "internal_notes": "Jangan lambat balas.",
    "confidence_score": 0.95
  },
  "action_mode": "auto_draft_only",
  "policy_reasons": [
    "Lead menunjukkan intent tinggi dan risk level rendah."
  ],
  "priority_score": 95,
  "urgency_level": "critical",
  "task_type": "overdue_follow_up",
  "reason": "Follow-up sudah lewat dari waktu yang dijadwalkan.",
  "recommended_action": "Hubungi lead ini secepat mungkin dan lanjutkan proses closing.",
  "suggested_next_follow_up_at": "2026-05-19T11:00:00Z"
}
```

---

## Endpoint 5: Customer Identity Match

Endpoint ini dipakai SGCC untuk meminta Clara memberi penilaian apakah satu customer SGCC kemungkinan sama dengan candidate profile lain.

Tujuan utamanya:

- deteksi duplikasi customer lintas channel
- bantu keputusan merge manual di sisi SGCC
- memberi score dan alasan kecocokan yang bisa diaudit

### Request

```http
POST /integrations/sgcc/customer-identity-match
```

### Request body schema

```json
{
  "primary_profile": {
    "external_customer_id": "cust-primary",
    "display_name": "Nia Putri",
    "phone_number": "0812-3456-7890",
    "email": "nia@example.com",
    "source_channel": "whatsapp",
    "assigned_user_name": "Aria"
  },
  "candidate_profiles": [
    {
      "external_customer_id": "cust-2",
      "display_name": "Nia P",
      "phone_number": "081234567890",
      "email": "nia@example.com",
      "source_channel": "telegram",
      "assigned_user_name": "Aria"
    }
  ],
  "match_threshold": 0.45
}
```

### Catatan penting

- endpoint ini **stateless**
- Clara tidak otomatis merge data SGCC
- SGCC tetap menjadi pihak yang memutuskan merge final
- `match_threshold` hanya threshold screening, bukan auto-merge threshold final

### Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "schema_version": "v1",
  "primary_profile": {
    "external_customer_id": "cust-primary",
    "display_name": "Nia Putri",
    "canonical_key": "nia putri",
    "identity_confidence": 0.9,
    "match_strategy": "name_normalized",
    "match_score": 1.0,
    "overlap_reason": "Profil acuan utama dari SGCC.",
    "shared_signals": [],
    "source_channel": "whatsapp"
  },
  "recommended_match": {
    "external_customer_id": "cust-2",
    "display_name": "Nia P",
    "canonical_key": "nia p",
    "identity_confidence": 0.9,
    "match_strategy": "name_normalized",
    "match_score": 0.82,
    "overlap_reason": "Overlap token identitas: nia. Email identik. PIC SGCC yang sama.",
    "shared_signals": ["token:nia", "email:exact", "assigned_user:same"],
    "source_channel": "telegram"
  },
  "match_candidates": [
    {
      "external_customer_id": "cust-2",
      "display_name": "Nia P",
      "canonical_key": "nia p",
      "identity_confidence": 0.9,
      "match_strategy": "name_normalized",
      "match_score": 0.82,
      "overlap_reason": "Overlap token identitas: nia. Email identik. PIC SGCC yang sama.",
      "shared_signals": ["token:nia", "email:exact", "assigned_user:same"],
      "source_channel": "telegram"
    }
  ],
  "should_merge": true,
  "merge_reason": "Candidate teratas memiliki match_score 0.82 dan cukup kuat untuk digabung."
}
```

### Aturan interpretasi

- `match_candidates`: semua candidate yang lolos threshold screening
- `recommended_match`: candidate terbaik bila ada
- `should_merge=true`: sinyal merge cukup kuat, tapi tetap perlu approval SGCC
- `shared_signals`: sinyal yang menyebabkan score naik

---

## Endpoint 6: KPI Enrichment

Endpoint ini dipakai SGCC untuk meminta Clara membaca raw KPI summary dari SGCC lalu mengembalikan insight eksekutif.

Tujuan utamanya:

- menambah owner/admin intelligence tanpa memindahkan system of record KPI ke Clara
- menghasilkan observation, alert, dan recommendation dari angka yang sudah ada

### Request

```http
POST /integrations/sgcc/kpi-enrichment
```

### Request body schema

```json
{
  "period_label": "Daily ops review 2026-05-20",
  "source_channel": "whatsapp",
  "summary": {
    "total_organizations": 1,
    "total_sales_users": 2,
    "total_leads": 12,
    "hot_leads": 5,
    "closing_leads": 2,
    "analyzed_conversations": 8,
    "reply_sent_rate": 0.3,
    "approved_reply_rate": 0.45,
    "overdue_follow_ups": 3,
    "pipeline_value": 15000000,
    "won_value": 2000000,
    "deposit_amount": 1000000,
    "win_rate": 0.2
  },
  "marketing_execution_summary": {
    "total_items": 4,
    "done_items": 2,
    "published_items": 1,
    "leads_generated": 10,
    "qualified_leads": 4,
    "won_leads": 0,
    "attributed_pipeline_value": 3000000,
    "attributed_won_value": 0,
    "attributed_deposit_amount": 0
  },
  "sales_performance": [],
  "organization_performance": [],
  "source_performance": []
}
```

### Catatan penting

- endpoint ini **tidak** menghitung KPI dasar dari transcript mentah
- SGCC harus mengirim KPI yang sudah dihitung di sisi SGCC
- Clara fokus sebagai layer enrichment untuk observation, alert, dan recommendation

### Response body

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "schema_version": "v1",
  "period_label": "Daily ops review 2026-05-20",
  "source_channel": "whatsapp",
  "health_status": "critical",
  "key_observations": [
    "Ada 3 follow-up yang sudah overdue. Ini sinyal paling dekat ke kehilangan momentum lead."
  ],
  "alerts": [
    {
      "severity": "high",
      "title": "Follow-up overdue menumpuk",
      "description": "Ada 3 lead yang sudah melewati jadwal follow-up.",
      "recommended_action": "Dorong tim sales membuka AI Worklist dan selesaikan overdue item hari ini.",
      "target_href": "/dashboard/follow-up"
    }
  ],
  "recommendations": [
    {
      "title": "Jadikan overdue follow-up sebagai prioritas harian",
      "rationale": "Lead yang sudah lewat jadwal follow-up adalah sumber kehilangan momentum tercepat.",
      "owner_role": "admin",
      "next_step": "Pantau AI Worklist setiap pagi dan pastikan overdue item turun sebelum siang.",
      "target_href": "/dashboard/follow-up"
    }
  ],
  "top_priorities": [
    "[HIGH] Follow-up overdue menumpuk",
    "Pantau AI Worklist setiap pagi dan pastikan overdue item turun sebelum siang."
  ]
}
```

### Aturan interpretasi

- `health_status=critical`: ada high severity alert atau KPI sehatnya buruk
- `health_status=attention`: ada warning yang perlu diintervensi
- `health_status=healthy`: tidak ada sinyal besar yang mendesak

---

## Error Contract

## HTTP status codes

### `200 OK`

Request sukses.

### `400 Bad Request`

Dipakai jika:

- transcript kosong setelah normalisasi
- payload valid JSON tapi business rule gagal
- AI output invalid / tidak sesuai schema

Contoh:

```json
{
  "detail": "Conversation messages are empty after normalization."
}
```

### `401 Unauthorized`

Dipakai jika:

- integration key tidak dikirim
- integration key salah

Contoh:

```json
{
  "detail": "Missing SGCC integration key."
}
```

atau:

```json
{
  "detail": "Invalid SGCC integration key."
}
```

### `422 Unprocessable Entity`

Dipakai jika:

- payload tidak sesuai schema Pydantic
- field enum salah
- field wajib tidak ada

Contoh:

```json
{
  "detail": [
    {
      "loc": ["body", "messages", 0, "sender_name"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

### `429 Too Many Requests`

Dipakai jika:

- caller SGCC melewati rate limit integrasi

Contoh:

```json
{
  "detail": "Too many SGCC integration requests. Please try again later."
}
```

### `503 Service Unavailable`

Dipakai jika:

- Clara belum dikonfigurasi untuk SGCC integration

Contoh:

```json
{
  "detail": "SGCC integration is not configured."
}
```

---

## Validasi dan Batasan Input

## `messages`

- min: `1`
- max: `120`

## `message_text`

- wajib
- max: `4000`

## `sender_name`

- wajib
- max: `255`

## `extra_context`

- optional
- max: `2000`

## `knowledge_snippets`

- max: `20`

## `conversations` untuk objection insights

- min: `1`
- max: `200`
- tiap item wajib punya `analysis`

## `candidate_profiles` untuk customer identity match

- min: `1`
- max: `100`

## `sales_performance` / `organization_performance` / `source_performance`

- max: `100` item per list
- sebaiknya SGCC hanya mengirim data ringkas yang benar-benar relevan

### Rekomendasi untuk SGCC

Sebelum kirim ke Clara:

- trim whitespace
- buang message kosong
- jangan kirim attachment binary
- jangan kirim HTML mentah
- kirim plain text saja
- untuk endpoint agregat, kirim analysis yang sudah tervalidasi di SGCC

---

## Contract Stability

Versi schema saat ini:

```text
v1
```

Field response:

- `schema_version`

dipakai agar SGCC bisa mendeteksi perubahan kontrak di masa depan.

### Aturan compatibility

Untuk fase sekarang:

- penambahan field baru di response sebaiknya dianggap non-breaking
- perubahan nama field lama harus dianggap breaking
- perubahan enum harus dianggap breaking bila menghapus nilai lama

---

## Rekomendasi Implementasi di SGCC

## Flow yang direkomendasikan

### Langkah 1

SGCC kirim transcript ke:

```text
POST /integrations/sgcc/conversation-analysis
```

Simpan hasil `analysis` di sisi SGCC.

### Langkah 2

Saat user butuh draft:

SGCC panggil:

```text
POST /integrations/sgcc/reply-suggestions
```

dengan `analysis` yang tadi sudah didapat.

### Kenapa ini lebih baik

- menghindari analisis ganda
- lebih hemat biaya model
- latency lebih rendah
- jejak data di SGCC lebih rapi

### Langkah 3

Untuk review tim/manager:

```text
POST /integrations/sgcc/objection-insights
```

pakai sekumpulan hasil `analysis` yang sudah disimpan SGCC.

### Langkah 4

Untuk worklist operasional:

```text
POST /integrations/sgcc/follow-up-recommendation
```

pakai transcript terbaru + context follow-up dari SGCC.

### Langkah 5

Untuk deduplikasi customer lintas source/channel:

```text
POST /integrations/sgcc/customer-identity-match
```

pakai satu profile utama dan daftar candidate dari SGCC.

### Langkah 6

Untuk owner/admin dashboard SGCC:

```text
POST /integrations/sgcc/kpi-enrichment
```

pakai raw KPI summary yang sudah dihitung di SGCC, lalu render insight dari Clara.

---

## cURL Example

## Conversation analysis

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/conversation-analysis" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "external_conversation_id": "sgcc-chat-001",
    "source_channel": "whatsapp",
    "customer_name": "Nia",
    "sales_name": "Aria",
    "messages": [
      {
        "sender_type": "customer",
        "sender_name": "Nia",
        "message_text": "Saya masih ragu soal legalitasnya.",
        "message_timestamp": "2026-05-19T09:00:00Z"
      },
      {
        "sender_type": "sales",
        "sender_name": "Aria",
        "message_text": "Baik kak, saya bantu jelaskan ya.",
        "message_timestamp": "2026-05-19T09:01:00Z"
      }
    ]
  }'
```

## Reply suggestions

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/reply-suggestions" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "external_conversation_id": "sgcc-chat-002",
    "source_channel": "whatsapp",
    "knowledge_snippets": [
      "Legalitas produk hanya boleh dijelaskan berdasarkan dokumen resmi.",
      "Jangan membuat janji hasil."
    ],
    "analysis": {
      "lead_temperature": "warm",
      "pipeline_stage": "objection",
      "buying_intent": "medium",
      "sentiment": "cautious",
      "risk_level": "medium",
      "main_objections": ["legalitas"],
      "budget_signal": {
        "detected": false,
        "amount_text": null,
        "notes": "Belum ada budget eksplisit."
      },
      "recommended_reply_strategy": {
        "tone": "professional",
        "key_points": ["jelaskan legalitas"],
        "avoid_topics": ["janji hasil"]
      },
      "customer_summary": "Lead masih butuh penguatan trust.",
      "next_best_action": "Jelaskan legalitas dan tawarkan follow-up dokumen resmi.",
      "content_insight": "Legalitas menjadi sumber resistensi utama.",
      "internal_notes": "Jangan overclaim.",
      "confidence_score": 0.9
    },
    "messages": [
      {
        "sender_type": "customer",
        "sender_name": "Nia",
        "message_text": "Saya masih ragu soal legalitasnya.",
        "message_timestamp": "2026-05-19T09:00:00Z"
      }
    ]
  }'
```

## Objection insights

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/objection-insights" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "period_label": "Weekly review 2026-05-19",
    "conversations": [
      {
        "external_conversation_id": "sgcc-chat-101",
        "source_channel": "whatsapp",
        "customer_name": "Nia",
        "sales_name": "Aria",
        "analysis": {
          "lead_temperature": "warm",
          "pipeline_stage": "objection",
          "buying_intent": "medium",
          "sentiment": "cautious",
          "risk_level": "medium",
          "main_objections": ["legalitas", "trust"],
          "budget_signal": {
            "detected": false,
            "amount_text": null,
            "notes": "Belum ada budget eksplisit."
          },
          "recommended_reply_strategy": {
            "tone": "professional",
            "key_points": ["jelaskan legalitas"],
            "avoid_topics": ["janji hasil"]
          },
          "customer_summary": "Lead masih butuh trust.",
          "next_best_action": "Kirim bukti resmi.",
          "content_insight": "Legalitas dominan.",
          "internal_notes": "Butuh materi edukasi.",
          "confidence_score": 0.88
        }
      }
    ]
  }'
```

## Follow-up recommendation

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/follow-up-recommendation" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "external_conversation_id": "sgcc-chat-202",
    "source_channel": "whatsapp",
    "customer_name": "Leoni",
    "sales_name": "Aria",
    "current_stage": "closing",
    "next_follow_up_at": "2026-05-19T08:00:00Z",
    "last_contact_at": "2026-05-19T07:40:00Z",
    "analysis": {
      "lead_temperature": "hot",
      "pipeline_stage": "closing",
      "buying_intent": "high",
      "sentiment": "positive",
      "risk_level": "low",
      "main_objections": [],
      "budget_signal": {
        "detected": true,
        "amount_text": "10 juta",
        "notes": "Budget terlihat siap."
      },
      "recommended_reply_strategy": {
        "tone": "urgent",
        "key_points": ["pandu langkah closing"],
        "avoid_topics": ["overclaim"]
      },
      "customer_summary": "Lead siap lanjut hari ini.",
      "next_best_action": "Segera pandu tahap closing.",
      "content_insight": "Closing intent tinggi.",
      "internal_notes": "Jangan lambat balas.",
      "confidence_score": 0.95
    },
    "messages": [
      {
        "sender_type": "customer",
        "sender_name": "Leoni",
        "message_text": "Kalau saya kirim data sekarang bisa langsung diproses?",
        "message_timestamp": "2026-05-19T09:00:00Z"
      }
    ]
  }'
```

## Customer identity match

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/customer-identity-match" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "primary_profile": {
      "external_customer_id": "cust-primary",
      "display_name": "Nia Putri",
      "phone_number": "0812-3456-7890",
      "email": "nia@example.com",
      "source_channel": "whatsapp",
      "assigned_user_name": "Aria"
    },
    "candidate_profiles": [
      {
        "external_customer_id": "cust-2",
        "display_name": "Nia P",
        "phone_number": "081234567890",
        "email": "nia@example.com",
        "source_channel": "telegram",
        "assigned_user_name": "Aria"
      }
    ],
    "match_threshold": 0.45
  }'
```

## KPI enrichment

```bash
curl -X POST "http://127.0.0.1:8000/integrations/sgcc/kpi-enrichment" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Clara-Integration-Key: super-secret-integration-key" \
  -d '{
    "period_label": "Daily ops review 2026-05-20",
    "source_channel": "whatsapp",
    "summary": {
      "total_organizations": 1,
      "total_sales_users": 2,
      "total_leads": 12,
      "hot_leads": 5,
      "closing_leads": 2,
      "analyzed_conversations": 8,
      "reply_sent_rate": 0.3,
      "approved_reply_rate": 0.45,
      "overdue_follow_ups": 3,
      "pipeline_value": 15000000,
      "won_value": 2000000,
      "deposit_amount": 1000000,
      "win_rate": 0.2
    },
    "marketing_execution_summary": {
      "total_items": 4,
      "done_items": 2,
      "published_items": 1,
      "leads_generated": 10,
      "qualified_leads": 4,
      "won_leads": 0,
      "attributed_pipeline_value": 3000000,
      "attributed_won_value": 0,
      "attributed_deposit_amount": 0
    },
    "sales_performance": [],
    "organization_performance": [],
    "source_performance": []
  }'
```

---

## Secure-by-Design Notes

## Untuk tim Clara

- jangan log full transcript mentah di production tanpa masking
- rate limit endpoint integrasi
- pisahkan integration key per environment
- audit semua request integrasi penting

## Untuk tim SGCC

- jangan expose integration key ke browser
- panggil Clara dari backend SGCC, bukan dari frontend langsung
- anggap response text dari Clara sebagai **untrusted output**
- tetap lakukan output encoding/sanitization saat render draft ke UI

---

## Out of Scope Fase 1-3

Hal-hal ini **belum** termasuk kontrak fase sekarang:

- webhook callback dari Clara ke SGCC
- persistence hasil ke database Clara sebagai source of truth
- tenant scoping SGCC multi-org yang lebih kompleks
- automatic merge write-back dari Clara ke SGCC
- async batch KPI processing

---

## Roadmap Kontrak Berikutnya

Setelah fase 3 stabil, endpoint yang paling layak ditambahkan:

1. webhook callback untuk async enrichment
2. per-client scoped rate policy
3. API versioning lebih formal (`/v1/integrations/sgcc/...`)
4. optional async batch processing untuk KPI dan identity review

---

## Ringkasan Singkat

Kontrak fase 1 sampai fase 3 ini membuat SGCC bisa memakai Clara untuk:

- membaca transcript dengan AI
- mendapatkan klasifikasi sales intelligence
- menghasilkan 3 draft balasan
- mendapatkan `action_mode` dan `policy_reasons`
- membaca pola objection agregat
- mendapatkan rekomendasi prioritas follow-up
- memberi score kecocokan identitas customer
- memperkaya dashboard KPI SGCC dengan insight eksekutif
- memakai audit log dan rate limit khusus integrasi

tanpa harus memindahkan seluruh sistem operasional SGCC ke Clara.
