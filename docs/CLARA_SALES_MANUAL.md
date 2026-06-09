# CLARA Sales Manual

Manual ini dibuat khusus untuk akun `sales` di Clara.

Tujuan manual ini:

- membantu sales baru cepat paham cara kerja Clara
- menjelaskan urutan kerja harian yang aman
- menjelaskan fitur apa yang harus dipakai dan kapan
- memberi test case cepat untuk tiap fitur utama

Kalau harus diingat dalam satu kalimat:

> Tugas sales di Clara adalah membaca chat dengan benar, membalas dengan aman, merapikan lead dan customer, lalu memastikan follow-up berikutnya jelas.

---

## 1. Akses Sales Saat Ini

Fitur utama yang bisa diakses `sales`:

1. `Beranda`
2. `Lead Capture`
3. `Queue`
4. `Conversation Detail`
5. `Lead Management`
6. `Lead Detail`
7. `Customer List`
8. `Customer Detail`
9. `Action Center`

Yang **tidak** bisa diakses `sales`:

- `Manager Insights`
- `Head Insights`
- `Marketing Insights`
- `Ops Dashboard`
- `Access Control`
- `Audit Logs`
- approval final knowledge

---

## 2. Urutan Kerja Sales Yang Paling Aman

1. buka `Queue`
2. pilih conversation
3. baca `Conversation Detail`
4. jalankan `AI Analysis` kalau belum ada
5. generate draft dan kirim balasan
6. rapikan `Lead Detail`
7. rapikan `Customer Detail` bila perlu
8. cek `Action Center`
9. masukkan chat baru lewat `Lead Capture` kalau ada sumber baru

---

## 3. Fitur Per Fitur

## 3.1 Beranda

### Fungsi

Dipakai untuk melihat shortcut pekerjaan hari itu.

### Test case cepat

- ID: `SALES-HOME-01`
- Steps:
  1. login sebagai `sales`
  2. buka `/dashboard`
  3. verifikasi menu `Queue`, `Lead Management`, `Customer List`, `Action Center`, `Lead Capture` muncul
- Expected:
  - beranda tampil
  - menu sales sesuai role

---

## 3.2 Lead Capture

### Fungsi

Dipakai untuk memasukkan chat baru ke Clara.

### Langkah pakai

1. buka `Lead Capture`
2. isi judul dengan nama customer yang benar
3. pilih upload TXT atau paste manual
4. submit
5. verifikasi conversation dan lead terbentuk

### Test case cepat

- ID: `SALES-CAPTURE-01`
- Steps:
  1. buka `Lead Capture`
  2. upload/paste transcript valid
  3. submit
- Expected:
  - conversation dibuat/diupdate
  - lead dan customer profile ikut tersambung

---

## 3.3 Queue

### Fungsi

Tempat kerja utama sales untuk membaca chat yang harus ditindaklanjuti.

### Langkah pakai

1. buka `Queue`
2. prioritaskan chat penting
3. cek apakah AI extraction sudah ada
4. cek apakah draft reply sudah ada
5. buka chat yang perlu dikerjakan

### Test case cepat

- ID: `SALES-QUEUE-01`
- Steps:
  1. buka `Queue`
  2. pilih satu row conversation
  3. klik buka chat
- Expected:
  - queue tampil
  - navigasi ke conversation detail berjalan

---

## 3.4 Conversation Detail

### Fungsi

Dipakai untuk membaca transcript lengkap dan menyiapkan balasan.

### Langkah pakai

1. baca chat terakhir
2. pahami siapa yang bicara terakhir
3. jalankan `AI Analysis` jika belum ada
4. cek summary, intent, risk, next action
5. generate draft reply
6. edit jika perlu
7. approve/mark sent sesuai flow

### Test case cepat

- ID: `SALES-CONV-01`
- Steps:
  1. buka conversation
  2. jalankan analyze
  3. generate draft
  4. mark sent
- Expected:
  - AI extraction tersimpan
  - draft muncul
  - sent history terupdate

---

## 3.5 Lead Management

### Fungsi

Dipakai untuk melihat daftar lead yang sedang dikerjakan.

### Test case cepat

- ID: `SALES-LEAD-LIST-01`
- Steps:
  1. buka `Lead Management`
  2. filter lead penting
  3. buka satu lead
- Expected:
  - list lead tampil
  - filter dan buka detail berjalan

---

## 3.6 Lead Detail

### Fungsi

Dipakai untuk merapikan data eksekusi sales setelah chat dibalas.

### Yang harus diisi

- stage
- next follow-up
- summary/notes
- account category bila perlu
- deal metrics bila relevan

### Test case cepat

- ID: `SALES-LEAD-DETAIL-01`
- Steps:
  1. buka detail lead
  2. ubah stage
  3. isi next follow-up
  4. simpan
- Expected:
  - perubahan tersimpan
  - lead kembali terlihat dengan status terbaru

---

## 3.7 Customer List dan Customer Detail

### Fungsi

Dipakai untuk membersihkan data customer yang dipakai lintas lead.

### Test case cepat

- ID: `SALES-CUSTOMER-01`
- Steps:
  1. buka `Customer List`
  2. cari customer
  3. buka detail dan update field yang diizinkan
- Expected:
  - detail customer tampil
  - perubahan profil tersimpan

---

## 3.8 Action Center

### Fungsi

Dipakai untuk merapikan pekerjaan follow-up yang belum selesai.

### Yang dicari

- item overdue
- item yang tertahan
- lead yang belum punya next action jelas

### Test case cepat

- ID: `SALES-ACTION-01`
- Steps:
  1. buka `Action Center`
  2. pilih item overdue
  3. buka lead/conversation terkait
- Expected:
  - worklist tampil
  - user bisa lanjut menindaklanjuti item

---

## 4. Checklist Harian Sales

1. buka `Queue`
2. kerjakan chat paling penting
3. analyze jika belum ada
4. generate dan kirim balasan
5. update lead
6. rapikan customer bila perlu
7. tutup hari dengan cek `Action Center`

---

## 5. Ringkasan Test Case Sales

| ID | Fitur | Hasil yang diharapkan |
| --- | --- | --- |
| `SALES-HOME-01` | Beranda | menu sales tampil |
| `SALES-CAPTURE-01` | Lead Capture | chat baru masuk ke sistem |
| `SALES-QUEUE-01` | Queue | list conversation tampil |
| `SALES-CONV-01` | Conversation Detail | analyze, draft, sent berjalan |
| `SALES-LEAD-LIST-01` | Lead Management | list/filter lead berjalan |
| `SALES-LEAD-DETAIL-01` | Lead Detail | update stage/follow-up tersimpan |
| `SALES-CUSTOMER-01` | Customer Detail | profil customer bisa dibaca dan diupdate |
| `SALES-ACTION-01` | Action Center | item worklist bisa dibuka dan ditindaklanjuti |
