# CLARA Head Manual

Manual ini dibuat khusus untuk user `head` di Clara.

Tujuannya:

- membantu head cepat paham halaman yang memang dipakai head
- menjelaskan urutan kerja harian head
- menjelaskan cara membaca alert, bottleneck lintas tim, KPI, dan governance
- menjelaskan kapan harus turun ke lead atau customer detail

Kalau harus diingat dalam satu kalimat:

> Tugas head di Clara adalah menjaga ritme operasional tim, melihat masalah dari level atas, lalu turun ke detail hanya saat keputusan atau intervensi benar-benar diperlukan.

---

## 1. Clara Dipakai Untuk Apa Oleh Head

Untuk head, Clara dipakai untuk:

- melihat alert aktif
- melihat bottleneck lintas tim
- memastikan lead penting tidak tertahan
- mengecek customer intelligence yang berdampak ke banyak lead
- memantau KPI operasional
- menjaga governance akses dan kualitas knowledge

Jadi fokus head adalah:

- pengawasan operasional
- keputusan lintas tim
- kualitas pipeline
- governance akses dan knowledge

---

## 2. Halaman Yang Paling Sering Dipakai Head

Urutan halaman yang paling sering dipakai head:

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

Aturan paling sederhana:

- kalau mau lihat masalah hari ini: buka `Alert Center`
- kalau mau lihat bottleneck chat: buka `Chat Review Center`
- kalau mau lihat lead yang tertahan: buka `Lead Management`
- kalau mau lihat kesehatan operasional: buka `Ops Dashboard`
- kalau mau cek akses dan struktur user: buka `Access Control`

---

## 3. Alur Kerja Harian Head

### Saat mulai kerja

1. login ke Clara
2. buka `Alert Center`
3. baca alert aktif yang paling penting
4. lihat apakah ada masalah yang butuh keputusan cepat

### Setelah itu

1. buka `Chat Review Center`
2. lihat chat atau bottleneck yang butuh campur tangan
3. kalau perlu, buka `Conversation Detail`

### Saat memeriksa pipeline

1. buka `Lead Management`
2. lihat lead `Hot`, `Overdue`, dan `Needs sync`
3. buka `Lead Detail` jika perlu melihat konteks penuh

### Saat memeriksa customer dan data kerja tim

1. buka `Customer List`
2. cari customer yang terasa penting atau bermasalah
3. buka `Customer Detail`
4. lihat apakah kategori akun sudah tepat
5. lihat apakah data identitas masih rapi

### Saat memeriksa kesehatan operasional

1. buka `Ops Dashboard`
2. lihat KPI tim
3. lihat apakah ada tekanan operasional
4. cek apakah bottleneck di alert dan review sejalan dengan KPI

### Saat perlu intervensi sistem

1. buka `Access Control`
2. cek apakah role dan akses sudah tepat
3. buka `Channels` jika ingin melihat sumber data
4. buka `Knowledge Base` jika ingin mengecek landasan jawaban resmi

---

## 4. Urutan Kerja Yang Paling Aman

Kalau Anda bingung harus mulai dari mana, pakai urutan ini:

1. `Alert Center`
2. `Chat Review Center`
3. `Lead Management`
4. `Lead Detail`
5. `Customer Detail`
6. `Ops Dashboard`
7. `Access Control`
8. `Knowledge Base`

Alasannya:

- `Alert Center` dipakai untuk tahu apakah ada masalah aktif
- `Chat Review Center` dipakai untuk melihat bottleneck manusia
- `Lead Management` dipakai untuk melihat dampaknya di pipeline
- `Customer Detail` dipakai jika masalahnya menyentuh identitas atau segmentasi customer
- `Ops Dashboard` dipakai untuk membaca tekanan operasional dari atas
- `Access Control` dan `Knowledge Base` dipakai untuk menjaga governance

---

## 5. Panduan Halaman Satu Per Satu

## 5.1 Alert Center

### Fungsi halaman ini

Ini adalah titik masuk utama head untuk membaca masalah operasional yang aktif.

### Yang biasanya terlihat

- alert `active`
- `acknowledged`
- `resolved`
- severity
- sumber alert

### Cara pakai

1. fokus ke alert `active`
2. baca judul dan severity
3. pahami apakah masalah ini cukup ditangani tim
4. tentukan apakah perlu keputusan lebih tinggi

### Jangan lakukan ini

- mengabaikan alert aktif yang berulang
- menyelesaikan alert tanpa verifikasi
- hanya membaca angka tanpa turun ke konteks

---

## 5.2 Chat Review Center

### Fungsi halaman ini

Dipakai untuk melihat chat yang macet atau butuh perhatian khusus dari level head.

### Yang biasanya masuk ke sini

- high risk
- stale
- pending review
- escalation

### Cara pakai

1. buka `Chat Review Center`
2. prioritaskan item yang paling berisiko
3. buka detail chat
4. tentukan apakah cukup dibimbing, direvisi, atau perlu keputusan lebih tinggi

---

## 5.3 Lead Management

### Fungsi halaman ini

Dipakai head untuk melihat apakah pipeline tertahan di area tertentu.

### Fokus utama head

- `Hot`
- `Overdue`
- `Needs sync`
- `Disiplin stale`

### Cara pakai

1. buka `Lead Management`
2. lihat bucket yang paling bermasalah
3. pilih lead yang berdampak besar
4. buka detail jika perlu

---

## 5.4 Lead Detail

### Fungsi halaman ini

Dipakai head untuk memahami satu lead secara lengkap saat perlu intervensi.

### Yang harus diperiksa

- stage
- owner
- next follow-up
- log disiplin
- metrik deal
- account category

### Tanda lead perlu perhatian head

- lead panas tanpa next step jelas
- owner tidak jelas
- metrik deal tidak sinkron
- banyak perubahan tapi log lemah

---

## 5.5 Customer List

### Fungsi halaman ini

Dipakai head untuk mencari customer yang ingin diperiksa dari sudut pandang operasional dan kualitas data.

### Kapan harus buka

- saat satu customer terkait ke banyak lead
- saat kategori akun terasa salah
- saat tim terlihat membaca customer yang sama sebagai orang berbeda

---

## 5.6 Customer Detail

### Fungsi halaman ini

Dipakai untuk memahami satu customer secara utuh dari sudut pandang pengawasan.

### Yang harus diperiksa

- nama customer
- telepon
- email
- alamat
- kategori akun
- temperature customer
- lead terkait

### Kenapa halaman ini penting untuk head

Karena masalah operasional kadang bukan cuma di chat, tetapi di:

- customer yang pecah ke banyak lead
- segmentasi akun yang salah
- temperature yang tidak sesuai konteks

### Tentang kategori akun

Kategori akun bisa:

- terbaca otomatis oleh Clara
- diubah manual jika memang perlu

Pilihan yang biasanya ada:

- `Belum ditentukan`
- `Mini`
- `Reguler`

### Tentang temperature customer

Temperature customer bisa:

- diisi otomatis oleh Clara
- diubah manual jika memang perlu

Pilihan yang biasanya ada:

- `Belum ditentukan`
- `Cold`
- `Warm`
- `Hot`

---

## 5.7 Ops Dashboard

### Fungsi halaman ini

Dipakai untuk melihat performa operasional tim dan organisasi.

### Yang dicari di sini

- apakah pipeline sehat
- apakah ada tekanan operasional
- apakah ada alert KPI
- apakah masalah di alert sejalan dengan angka besar

### Cara pakai

1. buka `Ops Dashboard`
2. lihat KPI yang paling menonjol
3. jangan berhenti di angka
4. cocokkan dengan alert, review, atau lead yang relevan

---

## 5.8 Manager Insights

### Fungsi halaman ini

Dipakai untuk membaca kondisi tim dari level menengah sebelum mengambil keputusan lintas tim.

### Yang biasanya diperiksa head

- team mana yang mulai longgar
- team mana yang punya coaching priority tinggi
- apakah pola hambatan hanya terjadi di satu team atau banyak team

---

## 5.9 Access Control

### Fungsi halaman ini

Dipakai untuk mengelola akun dan akses.

### Yang bisa dilakukan

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

---

## 5.10 Channels

### Fungsi halaman ini

Dipakai untuk melihat sumber channel dan ingestion.

Yang dilihat:

- channel aktif
- sumber data
- volume data
- aktivitas terakhir

---

## 5.11 Knowledge Base

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
- head harus sadar kategori akun yang sedang dipakai sebelum menilai apakah satu draft sudah aman

---

## 6. Apa Yang Harus Dilakukan Kalau Melihat Kondisi Ini

## 6.1 Ada alert aktif

Artinya:

- ada masalah operasional yang masih berjalan

Yang harus dilakukan:

1. pahami masalahnya
2. putuskan apakah cukup diproses
3. atau harus dinaikkan jadi perhatian organisasi

## 6.2 Ada bottleneck lintas tim

Artinya:

- masalah tidak lagi berhenti di satu sales atau satu manager

Yang harus dilakukan:

1. buka `Chat Review Center`
2. lihat pola yang berulang
3. cari apakah masalahnya di orang, proses, atau data

## 6.3 KPI terasa tidak sehat

Artinya:

- ada tekanan operasional yang perlu diverifikasi

Yang harus dilakukan:

1. buka `Ops Dashboard`
2. cek snapshot
3. cek alert
4. turun ke lead atau chat bila perlu

## 6.4 Customer profile dan kategori akun terasa berantakan

Artinya:

- tim mungkin tidak bekerja dengan konteks customer yang sama

Yang harus dilakukan:

1. buka `Customer Detail`
2. cek lead terkait
3. cek apakah account category perlu diseragamkan
4. pastikan tim punya konteks yang sama

## 6.5 Akses user terasa terlalu luas atau terlalu sempit

Artinya:

- ada risiko governance atau akses kerja tidak tepat

Yang harus dilakukan:

1. buka `Access Control`
2. cek role dan status user
3. pastikan akses sesuai kebutuhan kerja

---

## 7. Checklist Cepat Head

Sebelum selesai kerja hari itu, cek:

- apakah ada alert aktif yang belum jelas pemiliknya
- apakah ada bottleneck lintas team
- apakah hot lead penting dijaga
- apakah akses user masih sesuai struktur tim
- apakah jawaban sensitif punya landasan resmi
- apakah data customer penting tidak pecah

---

## 8. Hal Yang Jangan Dilakukan Head

- jangan mengambil keputusan hanya dari satu metrik
- jangan mengubah akses user tanpa alasan jelas
- jangan mengabaikan alert aktif yang berulang
- jangan membiarkan pipeline sehat hanya “terlihat sehat” tanpa verifikasi
- jangan menganggap semua masalah tim berasal dari orang, kadang masalahnya justru di data atau alur kerja

---

## 9. Troubleshooting Singkat

## 9.1 Kenapa Alert Center kosong

Kemungkinan:

- memang tidak ada alert aktif sekarang
- Anda sedang melihat status yang bukan `active`

Yang harus dilakukan:

1. cek filter
2. kalau memang kosong, lanjut ke `Chat Review Center`, `Lead Management`, atau `Ops Dashboard`

## 9.2 Kenapa Chat Review Center kosong

Kemungkinan:

- memang tidak ada bottleneck review saat ini
- filter terlalu ketat

Yang harus dilakukan:

1. cek filter
2. lanjut ke `Manager Insights`
3. atau buka `Lead Management`

## 9.3 Kenapa KPI terasa buruk tapi detailnya tidak jelas

Kemungkinan:

- angka ringkasan perlu diverifikasi di lead, alert, atau chat

Yang harus dilakukan:

1. buka `Alert Center`
2. buka `Lead Management`
3. buka `Chat Review Center`
4. cocokkan masalah besar dengan kasus nyata

## 9.4 Kenapa kategori akun belum muncul

Kemungkinan:

- Clara belum cukup yakin membaca kategori akun
- analisis chat belum dijalankan

Yang harus dilakukan:

1. cek apakah AI analysis sudah ada
2. buka `Lead Detail` atau `Customer Detail`
3. verifikasi bersama tim jika perlu

---

## 10. Ringkasan Super Singkat

Kalau Anda lupa semua isi manual ini, ingat 5 hal:

- mulai kerja dari `Alert Center`
- lihat bottleneck manusia dari `Chat Review Center`
- lihat dampaknya di `Lead Management`
- lihat gambaran besarnya di `Ops Dashboard`
- jaga governance lewat `Access Control` dan `Knowledge Base`

Kalau Anda bingung melihat satu item:

- alert -> baca severity dan status
- chat -> buka `Conversation Detail`
- lead -> buka `Lead Detail`
- customer -> buka `Customer Detail`

---

## 11. Penutup

Clara paling mudah dipakai head kalau fokusnya tetap dijaga:

- lihat masalah dari atas
- tentukan prioritas
- cek apakah masalah ada di orang, proses, atau data
- intervensi hanya di tempat yang memang perlu

Kalau empat hal itu dijaga, Clara akan jauh lebih berguna sebagai alat pengawasan operasional, bukan sekadar dashboard angka.
