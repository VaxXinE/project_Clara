# Test Conversations Clara

Dokumen ini berisi contoh conversation siap pakai untuk:

- `Lead Capture`
- `CRM`
- `Daily Discipline Log`
- `Chat Review Center`
- `Knowledge Update Queue`
- `Manager Insights`
- `KPI`
- `WhatsApp server-side webhook`

Format yang saya siapkan:

- WhatsApp raw text
- Telegram raw text
- skenario per kategori bisnis `mini` dan `reguler`
- contoh payload webhook Meta

Gunakan conversation ini bersama [MANUAL_TEST_CASES_CLARA.md](/Users/newsmaker23/Projects/clara/MANUAL_TEST_CASES_CLARA.md).

---

## 1. Conversation A: Hot Lead Mini

Tujuan:

- lead kategori `mini`
- cocok untuk:
  - lead capture
  - AI analysis
  - draft suggestion
  - discipline log
  - KPI `hot lead`
  - account category `mini`

### Metadata

- Customer: `Leoni`
- Sales: `Aria`
- Channel: `WhatsApp`
- Category: `mini`
- Sinyal: hot, siap kirim data

### WhatsApp Raw Text

```text
12/04/26, 09.05 - Leoni: Halo kak, saya lihat info paket mini.
12/04/26, 09.06 - Aria: Halo kak, siap. Saya bantu jelaskan paket mini ya.
12/04/26, 09.07 - Leoni: Ini legal dan aman kan kak?
12/04/26, 09.08 - Aria: Siap kak, legalitasnya ada dan nanti saya kirim penjelasan resminya.
12/04/26, 09.10 - Leoni: Kalau saya lanjut hari ini prosesnya bisa dibantu?
12/04/26, 09.11 - Aria: Bisa kak, saya dampingi dari verifikasi sampai proses berikutnya.
12/04/26, 09.12 - Leoni: Oke kak, nanti saya kirim data hari ini.
```

### Expected Signal

- stage: `closing`
- temperature: `hot`
- objection: `legalitas`
- next best action: follow-up cepat dan kirim panduan data

### Cocok untuk test case

- `TC-CAP-002`
- `TC-CRM-001`
- `TC-DISC-001`
- `TC-REVIEW-001`
- `TC-KNOW-001`
- `TC-MGR-004`
- `TC-KPI-003`

---

## 2. Conversation B: Warm Lead Reguler Dengan Objection Harga

Tujuan:

- lead kategori `reguler`
- cocok untuk:
  - objection trend
  - coaching review
  - knowledge proposal soal handling harga

### Metadata

- Customer: `Nia Putri`
- Sales: `Aria`
- Channel: `WhatsApp`
- Category: `reguler`
- Sinyal: warm, keberatan harga

### WhatsApp Raw Text

```text
15/04/26, 10.15 - Nia Putri: Halo kak, saya mau tanya program yang reguler.
15/04/26, 10.16 - Aria: Siap kak, saya bantu jelaskan untuk program reguler ya.
15/04/26, 10.18 - Nia Putri: Saya tertarik, tapi jujur masih mikir soal harganya.
15/04/26, 10.19 - Aria: Siap kak, boleh saya bantu jelaskan value dan tahap prosesnya?
15/04/26, 10.20 - Nia Putri: Boleh, soalnya saya bandingkan dengan tempat lain juga.
15/04/26, 10.22 - Aria: Baik kak, saya bantu jelaskan perbedaannya dengan jelas ya.
15/04/26, 10.25 - Nia Putri: Oke, saya baca dulu nanti saya kabari.
```

### Expected Signal

- stage: `objection`
- temperature: `warm`
- objection: `harga`
- customer mood: `cautious`

### Cocok untuk test case

- `TC-DISC-002`
- `TC-REVIEW-003`
- `TC-REVIEW-004`
- `TC-KNOW-002`
- `TC-MGR-005`

---

## 3. Conversation C: Stale Lead Reguler

Tujuan:

- bikin case `stale`
- cocok untuk:
  - worklist overdue
  - stale lead ratio
  - manager boundary alert

### Metadata

- Customer: `Raka`
- Sales: `Aria`
- Channel: `WhatsApp`
- Category: `reguler`
- Sinyal: sempat tertarik, lalu diam

### WhatsApp Raw Text

```text
01/04/26, 08.10 - Raka: Halo kak, saya mau tanya dulu.
01/04/26, 08.11 - Aria: Siap kak, silakan.
01/04/26, 08.15 - Raka: Saya lagi lihat opsi yang cocok, tapi belum ngerti alurnya.
01/04/26, 08.16 - Aria: Baik kak, saya bantu jelaskan alurnya pelan-pelan ya.
01/04/26, 08.18 - Raka: Oke kak.
```

### Setup tambahan

Setelah conversation dibuat:

- jangan isi discipline log hari ini
- set `next_follow_up_at` ke tanggal kemarin

### Expected Signal

- stale
- overdue follow-up
- manager boundary alert

### Cocok untuk test case

- `TC-DISC-005`
- `TC-ACT-001`
- `TC-MGR-003`

---

## 4. Conversation D: Escalation / Unique Case

Tujuan:

- bikin coaching label `unik` atau `perlu_eskalasi`
- cocok untuk review case yang butuh intervensi manager/head

### Metadata

- Customer: `Bima`
- Sales: `Sales A`
- Channel: `WhatsApp`
- Category: `reguler`

### WhatsApp Raw Text

```text
18/04/26, 13.00 - Bima: Kak, saya butuh penjelasan rinci karena saya mau pakai atas nama perusahaan.
18/04/26, 13.01 - Sales A: Siap pak, saya bantu jelaskan tahap dasarnya dulu ya.
18/04/26, 13.03 - Bima: Saya juga perlu tahu nanti dokumen apa saja dan siapa yang bertanggung jawab kalau ada kendala.
18/04/26, 13.05 - Sales A: Baik pak, saya bantu rangkum kebutuhan Bapak dulu supaya jelas.
18/04/26, 13.06 - Bima: Tolong yang jelas ya, karena saya tidak mau ada informasi yang berubah-ubah.
```

### Expected Signal

- review label: `unik` atau `perlu_eskalasi`
- coaching focus: kejelasan komunikasi, handling corporate concern

### Cocok untuk test case

- `TC-REVIEW-003`
- `TC-REVIEW-005`
- `TC-KNOW-001`

---

## 5. Conversation E: Telegram Lead

Tujuan:

- test multi-channel
- test source channel Telegram
- test customer identity cross-channel

### Metadata

- Customer: `Leoni`
- Sales: `Aria`
- Channel: `Telegram`
- Category: `mini`

### Telegram Raw Text

```text
[18.05.2026 09:12] Leoni: Halo kak, saya lanjut tanya yang paket mini ya.
[18.05.2026 09:13] Aria: Siap kak, saya bantu jelaskan lagi.
[18.05.2026 09:14] Leoni: Saya sebelumnya sempat chat juga di WhatsApp.
[18.05.2026 09:15] Aria: Baik kak, nanti saya bantu rapikan infonya supaya tidak terpisah.
```

### Expected Signal

- source channel = `telegram`
- bisa dipakai untuk test customer identity merge

### Cocok untuk test case

- `TC-CAP-003`
- `TC-CUST-001`
- `TC-CUST-002`

---

## 6. Conversation F: Legalitas Knowledge Proposal

Tujuan:

- bikin proposal knowledge dari coaching case
- cocok untuk publish ke knowledge base

### Metadata

- Customer: `Dina`
- Sales: `Sales A`
- Channel: `WhatsApp`
- Category: `mini`

### WhatsApp Raw Text

```text
20/04/26, 11.00 - Dina: Kak, saya masih takut kalau ternyata ini tidak jelas legalitasnya.
20/04/26, 11.01 - Sales A: Baik kak, saya bantu jelaskan legalitas yang bisa disampaikan secara resmi.
20/04/26, 11.03 - Dina: Soalnya saya sering lihat orang cuma janji manis.
20/04/26, 11.04 - Sales A: Paham kak, justru saya akan bantu pakai penjelasan yang faktual saja.
20/04/26, 11.05 - Dina: Oke, kalau ada poin resmi tolong kirim ya.
```

### Expected Signal

- objection: `legalitas`
- cocok jadi knowledge proposal:
  - title: `Handling Objection Legalitas`
  - category: `objection_handling`

### Cocok untuk test case

- `TC-KNOW-001`
- `TC-KNOW-003`
- `TC-AI-001`

---

## 7. Conversation G: Harga + Trust Combo

Tujuan:

- test objection trend lebih kaya
- bagus untuk manager insights dan KPI insight

### Metadata

- Customer: `Maya`
- Sales: `Sales B`
- Channel: `WhatsApp`
- Category: `reguler`

### WhatsApp Raw Text

```text
21/04/26, 14.10 - Maya: Kak, saya masih bingung karena harganya cukup tinggi.
21/04/26, 14.11 - Sales B: Siap kak, saya bantu jelaskan detailnya ya.
21/04/26, 14.12 - Maya: Selain itu saya juga belum terlalu percaya kalau prosesnya benar-benar dibantu.
21/04/26, 14.13 - Sales B: Baik kak, nanti saya bantu jelaskan dukungan dan alurnya satu per satu.
21/04/26, 14.15 - Maya: Oke kak, saya tunggu penjelasannya.
```

### Expected Signal

- objection: `harga`, `trust`
- mood: `cautious`

### Cocok untuk test case

- `TC-MGR-005`
- `TC-KPI-001`
- `TC-KPI-002`

---

## 8. Contoh Discipline Log Setelah Conversation

Gunakan untuk `Conversation A`:

```json
{
  "activity_type": "follow_up_chat",
  "result_status": "follow_up_scheduled",
  "main_objection": "legalitas",
  "customer_mood": "positive",
  "notes": "Customer siap kirim data hari ini. Fokus follow-up berikutnya adalah kirim panduan dokumen dan pastikan proses berjalan cepat.",
  "next_follow_up_at": "2026-05-22T09:00:00Z"
}
```

Gunakan untuk `Conversation B`:

```json
{
  "activity_type": "follow_up_call",
  "result_status": "waiting_customer",
  "main_objection": "harga",
  "customer_mood": "cautious",
  "notes": "Customer masih bandingkan harga dengan pihak lain. Perlu penguatan value, bukan diskon agresif.",
  "next_follow_up_at": "2026-05-23T10:00:00Z"
}
```

---

## 9. Contoh Coaching Review

Untuk `Conversation B`:

```json
{
  "status": "in_review",
  "review_label": "gagal",
  "review_summary": "Sales belum cukup kuat membingkai value saat customer keberatan harga.",
  "coaching_focus": "Ajarkan cara menggeser percakapan dari harga ke value dan outcome proses.",
  "recommended_action": "Generate draft baru yang menekankan value, pembeda layanan, dan langkah konkret berikutnya.",
  "reviewer_user_id": "<manager-a-id>"
}
```

Untuk `Conversation D`:

```json
{
  "status": "escalated",
  "review_label": "perlu_eskalasi",
  "review_summary": "Kasus corporate concern butuh arahan komunikasi yang lebih formal dan lebih presisi.",
  "coaching_focus": "Perjelas boundary klaim, tanggung jawab, dan ekspektasi proses.",
  "recommended_action": "Head review sebelum sales kirim balasan final.",
  "reviewer_user_id": "<head-id>"
}
```

---

## 10. Contoh Knowledge Proposal

Untuk `Conversation F`:

```json
{
  "title": "Handling Objection Legalitas",
  "category": "objection_handling",
  "proposed_content": "Saat customer mempertanyakan legalitas, sales hanya boleh menjelaskan poin yang sudah tersedia di knowledge resmi. Hindari klaim tambahan yang belum diverifikasi. Fokus ke penjelasan faktual, alur proses, dan dokumen pendukung yang memang ada.",
  "source_type": "coaching_case",
  "rationale": "Objection legalitas berulang dan perlu jawaban standar yang aman secara compliance.",
  "status": "pending_approval"
}
```

---

## 11. Contoh Payload Meta Webhook

Gunakan untuk test server-side webhook:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "entry-1",
      "changes": [
        {
          "field": "messages",
          "value": {
            "metadata": {
              "display_phone_number": "628123000000",
              "phone_number_id": "1234567890"
            },
            "contacts": [
              {
                "wa_id": "628111222333",
                "profile": {
                  "name": "Customer Leoni"
                }
              }
            ],
            "messages": [
              {
                "from": "628111222333",
                "id": "wamid.ABC123",
                "timestamp": "1779271200",
                "type": "text",
                "text": {
                  "body": "Halo kak, saya mau tanya paket mini."
                }
              }
            ],
            "clara_context": {
              "account_category": "mini"
            }
          }
        }
      ]
    }
  ]
}
```

### Expected Result

- source conversation = `whatsapp_webhook`
- provider = `meta`
- external thread key terbentuk
- lead category = `mini`
- message tidak duplicate saat payload yang sama dikirim dua kali

---

## 12. Mapping Conversation ke Test Case

### Paling penting untuk dipakai dulu

- Conversation A -> hot lead, mini, closing
- Conversation B -> harga objection, reguler
- Conversation C -> stale lead
- Conversation D -> escalation / unique case
- Conversation E -> telegram / customer identity
- Conversation F -> knowledge proposal legalitas
- Conversation G -> objection trend harga + trust

### Minimal set kalau mau hemat waktu

Kalau Anda mau test cepat tapi tetap kuat:

1. Conversation A
2. Conversation B
3. Conversation C
4. Conversation E
5. Conversation F

Itu sudah cukup untuk cover:

- capture
- CRM
- discipline log
- coaching review
- knowledge queue
- manager insight
- KPI
- customer identity
- webhook category mini

12/04/26, 09.12 - Customer Nia: Halo kak, saya lihat iklannya tadi.
12/04/26, 09.13 - Sales Aria: Halo kak Nia, siap saya bantu. Kakak tertarik bagian yang mana?
12/04/26, 09.15 - Customer Nia: Masih lihat-lihat dulu sih kak.
12/04/26, 09.16 - Sales Aria: Siap kak, santai saja. Kalau boleh tahu, kakak lagi cari solusi untuk belajar dulu atau sudah mau mulai daftar?
12/04/26, 09.20 - Customer Nia: Belum tahu juga, masih bandingin tempat lain.
12/04/26, 09.21 - Sales Aria: Baik kak, nanti saya bantu jelaskan garis besarnya dulu supaya kakak ada gambaran.
12/04/26, 09.23 - Customer Nia: Oke kak, tapi saya belum janji ya.


12/04/26, 10.02 - Customer Raka: Kak, saya mau tanya detail programnya.
12/04/26, 10.03 - Sales Aria: Siap kak Raka, saya bantu. Kakak mau fokus tanya soal alur daftar, modal awal, atau legalitas?
12/04/26, 10.05 - Customer Raka: Saya paling pengen tahu legalitas sama cara mulainya.
12/04/26, 10.06 - Sales Aria: Baik kak, untuk legalitas nanti bisa saya kirim dokumen resminya juga. Untuk mulai, biasanya kakak cukup siapkan KTP dan data verifikasi dasar.
12/04/26, 10.09 - Customer Raka: Oke, kalau dari modal awal gimana?
12/04/26, 10.10 - Sales Aria: Tergantung tujuan kakak, tapi biasanya kami bantu arahkan mulai bertahap supaya tetap nyaman.
12/04/26, 10.13 - Customer Raka: Menarik sih kak, saya mau pelajari lebih lanjut dulu.
12/04/26, 10.14 - Sales Aria: Siap kak, nanti saya bantu kirim ringkasan dan poin pentingnya ya.


12/04/26, 11.01 - Customer Leoni: Kak, saya sudah baca penjelasannya.
12/04/26, 11.02 - Sales Aria: Siap kak Leoni, ada bagian yang masih ingin ditanyakan sebelum lanjut?
12/04/26, 11.04 - Customer Leoni: Saya rasa sudah cukup jelas. Kalau mau mulai hari ini prosesnya gimana?
12/04/26, 11.05 - Sales Aria: Bisa kak. Hari ini kakak tinggal siapkan KTP dan data verifikasi, nanti saya pandu langkahnya satu per satu.
12/04/26, 11.07 - Customer Leoni: Oke, kalau saya kirim data siang ini bisa langsung diproses?
12/04/26, 11.08 - Sales Aria: Bisa kak, saya bantu prioritaskan supaya prosesnya cepat.
12/04/26, 11.10 - Customer Leoni: Baik kak, saya mau lanjut.
12/04/26, 11.11 - Sales Aria: Siap kak, kirimkan saja datanya, nanti saya dampingi sampai selesai.


[18.05.2026 09:12] Customer Nia: Halo kak, saya cuma mau lihat-lihat dulu.
[18.05.2026 09:13] Sales Aria: Halo kak Nia, siap. Saya bantu jelaskan garis besar dulu ya.
[18.05.2026 09:15] Customer Nia: Boleh, tapi saya belum tentu ambil.
[18.05.2026 09:16] Sales Aria: Tidak apa-apa kak, santai saja. Kakak sedang bandingkan beberapa tempat ya?
[18.05.2026 09:18] Customer Nia: Iya kak, masih cari yang paling cocok.
[18.05.2026 09:19] Sales Aria: Siap, nanti saya bantu kasih gambaran yang ringkas supaya kakak lebih mudah menilai.


[18.05.2026 10:05] Customer Raka: Kak, saya tertarik tapi masih ada beberapa pertanyaan.
[18.05.2026 10:06] Sales Aria: Siap kak Raka, saya bantu jawab. Yang paling ingin kakak pastikan apa dulu?
[18.05.2026 10:08] Customer Raka: Legalitas dan langkah awalnya.
[18.05.2026 10:09] Sales Aria: Baik kak, legalitas bisa saya bantu tunjukkan. Untuk langkah awal, biasanya siapkan KTP dan data verifikasi.
[18.05.2026 10:11] Customer Raka: Oke, kalau prosesnya sulit tidak?
[18.05.2026 10:12] Sales Aria: Tidak kak, nanti saya pandu satu per satu supaya lebih mudah.
[18.05.2026 10:14] Customer Raka: Baik, saya mau pertimbangkan dulu.


[18.05.2026 11:20] Customer Leoni: Kak, saya sudah siap lanjut hari ini.
[18.05.2026 11:21] Sales Aria: Siap kak Leoni, bagus. Tinggal saya bantu arahkan untuk langkah verifikasinya.
[18.05.2026 11:23] Customer Leoni: Kalau saya kirim data sekarang, bisa langsung diproses?
[18.05.2026 11:24] Sales Aria: Bisa kak, nanti saya bantu cek dan percepat prosesnya.
[18.05.2026 11:25] Customer Leoni: Oke, saya kirim sekarang ya.
[18.05.2026 11:26] Sales Aria: Siap kak, saya standby bantu sampai selesai.