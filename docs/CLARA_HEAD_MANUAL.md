# CLARA Head Manual

Manual ini dibuat khusus untuk akun `head` di Clara.

Tujuan manual ini:

- membantu `head` baru memahami fitur yang memang bisa dia akses
- memberi alur kerja harian yang realistis
- menjelaskan kapan `head` cukup mengawasi, kapan harus turun ke detail
- memberi checklist verifikasi cepat untuk tiap fitur

Kalau harus diingat dalam satu kalimat:

> Tugas head di Clara adalah membaca kesehatan operasional tim, mengoreksi arah kerja, lalu mengeskalasi perbaikan strategis tanpa turun mengerjakan semua chat satu per satu.

---

## 1. Akses Head Saat Ini

Fitur utama yang bisa diakses `head`:

1. `Beranda`
2. `Lead Management`
3. `Customer List`
4. `Alert Center`
5. `Follow-up Center`
6. `Head Insights`
7. `Knowledge Base`
8. `Marketing Insights`
9. `Ops Dashboard`

Fitur yang **tidak** bisa diakses `head`:

- `Access Control`
- `Audit Logs`
- `Channels`
- approval final knowledge
- create/edit organization, unit, team, user

Catatan penting:

- `head` masih bisa melihat masalah besar lintas tim, tapi governance akses sekarang hanya `superadmin`
- `head` boleh mengoreksi proposal knowledge, tetapi approval final dan publish tetap `superadmin`

---

## 2. Cara Memakai Clara Sebagai Head

Urutan kerja yang paling aman:

1. buka `Alert Center`
2. buka `Head Insights`
3. buka `Follow-up Center`
4. buka `Lead Management`
5. kalau perlu, turun ke `Lead Detail` atau `Customer Detail`
6. cocokkan kondisinya di `Ops Dashboard`
7. kalau ada pola lapangan, buka `Marketing Insights`
8. kalau ada kebutuhan perbaikan jawaban, buka `Knowledge Base`

Logika urutan ini:

- `Alert Center` memberi tahu apa yang mendesak hari ini
- `Head Insights` memberi konteks tim mana yang mulai bermasalah
- `Follow-up Center` membantu melihat chat/review yang butuh intervensi
- `Lead Management` memperlihatkan dampak bottleneck ke pipeline nyata
- `Ops Dashboard` membantu memastikan masalah itu benar-benar tercermin di KPI

---

## 3. Fitur Per Fitur

## 3.1 Beranda

### Fungsi

Beranda dipakai untuk melihat ringkasan cepat sebelum masuk ke area detail.

### Langkah pakai

1. login sebagai `head`
2. pastikan menu yang muncul sesuai role `head`
3. baca ringkasan KPI singkat, aktivitas terbaru, dan shortcut halaman
4. tentukan titik masuk hari ini:
   - `Alert Center` kalau ada masalah aktif
   - `Head Insights` kalau mau baca pola tim
   - `Lead Management` kalau mau cek pipeline

### Hasil yang harus muncul

- tidak ada menu `Access Control` atau `Audit Logs`
- ada shortcut ke `Head Insights`, `Ops Dashboard`, `Marketing Insights`, `Knowledge Base`

### Test case cepat

- ID: `HEAD-HOME-01`
- Steps:
  1. login sebagai `head`
  2. buka `/dashboard`
  3. verifikasi menu utama muncul
  4. verifikasi menu admin superadmin-only tidak muncul
- Expected:
  - halaman terbuka
  - menu sesuai role `head`

---

## 3.2 Alert Center

### Fungsi

Dipakai untuk membaca alert aktif yang butuh keputusan atau follow-up lintas tim.

### Kapan dibuka

- awal hari kerja
- setelah refresh KPI
- saat ada lead panas yang terasa macet

### Langkah pakai

1. buka `Alert Center`
2. fokus ke item `active`
3. baca severity, judul, dan sumber alert
4. tentukan apakah masalah ini:
   - cukup dipantau
   - perlu diarahkan ke manager
   - perlu dilihat langsung ke lead/conversation
5. kalau alert terkait follow-up, lanjut ke `Follow-up Center` atau `Lead Management`

### Kesalahan yang harus dihindari

- menutup mata pada alert yang berulang
- menyimpulkan masalah hanya dari badge tanpa lihat konteks lead

### Test case cepat

- ID: `HEAD-ALERT-01`
- Steps:
  1. buka `Alert Center`
  2. filter item aktif
  3. pilih satu alert
  4. buka konteks lanjutan
- Expected:
  - alert aktif terlihat
  - detail alert bisa dibaca
  - ada arah tindak lanjut yang jelas

---

## 3.3 Follow-up Center

### Fungsi

Dipakai untuk melihat percakapan atau item review yang butuh intervensi level head.

### Yang biasanya dicari

- percakapan `high risk`
- draft yang sensitif
- item review yang berulang
- bottleneck yang tidak selesai di level manager

### Langkah pakai

1. buka `Follow-up Center`
2. prioritaskan item dengan risiko tertinggi
3. buka detail conversation
4. cek:
   - masalah customer
   - status balasan terakhir
   - hasil AI
   - apakah issue ini masalah orang, proses, atau knowledge
5. tentukan tindakan:
   - minta manager follow-up
   - minta sales revisi
   - arahkan pembuatan proposal knowledge

### Test case cepat

- ID: `HEAD-FOLLOWUP-01`
- Steps:
  1. buka `Follow-up Center`
  2. pilih satu item pending/high risk
  3. buka detail conversation
  4. baca status review
- Expected:
  - item bisa dibuka
  - head bisa membaca konteks dan menentukan intervensi

---

## 3.4 Head Insights

### Fungsi

Ini halaman utama `head` untuk membaca kondisi tim secara ringkas.

### Yang harus diperhatikan

- `coaching priority`
- `discipline trend`
- tim/anggota dengan progres lemah
- boundary alert lintas organisasi/tim

### Langkah pakai

1. buka `Head Insights`
2. cari tim yang paling perlu perhatian
3. cocokkan insight dengan alert aktif
4. pilih apakah harus turun ke:
   - `Lead Management`
   - `Customer List`
   - `Follow-up Center`

### Test case cepat

- ID: `HEAD-INSIGHT-01`
- Steps:
  1. buka `Head Insights`
  2. baca summary utama
  3. identifikasi satu tim atau sinyal yang menonjol
- Expected:
  - summary tim muncul
  - head bisa menentukan area yang perlu intervensi

---

## 3.5 Lead Management

### Fungsi

Dipakai untuk membaca apakah bottleneck tim benar-benar berdampak ke pipeline.

### Fokus utama

- lead `hot`
- lead `overdue`
- lead yang perlu sinkronisasi
- lead dengan next follow-up tidak jelas

### Langkah pakai

1. buka `Lead Management`
2. filter bucket yang paling bermasalah
3. pilih lead dengan dampak bisnis terbesar
4. buka detail lead jika perlu konteks penuh

### Test case cepat

- ID: `HEAD-LEAD-LIST-01`
- Steps:
  1. buka `Lead Management`
  2. cari lead `hot` atau `overdue`
  3. buka satu lead
- Expected:
  - list lead terbuka
  - filter dan navigasi ke detail berjalan

---

## 3.6 Lead Detail

### Fungsi

Dipakai saat `head` perlu memahami satu lead secara lengkap.

### Yang wajib dicek

- owner / sales PIC
- current stage
- next follow-up
- ringkasan dan notes
- deal metrics
- log disiplin

### Kapan head harus turun ke sini

- ada lead panas tapi belum jelas next step
- ada mismatch antara KPI dan kondisi lapangan
- ada risiko closure hilang karena follow-up lemah

### Test case cepat

- ID: `HEAD-LEAD-DETAIL-01`
- Steps:
  1. buka satu lead dari `Lead Management`
  2. verifikasi stage, owner, next follow-up, dan deal metrics tampil
  3. lihat timeline atau log disiplin
- Expected:
  - detail lead lengkap tampil
  - head bisa membaca konteks keputusan

---

## 3.7 Customer List dan Customer Detail

### Fungsi

Dipakai saat masalah operasional ternyata berakar pada identitas customer yang kurang rapi.

### Kapan dibuka

- satu customer muncul di banyak lead
- ada kebingungan kategori akun
- tim terlihat membaca customer yang sama sebagai identitas berbeda

### Langkah pakai

1. buka `Customer List`
2. cari nama customer
3. buka `Customer Detail`
4. cek:
   - identitas
   - account category
   - temperature
   - kaitan dengan lead yang ada

### Test case cepat

- ID: `HEAD-CUSTOMER-01`
- Steps:
  1. buka `Customer List`
  2. cari satu customer
  3. buka detailnya
- Expected:
  - detail customer tampil
  - hubungan ke lead dan informasi segmentasi terlihat

---

## 3.8 Knowledge Base

### Fungsi

Untuk `head`, halaman ini dipakai untuk:

- membaca jawaban resmi aktif
- mengoreksi proposal knowledge
- menyiapkan eskalasi ke `superadmin`

### Yang boleh dilakukan head

- melihat knowledge aktif
- membaca proposal
- memberi koreksi isi proposal
- mengubah proposal sampai siap dieskalasi

### Yang tidak boleh dilakukan head

- approve final proposal
- publish knowledge
- menghapus knowledge master

### Langkah pakai

1. buka `Knowledge Base`
2. baca proposal atau knowledge aktif yang relevan
3. koreksi wording, struktur, atau isi proposal
4. ubah status proposal menjadi siap dieskalasi jika memang sudah matang
5. serahkan final approval ke `superadmin`

### Test case cepat

- ID: `HEAD-KNOWLEDGE-01`
- Steps:
  1. buka `Knowledge Base`
  2. pilih satu proposal
  3. ubah isi koreksi proposal
  4. simpan atau eskalasi proposal
- Expected:
  - head bisa koreksi proposal
  - head tidak melihat tombol approve final

---

## 3.9 Marketing Insights

### Fungsi

Dipakai untuk membaca pola objection, intent, dan angle konten dari percakapan nyata.

### Tujuan untuk head

- mencari pola yang harus diperbaiki secara operasional
- menemukan topik yang layak dijadikan perbaikan knowledge
- melihat apakah sinyal lapangan cocok dengan arah tim

### Langkah pakai

1. buka `Marketing Insights`
2. baca objection teratas
3. lihat audience signal dan stage signal
4. cek apakah pola itu sejalan dengan alert/KPI
5. bila perlu, arahkan manager untuk bikin proposal knowledge

### Test case cepat

- ID: `HEAD-MARKETING-01`
- Steps:
  1. buka `Marketing Insights`
  2. baca top objection dan audience signal
  3. verifikasi halaman memuat snapshot
- Expected:
  - insight marketing tampil
  - head bisa membaca pola lapangan

---

## 3.10 Ops Dashboard

### Fungsi

Ini halaman KPI operasional utama untuk `head`.

### Yang harus dibaca

- total leads
- hot leads
- reply sent rate
- overdue follow-up
- pipeline value
- won value
- deposit
- observation utama

### Cara pakai

1. buka `Ops Dashboard`
2. baca snapshot aktif
3. cek apakah angka besar sejalan dengan alert dan insight
4. kalau ada gap, turun ke `Lead Management` atau `Follow-up Center`

### Test case cepat

- ID: `HEAD-KPI-01`
- Steps:
  1. buka `Ops Dashboard`
  2. verifikasi snapshot tampil
  3. lakukan refresh snapshot bila perlu
- Expected:
  - KPI utama terlihat
  - snapshot bisa direfresh

---

## 4. Checklist Harian Head

Pakai checklist ini sampai terbiasa:

1. buka `Alert Center`
2. cek `Head Insights`
3. cek `Follow-up Center`
4. cek lead panas/overdue
5. cek satu atau dua customer bermasalah kalau ada pola identitas
6. cocokkan kondisi dengan `Ops Dashboard`
7. buka `Marketing Insights` jika perlu membaca pola lapangan
8. buka `Knowledge Base` jika perlu mengoreksi dan mengeskalasi perbaikan

---

## 5. Ringkasan Test Case Head

| ID | Fitur | Hasil yang diharapkan |
| --- | --- | --- |
| `HEAD-HOME-01` | Beranda | menu sesuai role `head` |
| `HEAD-ALERT-01` | Alert Center | alert aktif bisa dibaca |
| `HEAD-FOLLOWUP-01` | Follow-up Center | item review bisa dibuka |
| `HEAD-INSIGHT-01` | Head Insights | summary tim terlihat |
| `HEAD-LEAD-LIST-01` | Lead Management | list dan filter lead bekerja |
| `HEAD-LEAD-DETAIL-01` | Lead Detail | detail lead lengkap |
| `HEAD-CUSTOMER-01` | Customer Detail | data customer dan relasi lead tampil |
| `HEAD-KNOWLEDGE-01` | Knowledge Base | head bisa koreksi, tidak bisa approve final |
| `HEAD-MARKETING-01` | Marketing Insights | insight marketing tampil |
| `HEAD-KPI-01` | Ops Dashboard | KPI snapshot tampil dan bisa refresh |
