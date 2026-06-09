# Alignment API Clara dengan `SCC_Spesifikasi_Master.md`

Dokumen ini menjadikan [SCC_Spesifikasi_Master.md](/Users/newsmaker23/Projects/clara/SCC_Spesifikasi_Master.md) sebagai **guideline utama** untuk pengembangan API integrasi antara SGCC dan Clara.

Tujuannya:

- memastikan API Clara **selaras dengan filosofi SCC**
- mencegah Clara mengambil alih **operational truth** milik SGCC
- menjaga agar endpoint Clara tetap berfungsi sebagai **derived intelligence layer**
- memberi arah untuk fase endpoint berikutnya

---

## 1. Prinsip Dasar dari SCC yang Wajib Dipatuhi

Berdasarkan spesifikasi master SCC, prinsip berikut harus dianggap **non-negotiable**:

### 1. SGCC = operational truth

Artinya data berikut tetap milik SGCC:

- lead
- assignment
- queue state aktual
- timeline
- message log operasional
- status kerja sales

Clara **tidak boleh** menjadi source of truth untuk data itu.

### 2. Execution > reporting

Artinya API Clara yang paling bernilai untuk SCC adalah:

- next action
- follow-up recommendation
- objection pattern
- risk signal
- draft bantuan

Bukan dashboard cantik semata.

### 3. Queue > dashboard

Artinya prioritas API harus mengarah ke:

- queue rerank
- next action enrichment
- SLA risk detection
- ghost risk detection

Bukan hanya KPI agregat.

### 4. Human owns workflow

Artinya hasil Clara harus diperlakukan sebagai:

- recommendation
- advisory
- derived intelligence

Bukan:

- auto-overwrite truth
- auto-close lead
- auto-merge customer tanpa keputusan SGCC

### 5. Timeline = audit trail

Artinya bila nanti integrasi berkembang, setiap derived output Clara yang dipakai SGCC idealnya:

- bisa dicatat ke timeline SGCC
- bisa diaudit
- punya alasan/jejak keputusan

### 6. Derived intelligence tidak boleh overwrite truth

Ini prinsip paling penting.

Contoh:

- Clara boleh bilang `pipeline_stage = objection`
- tapi SGCC yang memutuskan apakah stage truth diubah atau tidak

- Clara boleh bilang `should_merge = true`
- tapi SGCC yang memutuskan merge profile atau tidak

---

## 2. Konsekuensi Arsitektur API

Karena mengikuti SCC spec, maka desain API Clara ke SGCC harus seperti ini:

### SGCC mengirim truth

SGCC mengirim:

- transcript
- lead context
- stage truth saat ini
- follow-up truth saat ini
- KPI raw yang sudah dihitung SGCC

### Clara mengembalikan derived layer

Clara mengembalikan:

- analysis
- risk score
- action mode
- reply suggestions
- queue recommendation
- insight agregat
- KPI interpretation

### SGCC memutuskan final action

SGCC tetap menjadi pengambil keputusan final untuk:

- update lead
- ubah owner
- mark done
- snooze
- dismiss
- merge identity
- update queue truth

---

## 3. Mapping Endpoint Clara Saat Ini ke Filosofi SCC

Berikut status endpoint yang **sudah ada** dan seberapa selaras dengan SCC.

### 1. `POST /integrations/sgcc/conversation-analysis`

Status:

- **selaras**

Alasan:

- hanya membaca transcript
- mengembalikan analisis derived
- tidak mengubah truth SGCC

Peran dalam SCC:

- snapshot intelligence
- bahan queue enrichment
- bahan action center

### 2. `POST /integrations/sgcc/reply-suggestions`

Status:

- **selaras**

Alasan:

- membantu eksekusi sales
- tetap human-controlled
- tidak mengirim pesan otomatis

Peran dalam SCC:

- execution assist
- queue action support

### 3. `POST /integrations/sgcc/objection-insights`

Status:

- **selaras**

Alasan:

- agregasi insight
- tidak overwrite lead truth
- cocok untuk manager/head review

Peran dalam SCC:

- action center insight
- knowledge improvement

### 4. `POST /integrations/sgcc/follow-up-recommendation`

Status:

- **sangat selaras**

Alasan:

- langsung mendukung queue-first architecture
- membantu next action
- cocok dengan prinsip execution > reporting

Peran dalam SCC:

- queue rerank input
- SLA support
- ghost risk precursor

### 5. `POST /integrations/sgcc/customer-identity-match`

Status:

- **selaras dengan syarat**

Syarat:

- hasilnya harus tetap advisory
- jangan dipakai auto-merge tanpa approval SGCC

Peran dalam SCC:

- data hygiene
- cross-channel dedupe

### 6. `POST /integrations/sgcc/kpi-enrichment`

Status:

- **selaras**

Alasan:

- SGCC tetap hitung KPI truth
- Clara hanya memberi interpretasi

Peran dalam SCC:

- dashboard secondary layer
- owner/head interpretation

---

## 4. Hal yang Tidak Boleh Dilakukan API Clara

Supaya tetap patuh ke SCC spec, hindari desain seperti ini:

### Jangan auto-update truth SGCC

Contoh yang salah:

- Clara langsung ubah stage lead di database SGCC
- Clara langsung mark queue item sebagai done
- Clara langsung ganti owner

### Jangan auto-merge identity tanpa keputusan manusia

Karena bertentangan dengan:

- human owns workflow
- timeline = audit trail

### Jangan jadikan Clara sumber queue truth

Queue truth tetap milik SGCC.

Clara hanya boleh memberi:

- priority signal
- recommended action
- ghost risk
- SLA risk

### Jangan jadikan KPI Clara sebagai angka truth resmi SCC

Kalau ada beda hitung, yang menang tetap:

- SGCC summary

Clara hanya:

- menjelaskan
- menginterpretasi
- memprioritaskan

---

## 5. Gap API terhadap SCC Master yang Masih Belum Ada

Kalau benar-benar mau semakin selaras dengan `SCC_Spesifikasi_Master.md`, masih ada beberapa blok API yang sebaiknya ditambahkan.

### A. Queue lifecycle API enrichment

SCC spec menekankan:

- queue = work mode harian
- CTA:
  - chat now
  - done
  - snooze
  - dismiss

Yang masih belum ada dari Clara:

- `queue-rerank`
- `queue-bulk-prioritization`
- `queue-dismiss-recommendation`
- `ghost-risk-detection`

### B. Timeline event enrichment

SCC sangat menekankan timeline sebagai audit trail.

Yang belum ada:

- endpoint untuk menghasilkan event summary recommendation
- endpoint untuk menormalkan AI reasoning menjadi event note yang bisa ditulis SGCC ke timeline

### C. Snapshot layer formal

SCC domain model membedakan:

- truth
- snapshot
- queue

Yang belum ada secara eksplisit:

- endpoint `snapshot-recompute-preview`
- endpoint `lead-priority-score`
- endpoint `queue-state-enrichment`

### D. Action Center pressure signals

SCC menyebut pressure utama:

- overdue
- warm uncontacted
- ghost risk
- hot opportunity

Clara saat ini baru kuat di:

- overdue follow-up
- hot lead reply urgency

Yang belum lengkap:

- warm uncontacted API
- ghost risk API
- hot opportunity escalation API

### E. Assignment & rebalance advisory

SCC role Head butuh:

- rebalance beban
- monitor SLA

Yang belum ada:

- `owner-rebalance-recommendation`
- `workload-pressure-summary`
- `assignment-risk-signal`

---

## 6. Prioritas Endpoint Berikutnya agar Selaras dengan SCC

Kalau kita benar-benar patuh ke SCC spec, maka urutan prioritas API berikutnya seharusnya seperti ini:

### Prioritas 1

`POST /integrations/sgcc/queue-rerank`

Output yang diharapkan:

- `priority_score`
- `reason`
- `recommended_action`
- `urgency_level`
- `ghost_risk`
- `sla_risk`

Kenapa paling penting:

- paling sesuai dengan queue-first architecture

### Prioritas 2

`POST /integrations/sgcc/action-center-signals`

Output:

- overdue pressure
- warm uncontacted
- ghost risk
- hot opportunity

Kenapa:

- langsung memetakan operational pressure SCC

### Prioritas 3

`POST /integrations/sgcc/timeline-event-summary`

Output:

- event label
- event summary
- recommended timeline note
- audit-safe explanation

Kenapa:

- menjaga prinsip timeline = audit trail

### Prioritas 4

`POST /integrations/sgcc/assignment-rebalance-recommendation`

Output:

- overloaded owners
- underutilized owners
- suggested rebalance candidates

Kenapa:

- sesuai role Head di SCC

---

## 7. Rule Desain API ke Depan

Supaya semua endpoint berikutnya tetap selaras dengan SCC, pakai rule ini:

### Rule 1

Setiap endpoint Clara harus menjawab:

> apakah ini truth atau derived?

Kalau truth:

- seharusnya milik SGCC

Kalau derived:

- boleh ada di Clara

### Rule 2

Setiap output Clara harus bisa dijelaskan.

Minimal punya salah satu:

- `reason`
- `policy_reasons`
- `overlap_reason`
- `recommended_action`

Karena SCC butuh auditability.

### Rule 3

Setiap endpoint yang mempengaruhi queue harus mendukung:

- speed
- clarity
- operator usability

Bukan sekadar analytics.

### Rule 4

Clara tidak boleh mengambil alih ownership workflow.

Clara hanya:

- memberi signal
- memberi recommendation
- memberi ranking

SGCC tetap:

- execute
- persist
- audit

---

## 8. Kesimpulan

Kalau memakai `SCC_Spesifikasi_Master.md` sebagai guideline, maka posisi Clara harus jelas:

- **Clara = derived intelligence engine**
- **SGCC = operational execution system**

Itu berarti:

- endpoint Clara yang sekarang mayoritas sudah on track
- tapi arah pengembangan berikutnya harus lebih condong ke:
  - queue
  - action center
  - timeline support
  - assignment advisory

Bukan sekadar menambah analytics baru.

Kalau diringkas satu kalimat:

> API Clara yang benar untuk SCC adalah API yang membuat sales bekerja lebih cepat, lebih jelas, dan lebih terukur tanpa merebut operational truth dari SGCC.
