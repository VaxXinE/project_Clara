# Clara User Manual

Manual ini dibuat untuk user Clara yang ingin memakai sistem dengan cepat tanpa harus paham istilah teknis terlalu dalam.

Tujuan manual ini:

- membantu user baru mengerti Clara dalam sekali baca
- menjelaskan halaman demi halaman dengan bahasa sederhana
- menjelaskan apa yang harus dilakukan saat melihat status tertentu
- memberi urutan kerja yang aman untuk sales, manager, head, dan superadmin
- menjelaskan fitur baru seperti `Customer List`, `account category`, `customer temperature`, dan knowledge `mini` vs `reguler`

Kalau harus diingat dalam satu kalimat:

> Clara dipakai untuk mengubah chat customer menjadi tindakan yang jelas, lead yang rapi, customer profile yang bersih, dan keputusan tim yang lebih cepat.

---

## 1. Cara Membaca Manual Ini

Kalau Anda benar-benar baru pertama kali memakai Clara, baca dengan urutan ini:

1. baca `Bagian 2` untuk tahu Clara itu apa
2. baca `Bagian 3` untuk tahu role Anda
3. baca `Bagian 4` untuk tahu harus mulai dari halaman mana
4. baca `Bagian 5`, `6`, atau `7` sesuai role Anda
5. baca `Bagian 8` untuk mengenal halaman satu per satu
6. simpan `Bagian 9`, `10`, `11`, dan `12` untuk dibuka lagi saat Anda bingung

Kalau Anda sudah pernah memakai Clara tetapi masih suka bingung:

- buka `Bagian 5`, `6`, atau `7` sesuai role
- buka `Bagian 8` untuk panduan halaman
- buka `Bagian 9` untuk kondisi seperti `Overdue`, `Needs sync`, `High risk`, dan lain-lain

---

## 2. Apa Itu Clara

Clara adalah platform kerja harian untuk tim sales dan tim pengawasan sales.

Di Clara, beberapa pekerjaan yang biasanya tersebar di banyak tempat disatukan:

- chat customer
- daftar lead
- data customer
- jadwal follow-up
- review manager
- alert operasional
- knowledge atau jawaban resmi
- KPI dan insight tim

### Gambaran sederhananya

Bayangkan Clara seperti meja kerja besar:

- sisi kiri: chat customer masuk
- sisi tengah: lead, customer, dan follow-up dikerjakan
- sisi kanan: manager, head, dan superadmin memantau kualitas kerja tim

Jadi Clara bukan cuma CRM, dan juga bukan cuma chat tool. Clara adalah tempat kerja operasional harian.

### Alur kerja paling umum di Clara

1. chat customer masuk dari upload, extension, atau webhook
2. Clara membuat atau memperbarui `conversation`
3. Clara membuat atau memperbarui `lead`
4. Clara membuat atau memperbarui `customer profile`
5. AI membaca isi chat dan memberi analisis awal
6. sales menindaklanjuti chat atau lead
7. manager atau head mengecek kalau ada hambatan
8. knowledge dan KPI ikut terbentuk dari data yang sama

### Istilah yang paling penting

- `Conversation`
  - satu rangkaian chat customer
- `Lead`
  - satu peluang penjualan yang sedang dikerjakan
- `Customer Profile`
  - identitas customer yang dipakai lintas lead dan channel
- `Next follow-up`
  - jadwal tindakan berikutnya
- `Account category`
  - segmentasi akun seperti `Mini`, `Reguler`, atau `Belum ditentukan`
- `Temperature`
  - tingkat panasnya minat customer, misalnya `Cold`, `Warm`, atau `Hot`

---

## 3. Role Dan Hak Akses

Clara memakai 4 role utama:

- `sales`
- `manager`
- `head`
- `superadmin`

Urutan akses:

```text
superadmin > head > manager > sales
```

Artinya:

- `sales` fokus mengerjakan chat, lead, dan customer
- `manager` fokus melihat hambatan percakapan dan kualitas kerja tim
- `head` fokus mengawasi operasional dan governance
- `superadmin` punya akses tertinggi lintas organisasi

### Hal penting yang wajib dipahami

- `manager` dan `head` tidak memakai `Queue` dan `Action Center` sebagai tempat kerja utama
- `manager` dan `head` tetap bisa membaca chat lewat `Chat Review Center`
- `sales` fokus ke eksekusi
- `manager` fokus ke kualitas kerja dan bottleneck tim
- `head` fokus ke pengawasan operasional dan keputusan lintas tim

### Ringkasan akses per role

| Modul / Halaman | Sales | Manager | Head | Superadmin |
|---|---:|---:|---:|---:|
| Beranda `/dashboard` | Ya | Ya | Ya | Ya |
| Workflow Guide `/dashboard/start` | Ya | Ya | Ya | Ya |
| Queue `/dashboard/sales` | Ya | Tidak | Tidak | Ya |
| Conversation Detail `/dashboard/sales/conversations/:id` | Ya | Ya | Ya | Ya |
| Lead Management `/dashboard/crm` | Ya | Ya | Ya | Ya |
| Lead Detail `/dashboard/crm/:id` | Ya | Ya | Ya | Ya |
| Customer List `/dashboard/customers` | Ya | Ya | Ya | Ya |
| Customer Detail `/dashboard/customers/:id` | Ya | Ya | Ya | Ya |
| Action Center `/dashboard/follow-up` | Ya | Tidak | Tidak | Ya |
| Alert Center `/dashboard/notifications` | Ya | Ya | Ya | Ya |
| Lead Capture `/dashboard/upload` | Ya | Tidak | Tidak | Ya |
| Chat Review Center `/dashboard/approvals` | Tidak | Ya | Ya | Ya |
| Manager Insights `/dashboard/manager-insights` | Tidak | Ya | Ya | Ya |
| Channels `/dashboard/channels` | Tidak | Tidak | Ya | Ya |
| Knowledge Base `/dashboard/knowledge` | Tidak | Tidak | Ya | Ya |
| Ops Dashboard `/dashboard/kpi` | Tidak | Tidak | Ya | Ya |
| Marketing Insights `/dashboard/marketing` | Tidak | Tidak | Ya | Ya |
| Access Control `/dashboard/admin/access` | Tidak | Tidak | Ya | Ya |
| Admin Ops `/dashboard/admin/ops` | Tidak | Tidak | Ya | Ya |

---

## 4. Halaman Mana Yang Harus Dibuka Dulu

Kalau user lupa semua istilah di Clara, pakai aturan ini:

- `sales` mulai dari `Queue`
- `manager` mulai dari `Chat Review Center`
- `head` mulai dari `Alert Center`
- `superadmin` mulai dari `Ops Dashboard`

### Kalau tujuan Anda adalah...

#### Saya mau membalas customer

- role `sales`: buka `Queue`
- lalu buka `Conversation Detail`

#### Saya mau melihat lead yang harus dikejar

- buka `Lead Management`

#### Saya mau melihat profil customer

- buka `Customer List`
- lalu buka `Customer Detail`

#### Saya mau cek pekerjaan hari ini yang paling penting

- role `sales`: buka `Action Center`
- role `manager`: buka `Manager Insights` atau `Chat Review Center`
- role `head`: buka `Alert Center`

#### Saya mau mengecek chat tim yang macet

- buka `Chat Review Center`

#### Saya mau mengecek data customer yang belum rapi

- buka `Customer List`
- lalu pilih customer yang ingin diperiksa

#### Saya mau menambah chat baru ke sistem

- role `sales`: buka `Lead Capture`

---

## 5. Manual Sales

Bab ini dibuat khusus untuk user `sales`.

### 5.1 Tujuan kerja sales di Clara

Tugas sales di Clara sederhana kalau diringkas:

- baca chat yang masuk
- balas customer dengan benar
- rapikan lead
- rapikan customer profile jika perlu
- isi follow-up berikutnya
- jangan biarkan lead penting terlambat

### 5.2 Halaman yang paling sering dipakai sales

1. `Queue`
2. `Conversation Detail`
3. `Lead Management`
4. `Lead Detail`
5. `Customer List`
6. `Customer Detail`
7. `Action Center`
8. `Lead Capture`

### 5.3 Urutan kerja sales dari pagi sampai sore

#### Saat mulai kerja pagi

1. login ke Clara
2. buka `Queue`
3. baca chat yang paling baru atau paling penting
4. lihat apakah ada chat yang belum dianalisis
5. lihat badge `account category` kalau sudah ada

#### Saat mulai membalas customer

1. buka `Conversation Detail`
2. baca chat terakhir
3. lihat siapa yang bicara terakhir
4. pahami apa yang customer minta
5. jalankan `AI Analysis` jika belum ada
6. cek draft balasan
7. edit draft jika perlu
8. kirim balasan jika aman

#### Setelah selesai membalas

1. buka `Lead Management`
2. cari lead terkait
3. cek apakah stage sudah benar
4. isi `next follow-up`
5. kalau ada aktivitas penting, buka `Lead Detail`
6. isi `Log Disiplin Harian`

#### Saat data customer terasa belum rapi

1. buka `Customer List`
2. cari customer yang dimaksud
3. buka `Customer Detail`
4. cek nama, telepon, email, alamat, kategori akun, dan temperature
5. koreksi manual bila memang perlu

#### Saat menjelang siang atau sore

1. buka `Action Center`
2. cek item `Overdue`
3. kerjakan yang paling telat dulu
4. pastikan tidak ada lead panas yang dibiarkan

### 5.4 Kalau sales bingung harus menekan apa

#### Kalau customer baru mengirim chat

Yang dibuka:

- `Queue`

Yang dilakukan:

1. cari chat customer itu
2. buka detail jika perlu
3. baca konteks
4. balas

#### Kalau customer bertanya harga

Yang dilakukan:

1. baca chat terakhir
2. lihat AI analysis
3. cek draft
4. sesuaikan bahasa balasan

#### Kalau customer menanyakan legalitas

Yang dilakukan:

1. jangan balas asal
2. lihat apakah Clara sudah memberi arah yang aman
3. kalau perlu, minta review

#### Kalau lead bertanda `Overdue`

Yang dilakukan:

1. buka lead
2. cek apa follow-up yang seharusnya dilakukan
3. lakukan tindakan
4. isi `next follow-up` baru

#### Kalau lead bertanda `Disiplin stale`

Yang dilakukan:

1. buka `Lead Detail`
2. isi log aktivitas terbaru
3. tulis dengan bahasa singkat tapi jelas

#### Kalau customer profile terasa tidak cocok

Yang dilakukan:

1. buka `Customer Detail`
2. cek apakah nama, telepon, email, atau alamat sudah benar
3. cek `account category`
4. cek `temperature customer`
5. koreksi manual jika AI salah baca

### 5.5 Checklist cepat sales

Sebelum pulang atau selesai kerja hari itu, cek:

- apakah semua chat penting sudah dibaca
- apakah follow-up penting sudah punya jadwal
- apakah lead panas tidak dibiarkan
- apakah aktivitas penting sudah dicatat
- apakah data customer penting yang baru muncul sudah cukup rapi

### 5.6 Hal yang jangan dilakukan sales

- jangan kirim draft AI mentah untuk topik sensitif
- jangan membiarkan `Overdue` tanpa tindakan
- jangan menutup pekerjaan tanpa mengisi `next follow-up`
- jangan mengubah data deal kalau belum yakin
- jangan mengisi data customer palsu hanya supaya form cepat penuh

---

## 6. Manual Manager

Bab ini dibuat khusus untuk `manager`.

### 6.1 Tujuan kerja manager di Clara

Manager tidak fokus membalas semua chat satu per satu.

Fokus manager adalah:

- melihat chat tim yang macet
- melihat siapa anggota tim yang mulai longgar
- memberi coaching
- menjaga supaya lead penting tidak terlewat

### 6.2 Halaman yang paling sering dipakai manager

1. `Chat Review Center`
2. `Conversation Detail`
3. `Manager Insights`
4. `Lead Management`
5. `Lead Detail`
6. `Customer List`
7. `Customer Detail`
8. `Alert Center`

### 6.3 Urutan kerja manager

#### Saat mulai kerja

1. buka `Chat Review Center`
2. lihat item yang `high risk`, `stale`, atau `pending review`
3. pilih satu item yang paling penting

#### Saat membaca kasus chat tim

1. buka detail percakapan
2. baca chat terakhir
3. pahami apa yang membuat chat ini macet
4. lihat apakah sales perlu arahan, revisi, atau approval

#### Setelah selesai membaca chat

1. buka `Manager Insights`
2. lihat apakah ada team yang mulai longgar
3. lihat `coaching priority`
4. lihat `discipline by team`

#### Saat ada lead atau customer yang perlu diperiksa

1. buka `Lead Management`
2. cari lead yang `Hot`, `Overdue`, atau `Disiplin stale`
3. buka detail lead bila perlu
4. kalau data customer tampak membingungkan, buka `Customer Detail`

### 6.4 Keputusan manager yang paling sering

#### Jika chat perlu coaching

Yang dilakukan:

1. beri arahan yang jelas
2. jangan terlalu umum
3. tulis apa yang harus diperbaiki

#### Jika chat perlu approval

Yang dilakukan:

1. baca konteks penuh
2. pastikan jawabannya aman
3. baru beri keputusan

#### Jika ada anggota team mulai longgar

Yang dilakukan:

1. buka `Manager Insights`
2. cek team dan anggota
3. lihat apakah masalahnya di chat, follow-up, atau log disiplin

#### Jika profil customer terlihat janggal

Yang dilakukan:

1. buka `Customer Detail`
2. cek apakah customer ini terbaca dari banyak lead
3. cek kategori akun dan temperature
4. pastikan tim tidak membaca orang yang sama sebagai beberapa customer berbeda

### 6.5 Checklist cepat manager

- apakah ada chat high risk yang belum disentuh
- apakah ada team yang compliance-nya menurun
- apakah hot lead milik tim masih dijaga
- apakah coaching sudah spesifik dan bisa ditindaklanjuti
- apakah customer profile penting tidak membingungkan tim

### 6.6 Hal yang jangan dilakukan manager

- jangan menilai tim hanya dari satu chat
- jangan memberi coaching yang terlalu umum
- jangan mengabaikan `stale` atau `pending review`
- jangan membiarkan lead panas tanpa owner yang jelas

---

## 7. Manual Head Dan Superadmin

Bab ini dibuat terutama untuk `head`. `superadmin` bisa membacanya juga, lalu menambahkan sudut pandang lintas organisasi.

### 7.1 Tujuan kerja head di Clara

Head fokus ke pengawasan operasional dan keputusan lintas tim.

Fokus utamanya:

- melihat masalah tim dari level atas
- mengecek hambatan lintas team
- menjaga kualitas pipeline
- memastikan governance akses dan data tetap rapi

### 7.2 Halaman yang paling sering dipakai head

1. `Alert Center`
2. `Chat Review Center`
3. `Lead Management`
4. `Lead Detail`
5. `Customer List`
6. `Customer Detail`
7. `Ops Dashboard`
8. `Manager Insights`
9. `Access Control`
10. `Channels`
11. `Knowledge Base`

### 7.3 Urutan kerja head

#### Saat mulai kerja

1. buka `Alert Center`
2. baca alert aktif yang paling penting
3. lihat apakah ada masalah yang harus cepat diputuskan

#### Setelah itu

1. buka `Chat Review Center`
2. lihat chat atau bottleneck yang butuh campur tangan
3. turun ke detail jika perlu

#### Saat memeriksa pipeline

1. buka `Lead Management`
2. lihat lead `Hot`, `Overdue`, dan `Needs sync`
3. buka detail lead penting bila perlu

#### Saat memeriksa customer dan data kerja tim

1. buka `Customer List`
2. cari customer yang terasa penting atau bermasalah
3. buka `Customer Detail`
4. lihat apakah kategorinya sudah benar
5. lihat apakah data identitas masih rapi

#### Saat memeriksa kesehatan operasional

1. buka `Ops Dashboard`
2. lihat KPI tim
3. lihat apakah ada tekanan operasional

#### Saat perlu intervensi sistem

1. buka `Access Control`
2. cek apakah role dan akses sudah tepat
3. buka `Channels` jika ingin melihat sumber data
4. buka `Knowledge Base` jika ingin mengecek landasan jawaban resmi

### 7.4 Keputusan head yang paling sering

#### Jika ada alert aktif

Yang dilakukan:

1. pahami masalahnya
2. putuskan apakah cukup diproses
3. atau harus dinaikkan jadi perhatian organisasi

#### Jika ada bottleneck lintas tim

Yang dilakukan:

1. buka `Chat Review Center`
2. lihat pola yang berulang
3. cari apakah masalahnya di orang, proses, atau data

#### Jika KPI terasa tidak sehat

Yang dilakukan:

1. buka `Ops Dashboard`
2. cek snapshot
3. cek alert
4. turun ke lead atau chat bila perlu

#### Jika customer profile dan kategori akun terasa berantakan

Yang dilakukan:

1. buka `Customer Detail`
2. cek lead terkait
3. cek apakah account category perlu diseragamkan
4. pastikan tim punya konteks yang sama

### 7.5 Checklist cepat head

- apakah ada alert aktif yang belum jelas pemiliknya
- apakah ada bottleneck lintas team
- apakah hot lead penting dijaga
- apakah akses user masih sesuai struktur tim
- apakah jawaban sensitif punya landasan resmi
- apakah data customer penting tidak pecah

### 7.6 Hal yang jangan dilakukan head

- jangan mengambil keputusan hanya dari satu metrik
- jangan mengubah akses user tanpa alasan jelas
- jangan mengabaikan alert aktif yang berulang
- jangan membiarkan pipeline sehat hanya “terlihat sehat” tanpa verifikasi

---

## 8. Panduan Halaman Utama Satu Per Satu

Bagian ini adalah inti manual. Bacalah sesuai halaman yang paling sering Anda buka.

## 8.1 Beranda

### Fungsi halaman ini

Beranda adalah tempat untuk orientasi.

Halaman ini dipakai untuk:

- tahu kondisi kerja hari ini
- tahu halaman mana yang harus dibuka dulu
- melihat shortcut sesuai role

### Kapan harus buka Beranda

- saat baru login
- saat lupa mulai dari mana
- saat ingin kembali ke titik awal

### Kalau Anda bingung di Beranda

- jangan baca semua kartu terlalu lama
- langsung cari bagian `Langkah Berikutnya`
- ikuti tombol utama yang sesuai role Anda

## 8.2 Workflow Guide

### Fungsi halaman ini

Halaman ini adalah panduan cepat untuk user yang belum hafal alur Clara.

### Kapan harus buka

- saat onboarding user baru
- saat role user berubah
- saat tim bingung urutan kerja yang benar

## 8.3 Queue

### Role yang memakai

- `sales`
- `superadmin`

### Fungsi halaman ini

Queue adalah tempat kerja utama untuk chat customer.

### Apa yang biasanya terlihat

- daftar conversation
- search
- filter bucket kerja
- channel
- account category
- tombol cepat seperti:
  - `AI Analysis`
  - `Generate Draft`
  - `Buka Chat`

### Langkah kerja yang benar di Queue

1. buka `Queue`
2. gunakan filter jika perlu
3. pilih chat yang paling penting
4. baca preview singkat
5. kalau AI belum jalan, jalankan `AI Analysis`
6. kalau perlu draft, tekan `Generate Draft`
7. kalau butuh konteks penuh, tekan `Buka Chat`

### Hal yang harus dicari saat membaca satu row chat

- nama customer
- isi chat terakhir
- channel
- risk level
- account category
- apakah draft sudah ada
- apakah perlu review

### Jangan lakukan ini di Queue

- membuka semua chat satu per satu tanpa tujuan
- langsung membalas tanpa membaca konteks
- mengirim draft mentah AI untuk kasus sensitif

## 8.4 Conversation Detail

### Fungsi halaman ini

Halaman ini dipakai untuk melihat percakapan secara lengkap.

### Bagian yang biasanya ada

- transcript chat
- hasil AI analysis
- draft balasan
- review / coaching context
- sent logs
- account category
- lead context

### Urutan membaca Conversation Detail

1. baca chat terbaru dulu
2. lihat siapa bicara terakhir
3. pahami apa yang diminta customer
4. lihat AI analysis
5. lihat next action recommendation
6. lihat draft balasan
7. edit atau tindak lanjuti

### Catatan penting

- account category sekarang tampil di halaman chat
- kategori ini membantu Clara memilih knowledge `Mini` atau `Reguler`
- kalau kategorinya salah, perbaikannya biasanya dilakukan dari `Lead Detail` atau `Customer Detail`

## 8.5 Lead Capture

### Fungsi halaman ini

Dipakai untuk memasukkan chat baru ke Clara.

### Metode yang biasanya ada

- upload file TXT
- paste chat manual
- data dari extension

### Aturan baru yang wajib dipahami

Judul conversation sekarang **wajib diisi dengan nama customer**.

Tujuannya:

- supaya conversation tidak punya judul generik
- supaya customer profile awal lebih rapi
- supaya lead dan customer lebih mudah dicocokkan

### Cara pakai yang aman

1. buka `Lead Capture`
2. isi nama customer sebagai judul conversation
3. pilih cara input
4. tempel atau upload data
5. cek lagi isi chat
6. submit
7. cek hasil parsing
8. lanjut ke `Queue` atau `Lead Management`

### Yang harus diperiksa setelah submit

- apakah nama customer terbaca benar
- apakah isi chat lengkap
- apakah conversation terbentuk
- apakah lead ikut terbentuk
- apakah customer profile awal ikut masuk

## 8.6 Lead Management

### Fungsi halaman ini

Ini adalah halaman untuk membaca banyak lead secara cepat.

Tujuan utamanya bukan membaca semua lead satu per satu, tetapi menemukan:

- lead mana yang perlu tindakan
- lead mana yang terlambat
- lead mana yang belum sinkron
- lead mana yang perlu dibuka detailnya

### Apa yang biasanya terlihat

- ringkasan total lead
- search
- filter
- bucket lead
- list lead
- preview lead

### Cara kerja paling aman

1. buka `Lead Management`
2. lihat angka ringkasan di atas
3. cari angka yang tinggi pada:
   - `Needs tindakan`
   - `Overdue`
   - `Needs sync`
4. pilih bucket yang paling penting
5. baca lead satu per satu dari bucket itu
6. buka detail lead jika perlu

### Cara membaca satu kartu lead

Perhatikan:

- nama customer
- stage
- badge seperti `Overdue`, `Hot`, atau `Disiplin stale`
- owner
- kontak terakhir
- next follow-up
- account category

## 8.7 Lead Detail

### Fungsi halaman ini

Halaman ini adalah pusat kerja paling lengkap untuk satu lead.

### Bagian utama yang biasanya ada

- konteks lead
- log disiplin harian
- identitas customer terpadu
- metrik deal
- tugas follow-up
- timeline aktivitas

### Urutan membaca lead detail

1. lihat action plan di bagian atas
2. cek apakah follow-up sudah terlambat
3. cek apakah log disiplin stale
4. cek owner
5. cek next follow-up
6. cek metrik deal
7. cek `account category`
8. baru lihat task dan timeline

### Hal penting baru di halaman ini

- `account category` tampil jelas
- kategori ini bisa diisi manual
- kategori ini ikut mempengaruhi knowledge routing Clara

## 8.8 Customer List

### Fungsi halaman ini

Halaman ini dipakai untuk melihat daftar customer yang sudah dikenal Clara.

### Kapan harus buka

- saat Anda ingin mencari satu customer tertentu
- saat Anda merasa satu orang terbaca dari banyak lead
- saat Anda ingin rapikan identitas customer

### Yang biasanya terlihat

- daftar customer
- jumlah lead terkait
- kontak terakhir
- owner / PIC dominan
- tombol ke detail customer

### Cara pakai

1. buka `Customer List`
2. cari nama customer
3. buka detailnya
4. baru tentukan apakah perlu edit data

## 8.9 Customer Detail

### Fungsi halaman ini

Halaman ini dipakai untuk memahami satu customer secara utuh.

Ini sekarang adalah tempat untuk:

- melihat identitas customer
- melihat lead terkait
- melihat account category customer
- melihat temperature customer
- memperbaiki data identitas
- memutuskan lead mana yang paling penting dibaca dulu

### Bagian utama yang biasanya ada

- ringkasan customer
- apa yang harus dilakukan
- profil customer
- lead terkait
- data customer
- channel coverage

### Urutan membaca customer detail

1. lihat `Profil customer` dulu
2. cek nama, telepon, email, alamat, status, dan kategori akun
3. cek `temperature customer`
4. lihat lead terkait
5. buka lead prioritas kalau perlu
6. edit data hanya kalau memang yakin

### Field penting di profil customer

- `Nama customer`
- `Telepon`
- `Email`
- `Alamat`
- `Status customer`
- `Kategori akun`
- `Temperature customer`
- `Kekuatan identitas`

### Tentang kategori akun

Kategori akun bisa:

- terbaca otomatis oleh Clara dari hasil analisis
- diubah manual oleh user

Opsi yang biasanya ada:

- `Belum ditentukan`
- `Mini`
- `Reguler`

### Tentang temperature customer

Temperature bisa:

- diisi otomatis berdasarkan hasil analisa Clara
- diubah manual jika user yakin penilaian otomatis kurang tepat

Pilihan yang biasanya ada:

- `Belum ditentukan`
- `Cold`
- `Warm`
- `Hot`

### Tentang AI autofill

Clara bisa membantu mengisi otomatis:

- nama customer
- nomor telepon
- email
- alamat
- kategori akun
- temperature

Tetapi:

- user tetap boleh koreksi manual
- jangan isi data palsu bila masih ragu

## 8.10 Action Center

### Role yang memakai

- `sales`
- `superadmin`

### Fungsi halaman ini

Halaman ini adalah daftar pekerjaan harian yang paling perlu dibersihkan.

### Yang biasanya ada

- overdue
- due today
- hot lead
- item perlu analisis
- item siap kirim

### Cara pakai

1. buka `Action Center`
2. fokus ke bucket paling kritis
3. lihat item mana yang paling telat
4. kerjakan satu per satu
5. setelah selesai, pindah ke bucket berikutnya

## 8.11 Alert Center

### Fungsi halaman ini

Halaman ini dipakai untuk melihat sinyal operasional yang perlu perhatian.

### Arti status alert

- `active`
  - masih perlu tindakan
- `acknowledged`
  - sudah dilihat dan sedang diproses
- `resolved`
  - sudah selesai

### Cara pakai

1. fokus ke alert `active`
2. baca judul dan severity
3. pahami masalahnya
4. tentukan apakah cukup diakui, diselesaikan, atau dinaikkan

### Kapan Alert Center kosong

Kalau `active` kosong:

- itu bukan error
- artinya tidak ada alert aktif sekarang
- lanjutkan ke halaman kerja utama sesuai role

## 8.12 Chat Review Center

### Role yang memakai

- `manager`
- `head`
- `superadmin`

### Fungsi halaman ini

Halaman ini dipakai untuk melihat chat yang macet atau butuh perhatian khusus.

### Item yang biasanya masuk ke sini

- perlu analisis ulang
- butuh draft baru
- pending review
- escalation
- stale

### Cara pakai

1. buka `Chat Review Center`
2. filter kalau perlu
3. prioritaskan yang paling tinggi risikonya
4. buka detail chat
5. putuskan tindakan:
   - cukup dibimbing
   - perlu revisi
   - perlu approval
   - perlu escalation

### Kapan halaman ini kosong

Kalau kosong:

- berarti tidak ada bottleneck review saat ini
- ini bukan error
- lanjut ke `Manager Insights`, `Alert Center`, atau `Lead Management`

## 8.13 Manager Insights

### Fungsi halaman ini

Halaman ini dipakai untuk melihat kondisi tim secara ringkas.

### Section yang umum

- discipline by team
- coaching priority
- objection trend
- boundary alert

### Cara pakai

1. buka `Manager Insights`
2. lihat tim mana yang mulai longgar
3. klik team untuk melihat anggota bila perlu
4. lihat coaching priority
5. turun ke lead atau chat bila perlu detail

## 8.14 Channels

### Fungsi halaman ini

Halaman ini dipakai head dan superadmin untuk melihat sumber channel dan ingestion.

Yang dilihat:

- channel aktif
- sumber data
- volume data
- aktivitas terakhir

## 8.15 Knowledge Base

### Fungsi halaman ini

Tempat menyimpan jawaban resmi.

Halaman ini penting untuk topik sensitif seperti:

- legalitas
- kebijakan
- penjelasan produk resmi
- aturan yang tidak boleh salah

### Hal baru yang wajib dipahami

Knowledge sekarang dibedakan menurut kategori akun:

- knowledge `Mini`
- knowledge `Reguler`

Artinya:

- jawaban untuk akun `Mini` bisa berbeda dari akun `Reguler`
- user harus sadar kategori akun yang sedang dipakai sebelum terlalu percaya pada satu draft balasan

## 8.16 Ops Dashboard

### Fungsi halaman ini

Halaman ini dipakai untuk melihat performa operasional tim dan organisasi.

Yang dicari di sini:

- apakah pipeline sehat
- apakah ada tekanan operasional
- apakah ada alert KPI

## 8.17 Marketing Insights

### Fungsi halaman ini

Dipakai untuk membaca pola percakapan secara strategis.

Yang dicari:

- objection yang sering muncul
- tema percakapan yang berulang
- insight untuk konten atau intervensi pemasaran

## 8.18 Access Control

### Fungsi halaman ini

Dipakai untuk mengelola akun dan akses.

Yang bisa dilakukan:

- cari user
- lihat role
- lihat status aktif
- edit data dasar
- reset password sesuai batas akses
- nonaktifkan user

### Aturan penting

- role harus sekecil mungkin sesuai kebutuhan
- akun yang tidak dipakai harus dinonaktifkan
- jangan berbagi satu akun untuk banyak orang

## 8.19 Admin Ops

### Fungsi halaman ini

Dipakai untuk kebutuhan operasional tingkat admin atau governance.

Karena halaman ini bisa berubah sesuai implementasi, pakai hanya jika memang Anda punya tanggung jawab admin.

---

## 9. Contoh Situasi Nyata Dan Apa Yang Harus Dilakukan

Bagian ini dibuat khusus supaya user yang tidak terbiasa dengan sistem tetap cepat paham.

## 9.1 Saya melihat lead `Overdue`

Artinya:

- follow-up seharusnya sudah dilakukan, tapi belum selesai

Yang harus dilakukan:

1. buka lead
2. baca chat terakhir
3. tentukan tindakan berikutnya
4. isi `next follow-up` baru
5. kalau sudah ada aktivitas, isi log disiplin

## 9.2 Saya melihat `Disiplin stale`

Artinya:

- aktivitas sudah lama tidak dicatat

Yang harus dilakukan:

1. buka lead detail
2. isi log disiplin baru
3. tulis aktivitas terbaru secara jujur dan jelas

## 9.3 Saya melihat `Needs sync`

Artinya:

- data di lead belum cocok dengan kondisi deal sebenarnya

Yang harus dilakukan:

1. buka lead detail
2. periksa `Metrik Deal`
3. samakan status, nilai, atau catatan deal

## 9.4 Saya melihat chat `high risk`

Artinya:

- balasan berpotensi sensitif atau salah

Yang harus dilakukan:

1. jangan kirim draft mentah
2. baca konteks penuh
3. cek knowledge yang relevan
4. lihat kategori akun `Mini` atau `Reguler`
5. jika perlu, bawa ke review

## 9.5 Saya melihat `Alert active`

Artinya:

- ada masalah operasional yang masih berjalan

Yang harus dilakukan:

1. baca severity dan sumber alert
2. pahami apakah masalah ini milik Anda
3. kalau sedang dikerjakan, `acknowledge`
4. kalau sudah selesai, `resolve`
5. kalau butuh keputusan lebih tinggi, `escalate`

## 9.6 Chat Review Center kosong

Artinya:

- tidak ada bottleneck review sekarang

Yang harus dilakukan:

- lanjut ke `Manager Insights`
- atau `Lead Management`
- atau `Alert Center`

## 9.7 Alert Center kosong

Artinya:

- tidak ada alert aktif yang perlu ditangani sekarang

Yang harus dilakukan:

- sales: kembali ke `Queue` atau `Action Center`
- manager: kembali ke `Manager Insights`
- head: lihat `Ops Dashboard` atau `Lead Management`

## 9.8 Customer profile terlihat salah

Artinya:

- nama, nomor, kategori akun, atau temperature bisa terbaca kurang tepat

Yang harus dilakukan:

1. buka `Customer Detail`
2. cek lead terkait
3. cek data identitas
4. koreksi manual kalau Anda yakin
5. jangan isi asal jika masih ragu

---

## 10. Langkah Cepat Per Halaman Untuk User Yang Sudah Berumur

Bagian ini dibuat sangat langsung.

## Kalau Anda sales

### Mau balas customer

1. buka `Queue`
2. pilih chat
3. buka `Conversation Detail`
4. baca chat terakhir
5. buat atau cek draft
6. kirim balasan

### Mau lihat pekerjaan hari ini

1. buka `Action Center`
2. pilih yang `Overdue` dulu
3. selesaikan satu per satu

### Mau rapikan lead

1. buka `Lead Management`
2. pilih bucket `Needs tindakan` atau `Overdue`
3. buka lead
4. isi follow-up berikutnya

### Mau rapikan customer

1. buka `Customer List`
2. cari nama customer
3. buka detailnya
4. periksa kategori akun dan temperature

## Kalau Anda manager

### Mau lihat chat tim yang macet

1. buka `Chat Review Center`
2. pilih yang paling berisiko
3. buka detail
4. beri arahan atau keputusan

### Mau lihat tim yang mulai ketinggalan

1. buka `Manager Insights`
2. lihat `Discipline by Team`
3. klik team jika perlu

### Mau cek satu customer penting

1. buka `Customer List`
2. cari nama customer
3. buka detailnya
4. lihat lead mana yang harus dibaca dulu

## Kalau Anda head

### Mau lihat masalah tim hari ini

1. buka `Alert Center`
2. baca alert aktif
3. buka `Chat Review Center` kalau perlu
4. buka `Lead Management` kalau ingin lihat lead yang tertahan

### Mau cek data customer yang membingungkan

1. buka `Customer List`
2. pilih customer
3. cek kategori akun, temperature, dan lead terkait

---

## 11. Troubleshooting

## 11.1 Kenapa Queue kosong

Kemungkinan:

- memang tidak ada conversation aktif
- chat belum masuk ke sistem
- filter terlalu ketat
- role Anda bukan `sales` atau `superadmin`

Yang harus dilakukan:

1. cek filter
2. cek apakah chat baru sudah diinput
3. cek role Anda

## 11.2 Kenapa Lead Management penuh badge merah

Artinya:

- sistem sedang menunjukkan prioritas yang harus dibereskan

Kerjakan dengan urutan ini:

1. `Overdue`
2. `Hot`
3. `Needs sync`
4. `Disiplin stale`

## 11.3 Kenapa saya tidak bisa membuka halaman tertentu

Kemungkinan:

- role Anda tidak punya akses
- scope team atau unit membatasi data
- halaman itu memang untuk role lain

Yang harus dilakukan:

- cek role Anda
- minta head atau superadmin mengecek akses bila perlu

## 11.4 Kenapa data terasa kosong

Kemungkinan:

- memang tidak ada item aktif
- filter sedang aktif
- Anda sedang melihat history kosong

Jangan langsung panik. Cek dulu:

1. filter
2. status aktif / archive
3. scope data Anda

## 11.5 Kenapa kategori akun belum muncul

Kemungkinan:

- Clara belum cukup yakin membaca kategori akun
- lead atau customer belum dianalisis
- nilai masih `Belum ditentukan`

Yang harus dilakukan:

1. cek apakah AI analysis sudah dijalankan
2. buka `Lead Detail` atau `Customer Detail`
3. isi manual jika Anda yakin

## 11.6 Kenapa temperature customer berbeda dengan lead

Kemungkinan:

- customer temperature pernah dioverride manual
- lead baru memberi sinyal yang berbeda

Yang harus dilakukan:

1. buka `Customer Detail`
2. lihat nilai temperature customer
3. putuskan apakah perlu disesuaikan manual

---

## 12. Praktik Aman Saat Memakai Clara

Walau ini manual user, keamanan tetap penting.

Lakukan ini:

- pakai akun Anda sendiri
- logout jika memakai perangkat bersama
- pakai password yang kuat
- gunakan knowledge resmi untuk topik sensitif
- ubah status hanya jika Anda benar-benar paham artinya
- cek kategori akun sebelum terlalu percaya pada draft produk

Jangan lakukan ini:

- berbagi akun dengan rekan kerja
- menyimpan password di catatan terbuka
- mengirim jawaban sensitif tanpa review
- mengubah data deal tanpa dasar yang jelas
- menebak-nebak legalitas atau kebijakan
- mengisi data customer palsu

---

## 13. Arti Istilah Dan Badge Yang Sering Muncul

### Istilah dasar

- `Conversation`
  - satu rangkaian chat customer
- `Lead`
  - calon customer atau peluang penjualan
- `Customer Profile`
  - identitas customer lintas lead dan channel
- `Owner`
  - penanggung jawab data
- `Next follow-up`
  - jadwal tindakan berikutnya
- `Account category`
  - jenis akun seperti `Mini` atau `Reguler`
- `Customer temperature`
  - panas atau dinginnya minat customer

### Badge umum

- `Overdue`
  - sudah lewat jadwal
- `Hot`
  - penting dan mendesak
- `Needs sync`
  - data belum cocok
- `Disiplin stale`
  - log aktivitas sudah lama tidak diupdate
- `Active`
  - sedang berjalan
- `Acknowledged`
  - sudah dilihat dan sedang diproses
- `Resolved`
  - sudah selesai
- `Escalated`
  - dinaikkan ke level keputusan berikutnya

---

## 14. Checklist Onboarding User Baru

## 14.1 Untuk Sales

Latihan pertama yang disarankan:

1. login
2. buka `Workflow Guide`
3. buka `Lead Capture`
4. isi nama customer sebagai judul conversation
5. masukkan 1 chat
6. buka `Queue`
7. jalankan AI analysis
8. buka `Conversation Detail`
9. buka `Lead Management`
10. isi follow-up
11. isi log disiplin
12. buka `Customer Detail`
13. cek apakah kategori akun dan temperature sudah masuk

## 14.2 Untuk Manager

1. login
2. buka `Workflow Guide`
3. buka `Chat Review Center`
4. buka 1 case review
5. buka `Manager Insights`
6. cek 1 team
7. buka 1 lead penting
8. buka 1 customer penting

## 14.3 Untuk Head

1. login
2. buka `Alert Center`
3. buka `Chat Review Center`
4. buka `Lead Management`
5. buka `Customer List`
6. buka `Ops Dashboard`
7. buka `Access Control`

---

## 15. Ringkasan Super Singkat

Kalau Anda lupa semua isi manual ini, ingat 5 hal saja:

- `sales` kerja dari `Queue`
- `manager` kerja dari `Chat Review Center`
- `head` kerja dari `Alert Center`
- semua masalah lead dibereskan di `Lead Management` dan `Lead Detail`
- semua masalah identitas customer dibereskan di `Customer List` dan `Customer Detail`

Kalau Anda bingung melihat satu item:

- chat -> buka `Conversation Detail`
- lead -> buka `Lead Detail`
- customer -> buka `Customer Detail`
- alert -> baca statusnya, lalu tentukan `acknowledge`, `resolve`, atau `escalate`

---

## 16. Penutup

Clara paling mudah dipakai kalau user tidak mencoba menghafal semua modul sekaligus.

Mulailah dari:

- role Anda
- halaman kerja utama Anda
- satu tindakan kecil yang paling penting hari ini

Kalau user sudah menguasai itu, Clara akan jauh lebih mudah dipahami.

Dokumen ini sebaiknya diperbarui lagi bila:

- ada halaman baru
- ada perubahan akses role
- ada perubahan istilah kerja
- ada perubahan besar pada customer intelligence atau knowledge routing
