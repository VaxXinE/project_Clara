# CLARA Manager Manual

Manual ini dibuat khusus untuk akun `manager` di Clara.

Tujuan manual ini:

- membantu `manager` memahami workflow yang benar
- menjelaskan fitur yang memang dipakai `manager`
- membantu `manager` membedakan kapan harus coaching, kapan harus eskalasi
- memberi test case cepat untuk tiap fitur yang dia akses

Kalau harus diingat dalam satu kalimat:

> Tugas manager di Clara adalah membaca kualitas eksekusi sales, memperbaiki bottleneck percakapan, lalu menerjemahkan masalah lapangan menjadi coaching atau proposal perbaikan.

---

## 1. Akses Manager Saat Ini

Fitur utama yang bisa diakses `manager`:

1. `Beranda`
2. `Lead Management`
3. `Customer List`
4. `Chat Review Center`
5. `Manager Insights`
6. `Conversation Detail`
7. `Lead Detail`
8. `Customer Detail`

Fitur khusus yang juga relevan:

- membuat atau mengubah review case
- membuat proposal knowledge dari hasil percakapan

Fitur yang **tidak** bisa diakses `manager`:

- `Access Control`
- `Audit Logs`
- `Channels`
- `Ops Dashboard`
- `Marketing Insights`
- approval final knowledge
- create/edit user, org, unit, team

---

## 2. Cara Memakai Clara Sebagai Manager

Urutan kerja manager yang paling aman:

1. buka `Chat Review Center`
2. buka `Conversation Detail`
3. buka `Manager Insights`
4. cek `Lead Management`
5. kalau perlu, buka `Customer Detail`
6. bila insight cukup kuat, buat proposal knowledge

---

## 3. Fitur Per Fitur

## 3.1 Beranda

### Fungsi

Dipakai sebagai titik awal untuk masuk ke review, insight, dan lead penting.

### Test case cepat

- ID: `MANAGER-HOME-01`
- Steps:
  1. login sebagai `manager`
  2. buka `/dashboard`
  3. verifikasi menu `Chat Review Center` dan `Manager Insights` muncul
- Expected:
  - beranda terbuka
  - manager tidak melihat menu superadmin-only

---

## 3.2 Chat Review Center

### Fungsi

Tempat kerja utama manager untuk memantau percakapan yang macet atau berisiko.

### Langkah pakai

1. buka `Chat Review Center`
2. prioritaskan item `high risk`, `pending review`, atau `stale`
3. buka conversation yang paling mendesak
4. tentukan apakah perlu:
   - coaching
   - revisi jawaban
   - review case
   - proposal knowledge

### Test case cepat

- ID: `MANAGER-REVIEW-01`
- Steps:
  1. buka `Chat Review Center`
  2. pilih satu item
  3. buka detail conversation
- Expected:
  - list review tampil
  - navigation ke conversation berjalan

---

## 3.3 Conversation Detail

### Fungsi

Dipakai manager untuk membaca konteks penuh sebelum memberi arahan.

### Yang wajib dicek

- siapa yang bicara terakhir
- masalah customer
- AI extraction
- draft balasan
- status approval/review
- konteks lead

### Test case cepat

- ID: `MANAGER-CONV-01`
- Steps:
  1. buka satu conversation dari review center
  2. baca transcript dan AI summary
  3. verifikasi draft reply dan statusnya terlihat
- Expected:
  - context conversation lengkap tampil

---

## 3.4 Manager Insights

### Fungsi

Dipakai untuk membaca pola kerja tim tanpa membuka satu per satu lead.

### Yang dicari

- coaching priority
- discipline trend
- tim atau anggota yang performanya turun
- pola objection yang berulang

### Test case cepat

- ID: `MANAGER-INSIGHT-01`
- Steps:
  1. buka `Manager Insights`
  2. baca summary tim
  3. pilih satu sinyal yang perlu ditindaklanjuti
- Expected:
  - insight tim tampil
  - manager bisa menentukan prioritas coaching

---

## 3.5 Review Case Management

### Fungsi

Dipakai manager untuk menyimpan keputusan review atas percakapan tertentu.

### Langkah pakai

1. buka conversation dari review center
2. ambil suggestion review jika tersedia
3. isi status review
4. tambahkan note coaching
5. simpan

### Test case cepat

- ID: `MANAGER-REVIEWCASE-01`
- Steps:
  1. buka satu conversation
  2. buat/update review case
  3. tambah note
- Expected:
  - review case tersimpan
  - note tampil saat dibuka ulang

---

## 3.6 Lead Management dan Lead Detail

### Fungsi

Dipakai untuk melihat dampak review ke pipeline nyata.

### Kapan dibuka

- setelah menemukan chat yang macet
- saat ada lead `hot` tapi progresnya lemah
- saat manager perlu lihat apakah next follow-up jelas

### Test case cepat

- ID: `MANAGER-LEAD-01`
- Steps:
  1. buka `Lead Management`
  2. pilih satu lead penting
  3. buka detail lead
- Expected:
  - data lead lengkap tampil
  - manager bisa membaca owner, stage, follow-up, dan deal

---

## 3.7 Customer List dan Customer Detail

### Fungsi

Dipakai kalau akar masalah ternyata ada di data customer atau segmentasi akun.

### Test case cepat

- ID: `MANAGER-CUSTOMER-01`
- Steps:
  1. buka `Customer List`
  2. cari customer terkait
  3. buka detail
- Expected:
  - data identitas customer tampil
  - account category dan temperature terbaca

---

## 3.8 Proposal Knowledge

### Fungsi

Manager boleh membuat proposal knowledge dari percakapan yang punya nilai belajar tinggi.

### Kapan dibuat

- objection berulang
- angle jawaban resmi belum ada
- ada pola customer yang perlu dibakukan jadi guidance

### Langkah pakai

1. buka conversation yang layak
2. buat proposal knowledge
3. isi ringkasan insight
4. simpan untuk dikoreksi `head`

### Test case cepat

- ID: `MANAGER-KNOWLEDGE-01`
- Steps:
  1. buka conversation relevan
  2. buat proposal knowledge
  3. simpan
- Expected:
  - proposal tersimpan
  - manager tidak melihat tombol approve final

---

## 4. Checklist Harian Manager

1. buka `Chat Review Center`
2. baca 3-5 item paling berisiko
3. buka `Conversation Detail` yang paling penting
4. simpan review case atau coaching note
5. cek `Manager Insights`
6. cek dampaknya di `Lead Management`
7. buat proposal knowledge kalau ada pola yang layak dibakukan

---

## 5. Ringkasan Test Case Manager

| ID | Fitur | Hasil yang diharapkan |
| --- | --- | --- |
| `MANAGER-HOME-01` | Beranda | menu manager tampil sesuai role |
| `MANAGER-REVIEW-01` | Chat Review Center | list review bisa dibuka |
| `MANAGER-CONV-01` | Conversation Detail | transcript, AI, draft terlihat |
| `MANAGER-INSIGHT-01` | Manager Insights | summary tim tampil |
| `MANAGER-REVIEWCASE-01` | Review Case | review case dan note tersimpan |
| `MANAGER-LEAD-01` | Lead Detail | data lead lengkap tampil |
| `MANAGER-CUSTOMER-01` | Customer Detail | data customer tampil |
| `MANAGER-KNOWLEDGE-01` | Proposal Knowledge | proposal bisa dibuat, tidak bisa approve final |
