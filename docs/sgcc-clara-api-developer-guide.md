# Panduan Developer API SGCC <-> Clara

Dokumen ini ditulis untuk developer `sales-command-center` yang ingin memakai API Clara secara aman, rapi, dan production-minded.

Dokumen ini melengkapi kontrak formal di:

- [sgcc-clara-api-contract.md](/Users/newsmaker23/Projects/clara/docs/sgcc-clara-api-contract.md)
- [sgcc-clara-api-alignment-with-scc-spec.md](/Users/newsmaker23/Projects/clara/docs/sgcc-clara-api-alignment-with-scc-spec.md)

Kalau dokumen kontrak fokus pada **shape request/response**, dokumen ini fokus pada:

- cara setup lokal
- cara auth
- urutan penggunaan endpoint
- contoh payload masuk/keluar
- error handling
- best practice implementasi di SGCC

---

## 1. Gambaran Arsitektur

Peran integrasi ini:

- **SGCC** tetap menjadi system of record operasional
- **Clara** menjadi AI intelligence layer

Artinya:

- data prospect/customer/progress utama tetap disimpan di SGCC
- Clara hanya menerima payload yang diperlukan
- Clara mengembalikan hasil analisis/enrichment
- SGCC memutuskan sendiri apakah hasil itu disimpan, ditampilkan, atau dipakai untuk workflow internal

Model integrasi:

- protocol: `HTTP/JSON`
- auth: service-to-service
- mode: `stateless`
- caller: backend SGCC
- callee: backend Clara

Jangan panggil endpoint Clara langsung dari browser/frontend SGCC.

---

## 2. Base URL dan Auth

Base URL lokal Clara:

```text
http://127.0.0.1:8000
```

Semua endpoint berada di bawah prefix:

```text
/integrations/sgcc
```

Header auth yang wajib:

```http
X-Clara-Integration-Key: <integration-key>
```

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

## 3. Konfigurasi yang Dibutuhkan

### Di Clara

File `.env` backend Clara minimal perlu:

```env
SGCC_INTEGRATION_API_KEY=replace_with_long_random_key
SGCC_INTEGRATION_RATE_LIMIT_PER_MINUTE=30
OPENAI_API_KEY=your_openai_key
```

### Di SGCC

File `.env` SGCC minimal perlu:

```env
CLARA_BASE_URL=http://127.0.0.1:8000
CLARA_INTEGRATION_KEY=replace_with_same_key_as_clara
CLARA_CONNECT_TIMEOUT_SECONDS=5
CLARA_TIMEOUT_SECONDS=20
```

Service Laravel yang sudah tersedia di SGCC:

- [ClaraIntegrationService.php](/Users/newsmaker23/Projects/clara/sales-command-center/app/Services/ClaraIntegrationService.php)

---

## 4. Daftar Endpoint yang Tersedia

Saat ini Clara menyediakan 6 endpoint untuk SGCC:

1. `POST /integrations/sgcc/conversation-analysis`
2. `POST /integrations/sgcc/reply-suggestions`
3. `POST /integrations/sgcc/objection-insights`
4. `POST /integrations/sgcc/follow-up-recommendation`
5. `POST /integrations/sgcc/customer-identity-match`
6. `POST /integrations/sgcc/kpi-enrichment`

---

## 5. Urutan Pemakaian yang Direkomendasikan

Untuk flow SGCC yang paling masuk akal:

### Flow operasional percakapan

1. panggil `conversation-analysis`
2. simpan hasil `analysis` di SGCC
3. saat perlu balasan, panggil `reply-suggestions` dengan `analysis` tadi
4. saat perlu worklist, panggil `follow-up-recommendation`

### Flow manager/admin

1. kumpulkan hasil `analysis` dari banyak percakapan
2. panggil `objection-insights`

### Flow deduplikasi customer

1. siapkan `primary_profile`
2. siapkan `candidate_profiles`
3. panggil `customer-identity-match`

### Flow owner/admin KPI

1. SGCC hitung KPI mentah di sisi sendiri
2. kirim ke `kpi-enrichment`
3. render observation, alerts, recommendation dari Clara

---

## 6. Endpoint 1: Conversation Analysis

Dipakai untuk membaca transcript dan mengembalikan analisis AI.

### Request

```http
POST /integrations/sgcc/conversation-analysis
```

### Payload masuk

```json
{
  "external_conversation_id": "sgcc-chat-001",
  "source_channel": "whatsapp",
  "customer_name": "Nia",
  "sales_name": "Aria",
  "account_category": "reguler",
  "extra_context": "Lead dari iklan, fokus trust dan legalitas.",
  "messages": [
    {
      "sender_type": "customer",
      "sender_name": "Nia",
      "message_text": "Saya masih ragu soal legalitasnya.",
      "message_timestamp": "2026-05-20T09:00:00Z"
    },
    {
      "sender_type": "sales",
      "sender_name": "Aria",
      "message_text": "Baik kak, saya bantu jelaskan ya.",
      "message_timestamp": "2026-05-20T09:01:00Z"
    }
  ]
}
```

### Field penting

- `external_conversation_id`
  - ID conversation dari SGCC
  - dipakai untuk trace/audit, bukan ID Clara
- `source_channel`
  - `whatsapp`
  - `telegram`
  - `other`
- `messages`
  - minimal 1 item
  - maksimal 120 item
- `sender_type`
  - `customer`
  - `sales`
  - `system`

### Payload keluar

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

### Kapan dipakai

- saat chat baru masuk
- saat prospect dibuka pertama kali
- saat review chat membutuhkan klasifikasi AI terbaru

### Best practice

- simpan `analysis` di SGCC
- jangan panggil berulang-ulang untuk chat yang sama kecuali transcript berubah

---

## 7. Endpoint 2: Reply Suggestions

Dipakai untuk menghasilkan 3 draft balasan.

### Request

```http
POST /integrations/sgcc/reply-suggestions
```

### Payload masuk

```json
{
  "external_conversation_id": "sgcc-chat-002",
  "source_channel": "whatsapp",
  "customer_name": "Nia",
  "sales_name": "Aria",
  "knowledge_snippets": [
    "Legalitas hanya boleh dijelaskan berdasarkan dokumen resmi.",
    "Jangan menjanjikan profit."
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
      "message_timestamp": "2026-05-20T09:00:00Z"
    }
  ]
}
```

### Catatan

- `analysis` boleh dikirim
- kalau `analysis` tidak dikirim, Clara akan menganalisis dulu
- `knowledge_snippets` dipakai untuk grounding tambahan dari SGCC

### Payload keluar

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

### Interpretasi `action_mode`

- `auto_draft_only`
  - relatif aman ditampilkan sebagai draft
- `human_approval_required`
  - sebaiknya direview sales/manager dulu
- `escalate_to_human`
  - kasus sensitif/high-risk, jangan auto-trust

---

## 8. Endpoint 3: Objection Insights

Dipakai untuk membaca pola objection agregat dari banyak hasil analysis.

### Request

```http
POST /integrations/sgcc/objection-insights
```

### Payload masuk

```json
{
  "period_label": "Weekly review 2026-05-20",
  "conversations": [
    {
      "external_conversation_id": "conv-1",
      "source_channel": "whatsapp",
      "customer_name": "Nia",
      "sales_name": "Aria",
      "account_category": "mini",
      "analysis": {
        "lead_temperature": "warm",
        "pipeline_stage": "objection",
        "buying_intent": "medium",
        "sentiment": "cautious",
        "risk_level": "medium",
        "main_objections": ["legalitas", "harga"],
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
        "customer_summary": "Masih ragu soal legalitas dan harga.",
        "next_best_action": "Jawab legalitas dan jelaskan value.",
        "content_insight": "Butuh konten trust.",
        "internal_notes": "Perlu asset legalitas.",
        "confidence_score": 0.92
      }
    }
  ]
}
```

### Payload keluar

```json
{
  "provider": "clara",
  "integration_client": "sgcc",
  "schema_version": "v1",
  "period_label": "Weekly review 2026-05-20",
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

### Kapan dipakai

- halaman manager insights
- weekly review
- knowledge queue / script improvement

### Best practice

- kirim analysis yang sudah ada di SGCC
- jangan kirim transcript mentah ke endpoint ini

---

## 9. Endpoint 4: Follow-up Recommendation

Dipakai untuk menghasilkan rekomendasi operasional follow-up.

### Request

```http
POST /integrations/sgcc/follow-up-recommendation
```

### Payload masuk

```json
{
  "external_conversation_id": "follow-1",
  "source_channel": "whatsapp",
  "customer_name": "Leoni",
  "sales_name": "Aria",
  "current_stage": "closing",
  "next_follow_up_at": "2026-05-19T09:00:00Z",
  "last_contact_at": "2026-05-19T08:40:00Z",
  "analysis": {
    "lead_temperature": "hot",
    "pipeline_stage": "closing",
    "buying_intent": "high",
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": true,
      "amount_text": "3 juta",
      "notes": "Sudah ada indikasi budget."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["klarifikasi legalitas", "dorong keputusan"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "Lead sangat dekat ke closing tapi masih ragu trust.",
    "next_best_action": "Hubungi segera, jawab legalitas, dan minta keputusan final.",
    "content_insight": "Trust menjadi hambatan terakhir sebelum closing.",
    "internal_notes": "Jangan biarkan lead pending terlalu lama.",
    "confidence_score": 0.94
  },
  "messages": [
    {
      "sender_type": "customer",
      "sender_name": "Leoni",
      "message_text": "Kalau saya kirim data sekarang bisa langsung diproses?",
      "message_timestamp": "2026-05-20T09:00:00Z"
    }
  ]
}
```

### Payload keluar

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
    "sentiment": "cautious",
    "risk_level": "medium",
    "main_objections": ["legalitas"],
    "budget_signal": {
      "detected": true,
      "amount_text": "3 juta",
      "notes": "Sudah ada indikasi budget."
    },
    "recommended_reply_strategy": {
      "tone": "professional",
      "key_points": ["klarifikasi legalitas", "dorong keputusan"],
      "avoid_topics": ["janji hasil"]
    },
    "customer_summary": "Lead sangat dekat ke closing tapi masih ragu trust.",
    "next_best_action": "Hubungi segera, jawab legalitas, dan minta keputusan final.",
    "content_insight": "Trust menjadi hambatan terakhir sebelum closing.",
    "internal_notes": "Jangan biarkan lead pending terlalu lama.",
    "confidence_score": 0.94
  },
  "action_mode": "human_approval_required",
  "policy_reasons": [
    "Risk level medium: balasan butuh approval sales."
  ],
  "priority_score": 95,
  "urgency_level": "critical",
  "task_type": "overdue_follow_up",
  "reason": "Follow-up sudah lewat dari waktu yang dijadwalkan.",
  "recommended_action": "Hubungi segera, jawab legalitas, dan minta keputusan final.",
  "suggested_next_follow_up_at": "2026-05-20T11:00:00Z"
}
```

### Kapan dipakai

- worklist harian sales
- sort prioritas chat/prospect
- manager coaching

---

## 10. Endpoint 5: Customer Identity Match

Dipakai untuk membantu deduplikasi customer lintas source/channel.

### Request

```http
POST /integrations/sgcc/customer-identity-match
```

### Payload masuk

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
      "external_customer_id": "cust-match",
      "display_name": "Nia P",
      "phone_number": "081234567890",
      "email": "nia@example.com",
      "source_channel": "telegram",
      "assigned_user_name": "Aria"
    },
    {
      "external_customer_id": "cust-other",
      "display_name": "Raka",
      "phone_number": "0899999999",
      "email": "raka@example.com",
      "source_channel": "other",
      "assigned_user_name": "Bima"
    }
  ],
  "match_threshold": 0.45
}
```

### Payload keluar

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
    "external_customer_id": "cust-match",
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
      "external_customer_id": "cust-match",
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

### Best practice

- anggap hasil ini sebagai **rekomendasi**, bukan keputusan final otomatis
- tetap butuh approval SGCC untuk merge actual

---

## 11. Endpoint 6: KPI Enrichment

Dipakai untuk memperkaya KPI mentah SGCC dengan insight dari Clara.

### Request

```http
POST /integrations/sgcc/kpi-enrichment
```

### Payload masuk

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

### Payload keluar

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

### Kapan dipakai

- dashboard owner
- dashboard admin
- executive morning briefing

---

## 12. Error Handling

### `401 Unauthorized`

Contoh:

```json
{
  "detail": "Missing SGCC integration key."
}
```

Atau:

```json
{
  "detail": "Invalid SGCC integration key."
}
```

### `400 Bad Request`

Contoh:

```json
{
  "detail": "Conversation messages are empty after normalization."
}
```

### `422 Unprocessable Entity`

Payload tidak sesuai schema.

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

Contoh:

```json
{
  "detail": "Too many SGCC integration requests. Please try again later."
}
```

### `503 Service Unavailable`

Contoh:

```json
{
  "detail": "SGCC integration is not configured."
}
```

---

## 13. Rate Limit

Default Clara saat ini:

- `30 request / menit / endpoint / IP`

Jadi:

- jangan spam retry tanpa backoff
- untuk flow mass processing, lebih baik batch atau queue di SGCC

---

## 14. Audit Log

Clara mencatat audit log untuk request sukses integrasi.

Contoh action yang tercatat:

- `integration.sgcc.conversation_analysis`
- `integration.sgcc.reply_suggestions`
- `integration.sgcc.objection_insights`
- `integration.sgcc.follow_up_recommendation`
- `integration.sgcc.customer_identity_match`
- `integration.sgcc.kpi_enrichment`

Ini penting untuk:

- debugging
- observability
- audit security

---

## 15. Best Practice Implementasi di SGCC

### Simpan hasil analysis

Jangan panggil `conversation-analysis` terus menerus kalau transcript belum berubah.

### Backend-to-backend only

Jangan expose `CLARA_INTEGRATION_KEY` ke frontend.

### Treat AI output as untrusted

Text dari Clara tetap harus dirender aman di UI SGCC.  
Hindari blind HTML rendering.

### Tambahkan retry yang sehat

Retry boleh, tapi:

- pakai backoff
- jangan retry tanpa batas
- jangan retry terus untuk `401` atau `422`

### Pisahkan sync vs async

Yang cocok sync:

- `conversation-analysis`
- `reply-suggestions`
- `follow-up-recommendation`

Yang lebih cocok async/queued kalau volume besar:

- `objection-insights`
- `kpi-enrichment`
- `customer-identity-match` batch besar

---

## 16. Cara Pakai dari Laravel SGCC

Service yang sudah tersedia:

- [ClaraIntegrationService.php](/Users/newsmaker23/Projects/clara/sales-command-center/app/Services/ClaraIntegrationService.php)

Contoh sederhana:

```php
use App\Services\ClaraIntegrationService;
use RuntimeException;

public function analyze(ClaraIntegrationService $clara)
{
    try {
        $result = $clara->analyzeConversation([
            'external_conversation_id' => 'sgcc-chat-001',
            'source_channel' => 'whatsapp',
            'customer_name' => 'Nia',
            'sales_name' => 'Aria',
            'messages' => [
                [
                    'sender_type' => 'customer',
                    'sender_name' => 'Nia',
                    'message_text' => 'Saya masih ragu soal legalitasnya.',
                    'message_timestamp' => '2026-05-20T09:00:00Z',
                ],
            ],
        ]);

        return response()->json($result);
    } catch (RuntimeException $exception) {
        return response()->json([
            'message' => $exception->getMessage(),
        ], 502);
    }
}
```

Dokumentasi SGCC side:

- [sales-command-center/docs/clara-integration.md](/Users/newsmaker23/Projects/clara/sales-command-center/docs/clara-integration.md)

---

## 17. Checklist Integrasi untuk Tim SGCC

Sebelum menganggap integrasi siap:

- Clara backend hidup
- `SGCC_INTEGRATION_API_KEY` sudah di-set
- SGCC punya `CLARA_BASE_URL` dan `CLARA_INTEGRATION_KEY`
- endpoint `conversation-analysis` sukses
- endpoint `reply-suggestions` sukses
- endpoint `follow-up-recommendation` sukses
- endpoint `objection-insights` sukses
- endpoint `customer-identity-match` sukses
- endpoint `kpi-enrichment` sukses
- error `401` dan `429` ter-handle dengan baik di SGCC

---

## 18. Referensi

- kontrak formal:
  - [sgcc-clara-api-contract.md](/Users/newsmaker23/Projects/clara/docs/sgcc-clara-api-contract.md)
- service client Laravel SGCC:
  - [ClaraIntegrationService.php](/Users/newsmaker23/Projects/clara/sales-command-center/app/Services/ClaraIntegrationService.php)
- panduan SGCC side:
  - [sales-command-center/docs/clara-integration.md](/Users/newsmaker23/Projects/clara/sales-command-center/docs/clara-integration.md)
